// src/lib/barcode/cercaProdotto.ts

export type ProdottoOpenFoodFacts = {
  nome: string;
  kcal_100g: number | null;
  proteine_100g: number | null;
  carboidrati_100g: number | null;
  grassi_100g: number | null;
};

export async function cercaProdottoPerBarcode(
  barcode: string
): Promise<ProdottoOpenFoodFacts | null> {
  const risposta = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`
  );

  if (!risposta.ok) return null;

  const dati = await risposta.json();

  if (dati.status !== 1 || !dati.product) return null;

  const p = dati.product;
  const nutrienti = p.nutriments ?? {};

  return {
    nome: p.product_name || p.product_name_it || "Prodotto senza nome",
    kcal_100g: nutrienti["energy-kcal_100g"] ?? null,
    proteine_100g: nutrienti["proteins_100g"] ?? null,
    carboidrati_100g: nutrienti["carbohydrates_100g"] ?? null,
    grassi_100g: nutrienti["fat_100g"] ?? null,
  };
}