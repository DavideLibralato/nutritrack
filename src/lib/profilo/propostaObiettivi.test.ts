import { describe, expect, it } from "vitest";
import { propostaObiettivi } from "./propostaObiettivi";
import { calcolaFabbisogno } from "../fabbisogno";
import type { ValoriModulo } from "./salvataggioProfilo";

// La proposta di target di "Calcola proposta" (Obiettivi) e del passo 5
// dell'onboarding. Sbaglia in silenzio: un controllo saltato fa calcolare
// la proposta con un'età o un'altezza senza senso (NaN nei campi), un
// controllo di troppo la toglie a chi ha tutti i dati, e con il sesso non
// indicato non ci deve mai essere un numero.

// Una data lontana da quella vera: se la funzione ignorasse `oggi` e usasse
// l'orologio, l'età cambierebbe e il test lo vedrebbe.
const OGGI = new Date(2031, 0, 15);

const COMPLETI: ValoriModulo["datiPersonali"] = {
  sesso: "maschio",
  dataNascita: "1990-01-10",
  altezzaCm: "180",
  livelloAttivita: "moderato",
};

function dati(campi: Partial<ValoriModulo["datiPersonali"]>): ValoriModulo["datiPersonali"] {
  return { ...COMPLETI, ...campi };
}

describe("propostaObiettivi: quando non c'è", () => {
  it("senza pesata: nessuna proposta, prima di ogni altro controllo", () => {
    expect(propostaObiettivi(COMPLETI, null, "mantenere", OGGI)).toEqual({ esito: "senza-pesata" });
    expect(
      propostaObiettivi(dati({ sesso: "non_indicato", dataNascita: "" }), null, "mantenere", OGGI)
    ).toEqual({ esito: "senza-pesata" });
  });

  it("sesso non indicato: nessuna proposta, anche con tutti gli altri dati", () => {
    expect(propostaObiettivi(dati({ sesso: "non_indicato" }), 80, "mantenere", OGGI)).toEqual({
      esito: "sesso-non-indicato",
    });
  });

  it("sesso non indicato vince sui dati mancanti", () => {
    expect(
      propostaObiettivi(
        dati({ sesso: "non_indicato", dataNascita: "", altezzaCm: "" }),
        80,
        "mantenere",
        OGGI
      )
    ).toEqual({ esito: "sesso-non-indicato" });
  });

  it("data di nascita mancante", () => {
    expect(propostaObiettivi(dati({ dataNascita: "" }), 80, "mantenere", OGGI)).toEqual({
      esito: "dati-mancanti",
      mancano: ["dataNascita"],
    });
  });

  it("altezza vuota, zero, negativa o non numerica", () => {
    for (const altezzaCm of ["", "  ", "0", "-170", "abc"]) {
      expect(propostaObiettivi(dati({ altezzaCm }), 80, "mantenere", OGGI)).toEqual({
        esito: "dati-mancanti",
        mancano: ["altezza"],
      });
    }
  });

  it("livello di attività mancante", () => {
    expect(propostaObiettivi(dati({ livelloAttivita: "" }), 80, "mantenere", OGGI)).toEqual({
      esito: "dati-mancanti",
      mancano: ["livelloAttivita"],
    });
  });

  it("tutti e tre mancanti: elencati nell'ordine dei campi", () => {
    expect(
      propostaObiettivi(
        dati({ sesso: "femmina", dataNascita: "", altezzaCm: "", livelloAttivita: "" }),
        60,
        "dimagrire",
        OGGI
      )
    ).toEqual({ esito: "dati-mancanti", mancano: ["dataNascita", "altezza", "livelloAttivita"] });
  });
});

describe("propostaObiettivi: quando c'è", () => {
  it("dati completi: lo stesso risultato di calcolaFabbisogno, con l'età a oggi", () => {
    // Nato il 10/1/1990: il 15/1/2031 ha 41 anni.
    expect(propostaObiettivi(COMPLETI, 80, "mantenere", OGGI)).toEqual({
      esito: "proposta",
      proposta: calcolaFabbisogno({
        sesso: "maschio",
        eta: 41,
        altezzaCm: 180,
        pesoKg: 80,
        livelloAttivita: "moderato",
        tipoObiettivo: "mantenere",
      }),
    });
  });

  it("compleanno non ancora passato: un anno in meno", () => {
    // Nata il 20/10/1994: il 15/1/2031 ha ancora 36 anni.
    expect(
      propostaObiettivi(
        dati({ sesso: "femmina", dataNascita: "1994-10-20", altezzaCm: "165" }),
        62,
        "massa",
        OGGI
      )
    ).toEqual({
      esito: "proposta",
      proposta: calcolaFabbisogno({
        sesso: "femmina",
        eta: 36,
        altezzaCm: 165,
        pesoKg: 62,
        livelloAttivita: "moderato",
        tipoObiettivo: "massa",
      }),
    });
  });

  it("altezza con la virgola e obiettivo passati al calcolo", () => {
    const dimagrire = propostaObiettivi(dati({ altezzaCm: "172,5" }), 78.4, "dimagrire", OGGI);
    expect(dimagrire).toEqual({
      esito: "proposta",
      proposta: calcolaFabbisogno({
        sesso: "maschio",
        eta: 41,
        altezzaCm: 172.5,
        pesoKg: 78.4,
        livelloAttivita: "moderato",
        tipoObiettivo: "dimagrire",
      }),
    });
    const mantenere = propostaObiettivi(dati({ altezzaCm: "172,5" }), 78.4, "mantenere", OGGI);
    expect(dimagrire).not.toEqual(mantenere);
  });
});
