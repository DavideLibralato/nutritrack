// Helper specifici per i pasti, oltre al CRUD generico di repositoryPasti.
//
// Il set predefinito dei 5 pasti (PUNTO_DI_PARTENZA.md, sezione "I pasti")
// va creato "alla registrazione", ma la registrazione è una Server Action e
// i pasti vivono in Dexie, che esiste solo nel browser (local-first, sezione
// 9.2). Quindi il set si crea lato client alla prima apertura dell'app,
// solo dopo aver visto che sul server non c'è niente
// (garantisciPastiPredefiniti).

import { v5 as uuidv5 } from "uuid";
import { repositoryPasti } from "./index";
import { contaRigheSulServer, scaricaTabella } from "../sync/discesa";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";
import { pastoValidoIl } from "../pasti/validitaPasti";

export const PASTI_PREDEFINITI: Pick<Pasto, "nome" | "ora_inizio" | "ordine">[] = [
  { nome: "Colazione", ora_inizio: "06:00", ordine: 0 },
  { nome: "Spuntino mattina", ora_inizio: "10:00", ordine: 1 },
  { nome: "Pranzo", ora_inizio: "12:30", ordine: 2 },
  { nome: "Spuntino pomeriggio", ora_inizio: "16:00", ordine: 3 },
  { nome: "Cena", ora_inizio: "19:30", ordine: 4 },
];

// Namespace fisso per calcolare l'id dei 5 pasti predefiniti come UUID v5
// (RFC4122) da utente + nome canonico, invece che casuale. Due dispositivi
// che seminano indipendentemente senza essersi mai sincronizzati producono
// così lo stesso id per "la Colazione di questo utente" — upsert() lo
// tratta come un aggiornamento della stessa riga, mai come un doppione.
// Prima di questo, il doppione era il rischio reale: due set da 5 righe con
// id diversi, il server arrivava a 10, le voci di diario dei due dispositivi
// restavano appese a due gruppi di pasti che non si fondevano da soli.
//
// COSTANTE IMMUTABILE. Non è un segreto (non serve nasconderla: PUNTO_2,
// sotto), ma è un valore che ogni dispositivo deve calcolare allo stesso
// modo per sempre. Se cambia, ogni dispositivo esistente ricalcola id
// diversi da quelli già sul server per le stesse identiche righe: è
// esattamente il doppione che questo meccanismo esiste per evitare, solo
// ritardato al giorno in cui qualcuno la tocca credendola innocua. Generata
// una volta con crypto.randomUUID(), non un UUID "storico" delle namespace
// DNS/URL di RFC4122 — non ha bisogno di esserlo, un UUID v5 accetta
// qualunque UUID come namespace.
const NAMESPACE_PASTI_PREDEFINITI = "5c62c189-1488-4f70-ae19-9a93f4cb8488";

// L'id va sempre calcolato dal NOME CANONICO in PASTI_PREDEFINITI, mai dal
// nome attuale di una riga già esistente. Se l'utente rinomina "Cena" in
// "Dinner", l'id resta quello calcolato su "Cena": due dispositivi che
// seminano lo stesso set devono produrre gli stessi id, qualunque cosa sia
// successa dopo ai nomi.
export function idPastoPredefinito(userId: string, nomeCanonico: string): string {
  return uuidv5(`${userId}:${nomeCanonico}`, NAMESPACE_PASTI_PREDEFINITI);
}

// Come è andata garantisciPastiPredefiniti. Chi la chiama (usePastiIniziali)
// ne ha bisogno per scegliere cosa mostrare quando l'utente non ha ancora
// nessun pasto: "Preparo i tuoi pasti…" mentre la lettura è in corso,
// "Serve la connessione" se è fallita.
export type EsitoPastiPredefiniti =
  // Dexie aveva già righe in `pasti` per questo utente: niente da fare.
  | "gia-in-locale"
  // Server vuoto (lettura riuscita): creati i 5 predefiniti.
  | "creati"
  // Il server aveva righe: scaricate, nessuna creata.
  | "scaricati"
  // Lettura dal server non riuscita: nessuna creazione.
  | "lettura-fallita";

// Una sola esecuzione per utente alla volta: chi chiama mentre la prima
// è ancora in corso riceve la stessa promessa, quindi lo stesso esito
// (Oggi e Aggiungi aperti uno dopo l'altro, un doppio montaggio, un
// "Riprova" toccato due volte).
const seedInCorso = new Map<string, Promise<EsitoPastiPredefiniti>>();

// Il set predefinito si crea SOLO se il server è vuoto, e lo si sa solo
// leggendolo (PUNTO_DI_PARTENZA.md, sezione 9.2, "Seed dei pasti
// predefiniti"). In ordine:
//
// 1. Dexie ha già righe in `pasti` per questo utente, vive o cancellate:
//    non si scrive niente. È il caso di ogni apertura dopo la prima, e
//    funziona offline.
// 2. Dexie è vuota: si contano le righe dell'utente sul server, comprese le
//    cancellate (contaRigheSulServer, NON incrementale: la discesa
//    incrementale restituisce 0 righe anche a un server pieno, se il
//    cursore è già avanti).
//    - conteggio fallito → niente, mai: senza sapere cosa c'è sul server,
//      creare vorrebbe dire rischiare di sovrascrivere un pasto rinominato
//      o resuscitarne uno cancellato (sotto, "perché");
//    - zero righe → si creano i 5 predefiniti, con gli id deterministici;
//    - almeno una riga, anche cancellata → niente si crea: si scaricano
//      quelle del server.
//
// Perché non "crea se in Dexie manca": crea() manda al server la riga
// intera con i valori predefiniti e deleted_at null, e l'upsert la
// sovrascrive. Un dispositivo vuoto con la discesa fallita resuscitava un
// pasto predefinito cancellato (difetto del 2026-09-25) e annullava la
// rinomina di uno rinominato ("Pranzo 1" tornava "Pranzo", trovato il
// 2026-10-07). Il prezzo: al primo avvio senza rete i pasti non ci sono,
// e Oggi mostra "Serve la connessione" (ServeConnessione).
//
// L'id resta deterministico (idPastoPredefinito): due dispositivi nuovi che
// trovano il server vuoto nello stesso momento producono le stesse righe.
export function garantisciPastiPredefiniti(
  userId: string
): Promise<EsitoPastiPredefiniti> {
  const inCorso = seedInCorso.get(userId);
  if (inCorso) return inCorso;

  const esecuzione = seminaSeServerVuoto(userId).finally(() => {
    seedInCorso.delete(userId);
  });
  seedInCorso.set(userId, esecuzione);
  return esecuzione;
}

async function seminaSeServerVuoto(userId: string): Promise<EsitoPastiPredefiniti> {
  if (await haPastiInLocale(userId)) return "gia-in-locale";

  let righeSulServer: number;
  try {
    righeSulServer = await contaRigheSulServer(userId, "pasti");
  } catch (errore) {
    console.error(
      "garantisciPastiPredefiniti: lettura dei pasti dal server fallita, non creo niente.",
      errore
    );
    return "lettura-fallita";
  }

  if (righeSulServer === 0) {
    // Nel frattempo una discesa (o un'altra scheda) può averli già scritti.
    if (await haPastiInLocale(userId)) return "gia-in-locale";
    for (const pasto of PASTI_PREDEFINITI) {
      await repositoryPasti.crea(
        { user_id: userId, ...pasto },
        idPastoPredefinito(userId, pasto.nome)
      );
    }
    return "creati";
  }

  // Il server ha dei pasti e Dexie nessuno: un cursore dei pasti rimasto
  // da prima non ha più senso (farebbe scaricare 0 righe e Oggi resterebbe
  // ad aspettare), quindi si toglie e lo scarico riparte da zero. Si tocca
  // solo il cursore: Dexie non ha pasti da sovrascrivere.
  try {
    await db.sync_cursori.delete(`pasti:${userId}`);
    await scaricaTabella(userId, db.pasti, "pasti");
  } catch (errore) {
    console.error("garantisciPastiPredefiniti: scarico dei pasti fallito.", errore);
    return "lettura-fallita";
  }
  return "scaricati";
}

// Tutte le righe di `pasti` dell'utente, comprese le cancellate: le
// schermate le passano a pastiValidiIl / pastiDaMostrare
// (src/lib/pasti/validitaPasti.ts), che scelgono quelle del giorno. Le
// cancellate servono alla rete di sicurezza di Oggi (un pasto cancellato
// con voci in quel giorno si mostra lo stesso) e ai nomi nei messaggi.
export async function tuttiIPasti(userId: string): Promise<Pasto[]> {
  return db.pasti.where("user_id").equals(userId).toArray();
}

// Righe di `pasti` di questo utente in Dexie, vive o cancellate.
async function haPastiInLocale(userId: string): Promise<boolean> {
  return (await db.pasti.where("user_id").equals(userId).count()) > 0;
}

// Il pasto può ricevere voci nel giorno D? Riletto da Dexie adesso, non
// preso dallo stato della pagina: fra la scelta e la conferma una sync, o
// Pasti e orari in un'altra scheda, possono averlo chiuso o cancellato.
// Lo usa Aggiungi prima di scrivere una voce (duplicaNelPasto fa lo stesso
// controllo per conto suo).
export async function pastoValidoAdesso(pastoId: string, giorno: string): Promise<boolean> {
  const pasto = await db.pasti.get(pastoId);
  return !!pasto && pastoValidoIl(pasto, giorno);
}
