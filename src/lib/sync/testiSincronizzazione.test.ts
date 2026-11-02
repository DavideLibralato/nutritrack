// I testi dell'indicatore (testiSincronizzazione.ts, dal 10/10/2026). La
// parte sottile è il "da quando": un'attesa che dura giorni deve dirlo
// ("da ieri alle 14:02", "da gio 8 ott alle 14:02"), non mostrare solo
// un'ora che sembra di oggi. Il giorno è quello del calendario locale.

import { describe, it, expect } from "vitest";
import {
  testoControllato,
  testoDaQuando,
  testiStato,
  riepilogoPerTipo,
  rigaDettaglio,
} from "./testiSincronizzazione";
import type { RiassuntoCoda } from "./statoSincronizzazione";
import type { VoceOutbox } from "./outbox";

// Istanti costruiti nell'ora locale, come li vede il telefono.
const ADESSO = new Date(2026, 9, 10, 18, 30);
const OGGI_1402 = new Date(2026, 9, 10, 14, 2).toISOString();
const IERI_2341 = new Date(2026, 9, 9, 23, 41).toISOString();
const GIOVEDI_0905 = new Date(2026, 9, 8, 9, 5).toISOString();

const CODA: RiassuntoCoda = { inAttesa: 0, inAttesaDal: null, accantonate: 0 };

describe("da quando e controllato alle", () => {
  it("oggi solo l'ora, ieri 'ieri', prima il giorno", () => {
    expect(testoDaQuando(OGGI_1402, ADESSO)).toBe("dalle 14:02");
    expect(testoDaQuando(IERI_2341, ADESSO)).toBe("da ieri alle 23:41");
    expect(testoDaQuando(GIOVEDI_0905, ADESSO)).toBe("da gio 8 ott alle 09:05");

    expect(testoControllato(OGGI_1402, ADESSO)).toBe("Controllato alle 14:02");
    expect(testoControllato(IERI_2341, ADESSO)).toBe("Controllato ieri alle 23:41");
    expect(testoControllato(GIOVEDI_0905, ADESSO)).toBe("Controllato gio 8 ott alle 09:05");
  });
});

describe("testiStato", () => {
  it("in attesa: singolare, plurale e da quando", () => {
    const una = testiStato({ tipo: "in-attesa", numero: 1, dal: OGGI_1402, pallino: false }, CODA, "", ADESSO);
    expect(una).toMatchObject({ titolo: "1 modifica in attesa", quando: "In attesa dalle 14:02", tono: "attesa" });
    const due = testiStato({ tipo: "in-attesa", numero: 2, dal: IERI_2341, pallino: false }, CODA, "", ADESSO);
    expect(due).toMatchObject({ titolo: "2 modifiche in attesa", quando: "In attesa da ieri alle 23:41" });
  });

  it("errore in salita (modifiche in coda) e in discesa (nessuna)", () => {
    const salita = testiStato(
      { tipo: "errore", inAttesa: 1, dal: OGGI_1402, tabelleNonScaricate: [], dettagli: [], pallino: false },
      CODA,
      "",
      ADESSO
    );
    expect(salita).toMatchObject({
      titolo: "Non riesco a salvare 1 modifica online",
      testo: "Il server la rifiuta. Riprovo da solo a ogni apertura.",
      quando: "Dalle 14:02",
      tono: "avviso",
    });
    const discesa = testiStato(
      { tipo: "errore", inAttesa: 0, dal: IERI_2341, tabelleNonScaricate: ["pasti"], dettagli: [], pallino: true },
      CODA,
      "",
      ADESSO
    );
    expect(discesa).toMatchObject({ titolo: "Non riesco a scaricare i dati dal server", quando: "Da ieri alle 23:41" });
  });

  it("sessione scaduta: con modifiche in attesa dice quante e da quando", () => {
    const testi = testiStato(
      { tipo: "sessione", inAttesa: 2, dettagli: [], pallino: true },
      { inAttesa: 2, inAttesaDal: OGGI_1402, accantonate: 0 },
      "",
      ADESSO
    );
    expect(testi).toMatchObject({ titolo: "Accesso scaduto", quando: "2 modifiche in attesa dalle 14:02", icona: "chiave" });
  });

  // Dal 02/11/2026 (mockup docs/mockups/sincronizzazione-sessione.html,
  // proposta C): prima si riprova con "Sincronizza ora", poi si esce.
  it("sessione scaduta: il testo manda prima a Sincronizza ora, con e senza modifiche in coda", () => {
    const senza = testiStato({ tipo: "sessione", inAttesa: 0, dettagli: [], pallino: true }, CODA, "", ADESSO);
    expect(senza.testo).toBe("Prova con Sincronizza ora. Se torna, esci e rientra.");
    expect(senza.quando).toBeNull();

    const con = testiStato(
      { tipo: "sessione", inAttesa: 2, dettagli: [], pallino: true },
      { inAttesa: 2, inAttesaDal: OGGI_1402, accantonate: 0 },
      "",
      ADESSO
    );
    expect(con.testo).toBe(
      "Le modifiche restano su questo telefono. Prova con Sincronizza ora; se non basta, esci e rientra."
    );
  });

  it("accantonate: titolo e riepilogo per tipo", () => {
    const voci = [
      { tabella: "voci_diario" },
      { tabella: "voci_diario" },
      { tabella: "pasti" },
    ] as VoceOutbox[];
    expect(riepilogoPerTipo(voci)).toBe("Diario (2), Pasti (1)");
    const testi = testiStato({ tipo: "accantonate", numero: 3, pallino: true }, CODA, riepilogoPerTipo(voci), ADESSO);
    expect(testi).toMatchObject({
      titolo: "3 modifiche non salvate online",
      testo: "L'app ha smesso di riprovare dopo 5 rifiuti del server.",
      quando: "Diario (2), Pasti (1)",
    });
    expect(testiStato({ tipo: "accantonate", numero: 1, pallino: true }, CODA, "", ADESSO).titolo).toBe(
      "1 modifica non salvata online"
    );
  });

  it("sincronizzato senza un'ora salvata: niente riga 'controllato'", () => {
    const testi = testiStato({ tipo: "sincronizzato", ultimoSuccesso: null, pallino: false }, CODA, "", ADESSO);
    expect(testi).toMatchObject({ titolo: "Tutto salvato online", quando: null, tono: "accento" });
  });
});

describe("rigaDettaglio", () => {
  it("verso · tabella · status · codice · messaggio, come il caso del 01/11", () => {
    expect(
      rigaDettaglio({
        verso: "discesa",
        tabella: "composizioni",
        status: 401,
        codice: "PGRST303",
        messaggio: "JWT issued at future",
      })
    ).toBe("discesa · composizioni · 401 · PGRST303 · JWT issued at future");
  });

  it("le parti che mancano si saltano; lo status 0 resta", () => {
    expect(
      rigaDettaglio({ verso: "salita", tabella: "pasti", status: 0, codice: null, messaggio: "Failed to fetch" })
    ).toBe("salita · pasti · 0 · Failed to fetch");
    expect(
      rigaDettaglio({ verso: "salita", tabella: "pasti", status: null, codice: null, messaggio: null })
    ).toBe("salita · pasti");
  });
});
