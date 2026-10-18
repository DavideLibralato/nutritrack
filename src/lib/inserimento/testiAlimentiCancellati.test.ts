// Test permanenti per la barra dopo l'Annulla di un'eliminazione
// (messaggioDopoRipristino), nella parte che conta: gli alimenti non
// ripristinati perché ne esiste già uno uguale vanno tolti dal conto dei
// ripristinati. Un errore qui direbbe "Ripristinato" per qualcosa che non è
// tornato.

import { describe, it, expect } from "vitest";
import {
  messaggioDopoRipristino,
  messaggioDopoRipristinoPasti,
  messaggioToltiDaiPreferiti,
} from "./testiAlimentiCancellati";
import { MESSAGGIO_ANNULLATO } from "./testiBarra";

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

// Il segnalibro pieno in Oggi e il suo Annulla (18/10, caso 3 dei "doppioni
// rimasti"): le stesse parole dell'Annulla degli alimenti.
describe("messaggioToltiDaiPreferiti", () => {
  it("uno: il testo di Impostazioni > Preferiti; più di uno: quanti", () => {
    expect(messaggioToltiDaiPreferiti(["Colazione"])).toEqual({ testo: "Tolto dai preferiti:", nome: "Colazione" });
    expect(messaggioToltiDaiPreferiti(["Colazione", "Colazione bis"])).toEqual({
      testo: "Tolti dai preferiti:",
      nome: "2 pasti salvati",
    });
  });
});

describe("messaggioDopoRipristinoPasti", () => {
  it("tutto tornato: «Annullato.», come ogni Annulla di Oggi", () => {
    expect(messaggioDopoRipristinoPasti({ ripristinati: ["Colazione"], nonRipristinati: [] })).toBe(MESSAGGIO_ANNULLATO);
  });

  it("un pasto solo non tornato: il motivo, per ciascuno dei tre", () => {
    const testo = (motivo: "nome" | "contenuto" | "vuoto") =>
      messaggioDopoRipristinoPasti({ ripristinati: [], nonRipristinati: [{ nome: "Colazione", motivo }] }).testo;
    expect(testo("nome")).toBe("Non ripristinato: hai già un altro pasto salvato con lo stesso nome.");
    expect(testo("contenuto")).toBe("Non ripristinato: hai già un altro pasto salvato con gli stessi alimenti.");
    expect(testo("vuoto")).toBe("Non ripristinato: i suoi alimenti non sono più nel catalogo.");
  });

  it("in parte: i ripristinati, poi quelli rimasti tolti con il loro motivo", () => {
    const m = messaggioDopoRipristinoPasti({
      ripristinati: ["Colazione"],
      nonRipristinati: [
        { nome: "Pranzo", motivo: "nome" },
        { nome: "Cena", motivo: "contenuto" },
        { nome: "Merenda", motivo: "contenuto" },
      ],
    });
    expect(m.testo).toBe(
      "Ripristinato: «Colazione». Il pasto salvato «Pranzo» no: ne hai già un altro con lo stesso nome. " +
        "I pasti salvati «Cena» e «Merenda» no: hai già altri pasti con gli stessi alimenti."
    );
  });
});
