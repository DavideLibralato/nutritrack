// La regola dei colori (PUNTO_DI_PARTENZA.md, sezione 7, "La regola dei
// colori"): tutti i casi, i bordi esatti della fascia, Dimagrire contro
// Massa. Con FASCIA_PERCENTO = 5 e obiettivo 2200 "in linea" va da 2090 a
// 2310, bordi inclusi. Se la fascia cambia dopo la prova su iPhone, i
// numeri dei bordi qui sotto vanno ricalcolati.

import { describe, it, expect } from "vitest";
import { esitoRispettoObiettivo, FASCIA_PERCENTO, TESTI_ESITO } from "./esitoObiettivo";

const SOTTO = { esito: "sotto", tono: "neutro" };
const IN_LINEA = { esito: "in-linea", tono: "buono" };
const SOPRA = { esito: "sopra", tono: "oltre" };

describe("esitoRispettoObiettivo", () => {
  it("la fascia è quella provvisoria del 09/11", () => {
    expect(FASCIA_PERCENTO).toBe(5);
  });

  it("kcal con Massa: neutro sotto la fascia, verde dentro, arancio sopra", () => {
    expect(esitoRispettoObiettivo(1500, 2200, "kcal", "massa")).toEqual(SOTTO);
    expect(esitoRispettoObiettivo(2200, 2200, "kcal", "massa")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(2500, 2200, "kcal", "massa")).toEqual(SOPRA);
  });

  it("kcal con Mantenere: come Massa", () => {
    expect(esitoRispettoObiettivo(1500, 2200, "kcal", "mantenere")).toEqual(SOTTO);
    expect(esitoRispettoObiettivo(2300, 2200, "kcal", "mantenere")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(2400, 2200, "kcal", "mantenere")).toEqual(SOPRA);
  });

  it("i bordi esatti della fascia sono inclusi: 2090 e 2310 in linea, 2089 e 2311 no", () => {
    expect(esitoRispettoObiettivo(2089, 2200, "kcal", "massa")).toEqual(SOTTO);
    expect(esitoRispettoObiettivo(2090, 2200, "kcal", "massa")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(2310, 2200, "kcal", "massa")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(2311, 2200, "kcal", "massa")).toEqual(SOPRA);
  });

  it("bordi con un obiettivo che non dà numeri tondi: 140 g, fascia da 133 a 147", () => {
    expect(esitoRispettoObiettivo(132, 140, "proteine", "massa")).toEqual(SOTTO);
    expect(esitoRispettoObiettivo(133, 140, "proteine", "massa")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(147, 140, "proteine", "massa")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(148, 140, "proteine", "massa")).toEqual(SOPRA);
  });

  it("si confronta il numero arrotondato, quello che si vede", () => {
    expect(esitoRispettoObiettivo(2310.4, 2200, "kcal", "massa")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(2310.6, 2200, "kcal", "massa")).toEqual(SOPRA);
    expect(esitoRispettoObiettivo(2089.6, 2200, "kcal", "massa")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(2200.4, 2200, "kcal", "dimagrire")).toEqual(IN_LINEA);
  });

  it("kcal con Dimagrire: un tetto, verde fino all'obiettivo, arancio da 1 kcal sopra", () => {
    expect(esitoRispettoObiettivo(1500, 2200, "kcal", "dimagrire")).toEqual({ esito: "sotto", tono: "buono" });
    expect(esitoRispettoObiettivo(2089, 2200, "kcal", "dimagrire")).toEqual({ esito: "sotto", tono: "buono" });
    expect(esitoRispettoObiettivo(2090, 2200, "kcal", "dimagrire")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(2200, 2200, "kcal", "dimagrire")).toEqual(IN_LINEA);
    expect(esitoRispettoObiettivo(2201, 2200, "kcal", "dimagrire")).toEqual(SOPRA);
  });

  it("Dimagrire contro Massa sullo stesso valore", () => {
    expect(esitoRispettoObiettivo(1800, 2200, "kcal", "dimagrire")?.tono).toBe("buono");
    expect(esitoRispettoObiettivo(1800, 2200, "kcal", "massa")?.tono).toBe("neutro");
    expect(esitoRispettoObiettivo(2250, 2200, "kcal", "dimagrire")?.tono).toBe("oltre");
    expect(esitoRispettoObiettivo(2250, 2200, "kcal", "massa")?.tono).toBe("buono");
  });

  it("proteine, carboidrati e grassi hanno la fascia anche con Dimagrire", () => {
    for (const g of ["proteine", "carboidrati", "grassi"] as const) {
      expect(esitoRispettoObiettivo(10, 70, g, "dimagrire"), g).toEqual(SOTTO);
      expect(esitoRispettoObiettivo(70, 70, g, "dimagrire"), g).toEqual(IN_LINEA);
      expect(esitoRispettoObiettivo(73, 70, g, "dimagrire"), g).toEqual(IN_LINEA);
      expect(esitoRispettoObiettivo(74, 70, g, "dimagrire"), g).toEqual(SOPRA);
    }
  });

  it("senza tipo di obiettivo vale la fascia", () => {
    expect(esitoRispettoObiettivo(1500, 2200, "kcal", null)).toEqual(SOTTO);
  });

  it("senza obiettivo, o con obiettivo 0: nessuno stato", () => {
    expect(esitoRispettoObiettivo(1500, null, "kcal", "massa")).toBeNull();
    expect(esitoRispettoObiettivo(1500, 0, "kcal", "dimagrire")).toBeNull();
    expect(esitoRispettoObiettivo(0, 0.4, "grassi", "massa")).toBeNull();
  });

  it("i testi della pastiglia", () => {
    expect(TESTI_ESITO).toEqual({ sotto: "sotto", "in-linea": "in linea", sopra: "sopra" });
  });
});
