// Test permanenti per la barra dopo l'Annulla di un'eliminazione
// (messaggioDopoRipristino), nella parte che conta: gli alimenti non
// ripristinati perché ne esiste già uno uguale vanno tolti dal conto dei
// ripristinati. Un errore qui direbbe "Ripristinato" per qualcosa che non è
// tornato.

import { describe, it, expect } from "vitest";
import { messaggioDopoRipristino } from "./testiAlimentiCancellati";

const NESSUNO = { alimentiNonRipristinati: [], pastiNonRipristinati: [] };
const pane = { nome: "Pane", etichetta: "Pane · Mulino" };
const latte = { nome: "Latte", etichetta: "Latte" };

describe("messaggioDopoRipristino", () => {
  it("tutto tornato: la riga breve di sempre", () => {
    expect(messaggioDopoRipristino(["Mela"], NESSUNO)).toMatchObject({ nome: "Mela" });
    expect(messaggioDopoRipristino(["Mela", "Pera"], NESSUNO)).toEqual({
      testo: "Ripristinati:",
      nome: "2 alimenti",
      icona: "spunta",
    });
  });

  it("l'unico alimento non è tornato: lo dice con nome e marca, senza «Ripristinato»", () => {
    expect(
      messaggioDopoRipristino(["Pane"], { ...NESSUNO, alimentiNonRipristinati: [pane] })
    ).toEqual({ testo: "Non ripristinato: hai già «Pane · Mulino»." });
    expect(
      messaggioDopoRipristino(["Pane", "Latte"], { ...NESSUNO, alimentiNonRipristinati: [pane, latte] })
    ).toEqual({ testo: "Non ripristinati: hai già «Pane · Mulino» e «Latte»." });
  });

  it("alcuni tornati e altri no: il conto è solo dei tornati", () => {
    expect(
      messaggioDopoRipristino(["Pane", "Mela", "Pera"], { ...NESSUNO, alimentiNonRipristinati: [pane] })
    ).toEqual({ testo: "Ripristinati: 2 alimenti. «Pane · Mulino» no: ne hai già uno uguale." });
    expect(
      messaggioDopoRipristino(["Pane", "Mela"], { ...NESSUNO, alimentiNonRipristinati: [pane] })
    ).toEqual({ testo: "Ripristinato: Mela. «Pane · Mulino» no: ne hai già uno uguale." });
  });

  it("con un pasto salvato non tornato, le due frasi insieme", () => {
    expect(
      messaggioDopoRipristino(["Pane", "Mela"], {
        alimentiNonRipristinati: [pane],
        pastiNonRipristinati: ["Cena"],
      })
    ).toEqual({
      testo:
        "Ripristinato: Mela. «Pane · Mulino» no: ne hai già uno uguale. Il pasto salvato «Cena» no: ne hai già un altro con lo stesso nome.",
    });
    expect(messaggioDopoRipristino(["Mela"], { ...NESSUNO, pastiNonRipristinati: ["Cena"] })).toEqual({
      testo: "Ripristinato: Mela. Il pasto salvato «Cena» no: ne hai già un altro con lo stesso nome.",
    });
  });
});
