// Test permanenti per leggiGrammi: la sola validazione dei grammi, condivisa
// da SheetQuantita e dalla modifica di un pasto salvato. I limiti vengono
// da numeric(7,2) su Supabase (voci_diario e composizioni_voci): un valore
// fuori limite fa fallire la sync in silenzio, un terzo decimale fa
// divergere Dexie dal server. Errori che non fanno rumore.

import { describe, it, expect } from "vitest";
import { leggiGrammi, GRAMMI_MASSIMI } from "./grammi";

describe("leggiGrammi", () => {
  it("vuoto, non numerico, zero o negativo: errore", () => {
    for (const valore of ["", "   ", "abc", "0", "0,00", "-5", "Infinity"]) {
      expect(leggiGrammi(valore).grammi).toBeNull();
      expect(leggiGrammi(valore).errore).not.toBeNull();
    }
  });

  it("accetta la virgola come separatore decimale", () => {
    expect(leggiGrammi("12,5")).toEqual({ grammi: 12.5, errore: null });
    expect(leggiGrammi(" 150 ")).toEqual({ grammi: 150, errore: null });
  });

  it("arrotonda a due decimali come numeric(7,2), anche dove la virgola mobile sbaglia", () => {
    expect(leggiGrammi("12,345").grammi).toBe(12.35);
    expect(leggiGrammi("12,344").grammi).toBe(12.34);
    // 1.005 * 100 = 100.49999... in virgola mobile: Postgres dà 1.01.
    expect(leggiGrammi("1,005").grammi).toBe(1.01);
    expect(leggiGrammi("0,005").grammi).toBe(0.01);
  });

  it("un valore che arrotondato diventa zero non vale, nemmeno piccolissimo", () => {
    expect(leggiGrammi("0,004").grammi).toBeNull();
    expect(leggiGrammi("0,0000001").grammi).toBeNull();
  });

  it("massimo 99999,99: oltre, errore invece di una sync che fallisce", () => {
    expect(leggiGrammi("99999,99")).toEqual({ grammi: GRAMMI_MASSIMI, errore: null });
    expect(leggiGrammi("100000").grammi).toBeNull();
    expect(leggiGrammi("99999,999").grammi).toBeNull();
    expect(leggiGrammi("1e9").grammi).toBeNull();
  });
});
