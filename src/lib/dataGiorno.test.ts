import { describe, it, expect } from "vitest";
import {
  oggiLocale,
  giornoPrecedente,
  giornoSuccessivo,
  eOggi,
  eFuturo,
  giornoLogico,
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

describe("giornoLogico", () => {
  // Primo pasto = Colazione alle 06:00 (set predefinito).
  const PRIMO = "06:00";

  it("in pieno giorno il giorno logico è l'oggi del calendario", () => {
    const pomeriggio = new Date(2026, 8, 10, 15, 30, 0);
    expect(giornoLogico(PRIMO, pomeriggio)).toBe("2026-09-10");
  });

  it("un inserimento prima dell'ora del primo pasto appartiene a ieri", () => {
    // L'una di notte del 10 settembre: la Cena di ieri, non la Colazione di
    // oggi (sezione "Il giorno logico").
    const unaDiNotte = new Date(2026, 8, 10, 1, 0, 0);
    expect(giornoLogico(PRIMO, unaDiNotte)).toBe("2026-09-09");
  });

  it("appena prima dell'ora del primo pasto è ancora ieri", () => {
    const alle0559 = new Date(2026, 8, 10, 5, 59, 0);
    expect(giornoLogico(PRIMO, alle0559)).toBe("2026-09-09");
  });

  it("all'ora esatta di inizio del primo pasto è già oggi", () => {
    const alle0600 = new Date(2026, 8, 10, 6, 0, 0);
    expect(giornoLogico(PRIMO, alle0600)).toBe("2026-09-10");
  });

  it("attraversa il cambio di mese (1° del mese all'una di notte → ultimo del mese prima)", () => {
    const primoMarzoNotte = new Date(2026, 2, 1, 0, 30, 0);
    expect(giornoLogico(PRIMO, primoMarzoNotte)).toBe("2026-02-28");
  });

  it("rispetta un primo pasto spostato prima (Colazione alle 05:00)", () => {
    const alle0530 = new Date(2026, 8, 10, 5, 30, 0);
    expect(giornoLogico("05:00", alle0530)).toBe("2026-09-10");
    expect(giornoLogico("05:00", new Date(2026, 8, 10, 4, 30, 0))).toBe(
      "2026-09-09"
    );
  });

  it("senza pasti (null) vale sempre l'oggi del calendario, anche all'una di notte", () => {
    const unaDiNotte = new Date(2026, 8, 10, 1, 0, 0);
    expect(giornoLogico(null, unaDiNotte)).toBe("2026-09-10");
  });

  it("accetta anche 'HH:mm:ss' (come arriva da Postgres) senza cambiare esito", () => {
    expect(giornoLogico("06:00:00", new Date(2026, 8, 10, 1, 0, 0))).toBe(
      "2026-09-09"
    );
    expect(giornoLogico("06:00:00", new Date(2026, 8, 10, 9, 0, 0))).toBe(
      "2026-09-10"
    );
  });
});
