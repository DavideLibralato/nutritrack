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

describe("dataScrivibile (Duplica su un altro giorno)", () => {
  const adesso = new Date(2026, 9, 6, 15, 0, 0); // 6 ottobre, pomeriggio

  it("oggi e i giorni passati sì, domani no", () => {
    expect(dataScrivibile("2026-10-06", adesso)).toBe(true);
    expect(dataScrivibile("2025-12-31", adesso)).toBe(true);
    expect(dataScrivibile("2026-10-07", adesso)).toBe(false);
  });

  it("mezzanotte passata: il giorno nuovo è già scrivibile (orologio locale, non UTC)", () => {
    // 00:30 del 7 ottobre a Roma è ancora il 6 ottobre in UTC.
    const dopoMezzanotte = new Date(2026, 9, 7, 0, 30, 0);
    expect(dataScrivibile("2026-10-07", dopoMezzanotte)).toBe(true);
    expect(dataScrivibile("2026-10-08", dopoMezzanotte)).toBe(false);
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
