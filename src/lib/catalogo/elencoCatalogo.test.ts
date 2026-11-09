// Test permanenti per l'elenco della scheda «Catalogo» (elencoCatalogo.ts;
// PUNTO_DI_PARTENZA.md §10.1). Un errore qui non fa rumore: una ricerca
// per marca che non trova niente, «Nascondi quelli che hai» che nasconde
// anche quelli da aggiungere, o un conteggio che non torna con l'elenco.

import { describe, it, expect } from "vitest";
import type { Alimento } from "../db/tipi";
import { CATALOGO_PRECARICATO } from "./catalogoPrecaricato";
import {
  categorieCatalogo,
  elencoCatalogo,
  suggerimentiCatalogo,
  testoConteggioCatalogo,
  trovaNelCatalogo,
} from "./elencoCatalogo";

const USER = "u1";
const TUTTI = { query: "", categoria: null, nascondiQuelliCheHai: false };

function mio(id: string, nome: string, marca: string | null, altro: Partial<Alimento> = {}): Alimento {
  return {
    id, user_id: USER, updated_at: "2026-11-08T10:00:00.000Z", deleted_at: null,
    nome, marca, barcode: null,
    kcal_100g: 100, proteine_100g: 1, carboidrati_100g: 1, grassi_100g: 1,
    zuccheri_100g: null, fibre_100g: null, saturi_100g: null, sale_100g: null,
    porzione_default_g: 100, fonte: "manuale", verificato: false,
    ...altro,
  };
}

function voce(id: string) {
  return CATALOGO_PRECARICATO.find((a) => a.id === id)!;
}

describe("trovaNelCatalogo", () => {
  it("cerca nel nome e nella marca, con maiuscole e accenti indifferenti", () => {
    const spaghetti = voce("off:8076800195057"); // Spaghetti n.5 · Barilla
    expect(trovaNelCatalogo(spaghetti, "BARILLA")).toBe(true);
    expect(trovaNelCatalogo(spaghetti, "spaghetti")).toBe(true);
    expect(trovaNelCatalogo(voce("ciqual:20009"), "carote")).toBe(true);
    expect(trovaNelCatalogo(voce("ciqual:15000"), "barilla")).toBe(false);
  });
});

describe("elencoCatalogo", () => {
  it("senza filtri: tutto il catalogo, nell'ordine del file", () => {
    const e = elencoCatalogo(CATALOGO_PRECARICATO, [], USER, TUTTI);
    expect(e.righe.map((r) => r.voce.id)).toEqual(CATALOGO_PRECARICATO.map((a) => a.id));
    expect({ totale: e.totale, giaNeiTuoi: e.giaNeiTuoi }).toEqual({ totale: 183, giaNeiTuoi: 0 });
  });

  it("una categoria: solo i suoi", () => {
    const e = elencoCatalogo(CATALOGO_PRECARICATO, [], USER, { ...TUTTI, categoria: "Legumi" });
    expect(e.righe.length).toBeGreaterThan(0);
    expect(e.righe.every((r) => r.voce.categoria === "Legumi")).toBe(true);
  });

  it("ricerca per marca dentro una categoria", () => {
    const e = elencoCatalogo(CATALOGO_PRECARICATO, [], USER, { ...TUTTI, query: "pavesi", categoria: "Dolci e snack" });
    expect(e.righe.map((r) => r.voce.id)).toContain("off:8013355999143");
    expect(e.righe.every((r) => r.voce.categoria === "Dolci e snack")).toBe(true);
  });

  it("«Nascondi quelli che hai» toglie solo quelli già nei tuoi; il totale resta", () => {
    const miei = [
      mio("g", "Biscotti", null, { barcode: "8013355999143" }), // le Gocciole, per codice
      mio("c", "Mandorle tostate", null, { catalogo_id: "ciqual:15000" }), // una copia rinominata
    ];
    const tutti = elencoCatalogo(CATALOGO_PRECARICATO, miei, USER, TUTTI);
    expect({ totale: tutti.totale, giaNeiTuoi: tutti.giaNeiTuoi, righe: tutti.righe.length }).toEqual({
      totale: 183, giaNeiTuoi: 2, righe: 183,
    });
    const nascosti = elencoCatalogo(CATALOGO_PRECARICATO, miei, USER, { ...TUTTI, nascondiQuelliCheHai: true });
    expect(nascosti.righe).toHaveLength(181);
    expect(nascosti.righe.map((r) => r.voce.id)).not.toContain("off:8013355999143");
    expect(nascosti.righe.map((r) => r.voce.id)).not.toContain("ciqual:15000");
    expect(nascosti.totale).toBe(183);
  });
});

describe("testoConteggioCatalogo", () => {
  const base = { righe: [], totale: 183, giaNeiTuoi: 0 };
  it("senza nessuno dei tuoi: solo il numero", () => {
    expect(testoConteggioCatalogo(base, false)).toBe("183");
  });
  it("con alcuni dei tuoi: «183 · 2 già nei tuoi»", () => {
    expect(testoConteggioCatalogo({ ...base, giaNeiTuoi: 2 }, false)).toBe("183 · 2 già nei tuoi");
  });
  it("con «Nascondi» acceso: quanti restano da aggiungere", () => {
    const e = elencoCatalogo(CATALOGO_PRECARICATO, [], USER, { ...TUTTI, categoria: "Legumi", nascondiQuelliCheHai: true });
    expect(testoConteggioCatalogo(e, true)).toBe(`${e.righe.length} da aggiungere`);
  });
});

describe("categorieCatalogo", () => {
  it("le 14 categorie della lista, una volta sola, nell'ordine del file", () => {
    const categorie = categorieCatalogo(CATALOGO_PRECARICATO);
    expect(categorie).toHaveLength(14);
    expect(categorie[0]).toBe("Pasta e cereali");
    expect(new Set(categorie).size).toBe(14);
  });
});

describe("suggerimentiCatalogo (il riquadro di Aggiungi)", () => {
  it("cerca solo nel nome, come la ricerca di Aggiungi: la marca non conta", () => {
    expect(suggerimentiCatalogo(CATALOGO_PRECARICATO, [], USER, "barilla")).toEqual([]);
    expect(suggerimentiCatalogo(CATALOGO_PRECARICATO, [], USER, "spaghetti").map((v) => v.id)).toContain("off:8076800195057");
  });

  it("al massimo 3, in ordine di nome", () => {
    const nomi = suggerimentiCatalogo(CATALOGO_PRECARICATO, [], USER, "LATTE").map((v) => v.nome);
    expect(nomi).toEqual(["Fiocchi di latte (cottage)", "Latte parzialmente scremato", "Latte parzialmente scremato UHT"]);
  });

  it("toglie quelli che hai già (qui una copia rinominata), e il posto lo prende il successivo", () => {
    const fiocchi = CATALOGO_PRECARICATO.find((v) => v.nome === "Fiocchi di latte (cottage)")!;
    const miei = [mio("c", "Il mio cottage", null, { catalogo_id: fiocchi.id })];
    const nomi = suggerimentiCatalogo(CATALOGO_PRECARICATO, miei, USER, "latte").map((v) => v.nome);
    expect(nomi).toEqual(["Latte parzialmente scremato", "Latte parzialmente scremato UHT", "Latte senza lattosio"]);
  });

  it("a ricerca vuota niente", () => {
    expect(suggerimentiCatalogo(CATALOGO_PRECARICATO, [], USER, "   ")).toEqual([]);
  });
});
