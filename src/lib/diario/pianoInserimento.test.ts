// Test permanenti per le righe nuove che entrano in un pasto con i doppioni
// (PUNTO_DI_PARTENZA.md, sezione 3, "Doppioni"): il cuore comune di Duplica
// e dell'inserimento da /aggiungi. Sbagliano in silenzio — un grammo in più
// o una riga di troppo nel diario si vedono mesi dopo nei totali.

import { describe, it, expect } from "vitest";
import { doppioniInserimento, pianoInserimento, type DatiVoce } from "./pianoInserimento";
import type { SceltaDoppione } from "./pianoSpostamento";
import type { VoceDiario } from "../db/tipi";

const PRANZO = "pranzo";
const ADESSO = "2026-10-10T13:00:00.000Z";

// Una riga già nel pasto di destinazione.
let contatore = 0;
function esistente(nome: string, grammi: number, extra: Partial<VoceDiario> = {}): VoceDiario {
  contatore++;
  return {
    id: `v${contatore}`,
    user_id: "u",
    alimento_id: `alimento-${nome}`,
    pasto_id: PRANZO,
    gruppo_id: null,
    quantita_g: grammi,
    data: "2026-10-10",
    creato_il: `2026-10-10T08:00:${String(contatore).padStart(2, "0")}.000Z`,
    consumato_alle: "2026-10-10T08:05:00.000Z",
    nome_alimento: nome,
    kcal_100g: 52,
    proteine_100g: 0.3,
    carboidrati_100g: 14,
    grassi_100g: 0.2,
    updated_at: "2026-10-10T08:00:00.000Z",
    deleted_at: null,
    ...extra,
  };
}

// Una riga nuova, pronta da scrivere.
function nuova(nome: string, grammi: number, extra: Partial<DatiVoce> = {}): DatiVoce {
  return {
    user_id: "u",
    alimento_id: `alimento-${nome}`,
    pasto_id: PRANZO,
    gruppo_id: "gruppo-nuovo",
    quantita_g: grammi,
    data: "2026-10-10",
    creato_il: ADESSO,
    consumato_alle: ADESSO,
    nome_alimento: nome,
    kcal_100g: 52,
    proteine_100g: 0.3,
    carboidrati_100g: 14,
    grassi_100g: 0.2,
    ...extra,
  };
}

function piano(nuove: DatiVoce[], destinazione: VoceDiario[], scelte: Record<string, SceltaDoppione> = {}) {
  return pianoInserimento({ nuove, destinazione, scelte });
}

describe("pianoInserimento — senza doppioni", () => {
  it("ogni riga nuova si crea così com'è", () => {
    const pane = nuova("Pane", 50);
    const p = piano([pane], [esistente("Burro", 10)]);
    expect(p.scritture).toEqual([{ tipo: "crea", dati: pane }]);
    expect(p.inseriti).toEqual(["Pane"]);
    expect(p.esclusi).toEqual([]);
  });

  it("le voci senza alimento_id non sono mai doppioni, nemmeno con lo stesso nome", () => {
    const vecchia = esistente("Ricotta", 100, { alimento_id: null });
    const arriva = nuova("Ricotta", 50, { alimento_id: null });
    expect(doppioniInserimento([arriva], [vecchia])).toEqual([]);
    expect(piano([arriva], [vecchia]).scritture).toEqual([{ tipo: "crea", dati: arriva }]);
  });

  it("due righe nuove dello stesso alimento non sono doppioni fra loro: due righe", () => {
    const mela1 = nuova("Mela", 50);
    const mela2 = nuova("Mela", 30);
    expect(doppioniInserimento([mela1, mela2], [])).toEqual([]);
    const p = piano([mela1, mela2], []);
    expect(p.scritture).toEqual([
      { tipo: "crea", dati: mela1 },
      { tipo: "crea", dati: mela2 },
    ]);
    // Un nome per alimento, non per riga.
    expect(p.inseriti).toEqual(["Mela"]);
  });
});

describe("pianoInserimento — le scelte sul doppione", () => {
  it("Somma: la riga di destinazione prende il totale e tiene i SUOI valori", () => {
    // La riga nuova ha valori diversi (catalogo corretto nel frattempo):
    // non devono finire sulla riga che resta.
    const vecchia = esistente("Mela", 100, { kcal_100g: 52 });
    const arriva = nuova("Mela", 50, { kcal_100g: 60 });
    const p = piano([arriva], [vecchia], { "alimento-Mela": { tipo: "somma" } });
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: vecchia.id, modifiche: { quantita_g: 150 } }]);
    expect(p.inseriti).toEqual(["Mela"]);
    expect(p.aggiornati).toEqual([{ nome: "Mela", grammi: 150, tipo: "somma" }]);
  });

  it("Somma con i decimali: due decimali, niente 30,299999…", () => {
    const vecchia = esistente("Riso", 10.1);
    const p = piano([nuova("Riso", 20.2)], [vecchia], { "alimento-Riso": { tipo: "somma" } });
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: vecchia.id, modifiche: { quantita_g: 30.3 } }]);
  });

  it("Scrivi quantità: la riga di destinazione prende i grammi scritti, a due decimali", () => {
    const vecchia = esistente("Mela", 100);
    const p = piano([nuova("Mela", 50)], [vecchia], {
      "alimento-Mela": { tipo: "scrivi", grammi: 120.456 },
    });
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: vecchia.id, modifiche: { quantita_g: 120.46 } }]);
    expect(p.aggiornati).toEqual([{ nome: "Mela", grammi: 120.46, tipo: "scrivi" }]);
  });

  it("Tieni separati: la riga nuova si crea accanto, quella di prima non si tocca", () => {
    const arriva = nuova("Mela", 50);
    const p = piano([arriva], [esistente("Mela", 100)], { "alimento-Mela": { tipo: "separati" } });
    expect(p.scritture).toEqual([{ tipo: "crea", dati: arriva }]);
    expect(p.inseriti).toEqual(["Mela"]);
    expect(p.aggiornati).toEqual([]);
  });

  it("Non aggiungerlo: nessuna scrittura, e l'alimento è fra gli esclusi", () => {
    const p = piano([nuova("Mela", 50)], [esistente("Mela", 100)], { "alimento-Mela": { tipo: "escludi" } });
    expect(p.scritture).toEqual([]);
    expect(p.inseriti).toEqual([]);
    expect(p.esclusi).toEqual(["Mela"]);
  });

  it("senza la scelta per un doppione è un errore di chi chiama", () => {
    expect(() => piano([nuova("Mela", 50)], [esistente("Mela", 100)])).toThrow(/alimento-Mela/);
  });
});

describe("pianoInserimento — più righe dello stesso alimento", () => {
  it("due righe nuove uguali e una a destinazione: un solo doppione, con le somme", () => {
    expect(doppioniInserimento([nuova("Mela", 50), nuova("Mela", 30)], [esistente("Mela", 100)])).toEqual([
      {
        alimentoId: "alimento-Mela",
        nome: "Mela",
        grammiEsistenti: 100,
        grammiInArrivo: 80,
        righeEsistenti: 1,
        righeInArrivo: 2,
      },
    ]);
  });

  it("Somma con due righe nuove uguali: una riga sola col totale di tutte", () => {
    const vecchia = esistente("Mela", 100);
    const p = piano([nuova("Mela", 50), nuova("Mela", 30)], [vecchia], { "alimento-Mela": { tipo: "somma" } });
    expect(p.scritture).toEqual([{ tipo: "aggiorna", id: vecchia.id, modifiche: { quantita_g: 180 } }]);
  });

  it("Tieni separati con due righe nuove uguali: tutte e due, una volta sola", () => {
    const mela1 = nuova("Mela", 50);
    const mela2 = nuova("Mela", 30);
    const p = piano([mela1, mela2], [esistente("Mela", 100)], { "alimento-Mela": { tipo: "separati" } });
    expect(p.scritture).toEqual([
      { tipo: "crea", dati: mela1 },
      { tipo: "crea", dati: mela2 },
    ]);
    expect(p.inseriti).toEqual(["Mela"]);
  });

  it("più righe a destinazione: Somma lascia la più vecchia e cancella le altre", () => {
    // Passate in ordine "sbagliato": la scelta non deve dipendere da come
    // Dexie restituisce le righe.
    const recente = esistente("Mela", 30, { creato_il: "2026-10-10T12:00:00.000Z" });
    const vecchia = esistente("Mela", 100, { creato_il: "2026-10-10T07:00:00.000Z" });
    const p = piano([nuova("Mela", 50)], [recente, vecchia], { "alimento-Mela": { tipo: "somma" } });
    expect(p.scritture).toEqual([
      { tipo: "aggiorna", id: vecchia.id, modifiche: { quantita_g: 180 } },
      { tipo: "elimina", id: recente.id },
    ]);
  });
});

describe("pianoInserimento — pasto salvato con alcuni doppioni", () => {
  it("gli alimenti senza doppione entrano comunque, anche se un altro è escluso", () => {
    const burro = nuova("Burro", 10);
    const p = piano([nuova("Pane", 50), burro], [esistente("Pane", 80)], {
      "alimento-Pane": { tipo: "escludi" },
    });
    expect(p.scritture).toEqual([{ tipo: "crea", dati: burro }]);
    expect(p.inseriti).toEqual(["Burro"]);
    expect(p.esclusi).toEqual(["Pane"]);
  });
});
