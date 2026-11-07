// Test permanenti per leggiCodice (codiceEan.ts). Un calcolo che sbaglia
// in silenzio: con i pesi 3 e 1 contati da sinistra invece che da destra
// gli EAN-8 passano ancora (7 cifre prima del controllo, dispari: i pesi
// cadono uguali), ma ogni EAN-13 buono viene rifiutato. Visto il 07/11
// rompendo il codice da una copia.
// E se il 12 cifre non diventasse 13, lo stesso prodotto avrebbe due
// codici e la regola "stesso codice = stesso prodotto" non lo vedrebbe.

import { describe, it, expect } from "vitest";
import { leggiCodice } from "./codiceEan";

describe("leggiCodice", () => {
  it("accetta un EAN-13 valido così com'è", () => {
    expect(leggiCodice("3017620422003")).toEqual({ codice: "3017620422003", errore: null });
  });

  it("accetta un EAN-8 valido e lo lascia a 8 cifre", () => {
    expect(leggiCodice("96385074")).toEqual({ codice: "96385074", errore: null });
  });

  it("un UPC-A (12 cifre) si salva a 13, con uno 0 davanti", () => {
    expect(leggiCodice("036000291452")).toEqual({ codice: "0036000291452", errore: null });
  });

  it("lo stesso prodotto letto come UPC-A o scritto a 13 cifre dà lo stesso codice", () => {
    expect(leggiCodice("036000291452").codice).toBe(leggiCodice("0036000291452").codice);
  });

  it("ignora gli spazi, anche quelli in mezzo come sotto le barre", () => {
    expect(leggiCodice(" 3 017620 422003 ").codice).toBe("3017620422003");
  });

  it("rifiuta una cifra di controllo sbagliata, in tutti e tre i formati", () => {
    expect(leggiCodice("3017620422004").errore).toBe("controllo");
    expect(leggiCodice("96385075").errore).toBe("controllo");
    expect(leggiCodice("036000291453").errore).toBe("controllo");
  });

  it("rifiuta due cifre vicine scambiate", () => {
    // "…620422003" → "…620242003": il 4 e il 2 hanno pesi diversi (3 e
    // 1), quindi la somma cambia anche se le cifre sono le stesse.
    expect(leggiCodice("3017620242003").errore).toBe("controllo");
  });

  it("rifiuta le lunghezze diverse da 8, 12 e 13", () => {
    expect(leggiCodice("1234567").errore).toBe("lunghezza");
    expect(leggiCodice("123456789").errore).toBe("lunghezza");
    expect(leggiCodice("30176204220031").errore).toBe("lunghezza");
  });

  it("rifiuta lettere e segni, e il campo vuoto", () => {
    expect(leggiCodice("30176204220O3").errore).toBe("non-cifre");
    expect(leggiCodice("3017-620422003").errore).toBe("non-cifre");
    expect(leggiCodice("").errore).toBe("vuoto");
    expect(leggiCodice("   ").errore).toBe("vuoto");
  });
});
