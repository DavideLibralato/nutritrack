// Quali pasti esistono in un giorno (PUNTO_DI_PARTENZA.md, sezione 3, "I
// pasti"): logica sottile, test permanenti. Un errore qui non fa crashare
// niente — mostra un pasto in un giorno in cui non c'era, o lo nasconde
// con le sue voci dentro mentre i totali le contano ancora.

import { describe, it, expect } from "vitest";
import {
  opzioniPastoDellaVoce,
  ordinaPerOrario,
  pastiDaMostrare,
  pastiValidiIl,
  pastoValidoIl,
} from "./validitaPasti";
import type { Pasto, VoceDiario } from "../db/tipi";

function pasto(id: string, ora_inizio: string, altro: Partial<Pasto> = {}): Pasto {
  return {
    id, nome: id, ora_inizio, ordine: 0, user_id: "u1",
    updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null, ...altro,
  };
}

function voce(pasto_id: string | null, data: string, altro: Partial<VoceDiario> = {}): VoceDiario {
  return {
    id: crypto.randomUUID(), user_id: "u1", updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null,
    alimento_id: "a1", pasto_id, gruppo_id: null, quantita_g: 100, data,
    creato_il: "2026-10-01T00:00:00.000Z", consumato_alle: null,
    nome_alimento: "Mela", kcal_100g: 52, proteine_100g: 0.3, carboidrati_100g: 14, grassi_100g: 0.2,
    ...altro,
  };
}

const nomi = (pasti: { nome: string }[]) => pasti.map((p) => p.nome);

describe("pastoValidoIl", () => {
  const chiuso = pasto("chiuso", "12:00", { valido_dal: "2026-10-05", valido_al: "2026-10-10" });

  it("i confini sono inclusi: vale il primo e l'ultimo giorno", () => {
    expect(pastoValidoIl(chiuso, "2026-10-05")).toBe(true);
    expect(pastoValidoIl(chiuso, "2026-10-10")).toBe(true);
  });

  it("non vale il giorno prima dell'inizio né il giorno dopo la fine", () => {
    expect(pastoValidoIl(chiuso, "2026-10-04")).toBe(false);
    expect(pastoValidoIl(chiuso, "2026-10-11")).toBe(false);
  });

  it("null vuol dire nessun limite da quella parte", () => {
    expect(pastoValidoIl(pasto("p", "12:00", { valido_dal: null, valido_al: null }), "1990-01-01")).toBe(true);
    expect(pastoValidoIl(pasto("p", "12:00", { valido_dal: "2026-10-05", valido_al: null }), "2099-12-31")).toBe(true);
    expect(pastoValidoIl(pasto("p", "12:00", { valido_dal: null, valido_al: "2026-10-05" }), "1990-01-01")).toBe(true);
  });

  it("una riga salvata prima di Dexie version(6), senza le due chiavi, vale sempre", () => {
    const vecchia = pasto("vecchia", "12:00");
    expect("valido_dal" in vecchia).toBe(false);
    expect(pastoValidoIl(vecchia, "2026-10-09")).toBe(true);
  });

  it("una riga cancellata non vale mai, nemmeno dentro il suo periodo", () => {
    expect(pastoValidoIl(pasto("p", "12:00", { deleted_at: "2026-10-01T00:00:00.000Z" }), "2026-10-09")).toBe(false);
  });
});

describe("pastiValidiIl e ordinaPerOrario", () => {
  it("ordina per orario, con 'HH:mm' e 'HH:mm:ss' mescolati", () => {
    const pasti = [
      pasto("Cena", "19:30:00", { ordine: 0 }),
      pasto("Colazione", "06:00", { ordine: 4 }),
      pasto("Pranzo", "12:30:00", { ordine: 1 }),
      pasto("Spuntino", "10:00", { ordine: 2 }),
    ];
    expect(nomi(pastiValidiIl(pasti, "2026-10-09"))).toEqual(["Colazione", "Spuntino", "Pranzo", "Cena"]);
  });

  it("stessa ora scritta in due formati: è la stessa ora, decide `ordine`, poi `id`", () => {
    // Senza normalizzare, "12:30" verrebbe prima di "12:30:00" e l'ordine
    // dipenderebbe da dove è nata la riga (dispositivo o server).
    const pasti = [
      pasto("c", "12:30", { ordine: 2 }),
      pasto("a", "12:30", { ordine: 1 }),
      pasto("b", "12:30:00", { ordine: 0 }),
      pasto("d", "12:30:00", { ordine: 1 }),
    ];
    expect(nomi(ordinaPerOrario(pasti))).toEqual(["b", "a", "d", "c"]);
  });

  it("solo i pasti di quel giorno: fuori periodo e cancellati restano fuori", () => {
    const pasti = [
      pasto("Colazione", "06:00"),
      pasto("Merenda", "16:00", { valido_dal: "2026-10-10" }),
      pasto("Cena vecchia", "19:30", { valido_al: "2026-10-08" }),
      pasto("Cena", "20:00", { valido_dal: "2026-10-09" }),
      pasto("Spuntino", "10:00", { deleted_at: "2026-10-01T00:00:00.000Z" }),
    ];
    expect(nomi(pastiValidiIl(pasti, "2026-10-09"))).toEqual(["Colazione", "Cena"]);
    expect(nomi(pastiValidiIl(pasti, "2026-10-08"))).toEqual(["Colazione", "Cena vecchia"]);
  });

  it("un giorno prima di tutti i pasti: nessun pasto", () => {
    const pasti = [pasto("Colazione", "06:00", { valido_dal: "2026-10-01" })];
    expect(pastiValidiIl(pasti, "2026-09-30")).toEqual([]);
  });
});

describe("pastiDaMostrare (rete di sicurezza)", () => {
  const GIORNO = "2026-10-09";
  const pasti = [
    pasto("Colazione", "06:00"),
    pasto("Merenda chiusa", "16:00", { valido_al: "2026-10-08" }),
    pasto("Spuntino cancellato", "10:00", { deleted_at: "2026-10-01T00:00:00.000Z" }),
  ];

  it("un pasto fuori periodo con voci quel giorno si mostra, al suo posto per orario", () => {
    const voci = [voce("Merenda chiusa", GIORNO), voce("Spuntino cancellato", GIORNO)];
    expect(nomi(pastiDaMostrare(pasti, voci, GIORNO))).toEqual([
      "Colazione",
      "Spuntino cancellato",
      "Merenda chiusa",
    ]);
  });

  it("senza voci quel giorno, no", () => {
    expect(nomi(pastiDaMostrare(pasti, [], GIORNO))).toEqual(["Colazione"]);
  });

  it("le voci cancellate, o di un altro giorno, non lo tengono in vista", () => {
    const voci = [
      voce("Merenda chiusa", GIORNO, { deleted_at: "2026-10-09T10:00:00.000Z" }),
      voce("Spuntino cancellato", "2026-10-07"),
    ];
    expect(nomi(pastiDaMostrare(pasti, voci, GIORNO))).toEqual(["Colazione"]);
  });

  it("un pasto valido compare una volta sola, anche con le voci", () => {
    expect(nomi(pastiDaMostrare(pasti, [voce("Colazione", GIORNO)], GIORNO))).toEqual(["Colazione"]);
  });
});

describe("opzioniPastoDellaVoce", () => {
  const GIORNO = "2026-10-09";
  const pasti = [
    pasto("colazione", "06:00", { nome: "Colazione" }),
    pasto("merenda", "16:00", { nome: "Merenda", valido_al: "2026-10-08" }),
    pasto("cena", "19:30", { nome: "Cena" }),
  ];

  it("voce in un pasto valido: solo i pasti di quel giorno, con i loro nomi", () => {
    expect(opzioniPastoDellaVoce(pasti, { data: GIORNO, pasto_id: "colazione" })).toEqual([
      { id: "colazione", nome: "Colazione" },
      { id: "cena", nome: "Cena" },
    ]);
  });

  it("voce in un pasto non più in uso: c'è anche lui, al suo posto, con l'etichetta", () => {
    expect(opzioniPastoDellaVoce(pasti, { data: GIORNO, pasto_id: "merenda" })).toEqual([
      { id: "colazione", nome: "Colazione" },
      { id: "merenda", nome: "Merenda · non più in uso" },
      { id: "cena", nome: "Cena" },
    ]);
  });

  it("lo stesso pasto in un giorno in cui valeva: nessuna etichetta", () => {
    expect(opzioniPastoDellaVoce(pasti, { data: "2026-10-08", pasto_id: "merenda" })).toEqual([
      { id: "colazione", nome: "Colazione" },
      { id: "merenda", nome: "Merenda" },
      { id: "cena", nome: "Cena" },
    ]);
  });
});
