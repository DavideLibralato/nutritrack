// La chiamata a Open Food Facts per un codice a barre (PUNTO_DI_PARTENZA.md
// §3, "Codice a barre", "Open Food Facts").
//
// - Dal browser, senza passare dal nostro server: API pubblica, senza
//   chiave e senza costi. Endpoint v3, quello raccomandato (la v2 è
//   deprecata), con i soli campi che servono.
// - Open Food Facts chiede a ogni app di presentarsi. Il browser non
//   lascia cambiare l'header `User-Agent`, quindi si manda
//   `X-User-Agent`, che Open Food Facts accetta (CORS verificato il
//   07/11: è nell'elenco Access-Control-Allow-Headers).
// - Tempo massimo 10 secondi, con la richiesta annullata davvero
//   (creaFetchConScadenza, lo stesso meccanismo della sync).
//
// Il risultato distingue i casi che la schermata tratta in modo diverso:
// "non trovato" (404) apre il modulo vuoto con il codice; "rete" e
// "occupato" danno un messaggio con "Riprova" e "Crea a mano"; "annullata"
// vuol dire che l'utente ha chiuso, e non si mostra niente.

import { creaFetchConScadenza } from "../supabase/fetchConScadenza";
import { daOpenFoodFacts, eVuoto, type ProdottoOpenFoodFacts } from "./valoriOpenFoodFacts";

export const SCADENZA_OPEN_FOOD_FACTS_MS = 10_000;

const INDIRIZZO_PRODOTTO = "https://world.openfoodfacts.org/api/v3/product/";
const CAMPI = "product_name,product_name_it,brands,nutriments";

// "Libra/0.1.0 (libra.app.supporto@gmail.com)". VERSIONE_APP la scrive
// next.config.ts da package.json durante la build; nei test non c'è.
export function userAgentLibra(): string {
  return `Libra/${process.env.VERSIONE_APP ?? "sviluppo"} (libra.app.supporto@gmail.com)`;
}

export type EsitoOpenFoodFacts =
  | { esito: "trovato"; prodotto: ProdottoOpenFoodFacts }
  | { esito: "non-trovato" }
  // La richiesta non è arrivata, o non ha risposto entro il tempo massimo.
  | { esito: "rete" }
  // Troppe richieste (429) o servizio sovraccarico (503).
  | { esito: "occupato" }
  // Qualunque altra risposta che non si sa leggere.
  | { esito: "errore" }
  // Chi chiama ha annullato (la schermata è stata chiusa).
  | { esito: "annullata" };

// `codice` è già controllato e normalizzato (leggiCodice). `fetchBase`
// serve ai test.
export async function cercaSuOpenFoodFacts(
  codice: string,
  opzioni: { segnale?: AbortSignal; fetchBase?: typeof fetch } = {}
): Promise<EsitoOpenFoodFacts> {
  const { segnale, fetchBase } = opzioni;
  const chiama = creaFetchConScadenza(SCADENZA_OPEN_FOOD_FACTS_MS, fetchBase);
  const url = `${INDIRIZZO_PRODOTTO}${encodeURIComponent(codice)}?fields=${CAMPI}`;

  let risposta: Response;
  try {
    risposta = await chiama(url, {
      headers: { "X-User-Agent": userAgentLibra() },
      signal: segnale,
    });
  } catch {
    // Una fetch fallita (rete assente, DNS, CORS) o annullata. Se l'ha
    // annullata chi chiama, non è un errore da mostrare; se è scaduto il
    // tempo massimo, per l'utente è come la rete assente.
    return segnale?.aborted ? { esito: "annullata" } : { esito: "rete" };
  }

  if (risposta.status === 404) return { esito: "non-trovato" };
  if (risposta.status === 429 || risposta.status === 503) return { esito: "occupato" };
  if (!risposta.ok) return { esito: "errore" };

  let corpo: unknown;
  try {
    corpo = await risposta.json();
  } catch (e) {
    // Un corpo che non è JSON (SyntaxError) è un errore. Tutto il resto
    // è la lettura interrotta a metà: da chi chiama, dal tempo massimo o
    // dalla rete caduta, che per l'utente sono "rete assente".
    if (segnale?.aborted) return { esito: "annullata" };
    return e instanceof SyntaxError ? { esito: "errore" } : { esito: "rete" };
  }
  const prodotto =
    typeof corpo === "object" && corpo !== null ? (corpo as { product?: unknown }).product : null;
  if (typeof prodotto !== "object" || prodotto === null) return { esito: "non-trovato" };

  const letto = daOpenFoodFacts(prodotto);
  // Un prodotto senza nome, marca né valori non aiuta: come non trovato.
  return eVuoto(letto) ? { esito: "non-trovato" } : { esito: "trovato", prodotto: letto };
}
