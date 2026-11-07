// Cosa fare con un codice a barre letto (PUNTO_DI_PARTENZA.md §3, "Codice
// a barre", "Il percorso"). L'ordine è la regola:
// 1. il catalogo locale (Dexie): se il prodotto c'è, si va dritti allo
//    sheet quantità, anche senza rete;
// 2. solo se non c'è, Open Food Facts.
// Così un prodotto già usato non costa una chiamata, non dipende dalla
// rete, e non rischia di diventare un secondo alimento con lo stesso
// codice.

import type { Alimento } from "../db/tipi";
import { alimentoPerCodice } from "../repository/alimenti";
import { cercaSuOpenFoodFacts, type EsitoOpenFoodFacts } from "./openFoodFacts";
import type { ProdottoOpenFoodFacts } from "./valoriOpenFoodFacts";

export type EsitoRicercaCodice =
  // Già nel catalogo: sheet quantità.
  | { esito: "nel-catalogo"; alimento: Alimento }
  // Trovato su Open Food Facts: "Nuovo alimento" precompilato.
  | { esito: "open-food-facts"; prodotto: ProdottoOpenFoodFacts }
  // Gli altri esiti di Open Food Facts, così come sono: "non-trovato"
  // apre il modulo vuoto con il codice, gli altri danno un messaggio.
  | Exclude<EsitoOpenFoodFacts, { esito: "trovato" }>;

// `codice` è già controllato e normalizzato (leggiCodice). `fetchBase`
// serve ai test.
export async function cercaCodice(
  userId: string,
  codice: string,
  opzioni: { segnale?: AbortSignal; fetchBase?: typeof fetch } = {}
): Promise<EsitoRicercaCodice> {
  const locale = await alimentoPerCodice(userId, codice);
  if (locale) return { esito: "nel-catalogo", alimento: locale };

  // La schermata può essere stata chiusa mentre si leggeva Dexie.
  if (opzioni.segnale?.aborted) return { esito: "annullata" };

  const esito = await cercaSuOpenFoodFacts(codice, opzioni);
  return esito.esito === "trovato" ? { esito: "open-food-facts", prodotto: esito.prodotto } : esito;
}
