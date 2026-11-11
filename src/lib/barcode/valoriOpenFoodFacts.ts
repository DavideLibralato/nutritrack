// Da un prodotto di Open Food Facts ai campi di "Nuovo alimento"
// (PUNTO_DI_PARTENZA.md §3, "Codice a barre", "Cosa si prende da OFF").
//
// Open Food Facts lo compilano dei volontari: un campo può mancare, essere
// vuoto, essere un testo invece di un numero, o avere un valore assurdo.
// Qui si legge solo quello che serve, e si lascia vuoto (null) quello che
// non si riesce a leggere. Un valore assurdo ma leggibile (120 g di
// proteine su 100 g) passa: lo ferma la validazione del modulo, che lo
// mostra all'utente — mai salvato in silenzio.
//
// Zuccheri, fibre, saturi e sale si scartano: il modulo non li mostra e
// nessuno li controllerebbe.
//
// Funzioni pure: i test sono in valoriOpenFoodFacts.test.ts.

import { normalizzaSpazi } from "../catalogo/doppioniAlimenti";
import { arrotondaDecimali } from "../numeriDecimali";

// Il fattore delle etichette UE (regolamento 1169/2011): 1 kcal = 4,184 kJ.
export const KJ_PER_KCAL = 4.184;

// Il limite di nome e marca in `alimenti_condivisi` (migration
// alimenti_condivisi): un alimento più lungo non si potrebbe mandare a un
// amico.
export const LUNGHEZZA_MASSIMA_TESTO = 200;

// La parte della risposta di Open Food Facts (API v3, `product`) che si
// legge. Tutto facoltativo e `unknown`: la forma non è garantita.
export interface ProdottoGrezzo {
  product_name?: unknown;
  product_name_it?: unknown;
  brands?: unknown;
  nutriments?: unknown;
}

// Quello che arriva al modulo. I valori sono per 100 g, già arrotondati a
// due decimali come le colonne numeric(7,2); null = da scrivere a mano.
export interface ProdottoOpenFoodFacts {
  nome: string; // "" se Open Food Facts non ha un nome
  marca: string | null;
  kcal_100g: number | null;
  proteine_100g: number | null;
  carboidrati_100g: number | null;
  grassi_100g: number | null;
  // Le kcal sono calcolate dai kJ: il modulo lo scrive sotto il campo.
  kcalDaKj: boolean;
}

// Un testo pulito: spazi normalizzati e al massimo 200 caratteri. I
// caratteri si contano come li conta Postgres (char_length): Array.from
// separa per carattere, mentre .length conterebbe due volte un'emoji o
// una lettera fuori dall'alfabeto di base, e .slice potrebbe tagliarla a
// metà.
function testoPulito(valore: unknown): string {
  if (typeof valore !== "string") return "";
  const caratteri = Array.from(normalizzaSpazi(valore));
  return caratteri.slice(0, LUNGHEZZA_MASSIMA_TESTO).join("").trimEnd();
}

// Un numero per 100 g: Open Food Facts a volte lo manda come testo
// ("7.1"). Negativo, infinito o illeggibile = null.
function numero(valore: unknown): number | null {
  const n =
    typeof valore === "number"
      ? valore
      : typeof valore === "string" && valore.trim() !== ""
        ? Number(valore.trim().replace(",", "."))
        : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function arrotondato(n: number | null): number | null {
  return n === null ? null : arrotondaDecimali(n, 2);
}

export function daOpenFoodFacts(p: ProdottoGrezzo): ProdottoOpenFoodFacts {
  const nutrienti =
    typeof p.nutriments === "object" && p.nutriments !== null
      ? (p.nutriments as Record<string, unknown>)
      : {};

  // Il nome italiano se c'è, altrimenti quello generico.
  const nome = testoPulito(p.product_name_it) || testoPulito(p.product_name);

  // `brands` è un elenco separato da virgole, la marca principale per
  // prima ("Nutella, Ferrero"): si tiene la prima non vuota.
  const primaMarca =
    typeof p.brands === "string"
      ? (p.brands
          .split(",")
          .map(testoPulito)
          .find((m) => m !== "") ?? "")
      : "";

  const kcal = numero(nutrienti["energy-kcal_100g"]);
  const kj = numero(nutrienti["energy-kj_100g"]);
  // Le kcal dichiarate vincono sempre; dai kJ solo se mancano.
  const kcalDaKj = kcal === null && kj !== null;
  const kcalFinali = kcal ?? (kj === null ? null : kj / KJ_PER_KCAL);

  return {
    nome,
    marca: primaMarca || null,
    kcal_100g: arrotondato(kcalFinali),
    proteine_100g: arrotondato(numero(nutrienti["proteins_100g"])),
    carboidrati_100g: arrotondato(numero(nutrienti["carbohydrates_100g"])),
    grassi_100g: arrotondato(numero(nutrienti["fat_100g"])),
    kcalDaKj,
  };
}

// Almeno uno dei quattro valori viene da Open Food Facts: l'alimento
// salvato avrà `fonte = 'off'`, anche se poi l'utente lo corregge. Se
// nessuno, li scrive lui e la fonte è 'barcode' (PUNTO §3, "`fonte` e
// `barcode`").
export function haValori(p: ProdottoOpenFoodFacts): boolean {
  return (
    p.kcal_100g !== null ||
    p.proteine_100g !== null ||
    p.carboidrati_100g !== null ||
    p.grassi_100g !== null
  );
}

// Niente di utile: né nome, né marca, né valori. Per l'utente è come un
// prodotto non trovato (modulo vuoto con il solo codice).
export function eVuoto(p: ProdottoOpenFoodFacts): boolean {
  return p.nome === "" && p.marca === null && !haValori(p);
}
