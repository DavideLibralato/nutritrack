import { describe, it, expect } from "vitest";
import {
  messaggioAggiunto,
  messaggioEliminato,
  messaggioRipristinato,
  MESSAGGIO_ANNULLATO,
  MESSAGGIO_SALVATO,
  DURATE_BARRA,
} from "./testiBarra";
import { prendiInserimento, segnaInserimento } from "./ultimoInserimento";

// Le parti restano separate (verbo in `testo`, `nome`, dettaglio in `coda`):
// la barra mette in evidenza solo il nome e tronca solo quello.
describe("testi della barra", () => {
  it("alimento singolo: verbo prima del nome, nessun dettaglio, spunta", () => {
    expect(messaggioAggiunto("Pane", null)).toEqual({
      testo: "Aggiunto:",
      nome: "Pane",
      icona: "spunta",
    });
  });

  it("pasto salvato: nome e conteggio degli alimenti, al singolare se è uno", () => {
    expect(messaggioAggiunto("Colazione tipo", 3)).toEqual({
      testo: "Aggiunto:",
      nome: "Colazione tipo",
      coda: "(3 alimenti)",
      icona: "spunta",
    });
    expect(messaggioAggiunto("Solo caffè", 1).coda).toBe("(1 alimento)");
  });

  it("eliminazione di un pasto intero in Oggi: il numero di alimenti nella coda", () => {
    expect(messaggioEliminato("Pranzo", 3)).toEqual({
      testo: "Eliminato:",
      nome: "Pranzo",
      coda: "(3 alimenti)",
      icona: "elimina",
    });
    expect(messaggioEliminato("Pranzo", 1).coda).toBe("(1 alimento)");
  });

  it("eliminazione, ripristino, annullamento e salvataggio, ognuno con la sua icona", () => {
    expect(messaggioEliminato("Mela")).toEqual({
      testo: "Eliminato:",
      nome: "Mela",
      icona: "elimina",
    });
    expect(messaggioRipristinato("Mela")).toEqual({
      testo: "Ripristinato:",
      nome: "Mela",
      icona: "spunta",
    });
    expect(MESSAGGIO_ANNULLATO).toEqual({
      testo: "Annullato.",
      icona: "annulla",
    });
    expect(MESSAGGIO_SALVATO).toEqual({
      testo: "Salvato.",
      icona: "spunta",
    });
  });

  it("durate: 3 s con Annulla, 2,5 s per tutto il resto", () => {
    expect(DURATE_BARRA).toEqual({ conAzione: 3000, senzaAzione: 2500 });
    // Nessun messaggio porta una durata sua: la barra sceglie da sola, con
    // o senza azione.
    for (const m of [
      messaggioAggiunto("Pane", null),
      messaggioEliminato("Mela"),
      messaggioRipristinato("Mela"),
      MESSAGGIO_ANNULLATO,
      MESSAGGIO_SALVATO,
    ]) {
      expect(m.durataMs).toBeUndefined();
    }
  });
});

describe("ultimoInserimento", () => {
  it("si legge una volta sola, e il più recente sostituisce il precedente", () => {
    segnaInserimento({ idVoci: ["a"], nome: "Pane", numeroAlimenti: null });
    segnaInserimento({ idVoci: ["b", "c"], nome: "Colazione tipo", numeroAlimenti: 2 });

    expect(prendiInserimento()?.idVoci).toEqual(["b", "c"]);
    expect(prendiInserimento()).toBeNull();
  });
});
