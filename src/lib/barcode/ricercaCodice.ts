// Cosa fare con un codice a barre letto (PUNTO_DI_PARTENZA.md §3, "Codice
// a barre", "Il percorso"). L'ordine è la regola:
// 1. il catalogo locale (Dexie): se il prodotto c'è, si va dritti allo
//    sheet quantità, anche senza rete;
// 2. il catalogo precaricato (dal branch `catalogo`, PUNTO §10.1): se il
//    codice è lì, risponde lui, senza chiamare Open Food Facts. Con il suo
//    stato «Nei tuoi»: con il codice non sei arrivato a un tuo alimento,
//    ma puoi averne uno con lo stesso nome e marca;
// 3. solo se non c'è, Open Food Facts.
// Così un prodotto già usato non costa una chiamata, non dipende dalla
// rete, e non rischia di diventare un secondo alimento con lo stesso
// codice.

import type { Alimento } from "../db/tipi";
import { alimentoPerCodice, catalogoLocale } from "../repository/alimenti";
import { alimentoCatalogoPerCodice, type AlimentoCatalogo } from "../catalogo/catalogoPrecaricato";
import { statoNelCatalogo, type StatoNelCatalogo } from "../catalogo/neiTuoi";
import { cercaSuOpenFoodFacts, type EsitoOpenFoodFacts } from "./openFoodFacts";
import type { ProdottoOpenFoodFacts } from "./valoriOpenFoodFacts";

export type EsitoRicercaCodice =
  // Già nel catalogo: sheet quantità.
  | { esito: "nel-catalogo"; alimento: Alimento }
  // Non fra i tuoi per codice, ma nel catalogo precaricato.
  | { esito: "catalogo-precaricato"; voce: AlimentoCatalogo; stato: StatoNelCatalogo }
  // Trovato su Open Food Facts: "Nuovo alimento" precompilato.
  | { esito: "open-food-facts"; prodotto: ProdottoOpenFoodFacts }
  // Gli altri esiti di Open Food Facts, così come sono: "non-trovato"
  // apre il modulo vuoto con il codice, gli altri danno un messaggio.
  | Exclude<EsitoOpenFoodFacts, { esito: "trovato" }>;

// Un alimento del catalogo come lo vede "Nuovo alimento" precompilato
// (lo stesso modulo di Open Food Facts). Serve quando il codice è nel
// catalogo ma hai già un alimento con lo stesso nome e marca e un ALTRO
// codice: si fa come con Open Food Facts (modulo, messaggio del doppione,
// «Apri» senza codice; PUNTO §3, "Codice a barre", "Il percorso"). I
// prodotti con il codice nel catalogo vengono tutti da Open Food Facts,
// quindi l'avviso del modulo resta vero.
export function prodottoDaCatalogo(voce: AlimentoCatalogo): ProdottoOpenFoodFacts {
  return {
    nome: voce.nome,
    marca: voce.marca,
    kcal_100g: voce.kcal_100g,
    proteine_100g: voce.proteine_100g,
    carboidrati_100g: voce.carboidrati_100g,
    grassi_100g: voce.grassi_100g,
    kcalDaKj: false,
  };
}

// `codice` è già controllato e normalizzato (leggiCodice). `fetchBase`
// serve ai test.
export async function cercaCodice(
  userId: string,
  codice: string,
  opzioni: { segnale?: AbortSignal; fetchBase?: typeof fetch } = {}
): Promise<EsitoRicercaCodice> {
  const locale = await alimentoPerCodice(userId, codice);
  if (locale) return { esito: "nel-catalogo", alimento: locale };

  const voce = alimentoCatalogoPerCodice(codice);
  if (voce) {
    return {
      esito: "catalogo-precaricato",
      voce,
      stato: statoNelCatalogo(voce, await catalogoLocale(userId), userId),
    };
  }

  // La schermata può essere stata chiusa mentre si leggeva Dexie.
  if (opzioni.segnale?.aborted) return { esito: "annullata" };

  const esito = await cercaSuOpenFoodFacts(codice, opzioni);
  return esito.esito === "trovato" ? { esito: "open-food-facts", prodotto: esito.prodotto } : esito;
}
