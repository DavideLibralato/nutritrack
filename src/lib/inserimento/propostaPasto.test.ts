import { describe, it, expect } from "vitest";
import {
  pastoPerOrario,
  primoPastoVuoto,
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

  // Il giorno è quello del calendario (PUNTO_DI_PARTENZA.md, sezione 4): fra
  // mezzanotte e il primo pasto si propone il primo pasto, non la Cena, che
  // sarebbe quella di stasera, non ancora mangiata.
  it("un orario prima del primo pasto propone il primo pasto (Colazione)", () => {
    expect(pastoPerOrario(SET, "00:30")?.nome).toBe("Colazione");
    expect(pastoPerOrario(SET, "05:57")?.nome).toBe("Colazione");
    expect(pastoPerOrario(SET, "06:00")?.nome).toBe("Colazione");
  });

  it("la sera resta la Cena fino a mezzanotte", () => {
    expect(pastoPerOrario(SET, "23:30")?.nome).toBe("Cena");
    expect(pastoPerOrario(SET, "23:59")?.nome).toBe("Cena");
  });

  it("rispetta orari personalizzati: primo pasto alle 07:30, alle 07:00 propone il primo pasto", () => {
    const personalizzati = [
      pasto("Colazione", "07:30", 0),
      pasto("Pranzo", "13:00", 1),
      pasto("Cena", "20:00", 2),
    ];
    expect(pastoPerOrario(personalizzati, "07:00")?.nome).toBe("Colazione");
    expect(pastoPerOrario(personalizzati, "07:30")?.nome).toBe("Colazione");
    expect(pastoPerOrario(personalizzati, "12:59")?.nome).toBe("Colazione");
  });

  it("il primo pasto è il più mattiniero per ora, non il primo per ordine", () => {
    // La Cena messa in cima per `ordine`: alle 03:00 si propone comunque la
    // Colazione, perché è lei il pasto che inizia per primo.
    const riordinati = [
      { ...SET[4], ordine: 0 },
      { ...SET[1], ordine: 1 },
      { ...SET[2], ordine: 2 },
      { ...SET[3], ordine: 3 },
      { ...SET[0], ordine: 4 },
    ];
    expect(pastoPerOrario(riordinati, "03:00")?.nome).toBe("Colazione");
  });

  it("accetta ora_inizio come 'HH:mm:ss' (come arriva da Postgres): l'ora esatta resta di quel pasto", () => {
    const daPostgres = SET.map((p) => ({ ...p, ora_inizio: `${p.ora_inizio}:00` }));
    expect(pastoPerOrario(daPostgres, "06:00")?.nome).toBe("Colazione");
    expect(pastoPerOrario(daPostgres, "12:30")?.nome).toBe("Pranzo");
    expect(pastoPerOrario(daPostgres, "19:30")?.nome).toBe("Cena");
    expect(pastoPerOrario(daPostgres, "00:30")?.nome).toBe("Colazione");
  });

  it("non dipende dall'ordine in cui arrivano i pasti", () => {
    const mescolati = [SET[3], SET[0], SET[4], SET[1], SET[2]];
    expect(pastoPerOrario(mescolati, "13:00")?.nome).toBe("Pranzo");
    expect(pastoPerOrario(mescolati, "04:00")?.nome).toBe("Colazione");
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
