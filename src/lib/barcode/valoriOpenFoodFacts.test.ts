// Test permanenti per daOpenFoodFacts (valoriOpenFoodFacts.ts). Una
// conversione che sbaglia in silenzio: kJ presi per kcal (2252 "kcal" per
// la Nutella), zuccheri finiti nel catalogo, la marca intera "Nutella,
// Ferrero", un nome tagliato a metà carattere. Il modulo li mostrerebbe
// come valori plausibili e l'utente li salverebbe.

import { describe, it, expect } from "vitest";
import {
  daOpenFoodFacts,
  eVuoto,
  haValori,
  KJ_PER_KCAL,
  LUNGHEZZA_MASSIMA_TESTO,
} from "./valoriOpenFoodFacts";

// La parte che serve della risposta vera di Open Food Facts per
// 3017620422003 (Nutella), letta il 07/11/2026.
const NUTELLA = {
  product_name: "Nutella",
  product_name_it: "Nutella",
  brands: "Nutella, Ferrero",
  nutriments: {
    "energy-kcal_100g": 539,
    "energy-kj_100g": 2252,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
    sugars_100g: 56.3,
    fiber_100g: 0,
    "saturated-fat_100g": 10.6,
    salt_100g: 0.107,
  },
};

describe("daOpenFoodFacts", () => {
  it("legge nome, prima marca e i quattro valori", () => {
    expect(daOpenFoodFacts(NUTELLA)).toEqual({
      nome: "Nutella",
      marca: "Nutella",
      kcal_100g: 539,
      proteine_100g: 6.3,
      carboidrati_100g: 57.5,
      grassi_100g: 30.9,
      kcalDaKj: false,
    });
  });

  it("scarta zuccheri, fibre, saturi e sale", () => {
    const p = daOpenFoodFacts(NUTELLA) as unknown as Record<string, unknown>;
    for (const chiave of Object.keys(p)) {
      expect(chiave).not.toMatch(/zuccheri|fibre|saturi|sale/);
    }
  });

  it("il nome italiano vince su quello generico; senza, il generico", () => {
    expect(daOpenFoodFacts({ product_name: "Cookies", product_name_it: "Biscotti" }).nome).toBe(
      "Biscotti"
    );
    expect(daOpenFoodFacts({ product_name: "Cookies", product_name_it: "  " }).nome).toBe("Cookies");
    expect(daOpenFoodFacts({ product_name: "Cookies" }).nome).toBe("Cookies");
    expect(daOpenFoodFacts({}).nome).toBe("");
  });

  it("la marca è la prima non vuota dell'elenco, null se non c'è", () => {
    expect(daOpenFoodFacts({ brands: " ,  Mulino   Bianco , Barilla" }).marca).toBe("Mulino Bianco");
    expect(daOpenFoodFacts({ brands: "" }).marca).toBeNull();
    expect(daOpenFoodFacts({}).marca).toBeNull();
  });

  it("senza kcal le calcola dai kJ, arrotondate a due decimali, e lo dice", () => {
    const p = daOpenFoodFacts({ nutriments: { "energy-kj_100g": 1000 } });
    // 1000 / 4,184 = 239,005…
    expect(p.kcal_100g).toBe(239.01);
    expect(p.kcalDaKj).toBe(true);
    expect(KJ_PER_KCAL).toBe(4.184);
  });

  it("con kcal e kJ tutte e due presenti usa le kcal dichiarate", () => {
    const p = daOpenFoodFacts({ nutriments: { "energy-kcal_100g": 100, "energy-kj_100g": 2000 } });
    expect(p.kcal_100g).toBe(100);
    expect(p.kcalDaKj).toBe(false);
  });

  it("accetta i numeri scritti come testo, e arrotonda a due decimali", () => {
    const p = daOpenFoodFacts({
      nutriments: { proteins_100g: "7.1", carbohydrates_100g: "68,456", fat_100g: 19.005 },
    });
    expect(p.proteine_100g).toBe(7.1);
    expect(p.carboidrati_100g).toBe(68.46);
    expect(p.grassi_100g).toBe(19.01);
  });

  it("un valore mancante, negativo o illeggibile resta vuoto (null), lo zero no", () => {
    const p = daOpenFoodFacts({
      nutriments: { proteins_100g: -1, carbohydrates_100g: "tanti", fat_100g: 0 },
    });
    expect(p.kcal_100g).toBeNull();
    expect(p.proteine_100g).toBeNull();
    expect(p.carboidrati_100g).toBeNull();
    expect(p.grassi_100g).toBe(0);
  });

  it("taglia nome e marca a 200 caratteri, senza spezzare un carattere", () => {
    // 🍫 occupa due unità in una stringa JavaScript: .slice(0, 200) lo
    // spezzerebbe e .length conterebbe il doppio dei caratteri.
    const lungo = "🍫".repeat(250);
    const p = daOpenFoodFacts({ product_name: lungo, brands: lungo });
    expect(Array.from(p.nome)).toHaveLength(LUNGHEZZA_MASSIMA_TESTO);
    expect(p.nome).toBe("🍫".repeat(200));
    expect(Array.from(p.marca ?? "")).toHaveLength(LUNGHEZZA_MASSIMA_TESTO);
  });

  it("una risposta storta (nutriments non oggetto, nome numerico) non rompe niente", () => {
    expect(daOpenFoodFacts({ product_name: 42, brands: 7, nutriments: "x" })).toEqual({
      nome: "",
      marca: null,
      kcal_100g: null,
      proteine_100g: null,
      carboidrati_100g: null,
      grassi_100g: null,
      kcalDaKj: false,
    });
  });
});

describe("haValori ed eVuoto", () => {
  it("basta un valore per dire che i valori vengono da Open Food Facts", () => {
    expect(haValori(daOpenFoodFacts({ nutriments: { fat_100g: 0 } }))).toBe(true);
    expect(haValori(daOpenFoodFacts({ product_name: "Solo nome" }))).toBe(false);
  });

  it("vuoto solo senza nome, senza marca e senza valori", () => {
    expect(eVuoto(daOpenFoodFacts({}))).toBe(true);
    // Il prodotto 4006381333931 su Open Food Facts: solo nome e marca.
    expect(eVuoto(daOpenFoodFacts({ product_name: "Prodotto", brands: "Marca" }))).toBe(false);
    expect(eVuoto(daOpenFoodFacts({ nutriments: { proteins_100g: 1 } }))).toBe(false);
  });
});
