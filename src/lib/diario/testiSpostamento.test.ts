// I messaggi dopo "Sposta" devono dire cosa è successo davvero. Il bug già
// trovato sul mockup e da non ripetere: l'unico alimento escluso con "Non
// spostarlo" faceva dire "Spostato", e non si era mosso niente.

import { describe, it, expect } from "vitest";
import {
  accorcia,
  elencoAlimenti,
  MASSIMO_ALIMENTO,
  MASSIMO_PASTO,
  messaggioSpostamento,
  testoEsitoDoppione,
  messaggioDuplicazione,
} from "./testiSpostamento";

const base = { pastoPartenza: "Colazione", pastoDestinazione: "Pranzo" };

// Il messaggio come lo legge l'utente, le tre parti della barra di fila.
function frase(m: { testo: string; nome?: string; coda?: string }) {
  return [m.testo, m.nome, m.coda].filter(Boolean).join(" ");
}

describe("messaggioSpostamento — i 5 casi", () => {
  it("1. alimento singolo spostato", () => {
    const m = messaggioSpostamento({ ...base, tipo: "voce", nomeAlimento: "Yogurt", spostati: 1, esclusi: [] });
    expect(m).toEqual({ testo: "Spostato:", nome: "Yogurt", coda: "→ Pranzo", icona: "spunta" });
  });

  it("2. alimento singolo escluso: niente parola «Spostato»", () => {
    const m = messaggioSpostamento({ ...base, tipo: "voce", nomeAlimento: "Yogurt", spostati: 0, esclusi: ["Yogurt"] });
    expect(frase(m)).toBe("«Yogurt» resta in «Colazione», non spostato.");
    expect(frase(m)).not.toMatch(/Spostato/);
    expect(m.icona).toBe("info");
  });

  it("3. pasto intero, tutto spostato", () => {
    const m = messaggioSpostamento({ ...base, tipo: "pasto", spostati: 3, esclusi: [] });
    expect(m).toEqual({ testo: "Spostato:", nome: "Colazione", coda: "→ Pranzo", icona: "spunta" });
  });

  it("4. pasto intero con esclusioni: singolare e plurale", () => {
    const uno = messaggioSpostamento({ ...base, tipo: "pasto", spostati: 2, esclusi: ["Yogurt"] });
    expect(frase(uno)).toBe("Spostato: «Colazione» → «Pranzo» (tranne «Yogurt», rimasto in «Colazione»).");
    const due = messaggioSpostamento({ ...base, tipo: "pasto", spostati: 1, esclusi: ["Yogurt", "Mela"] });
    expect(frase(due)).toBe(
      "Spostato: «Colazione» → «Pranzo» (tranne «Yogurt» e «Mela», rimasti in «Colazione»)."
    );
  });

  it("5. pasto intero, tutti esclusi: «Nessuno spostamento», singolare e plurale", () => {
    const uno = messaggioSpostamento({ ...base, tipo: "pasto", spostati: 0, esclusi: ["Yogurt"] });
    expect(frase(uno)).toBe("Nessuno spostamento: «Yogurt» resta in «Colazione».");
    const due = messaggioSpostamento({ ...base, tipo: "pasto", spostati: 0, esclusi: ["Yogurt", "Mela"] });
    expect(frase(due)).toBe("Nessuno spostamento: «Yogurt» e «Mela» restano in «Colazione».");
    expect(frase(due)).not.toMatch(/Spostato/);
  });
});

describe("testi lunghi", () => {
  it("accorcia con «…» solo oltre il massimo", () => {
    expect(accorcia("Pranzo", MASSIMO_PASTO)).toBe("Pranzo");
    const lungo = "Yogurt greco intero biologico al naturale";
    const corto = accorcia(lungo, MASSIMO_ALIMENTO);
    expect(corto.length).toBe(MASSIMO_ALIMENTO);
    expect(corto.endsWith("…")).toBe(true);
  });

  it("oltre due alimenti: i primi due e quanti altri", () => {
    expect(elencoAlimenti(["Yogurt", "Mela", "Pane", "Caffè"])).toBe("«Yogurt», «Mela» e altri 2");
  });

  it("nomi lunghi accorciati, parole e verbo sempre interi", () => {
    const m = messaggioSpostamento({
      tipo: "pasto",
      pastoPartenza: "Spuntino di metà mattina",
      pastoDestinazione: "Pranzo",
      spostati: 1,
      esclusi: ["Yogurt greco intero biologico al naturale"],
    });
    expect(m.testo).toBe(
      "Spostato: «Spuntino di met…» → «Pranzo» (tranne «Yogurt greco intero b…», rimasto in «Spuntino di met…»)."
    );
  });
});

describe("testoEsitoDoppione — la riga sotto ogni alimento del foglio", () => {
  const d = { grammiEsistenti: 100, grammiInArrivo: 50, righeEsistenti: 1, righeInArrivo: 1 };
  it("le quattro scelte, come nel mockup", () => {
    expect(testoEsitoDoppione(d, "somma", null, "")).toBe("→ Una riga da 150 g");
    expect(testoEsitoDoppione(d, "separati", null, "")).toBe("→ Due righe: 100 g e 50 g");
    expect(testoEsitoDoppione(d, "scrivi", 120, "")).toBe("→ Una riga da 120 g (scritta a mano)");
    expect(testoEsitoDoppione(d, "escludi", null, "Resta in Cena, non si sposta")).toBe(
      "→ Resta in Cena, non si sposta"
    );
  });

  it("Tieni separati con più righe per parte non dice «Due righe»", () => {
    expect(testoEsitoDoppione({ ...d, righeEsistenti: 2 }, "separati", null, "")).toBe("→ 3 righe separate");
  });

  it("Scrivi quantità col campo ancora vuoto", () => {
    expect(testoEsitoDoppione(d, "scrivi", null, "")).toBe("→ Una riga con la quantità che scrivi");
  });
});

describe("messaggioDuplicazione", () => {
  const base = { pastoPartenza: "Colazione", pastoDestinazione: "Pranzo", giornoDiverso: null, esclusi: [] };

  it("alimento e pasto intero, stesso giorno: niente «di …»", () => {
    expect(messaggioDuplicazione({ ...base, tipo: "voce", nomeAlimento: "Mela", duplicati: 1 })).toEqual({
      testo: "Duplicato:",
      nome: "Mela",
      coda: "in Pranzo",
      icona: "spunta",
    });
    expect(frase(messaggioDuplicazione({ ...base, tipo: "pasto", duplicati: 3 }))).toBe(
      "Duplicato: Colazione in Pranzo"
    );
  });

  it("giorno diverso: «di lun 5 ott»", () => {
    const m = messaggioDuplicazione({ ...base, tipo: "voce", nomeAlimento: "Mela", duplicati: 1, giornoDiverso: "lun 5 ott" });
    expect(frase(m)).toBe("Duplicato: Mela in Pranzo di lun 5 ott");
  });

  it("pasto intero con esclusioni: (tranne …), singolare e plurale", () => {
    const uno = messaggioDuplicazione({ ...base, tipo: "pasto", duplicati: 2, esclusi: ["Mela"] });
    expect(frase(uno)).toBe("Duplicato: «Colazione» in «Pranzo» (tranne «Mela», che c'era già).");
    const due = messaggioDuplicazione({ ...base, tipo: "pasto", duplicati: 1, esclusi: ["Mela", "Pane"], giornoDiverso: "lun 5 ott" });
    expect(frase(due)).toBe(
      "Duplicato: «Colazione» in «Pranzo» di lun 5 ott (tranne «Mela» e «Pane», che c'erano già)."
    );
  });

  it("tutto escluso: niente parola «Duplicato»", () => {
    const voce = messaggioDuplicazione({ ...base, tipo: "voce", nomeAlimento: "Mela", duplicati: 0, esclusi: ["Mela"] });
    expect(frase(voce)).toBe("Nessuna copia: «Mela» c'è già in «Pranzo».");
    const pasto = messaggioDuplicazione({ ...base, tipo: "pasto", duplicati: 0, esclusi: ["Mela", "Pane"] });
    expect(frase(pasto)).toBe("Nessuna copia: «Mela» e «Pane» ci sono già in «Pranzo».");
    expect(frase(voce) + frase(pasto)).not.toMatch(/Duplicato/);
  });
});
