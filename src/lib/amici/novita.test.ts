// Le novità di Amici e il pallino (PUNTO_DI_PARTENZA.md §3 "Amici", "Il
// pallino"). Test permanente: un pallino che copre l'arancio della
// sincronizzazione nasconde un problema vero; uno che resta dopo Esci mostra
// le richieste di un altro a chi entra dopo; una risposta vecchia arrivata
// tardi riaccende un pallino già spento dalla pagina Amici. Con gli alimenti
// in arrivo (dal 16/10) le parti sono due: la rilettura di una pagina non
// deve azzerare l'altra, e un numero salvato prima (senza gli alimenti) deve
// restare leggibile.

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

// I due conteggi sul server, finti: ogni chiamata resta in sospeso finché
// il test non risponde.
const risposteRichieste: ((n: number | null) => void)[] = [];
const risposteAlimenti: ((n: number | null) => void)[] = [];
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("./amicizie", () => ({
  contaRichiesteRicevute: () =>
    new Promise<number | null>((resolve) => {
      risposteRichieste.push(resolve);
    }),
}));
vi.mock("./alimentiCondivisi", () => ({
  contaAlimentiInArrivo: () =>
    new Promise<number | null>((resolve) => {
      risposteAlimenti.push(resolve);
    }),
}));

beforeEach(() => {
  window.localStorage.clear();
  cancellaNovita(ID);
  cancellaNovita(ALTRO);
  risposteRichieste.length = 0;
  risposteAlimenti.length = 0;
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
  it("è la somma delle richieste ricevute e degli alimenti in arrivo", () => {
    expect(totaleNovita({ richiesteRicevute: 3, alimentiInArrivo: 0 })).toBe(3);
    expect(totaleNovita({ richiesteRicevute: 0, alimentiInArrivo: 2 })).toBe(2);
    expect(totaleNovita({ richiesteRicevute: 1, alimentiInArrivo: 2 })).toBe(3);
  });
});

describe("la chiave in localStorage", () => {
  it("ha l'id dell'utente nel nome", () => {
    expect(chiaveNovita(ID)).toBe("nutritrack:amici:novita:utente-novita");
  });

  it("impostaNovita la scrive, novitaDi e leggiNovitaSalvate la rileggono", () => {
    impostaNovita(ID, { richiesteRicevute: 2, alimentiInArrivo: 1 });
    expect(JSON.parse(window.localStorage.getItem(chiaveNovita(ID))!)).toEqual({
      richiesteRicevute: 2,
      alimentiInArrivo: 1,
    });
    expect(leggiNovitaSalvate(ID)).toEqual({ richiesteRicevute: 2, alimentiInArrivo: 1 });
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 2, alimentiInArrivo: 1 });
  });

  it("all'avvio (niente in memoria) valgono gli ultimi numeri salvati", () => {
    window.localStorage.setItem(chiaveNovita(ID), JSON.stringify({ richiesteRicevute: 4, alimentiInArrivo: 3 }));
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 4, alimentiInArrivo: 3 });
  });

  it("un valore salvato prima degli alimenti in arrivo vale 0 alimenti, e le sue richieste restano", () => {
    window.localStorage.setItem(chiaveNovita(ID), JSON.stringify({ richiesteRicevute: 2 }));
    expect(leggiNovitaSalvate(ID)).toEqual({ richiesteRicevute: 2, alimentiInArrivo: 0 });
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 2, alimentiInArrivo: 0 });
  });

  it("un valore rovinato vale 'non so', cioè nessuna novità", () => {
    for (const rovinato of [
      "3",
      "{}",
      "{\"richiesteRicevute\":-1}",
      "{\"richiesteRicevute\":1.5}",
      "{\"richiesteRicevute\":1,\"alimentiInArrivo\":-2}",
      "{\"richiesteRicevute\":1,\"alimentiInArrivo\":\"2\"}",
      "{\"alimentiInArrivo\":2}",
      "non json",
    ]) {
      cancellaNovita(ID);
      window.localStorage.setItem(chiaveNovita(ID), rovinato);
      expect(leggiNovitaSalvate(ID), rovinato).toBeNull();
      expect(totaleNovita(novitaDi(ID)), rovinato).toBe(0);
    }
  });

  it("cancellaNovita toglie la chiave e i numeri in memoria di quell'utente, non di altri", () => {
    impostaNovita(ID, { richiesteRicevute: 2, alimentiInArrivo: 1 });
    impostaNovita(ALTRO, { richiesteRicevute: 1 });
    cancellaNovita(ID);
    expect(window.localStorage.getItem(chiaveNovita(ID))).toBeNull();
    expect(totaleNovita(novitaDi(ID))).toBe(0);
    expect(novitaDi(ALTRO).richiesteRicevute).toBe(1);
  });
});

describe("impostaNovita: ogni pagina scrive solo la sua parte", () => {
  it("la pagina Amici scrive le richieste e lascia gli alimenti, e viceversa", () => {
    impostaNovita(ID, { richiesteRicevute: 2, alimentiInArrivo: 3 });
    impostaNovita(ID, { richiesteRicevute: 0 });
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 0, alimentiInArrivo: 3 });
    impostaNovita(ID, { alimentiInArrivo: 1 });
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 0, alimentiInArrivo: 1 });
    expect(leggiNovitaSalvate(ID)).toEqual({ richiesteRicevute: 0, alimentiInArrivo: 1 });
  });
});

describe("aggiornaNovita", () => {
  it("scrive i due numeri arrivati dal server", async () => {
    const lettura = aggiornaNovita(ID);
    risposteRichieste[0](3);
    risposteAlimenti[0](2);
    await lettura;
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 3, alimentiInArrivo: 2 });
    expect(leggiNovitaSalvate(ID)).toEqual({ richiesteRicevute: 3, alimentiInArrivo: 2 });
  });

  it("senza risposta resta l'ultimo numero noto, solo per la parte che manca", async () => {
    impostaNovita(ID, { richiesteRicevute: 2, alimentiInArrivo: 4 });
    const lettura = aggiornaNovita(ID);
    risposteRichieste[0](null);
    risposteAlimenti[0](1);
    await lettura;
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 2, alimentiInArrivo: 1 });
  });

  it("una lettura partita prima di una scrittura della pagina, e arrivata dopo, si scarta per quella parte", async () => {
    // Il pallino chiede i numeri; intanto la pagina Amici accetta l'unica
    // richiesta e rilegge: zero. Poi arrivano le risposte vecchie (1
    // richiesta, 2 alimenti): la richiesta si scarta, gli alimenti no.
    const lettura = aggiornaNovita(ID);
    impostaNovita(ID, { richiesteRicevute: 0 });
    risposteRichieste[0](1);
    risposteAlimenti[0](2);
    await lettura;
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 0, alimentiInArrivo: 2 });
  });

  it("lo stesso per la pagina Alimenti: la sua scrittura vince sulla lettura vecchia", async () => {
    const lettura = aggiornaNovita(ID);
    impostaNovita(ID, { alimentiInArrivo: 0 });
    risposteRichieste[0](1);
    risposteAlimenti[0](3);
    await lettura;
    expect(novitaDi(ID)).toEqual({ richiesteRicevute: 1, alimentiInArrivo: 0 });
  });
});
