import { describe, it, expect } from "vitest";
import {
  messaggioAggiunto,
  messaggioInserimento,
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
    segnaInserimento({ fotografia: { prima: [], idCreate: ["a"] }, messaggio: messaggioAggiunto("Pane", null) });
    segnaInserimento({
      fotografia: { prima: [], idCreate: ["b", "c"] },
      messaggio: messaggioAggiunto("Colazione tipo", 2),
    });

    expect(prendiInserimento()?.fotografia.idCreate).toEqual(["b", "c"]);
    expect(prendiInserimento()).toBeNull();
  });
});

// I messaggi dopo un inserimento da /aggiungi con i doppioni (sezione 3,
// "Doppioni"): dicono cosa è successo davvero. Il testo intero, come lo
// legge chi guarda la barra: verbo, nome e dettaglio separati da spazi.
describe("messaggioInserimento", () => {
  const testo = (m: ReturnType<typeof messaggioInserimento>) =>
    m && [m.testo, m.nome, m.coda].filter(Boolean).join(" ");
  const piano = (p: Partial<Parameters<typeof messaggioInserimento>[2]> = {}) => ({
    inseriti: [],
    esclusi: [],
    aggiornati: [],
    ...p,
  });

  it("niente entrato: nessun messaggio, mai «Aggiunto»", () => {
    expect(messaggioInserimento("alimento", "Mela", piano({ esclusi: ["Mela"] }))).toBeNull();
    expect(
      messaggioInserimento("pasto-salvato", "Colazione", piano({ esclusi: ["Mela", "Pane"] }))
    ).toBeNull();
  });

  it("alimento in una riga nuova (anche Tieni separati): «Aggiunto: Mela»", () => {
    expect(messaggioInserimento("alimento", "Mela", piano({ inseriti: ["Mela"] }))).toEqual({
      testo: "Aggiunto:",
      nome: "Mela",
      icona: "spunta",
    });
  });

  it("Somma: «Sommato: Mela → 150 g», con i decimali all'italiana", () => {
    const m = messaggioInserimento(
      "alimento",
      "Mela",
      piano({ inseriti: ["Mela"], aggiornati: [{ nome: "Mela", grammi: 150, tipo: "somma" }] })
    );
    expect(m).toEqual({ testo: "Sommato:", nome: "Mela", coda: "→ 150 g", icona: "spunta" });
    const decimali = messaggioInserimento(
      "alimento",
      "Riso",
      piano({ inseriti: ["Riso"], aggiornati: [{ nome: "Riso", grammi: 30.3, tipo: "somma" }] })
    );
    expect(testo(decimali)).toBe("Sommato: Riso → 30,3 g");
  });

  it("Scrivi quantità: «Aggiornato: Mela → 120 g»", () => {
    const m = messaggioInserimento(
      "alimento",
      "Mela",
      piano({ inseriti: ["Mela"], aggiornati: [{ nome: "Mela", grammi: 120, tipo: "scrivi" }] })
    );
    expect(testo(m)).toBe("Aggiornato: Mela → 120 g");
  });

  it("pasto salvato: conta gli alimenti aggiunti e quelli sommati", () => {
    const m = messaggioInserimento(
      "pasto-salvato",
      "Colazione",
      piano({ inseriti: ["Yogurt", "Pane", "Mela"], aggiornati: [{ nome: "Mela", grammi: 300, tipo: "somma" }] })
    );
    expect(testo(m)).toBe("Aggiunto: Colazione (3 alimenti)");
    expect(testo(messaggioInserimento("pasto-salvato", "Caffè", piano({ inseriti: ["Caffè"] })))).toBe(
      "Aggiunto: Caffè (1 alimento)"
    );
  });

  it("pasto salvato con esclusi: «tranne», al singolare e al plurale", () => {
    expect(
      messaggioInserimento("pasto-salvato", "Colazione", piano({ inseriti: ["Pane"], esclusi: ["Mela"] }))?.testo
    ).toBe("Aggiunto: «Colazione» (tranne «Mela», che c'era già).");
    expect(
      messaggioInserimento("pasto-salvato", "Colazione", piano({ inseriti: ["Pane"], esclusi: ["Mela", "Yogurt"] }))
        ?.testo
    ).toBe("Aggiunto: «Colazione» (tranne «Mela» e «Yogurt», che c'erano già).");
    expect(
      messaggioInserimento(
        "pasto-salvato",
        "Colazione",
        piano({ inseriti: ["Pane"], esclusi: ["Mela", "Yogurt", "Kiwi", "Avena"] })
      )?.testo
    ).toBe("Aggiunto: «Colazione» (tranne «Mela», «Yogurt» e altri 2, che c'erano già).");
  });

  it("nomi lunghi accorciati con «…» nella frase lunga", () => {
    expect(
      messaggioInserimento(
        "pasto-salvato",
        "Colazione proteica della domenica",
        piano({ inseriti: ["Pane"], esclusi: ["Yogurt greco intero biologico"] })
      )?.testo
    ).toBe("Aggiunto: «Colazione proteica de…» (tranne «Yogurt greco intero b…», che c'era già).");
  });
});
