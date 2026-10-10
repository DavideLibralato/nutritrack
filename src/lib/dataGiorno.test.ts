import { describe, it, expect } from "vitest";
import {
  oggiLocale,
  giornoPrecedente,
  giornoSuccessivo,
  eOggi,
  eFuturo,
  giornoSettimanaDi,
  dataScrivibile,
  formattaGiornoCorto,
  GIORNI_FUTURI_DIARIO,
  ultimoGiornoDiario,
  eGiornoVero,
  prossimoLunedi,
} from "./dataGiorno";

describe("oggiLocale", () => {
  it("usa la data dell'orologio locale, non UTC", () => {
    // 1 gennaio 2026, 00:30 ora locale: in UTC (Roma = +1) è ancora il 31
    // dicembre 2025. Deve vincere il locale.
    const mezzanotteAndata = new Date(2026, 0, 1, 0, 30, 0);
    expect(oggiLocale(mezzanotteAndata)).toBe("2026-01-01");
  });

  it("mette lo zero davanti a mese e giorno a una cifra", () => {
    expect(oggiLocale(new Date(2026, 2, 5, 12, 0, 0))).toBe("2026-03-05");
  });
});

describe("giornoPrecedente / giornoSuccessivo", () => {
  it("attraversa il cambio di mese", () => {
    expect(giornoPrecedente("2026-03-01")).toBe("2026-02-28");
    expect(giornoSuccessivo("2026-02-28")).toBe("2026-03-01");
  });

  it("attraversa il cambio di anno", () => {
    expect(giornoPrecedente("2026-01-01")).toBe("2025-12-31");
    expect(giornoSuccessivo("2025-12-31")).toBe("2026-01-01");
  });

  it("gestisce il 29 febbraio di un anno bisestile", () => {
    expect(giornoSuccessivo("2028-02-28")).toBe("2028-02-29");
    expect(giornoSuccessivo("2028-02-29")).toBe("2028-03-01");
  });

  it("resta stabile a cavallo del cambio d'ora legale (ultima domenica di marzo)", () => {
    // In Italia l'ora legale 2026 scatta nella notte fra il 28 e il 29 marzo.
    // Sommando un giorno si deve ottenere il 29, non il 30 né restare al 28.
    expect(giornoSuccessivo("2026-03-28")).toBe("2026-03-29");
    expect(giornoPrecedente("2026-03-29")).toBe("2026-03-28");
  });
});

describe("eOggi / eFuturo", () => {
  const adesso = new Date(2026, 8, 4, 15, 0, 0); // 4 settembre 2026

  it("riconosce il giorno corrente", () => {
    expect(eOggi("2026-09-04", adesso)).toBe(true);
    expect(eOggi("2026-09-03", adesso)).toBe(false);
  });

  it("riconosce un giorno futuro", () => {
    expect(eFuturo("2026-09-05", adesso)).toBe(true);
    expect(eFuturo("2026-09-04", adesso)).toBe(false);
    expect(eFuturo("2026-09-03", adesso)).toBe(false);
  });
});

describe("giornoSettimanaDi", () => {
  it("riconosce ogni giorno della settimana (4-10 settembre 2026, venerdì-giovedì)", () => {
    expect(giornoSettimanaDi("2026-09-04")).toBe("venerdi");
    expect(giornoSettimanaDi("2026-09-05")).toBe("sabato");
    expect(giornoSettimanaDi("2026-09-06")).toBe("domenica");
    expect(giornoSettimanaDi("2026-09-07")).toBe("lunedi");
    expect(giornoSettimanaDi("2026-09-08")).toBe("martedi");
    expect(giornoSettimanaDi("2026-09-09")).toBe("mercoledi");
    expect(giornoSettimanaDi("2026-09-10")).toBe("giovedi");
  });

  it("attraversa il cambio di mese e di anno", () => {
    expect(giornoSettimanaDi("2026-03-01")).toBe("domenica");
    expect(giornoSettimanaDi("2026-01-01")).toBe("giovedi");
  });
});

describe("ultimoGiornoDiario: oggi + 7, incluso", () => {
  it("il limite è sette giorni dopo oggi", () => {
    expect(GIORNI_FUTURI_DIARIO).toBe(7);
    expect(ultimoGiornoDiario(new Date(2026, 9, 6, 15, 0, 0))).toBe("2026-10-13");
  });

  it("attraversa il cambio di mese e di anno", () => {
    expect(ultimoGiornoDiario(new Date(2026, 9, 28, 15, 0, 0))).toBe("2026-11-04");
    expect(ultimoGiornoDiario(new Date(2026, 11, 28, 15, 0, 0))).toBe("2027-01-04");
  });

  it("resta stabile a cavallo del cambio d'ora (ultima domenica di ottobre e di marzo)", () => {
    // 25/10/2026 e 29/3/2026: un giorno di 25 e uno di 23 ore nel mezzo.
    // Sommare 7 × 24 h sbaglierebbe giorno proprio a queste ore: alle 00:30
    // finirebbe alle 23:30 del giorno prima, alle 23:30 all'00:30 di quello
    // dopo.
    expect(ultimoGiornoDiario(new Date(2026, 9, 20, 0, 30, 0))).toBe("2026-10-27");
    expect(ultimoGiornoDiario(new Date(2026, 2, 24, 23, 30, 0))).toBe("2026-03-31");
  });
});

describe("dataScrivibile (diario: Duplica, Oggi, Aggiungi)", () => {
  const adesso = new Date(2026, 9, 6, 15, 0, 0); // 6 ottobre, pomeriggio

  it("i giorni passati, oggi e fino a oggi + 7 sì, oggi + 8 no", () => {
    expect(dataScrivibile("2025-12-31", adesso)).toBe(true);
    expect(dataScrivibile("2026-10-06", adesso)).toBe(true);
    expect(dataScrivibile("2026-10-07", adesso)).toBe(true);
    expect(dataScrivibile("2026-10-13", adesso)).toBe(true);
    expect(dataScrivibile("2026-10-14", adesso)).toBe(false);
    expect(dataScrivibile("2027-10-06", adesso)).toBe(false);
  });

  it("mezzanotte passata: il limite si è già spostato (orologio locale, non UTC)", () => {
    // 00:30 del 7 ottobre a Roma è ancora il 6 ottobre in UTC: col giorno
    // UTC il 14 sarebbe ancora fuori.
    const dopoMezzanotte = new Date(2026, 9, 7, 0, 30, 0);
    expect(dataScrivibile("2026-10-14", dopoMezzanotte)).toBe(true);
    expect(dataScrivibile("2026-10-15", dopoMezzanotte)).toBe(false);
  });

  it("vuota, malformata o inesistente: no", () => {
    expect(dataScrivibile("", adesso)).toBe(false);
    expect(dataScrivibile("6/10/2026", adesso)).toBe(false);
    expect(dataScrivibile("2026-02-30", adesso)).toBe(false);
  });

  it("formattaGiornoCorto: «lun 5 ott»", () => {
    expect(formattaGiornoCorto("2026-10-05")).toBe("lun 5 ott");
  });
});

describe("prossimoLunedi ed eGiornoVero (Pasti e orari, «Da una data»)", () => {
  it("il primo lunedì dopo oggi; se oggi è lunedì, quello dopo; anche a cavallo di mese", () => {
    expect(prossimoLunedi("2026-10-10")).toBe("2026-10-12"); // sabato
    expect(prossimoLunedi("2026-10-11")).toBe("2026-10-12"); // domenica
    expect(prossimoLunedi("2026-10-12")).toBe("2026-10-19"); // lunedì
    expect(prossimoLunedi("2026-10-29")).toBe("2026-11-02");
  });

  it("un giorno vero: la forma giusta e una data che esiste", () => {
    expect(eGiornoVero("2026-10-12")).toBe(true);
    expect(eGiornoVero("2026-02-30")).toBe(false);
    expect(eGiornoVero("12/10/2026")).toBe(false);
    expect(eGiornoVero("")).toBe(false);
  });
});
