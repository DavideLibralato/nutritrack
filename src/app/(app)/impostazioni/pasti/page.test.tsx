import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react";
import PastiEOrariPage from "./page";
import { db } from "@/lib/db/database";
import type { Pasto, VoceDiario } from "@/lib/db/tipi";
import { giornoPrecedente, oggiLocale } from "@/lib/dataGiorno";

// La pagina Pasti e orari (passo 3, PUNTO_DI_PARTENZA.md sezione 3, "Pasti
// e orari"): qui si controlla che la pagina scelga giusto quando chiedere
// "da quando", cosa bloccare e cosa scrivere. Regole e scritture hanno i
// loro test in controlliPasti.test.ts e modifichePasti.test.ts.

const USER_ID = "utente-test-pasti-orari";
const OGGI = oggiLocale();
const IERI = giornoPrecedente(OGGI);

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

// Server irraggiungibile: le scritture restano in Dexie e in coda.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ upsert: async () => ({ error: { message: "offline" } }) }),
  }),
}));

afterEach(cleanup);

function riga(id: string, nome: string, ora_inizio: string, altro: Partial<Pasto> = {}): Pasto {
  return {
    id, nome, ora_inizio, ordine: 0, user_id: USER_ID,
    updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null, valido_dal: null, valido_al: null, ...altro,
  };
}

function voce(id: string, pasto_id: string, data: string): VoceDiario {
  return {
    id, user_id: USER_ID, updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null,
    alimento_id: "a1", pasto_id, gruppo_id: null, quantita_g: 100, data,
    creato_il: "2026-10-01T00:00:00.000Z", consumato_alle: null,
    nome_alimento: "Mela", kcal_100g: 52, proteine_100g: 0.3, carboidrati_100g: 14, grassi_100g: 0.2,
  };
}

beforeEach(async () => {
  await Promise.all([db.pasti.clear(), db.voci_diario.clear(), db.outbox.clear()]);
  await db.pasti.bulkPut([
    riga("cena", "Cena", "19:30:00", { ordine: 4 }),
    riga("colazione", "Colazione", "06:00", { ordine: 0 }),
    riga("pranzo", "Pranzo", "12:30", { ordine: 2 }),
    // Chiuso ieri: non compare, ma il suo nome c'è nei giorni passati.
    riga("merenda", "Merenda", "16:00", { ordine: 3, valido_al: IERI }),
  ]);
  await db.voci_diario.bulkPut([voce("v-oggi", "pranzo", OGGI), voce("v-ieri", "pranzo", IERI)]);
});

async function apriPasto(nome: string) {
  render(<PastiEOrariPage />);
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${nome}`) }));
  return screen.getByRole("dialog");
}

function scrivi(sheet: HTMLElement, etichetta: string, valore: string) {
  fireEvent.change(within(sheet).getByLabelText(etichetta), { target: { value: valore } });
}

describe("Pagina Pasti e orari", () => {
  it("mostra i pasti di oggi in ordine d'orario, con l'ora sui primi 5 caratteri", async () => {
    render(<PastiEOrariPage />);
    await screen.findByRole("button", { name: /^Colazione/ });
    const righe = screen.getAllByRole("button").map((b) => b.textContent);
    expect(righe.slice(0, 3)).toEqual(["Colazione06:00", "Pranzo12:30", "Cena19:30"]);
    expect(screen.queryByText("Merenda")).toBeNull();
  });

  it("solo l'ora: si scrive subito, senza domanda, e Annulla la rimette", async () => {
    const sheet = await apriPasto("Cena");
    scrivi(sheet, "Inizia alle", "20:00");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    await waitFor(async () => expect((await db.pasti.get("cena"))?.ora_inizio).toBe("20:00"));
    expect(screen.queryByText("Da quando vale?")).toBeNull();
    // L'"Annulla" della barra, non quello dello sheet: la scrittura in
    // Dexie finisce un attimo prima che lo sheet si chiuda, e cercare il
    // pulsante per nome in quell'attimo trovava quello dello sheet (test
    // instabile, 2 volte su 5).
    const barra = await screen.findByRole("status");
    expect(barra.textContent).toContain("Orario cambiato:");
    fireEvent.click(within(barra).getByRole("button", { name: "Annulla" }));
    await waitFor(async () => expect((await db.pasti.get("cena"))?.ora_inizio).toBe("19:30:00"));
  });

  it("un'ora già usata resta nello sheet con l'errore sotto il campo", async () => {
    const sheet = await apriPasto("Cena");
    scrivi(sheet, "Inizia alle", "12:30");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));
    expect(await within(sheet).findByText("Alle 12:30 inizia già Pranzo.")).toBeTruthy();
    expect((await db.pasti.get("cena"))?.ora_inizio).toBe("19:30:00");
  });

  it("nome nuovo: chiede da quando, con Da oggi già scelto, e sposta le voci di oggi", async () => {
    const sheet = await apriPasto("Pranzo");
    scrivi(sheet, "Nome", "Pranzo 1");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    const domanda = await screen.findByRole("dialog", { name: "«Pranzo» diventa «Pranzo 1»" });
    expect(within(domanda).getByRole("button", { name: /^Da oggi/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(domanda).getByRole("button", { name: "Rinomina" }));

    await waitFor(async () => expect((await db.pasti.get("pranzo"))?.valido_al).toBe(IERI));
    const nuovo = (await db.pasti.toArray()).find((p) => p.nome === "Pranzo 1");
    expect(nuovo).toMatchObject({ valido_dal: OGGI, valido_al: null });
    expect((await db.voci_diario.get("v-oggi"))?.pasto_id).toBe(nuovo?.id);
    expect((await db.voci_diario.get("v-ieri"))?.pasto_id).toBe("pranzo");
  });

  it("Correggi è bloccato se il nome nuovo c'è già nei giorni passati", async () => {
    const sheet = await apriPasto("Pranzo");
    scrivi(sheet, "Nome", "merenda");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    const domanda = await screen.findByRole("dialog", { name: /diventa/ });
    const correggi = within(domanda).getByRole("button", { name: /^Correggi/ }) as HTMLButtonElement;
    expect(correggi.disabled).toBe(true);
    expect(within(domanda).getByText("Nei giorni passati c'è già un pasto con questo nome.")).toBeTruthy();
  });

  it("solo maiuscole, o pasto nato oggi: si corregge senza domanda", async () => {
    await db.pasti.put(riga("spuntino", "Spuntino", "10:00", { ordine: 1, valido_dal: OGGI }));
    const sheet = await apriPasto("Spuntino");
    scrivi(sheet, "Nome", "Spuntino mattina");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));
    await waitFor(async () => expect((await db.pasti.get("spuntino"))?.nome).toBe("Spuntino mattina"));
    expect(screen.queryByText("Da quando vale?")).toBeNull();
    cleanup();

    const sheet2 = await apriPasto("Cena");
    scrivi(sheet2, "Nome", "cena");
    fireEvent.click(within(sheet2).getByRole("button", { name: "Salva" }));
    await waitFor(async () => expect((await db.pasti.get("cena"))?.nome).toBe("cena"));
    expect(screen.queryByText("Da quando vale?")).toBeNull();
  });

  it("Aggiungi pasto: nessuna ora proposta, e 'giorni passati' bloccato se lì il nome c'è già", async () => {
    render(<PastiEOrariPage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Aggiungi pasto" }));
    const sheet = screen.getByRole("dialog");
    expect((within(sheet).getByLabelText("Inizia alle") as HTMLInputElement).value).toBe("");

    scrivi(sheet, "Nome", "Merenda");
    scrivi(sheet, "Inizia alle", "16:30");
    fireEvent.click(within(sheet).getByRole("button", { name: "Salva" }));

    const domanda = await screen.findByRole("dialog", { name: "Da quando c'è «Merenda»?" });
    expect((within(domanda).getByRole("button", { name: /^Anche nei giorni passati/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(domanda).getByRole("button", { name: "Aggiungi pasto" }));

    await waitFor(async () => {
      const nuovo = (await db.pasti.toArray()).find((p) => p.nome === "Merenda" && p.id !== "merenda");
      expect(nuovo).toMatchObject({ ora_inizio: "16:30", valido_dal: OGGI, valido_al: null, ordine: 5 });
    });
  });
});
