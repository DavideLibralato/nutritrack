// Test permanenti per la regola del doppione nel catalogo
// (doppioniAlimenti.ts). Un errore qui non fa rumore: o lascia passare due
// alimenti uguali, o blocca un alimento che doppione non è (stesso nome,
// marca diversa) e l'utente non capisce perché il Salva è spento.

import { describe, it, expect } from "vitest";
import type { Alimento } from "../db/tipi";
import {
  chiaveAlimento,
  normalizzaSpazi,
  stessoCodice,
  stessoProdotto,
  testoConfronto,
  testoDoppione,
  trovaDoppione,
} from "./doppioniAlimenti";

const USER = "u1";

function alimento(
  id: string,
  nome: string,
  marca: string | null,
  altro: Partial<Alimento> = {}
): Alimento {
  return {
    id,
    user_id: USER,
    updated_at: "2026-10-16T00:00:00.000Z",
    deleted_at: null,
    nome,
    marca,
    barcode: null,
    kcal_100g: 100,
    proteine_100g: 5,
    carboidrati_100g: 10,
    grassi_100g: 2,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
    ...altro,
  };
}

function doppione(catalogo: Alimento[], nome: string, marca: string | null, escludiId?: string) {
  return trovaDoppione(catalogo, { nome, marca }, { userId: USER, escludiId })?.id ?? null;
}

describe("normalizzaSpazi e testoConfronto", () => {
  it("spazi ai bordi tolti, spazi interni ridotti a uno", () => {
    expect(normalizzaSpazi("  Pane   di \t segale ")).toBe("Pane di segale");
  });

  it("il confronto ignora maiuscole e accenti, ma salva il testo com'è", () => {
    expect(testoConfronto("  CAFFÈ  Lungo ")).toBe("caffe lungo");
    expect(testoConfronto("Müller")).toBe("muller");
    expect(normalizzaSpazi(" Caffè ")).toBe("Caffè");
  });
});

describe("testoDoppione", () => {
  it("con la marca: dice che contano nome e marca insieme", () => {
    expect(testoDoppione({ nome: "Pane", marca: "Mulino" })).toBe(
      "Hai già un alimento con questo nome e questa marca: «Pane · Mulino»."
    );
  });

  it("senza marca (null, vuota o di soli spazi): lo dice", () => {
    for (const marca of [null, "", "  "]) {
      expect(testoDoppione({ nome: "Banana", marca })).toBe("Hai già «Banana», senza marca.");
    }
  });
});

describe("trovaDoppione", () => {
  const catalogo = [
    alimento("pane", "Pane", "Mulino"),
    alimento("caffe", "Caffè", null),
    alimento("fage", "Yogurt greco 0%", "Fage"),
    alimento("segale", "Pane di segale", null),
  ];

  it("stesso nome e stessa marca, con maiuscole, accenti e spazi diversi: doppione", () => {
    expect(doppione(catalogo, "pane", "mulino")).toBe("pane");
    expect(doppione(catalogo, "  PANE ", " Mulino  ")).toBe("pane");
    expect(doppione(catalogo, "CAFFE", null)).toBe("caffe");
    expect(doppione(catalogo, "Pane  di   segale", null)).toBe("segale");
  });

  it("la marca vuota conta come una marca: null, vuota e di soli spazi sono la stessa", () => {
    expect(doppione(catalogo, "Caffè", "")).toBe("caffe");
    expect(doppione(catalogo, "Caffè", "   ")).toBe("caffe");
    // Ma senza marca non è doppione di "Pane · Mulino".
    expect(doppione(catalogo, "Pane", null)).toBeNull();
    expect(doppione(catalogo, "Caffè", "Lavazza")).toBeNull();
  });

  it("stesso nome, marca diversa: mai doppione", () => {
    expect(doppione(catalogo, "Yogurt greco 0%", "Müller")).toBeNull();
    expect(doppione(catalogo, "Yogurt greco 0%", "fage")).toBe("fage");
  });

  it("i confini fra nome e marca contano: «ab» · «c» non è «a» · «bc»", () => {
    // Attaccati senza separatore darebbero tutti e due "abc".
    expect(chiaveAlimento({ nome: "ab", marca: "c" })).not.toBe(
      chiaveAlimento({ nome: "a", marca: "bc" })
    );
    const latte = [alimento("lat-te", "Lat", "te")];
    expect(doppione(latte, "Latte", null)).toBeNull();
    expect(doppione(latte, "La", "tte")).toBeNull();
  });

  it("contano solo gli alimenti vivi dell'utente: non i cancellati, non il catalogo comune, non altri utenti", () => {
    const altri = [
      alimento("cancellato", "Mela", null, { deleted_at: "2026-10-15T00:00:00.000Z" }),
      alimento("comune", "Banana", null, { user_id: null, verificato: true }),
      alimento("altrui", "Kiwi", null, { user_id: "u2" }),
    ];
    expect(doppione(altri, "Mela", null)).toBeNull();
    expect(doppione(altri, "Banana", null)).toBeNull();
    expect(doppione(altri, "Kiwi", null)).toBeNull();
  });

  it("un alimento proprio verificato conta: è del catalogo dell'utente", () => {
    const verificato = [alimento("v", "Riso", null, { verificato: true })];
    expect(doppione(verificato, "riso", null)).toBe("v");
  });

  it("in Modifica l'alimento stesso si esclude: una rinomina di sole maiuscole o accenti passa", () => {
    expect(doppione(catalogo, "PANE", "MULINO", "pane")).toBeNull();
    expect(doppione(catalogo, "Caffe", null, "caffe")).toBeNull();
    // Ma una rinomina verso un altro alimento no.
    expect(doppione(catalogo, "Caffè", null, "pane")).toBe("caffe");
  });

  it("con il nome vuoto non c'è doppione (manca il nome, lo dice già il form)", () => {
    const senzaNome = [alimento("x", "", null)];
    expect(doppione(senzaNome, "   ", null)).toBeNull();
  });
});

// Dal branch `codice-a-barre`: stesso codice a barre = stesso prodotto
// (PUNTO_DI_PARTENZA.md §3, "Codice a barre"). Un errore qui fa nascere
// due alimenti con lo stesso codice, e la scansione dopo non sa più quale
// aprire; oppure blocca un alimento senza codice per colpa di un altro.
describe("trovaDoppione per codice a barre", () => {
  const NUTELLA = "3017620422003";
  const catalogo = [
    alimento("nutella", "Nutella", "Ferrero", { barcode: NUTELLA }),
    alimento("pane", "Pane", "Mulino"),
  ];

  function perCodice(
    lista: Alimento[],
    nome: string,
    marca: string | null,
    barcode: string | null,
    escludiId?: string
  ): string | null {
    return trovaDoppione(lista, { nome, marca, barcode }, { userId: USER, escludiId })?.id ?? null;
  }

  it("stesso codice, nome e marca diversi: doppione", () => {
    expect(perCodice(catalogo, "Crema spalmabile", "Altra marca", NUTELLA)).toBe("nutella");
  });

  it("stesso codice con il nome ancora vuoto: doppione (il modulo di un prodotto non trovato)", () => {
    expect(perCodice(catalogo, "", null, NUTELLA)).toBe("nutella");
  });

  it("un codice diverso, o nessun codice, non rende doppione", () => {
    expect(perCodice(catalogo, "Crema", null, "96385074")).toBeNull();
    expect(perCodice(catalogo, "Crema", null, null)).toBeNull();
    expect(perCodice(catalogo, "Crema", null, "")).toBeNull();
  });

  it("due alimenti senza codice non sono doppioni per il codice (null e vuoto non contano)", () => {
    const senza = [alimento("a", "Mela", null), alimento("b", "Pera", null, { barcode: "" })];
    expect(perCodice(senza, "Kiwi", null, null)).toBeNull();
    expect(perCodice(senza, "Kiwi", null, "")).toBeNull();
  });

  it("il nome e la marca contano ancora, anche con un codice nuovo", () => {
    expect(perCodice(catalogo, "Pane", "Mulino", "96385074")).toBe("pane");
  });

  it("se il codice è di uno e nome e marca di un altro, vince il codice", () => {
    expect(perCodice(catalogo, "Pane", "Mulino", NUTELLA)).toBe("nutella");
  });

  it("contano solo i vivi dell'utente: non i cancellati, non il catalogo comune, non altri utenti", () => {
    const altri = [
      alimento("cancellato", "A", null, {
        barcode: NUTELLA,
        deleted_at: "2026-11-01T00:00:00.000Z",
      }),
      alimento("comune", "B", null, { barcode: NUTELLA, user_id: null }),
      alimento("altrui", "C", null, { barcode: NUTELLA, user_id: "u2" }),
    ];
    expect(perCodice(altri, "Nutella", null, NUTELLA)).toBeNull();
  });

  it("escludiId esclude anche per il codice (un ripristino non è doppione di sé stesso)", () => {
    expect(perCodice(catalogo, "Nutella", "Ferrero", NUTELLA, "nutella")).toBeNull();
  });
});

describe("stessoCodice e stessoProdotto", () => {
  it("stesso codice non vuoto; null e vuoto non sono mai uguali", () => {
    expect(stessoCodice({ barcode: "96385074" }, { barcode: "96385074" })).toBe(true);
    expect(stessoCodice({ barcode: "96385074" }, { barcode: "3017620422003" })).toBe(false);
    expect(stessoCodice({ barcode: null }, { barcode: null })).toBe(false);
    expect(stessoCodice({ barcode: "" }, { barcode: "" })).toBe(false);
    expect(stessoCodice({}, {})).toBe(false);
  });

  it("stesso prodotto: stesso nome e marca, oppure stesso codice", () => {
    const a = { nome: "Nutella", marca: "Ferrero", barcode: "3017620422003" };
    expect(stessoProdotto(a, { nome: "nutella", marca: "FERRERO", barcode: null })).toBe(true);
    expect(stessoProdotto(a, { nome: "Crema", marca: null, barcode: "3017620422003" })).toBe(true);
    expect(stessoProdotto(a, { nome: "Crema", marca: null, barcode: null })).toBe(false);
  });
});

describe("testoDoppione per codice a barre", () => {
  it("se il doppione è per il codice, il messaggio dice il codice, non nome e marca", () => {
    const doppione = { nome: "Nutella", marca: "Ferrero", barcode: "3017620422003" };
    expect(testoDoppione(doppione, { barcode: "3017620422003" })).toBe(
      "Hai già un alimento con questo codice a barre: «Nutella · Ferrero»."
    );
    expect(testoDoppione({ ...doppione, marca: null }, { barcode: "3017620422003" })).toBe(
      "Hai già un alimento con questo codice a barre: «Nutella»."
    );
  });

  it("senza codice, o con un codice diverso, resta il messaggio di nome e marca", () => {
    const doppione = { nome: "Pane", marca: "Mulino", barcode: "96385074" };
    expect(testoDoppione(doppione)).toBe(
      "Hai già un alimento con questo nome e questa marca: «Pane · Mulino»."
    );
    expect(testoDoppione(doppione, { barcode: null })).toBe(testoDoppione(doppione));
    expect(testoDoppione(doppione, { barcode: "3017620422003" })).toBe(testoDoppione(doppione));
  });
});
