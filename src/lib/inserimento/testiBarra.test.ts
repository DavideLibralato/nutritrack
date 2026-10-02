import { describe, it, expect } from "vitest";
import {
  messaggioAggiunto,
  messaggioEliminato,
  messaggioRipristinato,
  MESSAGGIO_ANNULLATO,
} from "./testiBarra";
import { prendiInserimento, segnaInserimento } from "./ultimoInserimento";

describe("testi della barra", () => {
  it("alimento singolo: verbo prima del nome, nessun conteggio", () => {
    expect(messaggioAggiunto("Pane", null)).toEqual({ testo: "Aggiunto:", nome: "Pane" });
  });

  it("pasto salvato: nome e conteggio degli alimenti, al singolare se è uno", () => {
    expect(messaggioAggiunto("Colazione tipo", 3)).toEqual({
      testo: "Aggiunto:",
      nome: "Colazione tipo",
      coda: "(3 alimenti)",
    });
    expect(messaggioAggiunto("Solo caffè", 1).coda).toBe("(1 alimento)");
  });

  it("eliminazione, ripristino e annullamento", () => {
    expect(messaggioEliminato("Mela")).toEqual({ testo: "Eliminato:", nome: "Mela" });
    expect(messaggioRipristinato("Mela")).toEqual({ testo: "Ripristinato:", nome: "Mela" });
    expect(MESSAGGIO_ANNULLATO).toEqual({ testo: "Annullato." });
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
