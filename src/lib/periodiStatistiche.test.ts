import { describe, it, expect } from "vitest";
import {
  inizioPeriodo,
  giorniDelPeriodo,
  periodoAdiacente,
  limitiFrecce,
  etichettaPeriodo,
  etichettaBarra,
  periodoDaIndirizzo,
} from "./periodiStatistiche";

// Periodi della pagina Statistiche (PUNTO_DI_PARTENZA.md, sezione 3). Oggi
// è lunedì 9 novembre 2026 in quasi tutti i casi; il fuso dei test è
// Europe/Rome (vitest.config.mts), quindi il cambio d'ora del 25/10 è vero.
const OGGI = "2026-11-09";

describe("inizioPeriodo e giorniDelPeriodo", () => {
  it("la settimana va da lunedì a domenica, anche a cavallo di due mesi", () => {
    expect(inizioPeriodo("settimana", "2026-11-01")).toBe("2026-10-26");
    expect(giorniDelPeriodo("settimana", "2026-10-26")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("la settimana del cambio d'ora ha sette giorni distinti", () => {
    const giorni = giorniDelPeriodo("settimana", inizioPeriodo("settimana", "2026-10-25"));
    expect(giorni[0]).toBe("2026-10-19");
    expect(giorni[6]).toBe("2026-10-25");
    expect(new Set(giorni).size).toBe(7);
  });

  it("il mese ha tutti i suoi giorni: febbraio 28 o 29, novembre 30", () => {
    expect(inizioPeriodo("mese", "2026-02-14")).toBe("2026-02-01");
    expect(giorniDelPeriodo("mese", "2026-02-01")).toHaveLength(28);
    expect(giorniDelPeriodo("mese", "2028-02-01").at(-1)).toBe("2028-02-29");
    const novembre = giorniDelPeriodo("mese", "2026-11-01");
    expect(novembre).toHaveLength(30);
    expect(novembre.at(-1)).toBe("2026-11-30");
  });

  it("il mese del cambio d'ora non perde né ripete giorni", () => {
    const ottobre = giorniDelPeriodo("mese", "2026-10-01");
    expect(ottobre).toHaveLength(31);
    expect(new Set(ottobre).size).toBe(31);
    expect(ottobre.at(-1)).toBe("2026-10-31");
  });
});

describe("periodoAdiacente", () => {
  it("settimane: sette giorni avanti o indietro, anche oltre il cambio d'ora", () => {
    expect(periodoAdiacente("settimana", "2026-10-19", 1)).toBe("2026-10-26");
    expect(periodoAdiacente("settimana", "2026-10-26", -1)).toBe("2026-10-19");
  });

  it("mesi: il primo del mese prima o dopo, anche a cavallo d'anno", () => {
    expect(periodoAdiacente("mese", "2026-03-01", -1)).toBe("2026-02-01");
    expect(periodoAdiacente("mese", "2026-12-01", 1)).toBe("2027-01-01");
  });
});

describe("limitiFrecce", () => {
  it("nel periodo in corso › è spenta; ‹ accesa se ci sono voci prima", () => {
    expect(limitiFrecce("settimana", "2026-11-09", "2026-09-21", OGGI)).toEqual({
      precedente: true,
      successivo: false,
    });
    expect(limitiFrecce("mese", "2026-11-01", "2026-09-21", OGGI)).toEqual({
      precedente: true,
      successivo: false,
    });
  });

  it("nel periodo della prima voce ‹ è spenta, anche se la voce è a metà periodo", () => {
    // 23/09 è un mercoledì: il suo periodo parte da lunedì 21/09.
    expect(limitiFrecce("settimana", "2026-09-21", "2026-09-23", OGGI)).toEqual({
      precedente: false,
      successivo: true,
    });
    expect(limitiFrecce("mese", "2026-09-01", "2026-09-23", OGGI)).toEqual({
      precedente: false,
      successivo: true,
    });
  });

  it("senza voci tutte e due spente", () => {
    expect(limitiFrecce("settimana", "2026-11-09", null, OGGI)).toEqual({
      precedente: false,
      successivo: false,
    });
  });

  it("una prima voce dopo oggi non sposta il limite oltre il periodo in corso", () => {
    expect(limitiFrecce("settimana", "2026-11-09", "2026-11-20", OGGI)).toEqual({
      precedente: false,
      successivo: false,
    });
  });

  it("il mese in corso con oggi l'ultimo del mese", () => {
    expect(limitiFrecce("mese", "2026-10-01", "2026-09-01", "2026-10-31")).toEqual({
      precedente: true,
      successivo: false,
    });
  });
});

describe("etichettaPeriodo", () => {
  it("settimana in un mese solo: «2 – 8 novembre»", () => {
    expect(etichettaPeriodo("settimana", "2026-11-02", OGGI)).toEqual({
      titolo: "2 – 8 novembre",
      sottotitolo: "Settimana scorsa",
    });
  });

  it("settimana a cavallo di due mesi o di due anni: giorno e mese breve ai due capi", () => {
    // Quella che parte lunedì 26/10 finisce domenica 1/11 (il «27 ott – 2 nov»
    // del brief è la stessa forma, ma nel 2026 il 27/10 è un martedì).
    expect(etichettaPeriodo("settimana", "2026-10-26", OGGI).titolo).toBe("26 ott – 1 nov");
    expect(etichettaPeriodo("settimana", "2026-12-28", OGGI).titolo).toBe("28 dic – 3 gen");
  });

  it("«Questa settimana», «Settimana scorsa», niente per le altre", () => {
    expect(etichettaPeriodo("settimana", "2026-11-09", OGGI).sottotitolo).toBe("Questa settimana");
    expect(etichettaPeriodo("settimana", "2026-11-02", OGGI).sottotitolo).toBe("Settimana scorsa");
    expect(etichettaPeriodo("settimana", "2026-10-26", OGGI).sottotitolo).toBeNull();
    // Domenica: la settimana in corso è ancora quella del lunedì prima.
    expect(etichettaPeriodo("settimana", "2026-11-09", "2026-11-15").sottotitolo).toBe(
      "Questa settimana"
    );
  });

  it("mese: «Novembre 2026» e «Questo mese» solo per quello in corso", () => {
    expect(etichettaPeriodo("mese", "2026-11-01", OGGI)).toEqual({
      titolo: "Novembre 2026",
      sottotitolo: "Questo mese",
    });
    expect(etichettaPeriodo("mese", "2026-10-01", OGGI)).toEqual({
      titolo: "Ottobre 2026",
      sottotitolo: null,
    });
  });
});

describe("etichettaBarra", () => {
  it("settimana: L M M G V S D", () => {
    const lettere = [
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ].map((g) => etichettaBarra("settimana", g, OGGI));
    expect(lettere).toEqual(["L", "M", "M", "G", "V", "S", "D"]);
  });

  it("mese: solo 1, 8, 15, 22, 29 e oggi", () => {
    const etichette = Array.from({ length: 30 }, (_, i) =>
      etichettaBarra("mese", `2026-11-${String(i + 1).padStart(2, "0")}`, OGGI)
    ).filter((e) => e !== "");
    expect(etichette).toEqual(["1", "8", "9", "15", "22", "29"]);
  });
});

describe("periodoDaIndirizzo (?vista=…&dal=…)", () => {
  const PRIMA_VOCE = "2026-09-23";
  const SETTIMANA_IN_CORSO = { modo: "settimana", inizio: "2026-11-09" };

  it("un periodo valido si apre com'è", () => {
    expect(periodoDaIndirizzo("mese", "2026-10-01", PRIMA_VOCE, OGGI)).toEqual({
      modo: "mese",
      inizio: "2026-10-01",
    });
    expect(periodoDaIndirizzo("settimana", "2026-09-21", PRIMA_VOCE, OGGI)).toEqual({
      modo: "settimana",
      inizio: "2026-09-21",
    });
  });

  it("senza parametri: la settimana in corso", () => {
    expect(periodoDaIndirizzo(null, null, PRIMA_VOCE, OGGI)).toEqual(SETTIMANA_IN_CORSO);
  });

  it("vista sconosciuta o dal mancante: la settimana in corso", () => {
    expect(periodoDaIndirizzo("anno", "2026-10-01", PRIMA_VOCE, OGGI)).toEqual(SETTIMANA_IN_CORSO);
    expect(periodoDaIndirizzo("mese", null, PRIMA_VOCE, OGGI)).toEqual(SETTIMANA_IN_CORSO);
  });

  it("dal malformato o inesistente: la settimana in corso", () => {
    expect(periodoDaIndirizzo("mese", "ottobre", PRIMA_VOCE, OGGI)).toEqual(SETTIMANA_IN_CORSO);
    expect(periodoDaIndirizzo("settimana", "2026-02-30", PRIMA_VOCE, OGGI)).toEqual(
      SETTIMANA_IN_CORSO
    );
    // Ha la forma del primo di un mese e non è nel futuro, ma il mese 13
    // non esiste.
    expect(periodoDaIndirizzo("mese", "2025-13-01", "2025-09-01", OGGI)).toEqual(
      SETTIMANA_IN_CORSO
    );
  });

  it("una prima voce dopo oggi non toglie il periodo in corso", () => {
    // Solo voci pianificate per dicembre: novembre resta apribile.
    expect(periodoDaIndirizzo("mese", "2026-11-01", "2026-12-02", OGGI)).toEqual({
      modo: "mese",
      inizio: "2026-11-01",
    });
  });

  it("dal che non è l'inizio di un periodo: la settimana in corso", () => {
    expect(periodoDaIndirizzo("settimana", "2026-11-04", PRIMA_VOCE, OGGI)).toEqual(
      SETTIMANA_IN_CORSO
    );
    expect(periodoDaIndirizzo("mese", "2026-10-15", PRIMA_VOCE, OGGI)).toEqual(SETTIMANA_IN_CORSO);
  });

  it("periodo futuro: la settimana in corso", () => {
    expect(periodoDaIndirizzo("settimana", "2026-11-16", PRIMA_VOCE, OGGI)).toEqual(
      SETTIMANA_IN_CORSO
    );
    expect(periodoDaIndirizzo("mese", "2026-12-01", PRIMA_VOCE, OGGI)).toEqual(SETTIMANA_IN_CORSO);
  });

  it("prima del periodo della prima voce: la settimana in corso", () => {
    expect(periodoDaIndirizzo("settimana", "2026-09-14", PRIMA_VOCE, OGGI)).toEqual(
      SETTIMANA_IN_CORSO
    );
    expect(periodoDaIndirizzo("mese", "2026-08-01", PRIMA_VOCE, OGGI)).toEqual(SETTIMANA_IN_CORSO);
    // Senza voci vale solo il periodo in corso.
    expect(periodoDaIndirizzo("mese", "2026-11-01", null, OGGI)).toEqual({
      modo: "mese",
      inizio: "2026-11-01",
    });
    expect(periodoDaIndirizzo("mese", "2026-10-01", null, OGGI)).toEqual(SETTIMANA_IN_CORSO);
  });
});
