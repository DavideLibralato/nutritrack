// Il segno ?password=aggiornata (passwordAggiornata.ts): si riconosce solo
// con quel valore e si toglie lasciando com'è il resto dell'indirizzo.

import { describe, it, expect } from "vitest";
import { leggiSegnoPasswordAggiornata, PROFILO_CON_PASSWORD_AGGIORNATA } from "./passwordAggiornata";

const ORIGINE = "https://app-libra.vercel.app";

describe("leggiSegnoPasswordAggiornata", () => {
  it("l'indirizzo di ritorno da Cambia password: segno visto e tolto", () => {
    expect(leggiSegnoPasswordAggiornata(ORIGINE + PROFILO_CON_PASSWORD_AGGIORNATA)).toEqual({
      aggiornata: true,
      senzaSegno: "/impostazioni/profilo",
    });
  });

  it("gli altri parametri e il frammento restano", () => {
    expect(leggiSegnoPasswordAggiornata(`${ORIGINE}/impostazioni/profilo?a=1&password=aggiornata&b=2#x`)).toEqual({
      aggiornata: true,
      senzaSegno: "/impostazioni/profilo?a=1&b=2#x",
    });
  });

  it.each(["/impostazioni/profilo", "/impostazioni/profilo?password=altro", "/impostazioni/profilo?aggiornata=password"])(
    "%s: niente barra",
    (percorso) => {
      expect(leggiSegnoPasswordAggiornata(ORIGINE + percorso).aggiornata).toBe(false);
    }
  );
});
