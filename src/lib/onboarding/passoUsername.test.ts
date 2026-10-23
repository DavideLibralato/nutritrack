// Il passo dello username nell'onboarding (PUNTO_DI_PARTENZA.md §3, Amici,
// "Lo username dopo l'accesso"). Test permanente: la regola più importante
// è che chi ha già uno username non veda mai il passo, e che senza una
// risposta sicura dal server il passo si salti invece di bloccare. La rete
// al momento del tocco non conta (dal 23/10): offline il passo compare e
// lo dice da sé, con "Lo scelgo dopo".

import { describe, expect, it } from "vitest";
import { mostraPassoUsername, passoPrecedente, posizioneNellaBarra } from "./passoUsername";

const SENZA = { esito: "ok", username: null } as const;
const CON = { esito: "ok", username: "giulia_92" } as const;
const ERRORE = { esito: "errore" } as const;
const CARICAMENTO = { esito: "caricamento" } as const;

describe("mostraPassoUsername", () => {
  it("senza username: compare, anche se nel frattempo la rete è caduta", () => {
    expect(mostraPassoUsername(SENZA, false)).toBe(true);
  });

  it("con lo username già scelto: mai", () => {
    expect(mostraPassoUsername(CON, false)).toBe(false);
  });

  it("senza una risposta sicura si salta: errore (offline all'apertura), risposta non arrivata", () => {
    expect(mostraPassoUsername(ERRORE, false)).toBe(false);
    expect(mostraPassoUsername(CARICAMENTO, false)).toBe(false);
  });

  it("già comparso in questo giro: resta, anche con il nome ormai salvato", () => {
    expect(mostraPassoUsername(CON, true)).toBe(true);
    expect(mostraPassoUsername(ERRORE, true)).toBe(true);
  });
});

describe("passoPrecedente", () => {
  it("da Su di te: al passo dello username se c'è, altrimenti al Benvenuto", () => {
    expect(passoPrecedente(2, true)).toBe("username");
    expect(passoPrecedente(2, false)).toBe(1);
  });

  it("dal passo dello username: al Benvenuto", () => {
    expect(passoPrecedente("username", true)).toBe(1);
  });

  it("dagli altri passi: quello prima, con o senza username", () => {
    expect(passoPrecedente(3, true)).toBe(2);
    expect(passoPrecedente(5, false)).toBe(4);
  });
});

describe("posizioneNellaBarra", () => {
  it("con il passo dello username: 6 puntini, lui è il secondo e gli altri scorrono di uno", () => {
    expect(posizioneNellaBarra("username", true)).toEqual({ posizione: 2, totale: 6 });
    expect(posizioneNellaBarra(2, true)).toEqual({ posizione: 3, totale: 6 });
    expect(posizioneNellaBarra(5, true)).toEqual({ posizione: 6, totale: 6 });
  });

  it("senza: 5 puntini, come prima", () => {
    expect(posizioneNellaBarra(2, false)).toEqual({ posizione: 2, totale: 5 });
    expect(posizioneNellaBarra(5, false)).toEqual({ posizione: 5, totale: 5 });
  });
});
