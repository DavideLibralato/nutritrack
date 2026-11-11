// Medie settimanali e mensili (PUNTO_DI_PARTENZA.md, sezione 10.5, funzione
// n. 2; sezione 3, "Statistiche"): giorni vuoti in mezzo, giorni futuri
// esclusi, target diversi (obiettivo medio), un cambio di periodo a metà
// settimana, un periodo senza giorni contati.
//
// Oggi è mercoledì 11 novembre 2026. La settimana "scorsa" va dal 2 all'8.

import { describe, it, expect } from "vitest";
import {
  giorniStatistiche,
  medieDelPeriodo,
  segnoObiettivo,
  primoGiornoConVoci,
  senzaVoci,
} from "./medieStatistiche";
import { giorniDelPeriodo } from "./periodiStatistiche";
import type { DatiObiettivi } from "./targetGiorno";
import type { Giorno, Obiettivo, ObiettivoTarget, Profilo, VoceDiario } from "./db/tipi";

const OGGI = "2026-11-11";
const SETTIMANA_SCORSA = giorniDelPeriodo("settimana", "2026-11-02");
const QUESTA_SETTIMANA = giorniDelPeriodo("settimana", "2026-11-09");

// Una voce da 100 g: i valori per 100 g sono i totali della voce.
function voce(
  data: string,
  kcal: number,
  macro: { proteine?: number; carboidrati?: number; grassi?: number } = {},
  modifiche: Partial<VoceDiario> = {}
): VoceDiario {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-11-01T10:00:00.000Z",
    deleted_at: null,
    alimento_id: "a1",
    pasto_id: "p1",
    gruppo_id: null,
    quantita_g: 100,
    data,
    creato_il: "2026-11-01T10:00:00.000Z",
    consumato_alle: null,
    nome_alimento: "Alimento",
    kcal_100g: kcal,
    proteine_100g: macro.proteine ?? 0,
    carboidrati_100g: macro.carboidrati ?? 0,
    grassi_100g: macro.grassi ?? 0,
    ...modifiche,
  };
}

function obiettivo(id: string, validoDal: string, tipo: Obiettivo["tipo"]): Obiettivo {
  return {
    id,
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    valido_dal: validoDal,
    tipo,
    kcal: 0,
    proteine_g: 0,
    carboidrati_g: 0,
    grassi_g: 0,
    peso_obiettivo: null,
  };
}

function target(
  obiettivoId: string,
  tipoGiorno: string,
  kcal: number,
  proteine = 140
): ObiettivoTarget {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    obiettivo_id: obiettivoId,
    tipo_giorno: tipoGiorno,
    kcal,
    proteine_g: proteine,
    carboidrati_g: 230,
    grassi_g: 70,
  };
}

function giorno(data: string, tipo: string): Giorno {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-01T10:00:00.000Z",
    deleted_at: null,
    data,
    tipo_giorno: tipo,
  };
}

const PROFILO: Profilo = {
  id: "pr1",
  user_id: "u1",
  updated_at: "2026-09-01T10:00:00.000Z",
  deleted_at: null,
  nome: null,
  sesso: "non_indicato",
  data_nascita: null,
  altezza_cm: null,
  livello_attivita: "moderato",
  differenzia_giorni: false,
  giorni_allenamento_default: null,
};

const DATI: DatiObiettivi = {
  obiettivi: [obiettivo("o1", "2026-09-01", "massa")],
  obiettiviTarget: [target("o1", "normale", 2200), target("o1", "allenamento", 2600, 160)],
  giorni: [],
  profilo: PROFILO,
};

function medie(giorniISO: string[], voci: VoceDiario[], dati: DatiObiettivi = DATI) {
  return medieDelPeriodo(giorniStatistiche(giorniISO, voci, dati, OGGI));
}

describe("giorniStatistiche", () => {
  it("un giorno per data, con i totali solo dove ci sono voci e il futuro segnato", () => {
    const giorni = giorniStatistiche(QUESTA_SETTIMANA, [voce("2026-11-10", 2000)], DATI, OGGI);
    expect(giorni.map((g) => g.data)).toEqual(QUESTA_SETTIMANA);
    expect(giorni.map((g) => g.totali?.kcal ?? null)).toEqual([
      null,
      2000,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(giorni.map((g) => g.futuro)).toEqual([false, false, false, true, true, true, true]);
  });

  it("somma le voci dello stesso giorno e salta quelle cancellate", () => {
    const voci = [
      voce("2026-11-03", 800),
      voce("2026-11-03", 700),
      voce("2026-11-03", 5000, {}, { deleted_at: "2026-11-03T20:00:00.000Z" }),
      voce("2026-11-04", 900, {}, { deleted_at: "2026-11-04T20:00:00.000Z" }),
    ];
    const giorni = giorniStatistiche(SETTIMANA_SCORSA, voci, DATI, OGGI);
    expect(giorni[1].totali?.kcal).toBe(1500);
    expect(giorni[2].totali).toBeNull(); // solo una voce cancellata: giorno vuoto
  });
});

describe("medieDelPeriodo", () => {
  it("giorni vuoti in mezzo: divide per i giorni con voci, non per 7", () => {
    const voci = [
      voce("2026-11-02", 2000, { proteine: 120 }),
      voce("2026-11-04", 2100, { proteine: 130 }),
      voce("2026-11-05", 2200, { proteine: 140 }),
      voce("2026-11-07", 2300, { proteine: 150 }),
      voce("2026-11-08", 2400, { proteine: 160 }),
    ];
    const r = medie(SETTIMANA_SCORSA, voci)!;
    expect(r.kcal.valore).toBe(2200);
    expect(r.kcal.giorniContati).toBe(5);
    expect(r.proteine.valore).toBe(140);
    expect(r.kcal.obiettivo).toBe(2200);
    expect(r.kcal.obiettivoUnico).toBe(true);
  });

  it("i giorni futuri non contano, anche se hanno voci pianificate", () => {
    const voci = [
      voce("2026-11-09", 2000),
      voce("2026-11-11", 2400), // oggi conta
      voce("2026-11-12", 100), // domani no
      voce("2026-11-15", 100),
    ];
    const r = medie(QUESTA_SETTIMANA, voci)!;
    expect(r.kcal.giorniContati).toBe(2);
    expect(r.kcal.valore).toBe(2200);
  });

  it("target diversi: obiettivo medio sugli stessi giorni contati", () => {
    // Allenamento il 3 e il 5 (scritti), normale gli altri; voci solo il 2, 3 e 5.
    const dati = {
      ...DATI,
      giorni: [giorno("2026-11-03", "allenamento"), giorno("2026-11-05", "allenamento")],
    };
    const voci = [voce("2026-11-02", 2000), voce("2026-11-03", 2600), voce("2026-11-05", 2600)];
    const r = medie(SETTIMANA_SCORSA, voci, dati)!;
    expect(r.kcal.obiettivo).toBeCloseTo((2200 + 2600 + 2600) / 3, 10);
    expect(r.kcal.obiettivoUnico).toBe(false);
    expect(r.proteine.obiettivo).toBeCloseTo((140 + 160 + 160) / 3, 10);
    // I grassi hanno lo stesso target nei due tipi: lì l'obiettivo è unico.
    expect(r.grassi.obiettivo).toBe(70);
    expect(r.grassi.obiettivoUnico).toBe(true);
  });

  it("un giorno di allenamento senza voci non entra nell'obiettivo medio", () => {
    const dati = { ...DATI, giorni: [giorno("2026-11-04", "allenamento")] };
    const r = medie(SETTIMANA_SCORSA, [voce("2026-11-02", 2000), voce("2026-11-03", 2100)], dati)!;
    expect(r.kcal.obiettivo).toBe(2200);
    expect(r.kcal.obiettivoUnico).toBe(true);
  });

  it("un cambio di periodo a metà settimana: ogni giorno il suo target, e il tipo dell'ultimo", () => {
    // Da giovedì 5 un periodo nuovo, Dimagrire a 1800.
    const dati = {
      ...DATI,
      obiettivi: [...DATI.obiettivi, obiettivo("o2", "2026-11-05", "dimagrire")],
      obiettiviTarget: [...DATI.obiettiviTarget, target("o2", "normale", 1800)],
    };
    const voci = [voce("2026-11-03", 2200), voce("2026-11-04", 2200), voce("2026-11-06", 1800)];
    const r = medie(SETTIMANA_SCORSA, voci, dati)!;
    expect(r.kcal.obiettivo).toBeCloseTo((2200 + 2200 + 1800) / 3, 10);
    expect(r.kcal.obiettivoUnico).toBe(false);
    expect(r.kcal.tipoObiettivo).toBe("dimagrire");
  });

  it("il tipo di obiettivo è quello dell'ultimo giorno CONTATO, non dell'ultimo del periodo", () => {
    const dati = {
      ...DATI,
      obiettivi: [...DATI.obiettivi, obiettivo("o2", "2026-11-07", "dimagrire")],
      obiettiviTarget: [...DATI.obiettiviTarget, target("o2", "normale", 1800)],
    };
    const r = medie(SETTIMANA_SCORSA, [voce("2026-11-03", 2200)], dati)!;
    expect(r.kcal.tipoObiettivo).toBe("massa");
  });

  it("un periodo senza giorni contati: null, mai 0", () => {
    expect(medie(SETTIMANA_SCORSA, [])).toBeNull();
    expect(medie(SETTIMANA_SCORSA, [voce("2026-10-30", 2000)])).toBeNull();
    // Solo voci future: nessun giorno contato.
    expect(medie(QUESTA_SETTIMANA, [voce("2026-11-13", 2000)])).toBeNull();
  });

  it("senza nessun obiettivo: le medie ci sono, l'obiettivo no", () => {
    const dati = { ...DATI, obiettivi: [], obiettiviTarget: [] };
    const r = medie(SETTIMANA_SCORSA, [voce("2026-11-03", 2000)], dati)!;
    expect(r.kcal.valore).toBe(2000);
    expect(r.kcal.obiettivo).toBeNull();
    expect(r.kcal.obiettivoUnico).toBe(false);
    expect(r.kcal.tipoObiettivo).toBeNull();
  });

  it("i quattro valori dalle voci: kcal, grassi, carboidrati, proteine", () => {
    const r = medie(SETTIMANA_SCORSA, [
      voce("2026-11-03", 2000, { proteine: 120, carboidrati: 250, grassi: 60 }),
    ])!;
    expect(r.kcal.valore).toBe(2000);
    expect(r.grassi.valore).toBe(60);
    expect(r.carboidrati.valore).toBe(250);
    expect(r.proteine.valore).toBe(120);
  });
});

describe("segnoObiettivo (variante V1)", () => {
  it("stesso target su tutti i giorni fino a oggi: la linea", () => {
    expect(segnoObiettivo(giorniStatistiche(SETTIMANA_SCORSA, [], DATI, OGGI))).toEqual({
      tipo: "linea",
      kcal: 2200,
    });
  });

  it("un giorno di allenamento scritto, anche con i differenziati spenti: i trattini", () => {
    const dati = { ...DATI, giorni: [giorno("2026-11-04", "allenamento")] };
    expect(segnoObiettivo(giorniStatistiche(SETTIMANA_SCORSA, [], dati, OGGI))).toEqual({
      tipo: "trattini",
    });
  });

  it("un cambio di periodo a metà settimana: i trattini", () => {
    const dati = {
      ...DATI,
      obiettivi: [...DATI.obiettivi, obiettivo("o2", "2026-11-05", "dimagrire")],
      obiettiviTarget: [...DATI.obiettiviTarget, target("o2", "normale", 1800)],
    };
    expect(segnoObiettivo(giorniStatistiche(SETTIMANA_SCORSA, [], dati, OGGI))).toEqual({
      tipo: "trattini",
    });
  });

  it("un target diverso solo nei giorni futuri non toglie la linea", () => {
    const dati = { ...DATI, giorni: [giorno("2026-11-13", "allenamento")] };
    expect(segnoObiettivo(giorniStatistiche(QUESTA_SETTIMANA, [], dati, OGGI))).toEqual({
      tipo: "linea",
      kcal: 2200,
    });
  });

  it("senza obiettivi: nessun segno", () => {
    const dati = { ...DATI, obiettivi: [], obiettiviTarget: [] };
    expect(segnoObiettivo(giorniStatistiche(SETTIMANA_SCORSA, [], dati, OGGI))).toEqual({
      tipo: "nessuno",
    });
  });
});

describe("primoGiornoConVoci e senzaVoci", () => {
  it("la prima voce viva fino a oggi", () => {
    const voci = [
      voce("2026-10-20", 100),
      voce("2026-09-23", 100),
      voce("2026-09-01", 100, {}, { deleted_at: "2026-09-02T10:00:00.000Z" }),
      voce("2026-11-20", 100),
    ];
    expect(primoGiornoConVoci(voci, OGGI)).toBe("2026-09-23");
  });

  it("solo voci future o cancellate: nessuna", () => {
    expect(primoGiornoConVoci([voce("2026-11-20", 100)], OGGI)).toBeNull();
    expect(primoGiornoConVoci([], OGGI)).toBeNull();
  });

  it("utente nuovo: nessuna voce viva in assoluto; una voce futura basta a non esserlo", () => {
    expect(senzaVoci([])).toBe(true);
    expect(
      senzaVoci([voce("2026-11-03", 100, {}, { deleted_at: "2026-11-03T10:00:00.000Z" })])
    ).toBe(true);
    expect(senzaVoci([voce("2026-11-20", 100)])).toBe(false);
  });
});
