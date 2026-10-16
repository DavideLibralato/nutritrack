// Le novità di Amici e il pallino (PUNTO_DI_PARTENZA.md §3 "Amici", "Il
// pallino"). Test permanente: un pallino che copre l'arancio della
// sincronizzazione nasconde un problema vero; uno che resta dopo Esci mostra
// le richieste di un altro a chi entra dopo; una risposta vecchia arrivata
// tardi riaccende un pallino già spento dalla pagina Amici.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aggiornaNovita,
  cancellaNovita,
  chiaveNovita,
  impostaNovita,
  leggiNovitaSalvate,
  novitaDi,
  pallinoTab,
  totaleNovita,
} from "./novita";

const ID = "utente-novita";
const ALTRO = "altro-utente-novita";

// Il conteggio sul server, finto: ogni chiamata resta in sospeso finché il
// test non risponde.
const risposte: ((n: number | null) => void)[] = [];
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("./amicizie", () => ({
  contaRichiesteRicevute: () =>
    new Promise<number | null>((resolve) => {
      risposte.push(resolve);
    }),
}));

beforeEach(() => {
  window.localStorage.clear();
  cancellaNovita(ID);
  cancellaNovita(ALTRO);
  risposte.length = 0;
});

afterEach(() => {
  window.localStorage.clear();
});

describe("pallinoTab", () => {
  it("l'arancio della sincronizzazione vince sulle novità", () => {
    expect(pallinoTab(true, 2)).toBe("sincronizzazione");
    expect(pallinoTab(true, 0)).toBe("sincronizzazione");
  });

  it("senza problemi di sincronizzazione, il colore principale con delle novità", () => {
    expect(pallinoTab(false, 1)).toBe("amici");
  });

  it("niente senza novità", () => {
    expect(pallinoTab(false, 0)).toBeNull();
  });
});

describe("totaleNovita", () => {
  it("oggi è solo il numero delle richieste ricevute", () => {
    expect(totaleNovita({ richiesteRicevute: 3 })).toBe(3);
  });
});

describe("la chiave in localStorage", () => {
  it("ha l'id dell'utente nel nome", () => {
    expect(chiaveNovita(ID)).toBe("nutritrack:amici:novita:utente-novita");
  });

  it("impostaNovita la scrive, novitaDi e leggiNovitaSalvate la rileggono", () => {
    impostaNovita(ID, { richiesteRicevute: 2 });
    expect(JSON.parse(window.localStorage.getItem(chiaveNovita(ID))!)).toEqual({ richiesteRicevute: 2 });
    expect(leggiNovitaSalvate(ID)).toEqual({ richiesteRicevute: 2 });
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 2 });
  });

  it("all'avvio (niente in memoria) vale l'ultimo numero salvato", () => {
    window.localStorage.setItem(chiaveNovita(ID), JSON.stringify({ richiesteRicevute: 4 }));
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 4 });
  });

  it("un valore rovinato vale 'non so', cioè nessuna novità", () => {
    for (const rovinato of ["3", "{}", "{\"richiesteRicevute\":-1}", "{\"richiesteRicevute\":1.5}", "non json"]) {
      cancellaNovita(ID);
      window.localStorage.setItem(chiaveNovita(ID), rovinato);
      expect(leggiNovitaSalvate(ID), rovinato).toBeNull();
      expect(novitaDi(ID).richiesteRicevute, rovinato).toBe(0);
    }
  });

  it("cancellaNovita toglie la chiave e il numero in memoria di quell'utente, non di altri", () => {
    impostaNovita(ID, { richiesteRicevute: 2 });
    impostaNovita(ALTRO, { richiesteRicevute: 1 });
    cancellaNovita(ID);
    expect(window.localStorage.getItem(chiaveNovita(ID))).toBeNull();
    expect(novitaDi(ID).richiesteRicevute).toBe(0);
    expect(novitaDi(ALTRO).richiesteRicevute).toBe(1);
  });
});

describe("aggiornaNovita", () => {
  it("scrive il numero arrivato dal server", async () => {
    const lettura = aggiornaNovita(ID);
    risposte[0](3);
    await lettura;
    expect(novitaDi(ID).richiesteRicevute).toBe(3);
    expect(leggiNovitaSalvate(ID)).toEqual({ richiesteRicevute: 3 });
  });

  it("senza risposta resta l'ultimo numero noto", async () => {
    impostaNovita(ID, { richiesteRicevute: 2 });
    const lettura = aggiornaNovita(ID);
    risposte[0](null);
    await lettura;
    expect(novitaDi(ID).richiesteRicevute).toBe(2);
  });

  it("una lettura partita prima di una scrittura della pagina, e arrivata dopo, si scarta", async () => {
    // Il pallino chiede il numero; intanto la pagina Amici accetta l'unica
    // richiesta e rilegge: zero. Poi arriva la risposta vecchia (1).
    const lettura = aggiornaNovita(ID);
    impostaNovita(ID, { richiesteRicevute: 0 });
    risposte[0](1);
    await lettura;
    expect(novitaDi(ID).richiesteRicevute).toBe(0);
  });
});
