// L'ordinamento di Impostazioni > Alimenti. Un errore qui non fa rumore:
// l'elenco esce comunque, solo in un ordine leggermente sbagliato, e ci si
// accorge mesi dopo che l'alimento più usato non è in cima. I casi sottili:
// - una voce cancellata da Oggi non è un uso;
// - una voce senza alimento_id non conta per nessuno;
// - un alimento mai usato vale 0 (in fondo a "Più usati", in cima a
//   "Meno usati");
// - a parità di usi l'ordine è A → Z in tutti e due i versi;
// - l'ordine alfabetico è quello italiano, non quello dei codici dei
//   caratteri (maiuscole e accenti);
// - stesso nome: senza marca prima, poi per marca.

import { describe, it, expect } from "vitest";
import { contaUsi, ordinaCatalogo } from "./ordinamentoCatalogo";
import type { Alimento, VoceDiario } from "../db/tipi";

const BASE = { user_id: "u1", updated_at: "2026-10-15T00:00:00.000Z", deleted_at: null };

function alimento(id: string, nome = id, marca: string | null = null): Alimento {
  return {
    ...BASE,
    id,
    nome,
    marca,
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

let contatore = 0;
function voce(alimentoId: string | null, deletedAt: string | null = null): VoceDiario {
  contatore++;
  return {
    ...BASE,
    id: `v${contatore}`,
    deleted_at: deletedAt,
    alimento_id: alimentoId,
    pasto_id: "p1",
    gruppo_id: null,
    quantita_g: 100,
    data: "2026-10-15",
    creato_il: "2026-10-15T08:00:00.000Z",
    consumato_alle: null,
    nome_alimento: alimentoId ?? "senza alimento",
    kcal_100g: 100,
    proteine_100g: 5,
    carboidrati_100g: 10,
    grassi_100g: 2,
  };
}

const nomi = (lista: Alimento[]) => lista.map((a) => a.nome);

describe("contaUsi", () => {
  it("conta una voce per uso, per ogni alimento", () => {
    const usi = contaUsi([voce("mela"), voce("pane"), voce("mela"), voce("mela")]);
    expect(usi.get("mela")).toBe(3);
    expect(usi.get("pane")).toBe(1);
  });

  it("non conta le voci cancellate", () => {
    const usi = contaUsi([voce("mela"), voce("mela", "2026-10-15T09:00:00.000Z")]);
    expect(usi.get("mela")).toBe(1);
  });

  it("non conta le voci senza alimento_id", () => {
    const usi = contaUsi([voce(null), voce(null)]);
    expect(usi.size).toBe(0);
  });

  it("un alimento mai usato non è nella mappa", () => {
    expect(contaUsi([voce("mela")]).has("pane")).toBe(false);
    expect(contaUsi([]).size).toBe(0);
  });
});

describe("ordinaCatalogo", () => {
  const avena = alimento("avena", "Avena");
  const banana = alimento("banana", "Banana");
  const pane = alimento("pane", "Pane");
  const uova = alimento("uova", "Uova");
  const catalogo = [pane, uova, avena, banana];
  // banana 3, uova 3, pane 1, avena mai usata.
  const usi = new Map([
    ["banana", 3],
    ["uova", 3],
    ["pane", 1],
  ]);

  it("Più usati: più usi prima, a parità A → Z, i mai usati in fondo", () => {
    expect(nomi(ordinaCatalogo(catalogo, usi, "piu-usati"))).toEqual([
      "Banana",
      "Uova",
      "Pane",
      "Avena",
    ]);
  });

  it("Meno usati: i mai usati in cima, a parità sempre A → Z (non rovesciato)", () => {
    expect(nomi(ordinaCatalogo(catalogo, usi, "meno-usati"))).toEqual([
      "Avena",
      "Pane",
      "Banana",
      "Uova",
    ]);
  });

  it("A → Z e Z → A ignorano gli usi", () => {
    expect(nomi(ordinaCatalogo(catalogo, usi, "a-z"))).toEqual([
      "Avena",
      "Banana",
      "Pane",
      "Uova",
    ]);
    expect(nomi(ordinaCatalogo(catalogo, usi, "z-a"))).toEqual([
      "Uova",
      "Pane",
      "Banana",
      "Avena",
    ]);
  });

  it("ordine alfabetico italiano: maiuscole e accenti non finiscono in fondo", () => {
    // Per codice del carattere sarebbe Pane, pera, zucca, Àcqua: le
    // minuscole dopo le maiuscole e la À dopo tutte le lettere semplici.
    const lista = [
      alimento("z", "zucca"),
      alimento("a", "Àcqua"),
      alimento("pe", "pera"),
      alimento("pa", "Pane"),
    ];
    expect(nomi(ordinaCatalogo(lista, new Map(), "a-z"))).toEqual([
      "Àcqua",
      "Pane",
      "pera",
      "zucca",
    ]);
  });

  it("stesso nome: prima senza marca, poi per marca; Z → A rovescia anche questo", () => {
    const fage = alimento("y-fage", "Yogurt", "Fage");
    const muller = alimento("y-muller", "Yogurt", "Müller");
    const semplice = alimento("y", "Yogurt");
    const lista = [muller, fage, semplice];
    expect(ordinaCatalogo(lista, new Map(), "a-z").map((a) => a.id)).toEqual([
      "y",
      "y-fage",
      "y-muller",
    ]);
    expect(ordinaCatalogo(lista, new Map(), "z-a").map((a) => a.id)).toEqual([
      "y-muller",
      "y-fage",
      "y",
    ]);
  });

  it("non modifica l'elenco ricevuto", () => {
    const copia = [...catalogo];
    ordinaCatalogo(catalogo, usi, "a-z");
    expect(catalogo).toEqual(copia);
  });
});
