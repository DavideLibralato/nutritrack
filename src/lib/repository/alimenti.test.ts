import { describe, it, expect } from "vitest";
import { cercaPerNome } from "./alimenti";
import type { Alimento } from "../db/tipi";

function alimento(nome: string): Alimento {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    updated_at: "2026-09-04T00:00:00.000Z",
    deleted_at: null,
    nome,
    marca: null,
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

describe("cercaPerNome", () => {
  const catalogo = [
    alimento("Caffè"),
    alimento("Pane integrale"),
    alimento("Petto di pollo"),
    alimento("Purè di patate"),
  ];

  it("ignora maiuscole e accenti in entrambe le direzioni", () => {
    expect(cercaPerNome(catalogo, "caffe").map((a) => a.nome)).toEqual(["Caffè"]);
    expect(cercaPerNome(catalogo, "PURÈ").map((a) => a.nome)).toEqual(["Purè di patate"]);
  });

  it("cerca per sottostringa, non solo per prefisso", () => {
    expect(cercaPerNome(catalogo, "pollo").map((a) => a.nome)).toEqual(["Petto di pollo"]);
  });

  it("una query vuota o di soli spazi non restituisce nulla", () => {
    expect(cercaPerNome(catalogo, "")).toEqual([]);
    expect(cercaPerNome(catalogo, "   ")).toEqual([]);
  });

  it("ordina i risultati per nome", () => {
    expect(cercaPerNome(catalogo, "e").map((a) => a.nome)).toEqual([
      "Caffè",
      "Pane integrale",
      "Petto di pollo",
      "Purè di patate",
    ]);
  });
});
