// Test permanenti per numeroPerCampo e arrotondaDecimali (sotto). Per
// numeroPerCampo: il testo con cui si apre ogni campo numerico dell'app. Quel testo, se l'utente non lo tocca, è anche quello
// che si rilegge e si salva: un "12.500" con il punto delle migliaia
// tornerebbe indietro come 12,5. Errori che non fanno rumore.

import { describe, it, expect } from "vitest";
import { arrotondaDecimali, leggiNumeroDecimale, numeroPerCampo } from "./numeriDecimali";

describe("numeroPerCampo", () => {
  it("gli interi restano come String()", () => {
    for (const n of [0, 5, 100, 180, 2500]) expect(numeroPerCampo(n, 2)).toBe(String(n));
  });

  it("virgola come separatore decimale, fino ai decimali chiesti", () => {
    expect(numeroPerCampo(12.5, 2)).toBe("12,5");
    expect(numeroPerCampo(12.25, 2)).toBe("12,25");
    expect(numeroPerCampo(0.5, 2)).toBe("0,5");
    expect(numeroPerCampo(72.5, 1)).toBe("72,5");
    // Oltre i decimali chiesti si arrotonda.
    expect(numeroPerCampo(175.55, 1)).toBe("175,6");
  });

  it("niente zeri inutili", () => {
    expect(numeroPerCampo(100.0, 2)).toBe("100");
    expect(numeroPerCampo(12.1, 2)).toBe("12,1");
    expect(numeroPerCampo(180.04, 1)).toBe("180");
  });

  it("niente punto delle migliaia, nemmeno da 10.000 in su", () => {
    expect(numeroPerCampo(1500, 2)).toBe("1500");
    expect(numeroPerCampo(12500, 2)).toBe("12500");
    expect(numeroPerCampo(99999.99, 2)).toBe("99999,99");
  });

  it("riletto dal campo, torna lo stesso numero", () => {
    for (const n of [0.5, 12.5, 12.25, 100, 12500, 12500.25, 99999.99]) {
      expect(leggiNumeroDecimale(numeroPerCampo(n, 2), { zeroAmmesso: true }).valore).toBe(n);
    }
  });
});

// arrotondaDecimali è la sola regola con cui si arrotonda un numero prima
// di scriverlo: deve dare quello che terrà il server (numeric "mezzo per
// eccesso") e quello che il campo mostrerà dopo (numeroPerCampo).
describe("arrotondaDecimali", () => {
  it("ai decimali della colonna, mezzo per eccesso come Postgres", () => {
    expect(arrotondaDecimali(175.55, 1)).toBe(175.6);
    expect(arrotondaDecimali(175.54, 1)).toBe(175.5);
    expect(arrotondaDecimali(72.25, 1)).toBe(72.3);
    expect(arrotondaDecimali(12.345, 2)).toBe(12.35);
    expect(arrotondaDecimali(12.344, 2)).toBe(12.34);
  });

  it("anche dove Math.round(n * 100) / 100 sbaglia", () => {
    // 1.005 * 100 = 100.49999...: Math.round darebbe 1, Postgres 1,01.
    expect(arrotondaDecimali(1.005, 2)).toBe(1.01);
    expect(arrotondaDecimali(0.285, 2)).toBe(0.29);
    expect(arrotondaDecimali(8.575, 2)).toBe(8.58);
  });

  it("interi e valori già corti restano identici", () => {
    for (const n of [0, 1, 180, 2500, 78.4, 12.5, 99999.99]) {
      expect(arrotondaDecimali(n, 2)).toBe(n);
    }
    expect(arrotondaDecimali(78.4, 1)).toBe(78.4);
  });

  it("piccolissimo (JavaScript lo scrive «1e-7»): 0, non NaN", () => {
    expect(arrotondaDecimali(1e-7, 2)).toBe(0);
    expect(arrotondaDecimali(0.04, 1)).toBe(0);
  });

  it("il campo mostra quello che si è salvato", () => {
    for (const n of [175.55, 72.25, 1.15, 78.15, 12.345, 1.005, 0.285, 8.575]) {
      for (const d of [1, 2]) {
        expect(numeroPerCampo(arrotondaDecimali(n, d), d)).toBe(numeroPerCampo(n, d));
      }
    }
  });
});
