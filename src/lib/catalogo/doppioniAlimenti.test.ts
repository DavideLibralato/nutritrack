// Test permanenti per la regola del doppione nel catalogo
// (doppioniAlimenti.ts). Un errore qui non fa rumore: o lascia passare due
// alimenti uguali, o blocca un alimento che doppione non è (stesso nome,
// marca diversa) e l'utente non capisce perché il Salva è spento.

import { describe, it, expect } from "vitest";
import type { Alimento } from "../db/tipi";
import {
  chiaveAlimento,
  normalizzaSpazi,
  testoConfronto,
  testoDoppione,
  trovaDoppione,
} from "./doppioniAlimenti";

const USER = "u1";

function alimento(id: string, nome: string, marca: string | null, altro: Partial<Alimento> = {}): Alimento {
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
