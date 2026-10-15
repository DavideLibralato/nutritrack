// La conferma dell'eliminazione multipla in Impostazioni > Alimenti. Un
// numero sbagliato qui non fa rumore: lo sheet dice "2 pasti salvati" e
// l'utente si fida. I casi sottili:
// - un pasto salvato con due alimenti della selezione conta una volta;
// - un pasto salvato invisibile in Preferiti (nessun alimento valido) non
//   conta, come non si vede;
// - un preferito cancellato non conta; due righe vive per lo stesso
//   alimento (due dispositivi offline) contano una volta;
// - singolare e plurale: del titolo (alimenti), del verbo (alimenti), dei
//   pasti e dei preferiti, e le parti a zero che spariscono.

import { describe, it, expect } from "vitest";
import { conseguenzeEliminazione, testiConfermaEliminazione } from "./confermaEliminazione";
import type { Alimento, Composizione, ComposizioneVoce, Preferito } from "../db/tipi";

const BASE = { user_id: "u1", updated_at: "2026-10-15T00:00:00.000Z", deleted_at: null };

function alimento(id: string): Alimento {
  return {
    ...BASE,
    id,
    nome: id,
    marca: null,
    barcode: null,
    kcal_100g: 100,
    proteine_100g: 5,
    carboidrati_100g: 10,
    grassi_100g: 2,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
  };
}

function pasto(id: string): Composizione {
  return { ...BASE, id, nome: id, tipo: "pasto_salvato", alimento_id: null };
}

function riga(composizioneId: string, alimentoId: string): ComposizioneVoce {
  return {
    ...BASE,
    id: `${composizioneId}-${alimentoId}`,
    composizione_id: composizioneId,
    alimento_id: alimentoId,
    quantita_g: 100,
    ordine: 0,
  };
}

function preferito(id: string, alimentoId: string, deletedAt: string | null = null): Preferito {
  return { ...BASE, id, alimento_id: alimentoId, deleted_at: deletedAt };
}

// Catalogo: avena, latte, pane. "fantasma" non c'è più (cancellato).
// - colazione: avena + latte → due alimenti della selezione, conta 1;
// - cena: pane + latte → conta 1;
// - spuntino: solo pane → non contiene la selezione;
// - vecchio: solo "fantasma" → invisibile in Preferiti, non conta.
const catalogo = [alimento("avena"), alimento("latte"), alimento("pane")];
const composizioni = [pasto("colazione"), pasto("cena"), pasto("spuntino"), pasto("vecchio")];
const composizioniVoci = [
  riga("colazione", "avena"),
  riga("colazione", "latte"),
  riga("cena", "pane"),
  riga("cena", "latte"),
  riga("spuntino", "pane"),
  riga("vecchio", "fantasma"),
];

describe("conseguenzeEliminazione", () => {
  it("un pasto salvato con due alimenti della selezione conta una volta", () => {
    const c = conseguenzeEliminazione(["avena", "latte"], catalogo, composizioni, composizioniVoci, []);
    expect(c.pastiSalvati).toBe(2); // colazione e cena
  });

  it("un pasto salvato invisibile in Preferiti non conta", () => {
    const c = conseguenzeEliminazione(["fantasma"], catalogo, composizioni, composizioniVoci, []);
    expect(c.pastiSalvati).toBe(0);
  });

  it("preferiti: solo righe vive, un alimento conta una volta", () => {
    const preferiti = [
      preferito("p1", "avena"),
      preferito("p2", "avena"), // seconda riga viva, da un altro dispositivo
      preferito("p3", "latte", "2026-10-10T00:00:00.000Z"), // tolto dai preferiti
      preferito("p4", "pane"), // non selezionato
    ];
    const c = conseguenzeEliminazione(["avena", "latte"], catalogo, composizioni, composizioniVoci, preferiti);
    expect(c.preferiti).toBe(1);
  });
});

describe("testiConfermaEliminazione", () => {
  it("un alimento solo: il nome nel titolo e il verbo al singolare", () => {
    expect(testiConfermaEliminazione(["Mela"], { pastiSalvati: 1, preferiti: 1 })).toEqual({
      titolo: "Eliminare «Mela»?",
      testo: "Il diario non cambia. Verrà tolto anche da 1 pasto salvato e 1 preferito.",
    });
  });

  it("più alimenti: il numero nel titolo e il verbo al plurale", () => {
    expect(
      testiConfermaEliminazione(["Mela", "Pane", "Latte"], { pastiSalvati: 2, preferiti: 3 })
    ).toEqual({
      titolo: "Eliminare 3 alimenti?",
      testo: "Il diario non cambia. Verranno tolti anche da 2 pasti salvati e 3 preferiti.",
    });
  });

  it("una parte a zero sparisce; tutte e due a zero, solo la prima frase", () => {
    expect(testiConfermaEliminazione(["Mela", "Pane"], { pastiSalvati: 2, preferiti: 0 }).testo).toBe(
      "Il diario non cambia. Verranno tolti anche da 2 pasti salvati."
    );
    expect(testiConfermaEliminazione(["Mela", "Pane"], { pastiSalvati: 0, preferiti: 1 }).testo).toBe(
      "Il diario non cambia. Verranno tolti anche da 1 preferito."
    );
    expect(testiConfermaEliminazione(["Mela"], { pastiSalvati: 0, preferiti: 0 }).testo).toBe(
      "Il diario non cambia."
    );
  });
});
