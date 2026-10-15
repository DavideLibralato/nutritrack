// Il foglio "Cambia username". Test permanente: sul proprio nome attuale il
// database risponde "preso", e il foglio non deve dire "già in uso" né
// lasciar salvare un cambio che non cambia niente.

import { describe, expect, it } from "vitest";
import { puoSalvareUsername, statoNelFoglio } from "./foglioUsername";

describe("statoNelFoglio", () => {
  it("il proprio nome attuale è 'attuale', non 'in_uso', anche scritto in maiuscolo", () => {
    expect(statoNelFoglio("in_uso", "davide_l", "davide_l")).toBe("attuale");
    expect(statoNelFoglio("controllo", " Davide_L ", "davide_l")).toBe("attuale");
  });

  it("un altro nome tiene l'esito del controllo", () => {
    expect(statoNelFoglio("in_uso", "marco_b", "davide_l")).toBe("in_uso");
    expect(statoNelFoglio("disponibile", "davide_libra", "davide_l")).toBe("disponibile");
  });

  it("senza un nome attuale non c'è 'attuale'", () => {
    expect(statoNelFoglio("in_uso", "davide_l", null)).toBe("in_uso");
  });
});

describe("puoSalvareUsername", () => {
  it("salva un nome libero, o non ancora controllato, o con il controllo fallito", () => {
    expect(puoSalvareUsername("disponibile", true)).toBe(true);
    expect(puoSalvareUsername("controllo", true)).toBe(true);
    expect(puoSalvareUsername("errore", true)).toBe(true);
  });

  it("non salva il nome attuale, uno preso, uno non valido o il campo vuoto", () => {
    for (const stato of ["attuale", "in_uso", "non_valido", "vuoto"] as const) {
      expect(puoSalvareUsername(stato, true), stato).toBe(false);
    }
  });

  it("senza connessione non salva mai", () => {
    expect(puoSalvareUsername("disponibile", false)).toBe(false);
  });
});
