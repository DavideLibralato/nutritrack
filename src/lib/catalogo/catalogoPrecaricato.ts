// Il catalogo precaricato (PUNTO_DI_PARTENZA.md §10.1): un file dentro
// l'app, solo da leggere, generato da scripts/catalogo/generaCatalogo.mjs.
// Non sta su Supabase né in Dexie: si importa con il codice dell'app, così
// c'è offline dal primo giorno e Esci non lo tocca.
//
// Da qui non si scrive niente: «Aggiungi» crea un alimento dell'utente
// (aggiungiDalCatalogo in src/lib/repository/alimenti.ts), e il catalogo
// resta com'è.

import file from "./catalogoPrecaricato.json";

// Da dove vengono i valori: Ciqual 2025 (Anses) per gli sfusi, Open Food
// Facts per quelli di marca. Non è la `fonte` di un alimento: la copia ha
// 'manuale' o 'off' (§10.1, "`fonte` della copia").
export type OrigineCatalogo = "ciqual" | "off";

export interface AlimentoCatalogo {
  // `ciqual:<codice Ciqual>` o `off:<codice a barre>`: stabile fra una
  // versione del catalogo e l'altra, è il `catalogo_id` delle copie.
  id: string;
  origine: OrigineCatalogo;
  categoria: string;
  nome: string;
  marca: string | null;
  barcode: string | null;
  porzione_default_g: number;
  kcal_100g: number;
  proteine_100g: number;
  carboidrati_100g: number;
  grassi_100g: number;
  zuccheri_100g: number | null;
  fibre_100g: number | null;
  saturi_100g: number | null;
  sale_100g: number | null;
}

export const VERSIONE_CATALOGO: string = file.versione;

export const CATALOGO_PRECARICATO: readonly AlimentoCatalogo[] = file.alimenti as AlimentoCatalogo[];

const PER_CODICE = new Map(
  CATALOGO_PRECARICATO.filter((a) => a.barcode !== null).map((a) => [a.barcode!, a])
);

// L'alimento del catalogo con questo codice a barre (già nella forma di
// leggiCodice: 13 o 8 cifre), se c'è. La scansione lo guarda dopo i tuoi
// alimenti e prima di Open Food Facts (src/lib/barcode/ricercaCodice.ts).
export function alimentoCatalogoPerCodice(codice: string): AlimentoCatalogo | null {
  return PER_CODICE.get(codice) ?? null;
}
