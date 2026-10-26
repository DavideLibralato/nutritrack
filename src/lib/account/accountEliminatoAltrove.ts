// L'account è stato eliminato da un altro dispositivo
// (PUNTO_DI_PARTENZA.md §9.6 e §11): il server ha risposto
// `user_not_found` (utenteEliminato, utenteOffline.ts), una risposta
// definitiva, non un problema di rete. Su QUESTO dispositivo si fa quello
// che fa Elimina account dopo il sì del server: dati di quell'utente
// tolti, sessione chiusa, Accedi con un messaggio.
//
// Qui non si decide QUANDO: lo decide chi riceve la risposta del server
// (dal commit successivo, useUtenteId). Questo modulo non va mai in rete
// per verificare: si fida del `user_not_found` già ricevuto.
//
// L'ordine:
// 1. di chi è la sessione su questo dispositivo? Nessuna → niente da fare;
// 2. c'è un segno "eliminazione in corso" dello STESSO utente (fase
//    "richiesta" o "confermata")? Allora l'eliminazione è partita da
//    questo dispositivo: la finisce il flusso esistente (Elimina account,
//    o la ripresa all'avvio) e porta a ?eliminato=1. Qui niente;
// 3. da qui si agisce, UNA VOLTA SOLA per caricamento della pagina:
//    sei componenti possono ricevere `user_not_found` insieme;
// 4. quante modifiche dell'utente c'erano in coda, PRIMA della pulizia
//    (per il messaggio "andate perse");
// 5. segno "confermata", se il posto è libero. Se c'è il segno di un ALTRO
//    utente non si sovrascrive (è la sua eliminazione da finire): si pulisce
//    senza segno, cioè un giro solo;
// 6. sessione chiusa su questo dispositivo (scope "local"; il 403 di
//    /logout lo ignora supabase-js), e controllo che sia sparita;
// 7. attesa delle discese partite prima (discesa.ts), poi la pulizia,
//    la stessa di Elimina account (puliziaDopoEliminazione.ts);
// 8. ricaricamento completo su /login?eliminato=altrove (con &perse=1 se
//    al punto 4 c'erano modifiche). Completo e non una navigazione interna
//    di Next: azzera tutto ciò che è in memoria (giri, novità, utente) e
//    fa ripartire la ripresa all'avvio, che con il segno "confermata" fa il
//    secondo giro di pulizia e toglie il segno.
//
// Se la sessione resta dopo il signOut (punto 6) non si naviga: il proxy
// vedrebbe ancora il token, rimanderebbe da /login a "/", e lì ripartirebbe
// tutto da capo. La pulizia si fa lo stesso (l'account non c'è più), e il
// segno resta per il prossimo avvio.

import { createClient } from "../supabase/client";
import { idUtenteDellaSessione } from "../supabase/utenteDellaSessione";
import { attendiDiscesaInCorso } from "../sync/discesa";
import { modificheNonInviate } from "../sync/ripristino";
import { totaleModifiche } from "./esci";
import { leggiSegnoEliminazione, scriviSegnoEliminazione } from "./eliminazioneInCorso";
import { pulisciDispositivoDopoEliminazione } from "./puliziaDopoEliminazione";

export type EsitoAccountEliminato =
  // Nessuna sessione su questo dispositivo: niente da pulire per conto suo.
  | "nessuna-sessione"
  // Segno dello stesso utente: ci pensa il flusso di Elimina account.
  | "segno-stesso-utente"
  // Pulito, ma la sessione è rimasta: niente navigazione.
  | "sessione-rimasta"
  // Pulito, sessione chiusa, si va su Accedi.
  | "uscito";

// Funzione pura: l'indirizzo di Accedi dopo l'eliminazione da un altro
// dispositivo. `perse`: c'erano modifiche in coda, andate perse.
export function indirizzoDopoEliminazioneAltrove(perse: boolean): string {
  return perse ? "/login?eliminato=altrove&perse=1" : "/login?eliminato=altrove";
}

// Il lavoro in corso, condiviso da tutte le chiamate di questo caricamento
// della pagina. Si imposta SOLO quando si agisce (punto 3): un "niente da
// fare" (nessuna sessione, segno dello stesso utente) non blocca le
// chiamate dopo. Esempio: al riavvio dopo un'eliminazione interrotta il
// segno c'è, poi la ripresa lo toglie; una risposta arrivata dopo deve
// poter agire. Non si azzera mai: dopo il ricaricamento il modulo riparte
// da capo da solo.
let azione: Promise<EsitoAccountEliminato> | null = null;

export function gestisciAccountEliminatoAltrove(
  naviga: (indirizzo: string) => void = (indirizzo) => window.location.replace(indirizzo)
): Promise<EsitoAccountEliminato> {
  if (azione) return azione;
  return valutaEAgisci(naviga);
}

async function valutaEAgisci(naviga: (indirizzo: string) => void): Promise<EsitoAccountEliminato> {
  const supabase = createClient();

  // 1. Di chi è la sessione (senza rete: getSession o il cookie).
  const idUtente = await idUtenteDellaSessione(supabase);
  if (!idUtente) return "nessuna-sessione";

  // 2. Eliminazione partita da qui: la finisce il flusso esistente.
  const segno = leggiSegnoEliminazione();
  if (segno?.idUtente === idUtente) return "segno-stesso-utente";

  // 3. Una volta sola. Fra l'await qui sopra e questa riga non può
  // inserirsi nessun'altra chiamata (JavaScript esegue un pezzo alla
  // volta): chi arriva dopo trova `azione` già impostata.
  if (azione) return azione;
  azione = agisci(supabase, idUtente, segno === null, naviga);
  return azione;
}

async function agisci(
  supabase: ReturnType<typeof createClient>,
  idUtente: string,
  postoLibero: boolean,
  naviga: (indirizzo: string) => void
): Promise<EsitoAccountEliminato> {
  // 4. Prima della pulizia, che le toglie. Se Dexie non risponde, nel dubbio
  // niente riga "andate perse": meglio tacere che dirlo a vuoto.
  const perse = await modificheNonInviate(idUtente)
    .then((m) => totaleModifiche(m) > 0)
    .catch(() => false);

  // 5. Il segno, solo se il posto è libero.
  if (postoLibero) scriviSegnoEliminazione(idUtente, "confermata");

  // 6. Sessione chiusa qui, e controllo.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  const { data } = await supabase.auth.getSession();
  const sessioneRimasta = data.session !== null;

  // 7. Prima finiscono le discese partite prima, poi la pulizia.
  await attendiDiscesaInCorso();
  await pulisciDispositivoDopoEliminazione(idUtente);

  // 8. Su Accedi, solo se la sessione non c'è più.
  if (sessioneRimasta) {
    console.error("Account eliminato altrove: la sessione è rimasta dopo il signOut, niente navigazione.");
    return "sessione-rimasta";
  }
  naviga(indirizzoDopoEliminazioneAltrove(perse));
  return "uscito";
}

// Solo per i test: ogni test parte come un caricamento nuovo della pagina.
export function azzeraPerTest(): void {
  azione = null;
}
