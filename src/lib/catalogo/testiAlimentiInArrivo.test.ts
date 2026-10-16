// I testi della condivisione degli alimenti (testiAlimentiInArrivo.ts):
// plurali, mittenti e numeri all'italiana. Un numero tagliato a un
// decimale mostrerebbe in arancio due valori che sembrano uguali.

import { describe, expect, it } from "vitest";
import {
  messaggioAlimentiAggiunti,
  messaggioInviati,
  sottotitoloMittenti,
  testiConfermaAggiungi,
  testiConfermaRifiuta,
  testoDoppioneDiverso,
  testoEsitoInvio,
  testoNonPiuInArrivo,
  testoRigaImpostazioniInArrivo,
  testoValoreConfronto,
  testoValoriBrevi,
  titoloRigaInArrivo,
} from "./testiAlimentiInArrivo";
import { TESTO_AZIONE_NON_RIUSCITA } from "../amici/testiAmici";

describe("la riga in arrivo", () => {
  it("titolo al singolare e al plurale", () => {
    expect(titoloRigaInArrivo(1)).toBe("1 alimento in arrivo");
    expect(titoloRigaInArrivo(6)).toBe("6 alimenti in arrivo");
  });

  it("i mittenti: uno, due, tre o più", () => {
    expect(sottotitoloMittenti(["sara_c"])).toBe("Da @sara_c");
    expect(sottotitoloMittenti(["sara_c", "paolo_a"])).toBe("Da @sara_c e @paolo_a");
    expect(sottotitoloMittenti(["sara_c", "paolo_a", "luca_f"])).toBe("Da 3 amici");
  });

  it("uno username non arrivato non si scrive", () => {
    expect(sottotitoloMittenti([null])).toBe("Da un amico");
    expect(sottotitoloMittenti(["sara_c", null])).toBe("Da 2 amici");
    expect(sottotitoloMittenti([])).toBe("");
  });

  it("la riga di Impostazioni", () => {
    expect(testoRigaImpostazioniInArrivo(1)).toBe("1 in arrivo");
    expect(testoRigaImpostazioniInArrivo(2)).toBe("2 in arrivo");
  });
});

describe("il foglio", () => {
  it("il doppione con valori diversi scrive sempre nome e marca", () => {
    expect(testoDoppioneDiverso({ nome: "Yogurt greco 0%", marca: "Fage" })).toBe(
      "Hai già «Yogurt greco 0% · Fage», con valori diversi."
    );
    expect(testoDoppioneDiverso({ nome: "Banana", marca: null })).toBe(
      "Hai già «Banana», senza marca, con valori diversi."
    );
    expect(testoDoppioneDiverso({ nome: "Banana", marca: "  " })).toBe(
      "Hai già «Banana», senza marca, con valori diversi."
    );
  });

  it("i quattro valori brevi, con la virgola", () => {
    expect(
      testoValoriBrevi({ kcal_100g: 259, grassi_100g: 3.3, carboidrati_100g: 45, proteine_100g: 9 })
    ).toBe("259 kcal · G 3,3 · C 45 · P 9 g");
  });

  it("le celle del confronto: kcal senza unità, grammi, fino a due decimali, trattino se assente", () => {
    expect(testoValoreConfronto("kcal_100g", 57)).toBe("57");
    expect(testoValoreConfronto("grassi_100g", 0.4)).toBe("0,4 g");
    expect(testoValoreConfronto("grassi_100g", 3.31)).toBe("3,31 g");
    expect(testoValoreConfronto("porzione_default_g", 150)).toBe("150 g");
    expect(testoValoreConfronto("zuccheri_100g", null)).toBe("—");
  });
});

describe("conferme e barre", () => {
  it("conferma di Aggiungi, con e senza doppioni che restano", () => {
    expect(testiConfermaAggiungi(3, false)).toEqual({
      titolo: "Aggiungere 3 alimenti?",
      testo: "Entrano nel tuo catalogo come alimenti tuoi.",
      etichettaSi: "Aggiungi 3",
    });
    expect(testiConfermaAggiungi(2, true).testo).toBe(
      "Entrano nel tuo catalogo come alimenti tuoi. I doppioni restano qui, da decidere uno per uno."
    );
  });

  it("conferma di Rifiuta", () => {
    expect(testiConfermaRifiuta(4)).toEqual({
      titolo: "Rifiutare 4 alimenti?",
      testo: "Chi te li ha mandati non lo saprà. Per riaverli dovrà mandarteli di nuovo.",
      etichettaSi: "Rifiuta 4",
    });
  });

  it("dopo Aggiungi", () => {
    expect(messaggioAlimentiAggiunti(["Pane"])).toEqual({ testo: "Aggiunto:", nome: "Pane", icona: "spunta" });
    expect(messaggioAlimentiAggiunti(["Pane", "Hummus", "Skyr"])).toEqual({
      testo: "Aggiunti:",
      nome: "3 alimenti",
      icona: "spunta",
    });
  });

  it("dopo l'invio", () => {
    expect(messaggioInviati(2, ["sara_c"]).testo).toBe("Mandati 2 alimenti a @sara_c.");
    expect(messaggioInviati(1, ["sara_c"]).testo).toBe("Mandato 1 alimento a @sara_c.");
    expect(messaggioInviati(2, ["sara_c", "paolo_a"]).testo).toBe("Mandati 2 alimenti a @sara_c e @paolo_a.");
    expect(messaggioInviati(1, ["a", "b", "c"]).testo).toBe("Mandato 1 alimento a 3 amici.");
  });

  it("gli esiti dell'invio non riuscito", () => {
    expect(testoEsitoInvio("non_amici")).toBe(
      "Uno degli amici scelti non è più tuo amico: non è partito niente. Controlla l'elenco e riprova."
    );
    expect(testoEsitoInvio("errore")).toBe(TESTO_AZIONE_NON_RIUSCITA);
    expect(testoEsitoInvio("non_valido")).toBe(TESTO_AZIONE_NON_RIUSCITA);
  });

  it("una risposta su alimenti che non sono più in arrivo", () => {
    expect(testoNonPiuInArrivo(1)).toBe("Questo alimento non è più in arrivo.");
    expect(testoNonPiuInArrivo(3)).toBe("Alcuni di questi alimenti non sono più in arrivo: non è cambiato niente.");
  });
});
