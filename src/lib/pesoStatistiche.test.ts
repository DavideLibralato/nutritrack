// Il grafico del peso di Statistiche (PUNTO_DI_PARTENZA.md, sezione 3,
// "Statistiche", "Peso"): la finestra di 12 settimane, le pesate per
// giorno, i testi. Oggi è mercoledì 11 novembre 2026: la finestra parte
// dal 19 agosto (84 giorni prima).

import { describe, it, expect } from "vitest";
import {
  pesateVive,
  graficoPeso,
  testoDifferenzaPeso,
  testoUltimaPesataStatistiche,
  testoValorePeso,
  SETTIMANE_PESO,
} from "./pesoStatistiche";
import type { Misurazione } from "./db/tipi";

const OGGI = "2026-11-11";

function pesata(data: string, valore: number, modifiche: Partial<Misurazione> = {}): Misurazione {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: `${data}T08:00:00.000Z`,
    deleted_at: null,
    tipo: "peso",
    valore,
    unita: "kg",
    data,
    ...modifiche,
  };
}

describe("pesateVive", () => {
  it("solo peso, vive, non future, dalla più vecchia", () => {
    const righe = [
      pesata("2026-10-24", 84.3),
      pesata("2026-09-20", 83.3),
      pesata("2026-10-01", 90, { tipo: "vita", unita: "cm" }),
      pesata("2026-10-10", 83.8, { deleted_at: "2026-10-10T09:00:00.000Z" }),
      pesata("2026-11-12", 84),
    ];
    expect(pesateVive(righe, OGGI)).toEqual([
      { data: "2026-09-20", valore: 83.3 },
      { data: "2026-10-24", valore: 84.3 },
    ]);
  });

  it("due pesate nello stesso giorno: vince la più recente come istante", () => {
    const righe = [
      pesata("2026-10-24", 84.3, { updated_at: "2026-10-24T09:00:00.000Z" }),
      // Più tardi come istante (09:30 UTC), ma come stringa viene prima:
      // il confronto deve essere fra istanti, non fra testi.
      pesata("2026-10-24", 84.1, { updated_at: "2026-10-24T08:30:00-01:00" }),
    ];
    expect(pesateVive(righe, OGGI)).toEqual([{ data: "2026-10-24", valore: 84.1 }]);
  });
});

describe("graficoPeso", () => {
  it("le 12 settimane sono 84 giorni", () => {
    expect(SETTIMANE_PESO).toBe(12);
  });

  it("nessuna pesata", () => {
    expect(graficoPeso([], OGGI)).toEqual({ stato: "nessuna" });
  });

  it("meno di 12 settimane di pesate: tutte, asse dalla prima a oggi", () => {
    const r = graficoPeso([pesata("2026-09-20", 83.3), pesata("2026-10-24", 84.3)], OGGI);
    expect(r).toEqual({
      stato: "pesate",
      pesate: [
        { data: "2026-09-20", valore: 83.3 },
        { data: "2026-10-24", valore: 84.3 },
      ],
      inizioAsse: "2026-09-20",
      fineAsse: OGGI,
    });
  });

  it("pesate più vecchie: solo quelle delle 12 settimane, asse dall'inizio della finestra", () => {
    const r = graficoPeso(
      [
        pesata("2026-07-01", 86),
        pesata("2026-08-18", 85.5),
        pesata("2026-09-02", 85),
        pesata("2026-10-24", 84),
      ],
      OGGI
    );
    // L'asse parte dal 19/08, non dalla prima pesata mostrata (2/09).
    expect(r).toMatchObject({ stato: "pesate", inizioAsse: "2026-08-19", fineAsse: OGGI });
    if (r.stato !== "pesate") throw new Error("atteso stato pesate");
    expect(r.pesate.map((p) => p.data)).toEqual(["2026-09-02", "2026-10-24"]);
  });

  it("il primo giorno della finestra è dentro, il giorno prima fuori", () => {
    const r = graficoPeso([pesata("2026-08-18", 85.5), pesata("2026-08-19", 85)], OGGI);
    if (r.stato !== "pesate") throw new Error("atteso stato pesate");
    expect(r.pesate.map((p) => p.data)).toEqual(["2026-08-19"]);
  });

  it("tutte più vecchie di 12 settimane: l'ultima, fuori dalla finestra", () => {
    expect(graficoPeso([pesata("2026-06-01", 86), pesata("2026-08-18", 85.5)], OGGI)).toEqual({
      stato: "fuori-finestra",
      ultima: { data: "2026-08-18", valore: 85.5 },
    });
  });
});

describe("testi del peso", () => {
  it("la differenza con un decimale e il segno, dalla prima pesata mostrata", () => {
    expect(
      testoDifferenzaPeso([
        { data: "2026-09-20", valore: 83.3 },
        { data: "2026-10-24", valore: 84.3 },
      ])
    ).toBe("+1,0 kg dal 20 set");
    expect(
      testoDifferenzaPeso([
        { data: "2026-10-03", valore: 84.4 },
        { data: "2026-10-24", valore: 84 },
      ])
    ).toBe("−0,4 kg dal 3 ott");
  });

  it("una differenza che arrotondata fa zero non ha segno", () => {
    expect(
      testoDifferenzaPeso([
        { data: "2026-10-03", valore: 84.04 },
        { data: "2026-10-24", valore: 84 },
      ])
    ).toBe("0,0 kg dal 3 ott");
  });

  it("una pesata sola: nessuna differenza", () => {
    expect(testoDifferenzaPeso([{ data: "2026-10-24", valore: 84 }])).toBeNull();
  });

  it("l'ultima pesata: giorni fa, oggi, ieri, e l'anno solo se è un altro", () => {
    expect(testoUltimaPesataStatistiche("2026-10-26", OGGI)).toBe(
      "Ultima pesata 26 ott, 16 giorni fa"
    );
    expect(testoUltimaPesataStatistiche(OGGI, OGGI)).toBe("Ultima pesata oggi");
    expect(testoUltimaPesataStatistiche("2026-11-10", OGGI)).toBe("Ultima pesata ieri");
    expect(testoUltimaPesataStatistiche("2026-11-09", OGGI)).toBe(
      "Ultima pesata 9 nov, 2 giorni fa"
    );
    expect(testoUltimaPesataStatistiche("2025-12-30", "2026-01-02")).toBe(
      "Ultima pesata 30 dic 2025, 3 giorni fa"
    );
  });

  it("il valore accanto al punto: decimale solo se c'è, con la virgola", () => {
    expect(testoValorePeso(84)).toBe("84");
    expect(testoValorePeso(84.3)).toBe("84,3");
  });
});
