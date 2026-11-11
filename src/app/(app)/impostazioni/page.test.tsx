import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import ImpostazioniPage from "./page";
import { db } from "@/lib/db/database";
import type { VoceOutbox } from "@/lib/sync/outbox";
import { azzeraStatoGiri, segnaFineGiro } from "@/lib/sync/statoSincronizzazione";

// L'elenco di Impostazioni: qui solo la riga Sincronizzazione (dal 10/10,
// mockup docs/mockups/sincronizzazione.html, "2 · Pallino + testo"). Le
// altre righe hanno i loro test sulle funzioni dei testi (rigaObiettivi,
// testiPeso). Testi e toni per i sei stati: rigaSincronizzazione.test.ts.

const USER_ID = "utente-test-elenco-impostazioni";

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
  useNomeUtente: () => "Prova",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

function voce(id: string): VoceOutbox {
  return {
    id: `misurazioni:${id}`,
    tabella: "misurazioni",
    record_id: id,
    dati: { id, user_id: USER_ID, updated_at: "2026-10-10T12:00:00.000Z", deleted_at: null },
    creato_il: "2026-10-10T12:00:00.000Z",
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
  };
}

beforeEach(async () => {
  window.localStorage.clear();
  azzeraStatoGiri();
  await db.outbox.clear();
});

afterEach(cleanup);

function rigaSincronizzazione() {
  return screen.getByRole("link", { name: /^Sincronizzazione/ });
}

describe("Impostazioni — la riga Sincronizzazione", () => {
  it("tutto salvato: testo grigio come gli altri valori, pallino verde", async () => {
    segnaFineGiro("discesa", "ok", { parlatoColServer: true });
    render(<ImpostazioniPage />);

    const testo = await screen.findByText("Tutto salvato");
    expect(rigaSincronizzazione().contains(testo)).toBe(true);
    expect(testo.className).not.toContain("text-warning");
    expect(testo.querySelector("[aria-hidden]")!.className).toContain("bg-accent");
  });

  it("modifiche in attesa: quante, in ocra", async () => {
    await db.outbox.bulkPut([voce("m1"), voce("m2")]);
    segnaFineGiro("salita", "rete", { parlatoColServer: false });
    render(<ImpostazioniPage />);

    const testo = await screen.findByText("2 in attesa");
    expect(rigaSincronizzazione().contains(testo)).toBe(true);
    expect(testo.className).toContain("text-pending");
  });

  it("il server rifiuta: Errore, in arancio", async () => {
    await db.outbox.put(voce("m1"));
    segnaFineGiro("salita", "errore", { parlatoColServer: false });
    render(<ImpostazioniPage />);

    const testo = await screen.findByText("Errore");
    expect(rigaSincronizzazione().contains(testo)).toBe(true);
    expect(testo.className).toContain("text-warning");
  });
});

// Il gruppo «I tuoi dati» (dal 08/11, branch esporta; mockup
// docs/mockups/esporta.html): fra App e Informazioni, la riga verso Esporta
// e il promemoria nella nota del gruppo.
describe("Impostazioni — il gruppo I tuoi dati", () => {
  it("fra App e Informazioni, con la riga verso Esporta e «Mai esportato»", async () => {
    render(<ImpostazioniPage />);
    const riga = screen.getByRole("link", { name: /^Esporta i miei dati/ });
    expect(riga.getAttribute("href")).toBe("/impostazioni/esporta");
    expect(await screen.findByText("Mai esportato")).toBeTruthy();

    // L'ordine dei titoli e delle righe nella pagina.
    const testo = document.body.textContent ?? "";
    const app = testo.indexOf("Sincronizzazione");
    const tuoiDati = testo.indexOf("I tuoi dati");
    const informazioni = testo.indexOf("Informazioni");
    expect(app).toBeLessThan(tuoiDati);
    expect(tuoiDati).toBeLessThan(informazioni);
  });

  it("dopo un'esportazione: «Ultima esportazione: oggi», e si aggiorna senza ricaricare", async () => {
    const { segnaEsportazione, togliUltimaEsportazione } =
      await import("@/lib/esporta/ultimaEsportazione");
    render(<ImpostazioniPage />);
    expect(await screen.findByText("Mai esportato")).toBeTruthy();
    act(() => segnaEsportazione(USER_ID));
    expect(await screen.findByText("Ultima esportazione: oggi")).toBeTruthy();
    act(() => togliUltimaEsportazione(USER_ID));
    expect(await screen.findByText("Mai esportato")).toBeTruthy();
  });
});
