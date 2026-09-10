import { describe, it, expect } from "vitest";
import {
  pastoPerOrario,
  primoPastoVuoto,
  oraInizioPrimoPasto,
} from "./propostaPasto";
import type { Pasto } from "../db/tipi";

function pasto(nome: string, ora_inizio: string, ordine: number): Pasto {
  return {
    id: `pasto-${ordine}`,
    user_id: "u1",
    updated_at: "2026-09-04T00:00:00.000Z",
    deleted_at: null,
    nome,
    ora_inizio,
    ordine,
  };
}

// Il set predefinito della sezione 4.
const SET = [
  pasto("Colazione", "06:00", 0),
  pasto("Spuntino mattina", "10:00", 1),
  pasto("Pranzo", "12:30", 2),
  pasto("Spuntino pomeriggio", "16:00", 3),
  pasto("Cena", "19:30", 4),
];

describe("pastoPerOrario", () => {
  it("colloca un orario nel pasto la cui fascia lo contiene", () => {
    expect(pastoPerOrario(SET, "07:30")?.nome).toBe("Colazione");
    expect(pastoPerOrario(SET, "11:00")?.nome).toBe("Spuntino mattina");
    expect(pastoPerOrario(SET, "13:00")?.nome).toBe("Pranzo");
    expect(pastoPerOrario(SET, "21:45")?.nome).toBe("Cena");
  });

  it("l'orario esatto di inizio appartiene a quel pasto", () => {
    expect(pastoPerOrario(SET, "06:00")?.nome).toBe("Colazione");
    expect(pastoPerOrario(SET, "12:30")?.nome).toBe("Pranzo");
    expect(pastoPerOrario(SET, "19:30")?.nome).toBe("Cena");
  });

  it("un orario prima del primo pasto ricade nella Cena (fascia che scavalca la mezzanotte)", () => {
    expect(pastoPerOrario(SET, "05:59")?.nome).toBe("Cena");
    expect(pastoPerOrario(SET, "00:30")?.nome).toBe("Cena");
    expect(pastoPerOrario(SET, "03:00")?.nome).toBe("Cena");
  });

  it("non dipende dall'ordine in cui arrivano i pasti", () => {
    const mescolati = [SET[3], SET[0], SET[4], SET[1], SET[2]];
    expect(pastoPerOrario(mescolati, "13:00")?.nome).toBe("Pranzo");
    expect(pastoPerOrario(mescolati, "04:00")?.nome).toBe("Cena");
  });

  it("lista vuota → null", () => {
    expect(pastoPerOrario([], "12:00")).toBeNull();
  });
});

describe("primoPastoVuoto", () => {
  it("propone il primo pasto senza voci", () => {
    const conVoci = new Set(["pasto-0", "pasto-1"]); // Colazione e Spuntino mattina pieni
    expect(primoPastoVuoto(SET, conVoci)?.nome).toBe("Pranzo");
  });

  it("se sono tutti pieni propone l'ultimo", () => {
    const conVoci = new Set(SET.map((p) => p.id));
    expect(primoPastoVuoto(SET, conVoci)?.nome).toBe("Cena");
  });

  it("se sono tutti vuoti propone il primo", () => {
    expect(primoPastoVuoto(SET, new Set())?.nome).toBe("Colazione");
  });

  it("lista vuota → null", () => {
    expect(primoPastoVuoto([], new Set())).toBeNull();
  });
});

describe("oraInizioPrimoPasto", () => {
  it("restituisce l'ora del pasto più mattiniero", () => {
    expect(oraInizioPrimoPasto(SET)).toBe("06:00");
  });

  it("guarda l'ora, non l'ordine: un pasto riordinato in cima ma serale non conta", () => {
    // La Cena (19:30) messa come primo per `ordine`, la Colazione (06:00) per
    // ultima: il primo pasto della giornata resta quello delle 06:00.
    const riordinati = [
      { ...SET[4], ordine: 0 },
      { ...SET[1], ordine: 1 },
      { ...SET[2], ordine: 2 },
      { ...SET[3], ordine: 3 },
      { ...SET[0], ordine: 4 },
    ];
    expect(oraInizioPrimoPasto(riordinati)).toBe("06:00");
  });

  it("lista vuota → null", () => {
    expect(oraInizioPrimoPasto([])).toBeNull();
  });
});
