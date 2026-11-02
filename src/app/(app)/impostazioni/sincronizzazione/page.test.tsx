import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, act } from "@testing-library/react";
import SincronizzazionePage from "./page";
import { db } from "@/lib/db/database";
import type { VoceOutbox } from "@/lib/sync/outbox";
import { azzeraStatoGiri, segnaFineGiro, segnaInizioGiro } from "@/lib/sync/statoSincronizzazione";

// La pagina Impostazioni > Sincronizzazione (mockup approvato il 10/10,
// docs/mockups/sincronizzazione.html): qui si controlla che, dati coda e
// giri, mostri lo stato giusto con i suoi testi e che le azioni facciano
// quello che dicono. Le priorità hanno i loro test in
// statoSincronizzazione.test.ts, i testi in testiSincronizzazione.test.ts.
//
// Lo stato dei giri si scrive direttamente (segnaInizioGiro /
// segnaFineGiro), come farebbero salita e discesa; la coda in Dexie.

const USER_ID = "utente-test-sincronizzazione";

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
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

// I giri veri non partono: si controlla solo che la pagina li chieda.
const giri = vi.hoisted(() => ({
  bidirezionale: vi.fn(async (userId: string) => {
    void userId;
  }),
  salita: vi.fn(async () => ({ inviate: 0, fallite: 0, sospese: 0 })),
}));
vi.mock("@/lib/sync/orchestratore", () => ({
  sincronizzaBidirezionale: giri.bidirezionale,
}));
vi.mock("@/lib/sync/sincronizza", async (originale) => ({
  ...(await originale<typeof import("@/lib/sync/sincronizza")>()),
  sincronizzaOutbox: giri.salita,
}));

beforeEach(async () => {
  giri.bidirezionale.mockClear();
  giri.salita.mockClear();
  window.localStorage.clear();
  azzeraStatoGiri();
  await Promise.all([db.outbox.clear(), db.pasti.clear()]);
});

afterEach(cleanup);

// Oggi alle hh:mm, nell'ora locale.
function oggiAlle(ore: number, minuti: number): string {
  const d = new Date();
  d.setHours(ore, minuti, 0, 0);
  return d.toISOString();
}

function voce(id: string, altro: Partial<VoceOutbox> = {}, userId = USER_ID): VoceOutbox {
  const [tabella, recordId] = id.split(":") as [VoceOutbox["tabella"], string];
  return {
    id,
    tabella,
    record_id: recordId,
    dati: { id: recordId, user_id: userId, updated_at: oggiAlle(14, 2), deleted_at: null },
    creato_il: oggiAlle(14, 2),
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
    ...altro,
  };
}

const ACCANTONATA: Partial<VoceOutbox> = {
  tentativi: 5,
  ultimo_errore: 'invalid input syntax for type time: "25:00"',
  ultimo_status: 400,
  sospesa_il: oggiAlle(14, 10),
};

describe("Impostazioni > Sincronizzazione — i sei stati", () => {
  it("tutto salvato, con l'ora dell'ultimo contatto", async () => {
    segnaFineGiro("discesa", "ok", { parlatoColServer: true });
    render(<SincronizzazionePage />);

    expect(await screen.findByRole("heading", { name: "Tutto salvato online" })).toBeTruthy();
    expect(screen.getByText(/^Controllato alle \d{2}:\d{2}$/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Sincronizza ora" }) as HTMLButtonElement).disabled).toBe(false);
    // "Ricarica i dati dal tuo account" resta in fondo.
    expect(screen.getByRole("button", { name: "Ricarica i dati dal tuo account" })).toBeTruthy();
  });

  it("in corso: compare da solo dopo un secondo, e Sincronizza ora è spento", async () => {
    render(<SincronizzazionePage />);
    await screen.findByRole("heading", { name: "Tutto salvato online" });

    act(() => segnaInizioGiro("discesa"));
    // Subito no: un giro breve non deve far lampeggiare niente.
    expect(screen.queryByRole("heading", { name: "Sincronizzazione in corso…" })).toBeNull();
    expect((screen.getByRole("button", { name: "Sincronizza ora" }) as HTMLButtonElement).disabled).toBe(true);

    // Nessun altro cambiamento: è il timer della pagina a ridisegnarla.
    expect(
      await screen.findByRole("heading", { name: "Sincronizzazione in corso…" }, { timeout: 2000 })
    ).toBeTruthy();
    expect(screen.getByText("Sto controllando i dati sul server.")).toBeTruthy();
  });

  it("in attesa, con da quando", async () => {
    await db.outbox.put(voce("pasti:p1"));
    segnaFineGiro("salita", "rete", { parlatoColServer: false });
    render(<SincronizzazionePage />);

    expect(await screen.findByRole("heading", { name: "1 modifica in attesa" })).toBeTruthy();
    expect(screen.getByText("Partono da sole quando torna la rete.")).toBeTruthy();
    expect(screen.getByText("In attesa dalle 14:02")).toBeTruthy();
  });

  it("il server rifiuta", async () => {
    await db.outbox.bulkPut([voce("pasti:p1"), voce("pasti:p2")]);
    segnaFineGiro("salita", "errore", { parlatoColServer: false });
    render(<SincronizzazionePage />);

    expect(await screen.findByRole("heading", { name: "Non riesco a salvare 2 modifiche online" })).toBeTruthy();
    expect(screen.getByText("Il server le rifiuta. Riprovo da solo a ogni apertura.")).toBeTruthy();
    expect(screen.getByText(/^Dalle \d{2}:\d{2}$/)).toBeTruthy();
  });

  it("accesso scaduto: con le modifiche in attesa, quante e da quando", async () => {
    await db.outbox.put(voce("pasti:p1"));
    segnaFineGiro("salita", "sessione", { parlatoColServer: false });
    render(<SincronizzazionePage />);

    expect(await screen.findByRole("heading", { name: "Accesso scaduto" })).toBeTruthy();
    expect(screen.getByText("1 modifica in attesa dalle 14:02")).toBeTruthy();
  });

  it("accantonate: l'elenco in parole dell'utente, i dettagli tecnici chiusi", async () => {
    await db.outbox.bulkPut([
      voce("pasti:p1", { ...ACCANTONATA, dati: { ...voce("pasti:p1").dati, nome: "Merenda" } as VoceOutbox["dati"] }),
      // Di un altro utente sullo stesso dispositivo: non si vede e non si conta.
      voce("pasti:p9", ACCANTONATA, "utente-altro"),
    ]);
    render(<SincronizzazionePage />);

    expect(await screen.findByRole("heading", { name: "1 modifica non salvata online" })).toBeTruthy();
    expect(screen.getByText("Pasti (1)")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Non salvate online" })).toBeTruthy();
    expect(await screen.findByText("Pasto")).toBeTruthy();
    expect(screen.getByText(/^«Merenda» · /)).toBeTruthy();

    const dettagli = screen.getByText("Dettagli tecnici").closest("details")!;
    expect(dettagli.open).toBe(false);
    expect(dettagli.textContent).toContain('pasti · 5 tentativi · 400 · invalid input syntax for type time: "25:00"');
  });
});

// La disposizione C del mockup docs/mockups/sincronizzazione-sessione.html
// (dal 02/11/2026). Il 01/11 "Accesso scaduto" era un rifiuto passeggero di
// PostgREST, e sotto il riquadro c'era solo "Esci e rientra", che svuota il
// telefono. Ora "Sincronizza ora" c'è sempre; "Esci e rientra", solo con la
// sessione scaduta, sta nel gruppo dei dati sotto "Ricarica"; "Dettagli
// tecnici" solo per sessione ed errore, e solo se c'è una riga.
describe("Impostazioni > Sincronizzazione — disposizione dal 02/11", () => {
  const PGRST303 = {
    verso: "discesa" as const,
    tabella: "composizioni" as const,
    status: 401,
    codice: "PGRST303",
    messaggio: "JWT issued at future",
  };

  function esciERientra() {
    return screen.queryByRole("button", { name: /^Esci e rientra/ });
  }

  it("sessione: Sincronizza ora c'è, Esci e rientra sta nel gruppo dei dati sotto Ricarica", async () => {
    segnaFineGiro("discesa", "sessione", {
      parlatoColServer: true,
      tabelleNonScaricate: ["composizioni"],
      dettagli: [PGRST303],
    });
    render(<SincronizzazionePage />);

    expect(await screen.findByRole("heading", { name: "Accesso scaduto" })).toBeTruthy();
    expect(screen.getByText("Prova con Sincronizza ora. Se torna, esci e rientra.")).toBeTruthy();
    const sincronizza = screen.getByRole("button", { name: "Sincronizza ora" }) as HTMLButtonElement;
    expect(sincronizza.disabled).toBe(false);

    const esci = esciERientra()!;
    expect(esci).toBeTruthy();
    expect(esci.textContent).toContain("Svuota i dati di questo telefono e li riscarica dopo l'accesso.");
    const gruppoDati = screen.getByRole("heading", { name: "Dati su questo dispositivo" }).closest("section")!;
    const ricarica = screen.getByRole("button", { name: "Ricarica i dati dal tuo account" });
    expect(gruppoDati.contains(esci)).toBe(true);
    expect(gruppoDati.contains(ricarica)).toBe(true);
    // Sotto Ricarica, non sopra.
    expect(ricarica.compareDocumentPosition(esci) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // I Dettagli, chiusi, fra Sincronizza ora e il gruppo dei dati.
    const dettagli = screen.getByText("Dettagli tecnici").closest("details")!;
    expect(dettagli.open).toBe(false);
    expect(dettagli.textContent).toContain("discesa · composizioni · 401 · PGRST303 · JWT issued at future");
    expect(sincronizza.compareDocumentPosition(dettagli) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dettagli.compareDocumentPosition(gruppoDati) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sessione: Sincronizza ora fa partire un giro (non apre Esci)", async () => {
    segnaFineGiro("discesa", "sessione", { parlatoColServer: true, dettagli: [PGRST303] });
    render(<SincronizzazionePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Sincronizza ora" }));
    expect(giri.bidirezionale).toHaveBeenCalledWith(USER_ID);
  });

  it("sessione senza righe da mostrare: niente Dettagli", async () => {
    await db.outbox.put(voce("pasti:p1"));
    segnaFineGiro("salita", "sessione", { parlatoColServer: false });
    render(<SincronizzazionePage />);

    await screen.findByRole("heading", { name: "Accesso scaduto" });
    expect(esciERientra()).toBeTruthy();
    expect(screen.queryByText("Dettagli tecnici")).toBeNull();
  });

  it("errore: i Dettagli ci sono, Esci e rientra no", async () => {
    segnaFineGiro("discesa", "errore", {
      parlatoColServer: true,
      tabelleNonScaricate: ["misurazioni"],
      dettagli: [
        { verso: "discesa", tabella: "misurazioni", status: 403, codice: "42501", messaggio: "permission denied" },
      ],
    });
    render(<SincronizzazionePage />);

    expect(await screen.findByRole("heading", { name: "Non riesco a scaricare i dati dal server" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sincronizza ora" })).toBeTruthy();
    expect(screen.getByText("Dettagli tecnici").closest("details")!.textContent).toContain(
      "discesa · misurazioni · 403 · 42501 · permission denied"
    );
    expect(esciERientra()).toBeNull();
  });

  it("tutto salvato: niente Esci e rientra, niente Dettagli", async () => {
    segnaFineGiro("discesa", "ok", { parlatoColServer: true, dettagli: [PGRST303] });
    render(<SincronizzazionePage />);

    await screen.findByRole("heading", { name: "Tutto salvato online" });
    expect(screen.getByRole("button", { name: "Sincronizza ora" })).toBeTruthy();
    expect(esciERientra()).toBeNull();
    expect(screen.queryByText("Dettagli tecnici")).toBeNull();
  });

  it("in attesa (rete): niente Esci e rientra, niente Dettagli", async () => {
    await db.outbox.put(voce("pasti:p1"));
    segnaFineGiro("salita", "rete", {
      parlatoColServer: false,
      dettagli: [{ verso: "salita", tabella: "pasti", status: 0, codice: null, messaggio: "Failed to fetch" }],
    });
    render(<SincronizzazionePage />);

    await screen.findByRole("heading", { name: "1 modifica in attesa" });
    expect(esciERientra()).toBeNull();
    expect(screen.queryByText("Dettagli tecnici")).toBeNull();
  });
});

describe("Impostazioni > Sincronizzazione — le azioni", () => {
  it("Sincronizza ora fa partire discesa e salita per l'utente", async () => {
    render(<SincronizzazionePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Sincronizza ora" }));
    expect(giri.bidirezionale).toHaveBeenCalledWith(USER_ID);
  });

  it("Riprova a salvarle rimette in coda le accantonate dell'utente e fa partire un giro", async () => {
    await db.outbox.bulkPut([voce("pasti:p1", ACCANTONATA), voce("pasti:p9", ACCANTONATA, "utente-altro")]);
    render(<SincronizzazionePage />);

    fireEvent.click(await screen.findByRole("button", { name: "Riprova a salvarle" }));

    await waitFor(async () => {
      expect(await db.outbox.get("pasti:p1")).toMatchObject({ sospesa_il: null, tentativi: 0 });
    });
    expect(await db.outbox.get("pasti:p9")).toMatchObject({ sospesa_il: ACCANTONATA.sospesa_il, tentativi: 5 });
    await waitFor(() => expect(giri.salita).toHaveBeenCalled());
    // Non più accantonata: il gruppo sparisce e la voce torna in attesa.
    expect(await screen.findByRole("heading", { name: "1 modifica in attesa" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Non salvate online" })).toBeNull();
  });
});
