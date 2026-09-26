// Test permanenti per validaValoriAlimento (CreaAlimentoForm). Proteggono
// due cose che non fanno rumore: un valore fuori da numeric(7,2) che fa
// fallire la sync in silenzio (o un terzo decimale che fa divergere Dexie
// dal server), e un errore di battitura fisicamente impossibile (120 g di
// grassi per 100 g) che finisce nel catalogo e da lì in ogni voce di diario.

import { describe, it, expect } from "vitest";
import { validaValoriAlimento, type CampiAlimento } from "./valoriAlimento";

const BASE: CampiAlimento = {
  kcal: "250",
  grassi: "10",
  carboidrati: "30",
  proteine: "8",
  porzione: "100",
};

function con(modifiche: Partial<CampiAlimento>) {
  return validaValoriAlimento({ ...BASE, ...modifiche });
}

describe("validaValoriAlimento", () => {
  it("valori normali: validi, facoltativi assenti o vuoti diventano null", () => {
    const esito = con({ zuccheri: "", fibre: "  " });
    expect(esito.errori).toEqual({});
    expect(esito.mancanti).toEqual([]);
    expect(esito.valori).toEqual({
      kcal_100g: 250,
      grassi_100g: 10,
      carboidrati_100g: 30,
      proteine_100g: 8,
      porzione_default_g: 100,
      zuccheri_100g: null,
      fibre_100g: null,
      saturi_100g: null,
      sale_100g: null,
    });
  });

  it("virgola come separatore e arrotondamento a due decimali, come numeric(7,2)", () => {
    const esito = con({ grassi: "12,345", proteine: "1,005", porzione: "30,5" });
    expect(esito.valori).toMatchObject({
      grassi_100g: 12.35,
      proteine_100g: 1.01,
      porzione_default_g: 30.5,
    });
  });

  it("zero ammesso per kcal e macro, non per la porzione", () => {
    expect(con({ kcal: "0", grassi: "0", carboidrati: "0", proteine: "0" }).valori).not.toBeNull();
    // Piccolissimo (JavaScript lo scrive "1e-7"): arrotonda a 0, non NaN.
    expect(con({ grassi: "0,0000001" }).valori?.grassi_100g).toBe(0);
    expect(con({ porzione: "0" }).errori.porzione).toBe("Deve essere maggiore di zero");
    expect(con({ porzione: "0,001" }).errori.porzione).toBe("Deve essere maggiore di zero");
  });

  it("campi obbligatori vuoti: mancanti, non errori; salvataggio bloccato", () => {
    const esito = validaValoriAlimento({ kcal: "", grassi: "", carboidrati: "5", proteine: "", porzione: "100" });
    expect(esito.valori).toBeNull();
    expect(esito.errori).toEqual({});
    expect(esito.mancanti).toEqual(["kcal", "grassi", "proteine"]);
  });

  it("non numerici e negativi: messaggio sul campo", () => {
    const esito = con({ kcal: "abc", grassi: "-1" });
    expect(esito.valori).toBeNull();
    expect(esito.errori).toEqual({ kcal: "Scrivi un numero", grassi: "Non può essere negativo" });
  });

  it("limiti fisici: ogni macro al massimo 100 g, kcal al massimo 900", () => {
    expect(con({ grassi: "100", kcal: "900" }).valori).not.toBeNull();
    for (const campo of ["grassi", "carboidrati", "proteine", "zuccheri", "fibre", "saturi", "sale"] as const) {
      expect(con({ [campo]: "100,01" }).errori[campo]).toBe("Al massimo 100 g per 100 g");
    }
    expect(con({ kcal: "900,01" }).errori.kcal).toBe("Al massimo 900 kcal per 100 g");
    // Oltre numeric(7,2): stesso messaggio fisico, non quello dello schema.
    expect(con({ kcal: "1000000" }).errori.kcal).toBe("Al massimo 900 kcal per 100 g");
  });

  it("porzione: solo il limite dello schema, 99999,99 g", () => {
    expect(con({ porzione: "99999,99" }).valori?.porzione_default_g).toBe(99999.99);
    expect(con({ porzione: "100000" }).errori.porzione).toBe("Al massimo 99999,99 g");
  });

  it("zuccheri non più dei carboidrati, saturi non più dei grassi", () => {
    const esito = con({ zuccheri: "30,5", saturi: "10,01" });
    expect(esito.valori).toBeNull();
    expect(esito.errori).toEqual({
      zuccheri: "Non più dei carboidrati (30 g)",
      saturi: "Non più dei grassi (10 g)",
    });
    // Uguali vanno bene (lo zucchero è tutto carboidrati).
    expect(con({ zuccheri: "30", saturi: "10" }).valori).not.toBeNull();
  });

  it("il confronto parte-tutto usa i valori arrotondati, quelli che si scrivono", () => {
    // 30,004 arrotonda a 30: non supera i carboidrati (30).
    expect(con({ zuccheri: "30,004" }).errori.zuccheri).toBeUndefined();
    // Nessun confronto se il "tutto" è già sbagliato: un solo messaggio.
    expect(con({ carboidrati: "abc", zuccheri: "5" }).errori).toEqual({ carboidrati: "Scrivi un numero" });
  });
});
