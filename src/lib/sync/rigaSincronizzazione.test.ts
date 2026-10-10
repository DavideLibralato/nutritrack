// La riga Sincronizzazione nell'elenco di Impostazioni (dal 10/10, mockup
// "2 · Pallino + testo"): il testo breve e il tono per ognuno dei sei stati.
// Il tono è la parte che non deve sbagliare in silenzio: un errore in
// grigio passerebbe inosservato, che è proprio il problema da risolvere.

import { describe, it, expect } from "vitest";
import { rigaSincronizzazione } from "./rigaSincronizzazione";

describe("rigaSincronizzazione", () => {
  it("i tre stati che chiedono attenzione sono in arancio", () => {
    expect(rigaSincronizzazione({ tipo: "accantonate", numero: 3, pallino: true })).toEqual({
      testo: "Da controllare",
      tono: "avviso",
      pulsa: false,
    });
    expect(rigaSincronizzazione({ tipo: "sessione", inAttesa: 0, pallino: true })).toMatchObject({
      testo: "Accedi di nuovo",
      tono: "avviso",
    });
    expect(
      rigaSincronizzazione({ tipo: "errore", inAttesa: 1, dal: null, tabelleNonScaricate: [], pallino: false })
    ).toMatchObject({ testo: "Errore", tono: "avviso" });
  });

  it("in attesa in ocra, con quante", () => {
    expect(rigaSincronizzazione({ tipo: "in-attesa", numero: 2, dal: null, pallino: false })).toEqual({
      testo: "2 in attesa",
      tono: "attesa",
      pulsa: false,
    });
  });

  it("in corso e tutto salvato in grigio; solo in corso pulsa", () => {
    expect(rigaSincronizzazione({ tipo: "in-corso", pallino: false })).toEqual({
      testo: "In corso…",
      tono: "neutro",
      pulsa: true,
    });
    expect(rigaSincronizzazione({ tipo: "sincronizzato", ultimoSuccesso: null, pallino: false })).toEqual({
      testo: "Tutto salvato",
      tono: "neutro",
      pulsa: false,
    });
  });
});
