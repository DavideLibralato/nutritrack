// Test permanenti per numeroPerCampo: il testo con cui si apre ogni campo
// numerico dell'app. Quel testo, se l'utente non lo tocca, è anche quello
// che si rilegge e si salva: un "12.500" con il punto delle migliaia
// tornerebbe indietro come 12,5. Errori che non fanno rumore.

import { describe, it, expect } from "vitest";
import { leggiNumeroDecimale, numeroPerCampo } from "./numeriDecimali";

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
