// Helper specifici per i pasti, oltre al CRUD generico di repositoryPasti.
//
// Il set predefinito dei 5 pasti (PUNTO_DI_PARTENZA.md, sezione "I pasti")
// va creato "alla registrazione", ma la registrazione è una Server Action e
// i pasti vivono in Dexie, che esiste solo nel browser (local-first, sezione
// 9.2). Quindi il set si crea lato client alla prima apertura dell'app, se
// manca.

import { v5 as uuidv5 } from "uuid";
import { repositoryPasti } from "./index";
import { scaricaTabella } from "../sync/discesa";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";

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
// "Dinner", l'id resta quello calcolato su "Cena": è quello che
// garantisciPastiPredefiniti userà per ritrovare la riga (e non ricrearla).
// Ricalcolarlo dal nome corrente romperebbe l'aggancio in silenzio — la
// funzione non troverebbe più "Cena" sotto il vecchio id e ne creerebbe una
// seconda con l'id derivato da "Dinner".
export function idPastoPredefinito(userId: string, nomeCanonico: string): string {
  return uuidv5(`${userId}:${nomeCanonico}`, NAMESPACE_PASTI_PREDEFINITI);
}

// Guardia contro la doppia esecuzione concorrente: due chiamate che partono
// mentre la prima sta ancora scrivendo.
const seedInCorso = new Set<string>();

// Bug reale trovato controllando Supabase: 10 pasti invece di 5, causato da
// un controllo aggregato ("l'utente ha già un pasto?") che una race
// condition con lo stato React di useLiveQuery aggirava. Quella race è
// chiusa (la funzione rilegge Dexie direttamente, non riceve più `pasti`
// dal chiamante) — ma il controllo aggregato aveva un secondo limite,
// indipendente dalla race: un pasto perso per strada (una riga sparita per
// un bug altrove, o mai arrivata da un altro dispositivo) non veniva mai
// ricreato, perché gli altri quattro bastavano a far tornare il controllo
// "non serve seminare".
//
// Ora il controllo è per-id, non aggregato: per ciascuno dei 5 nomi
// predefiniti, calcola l'id deterministico (idPastoPredefinito) e verifica
// SOLO quella riga specifica — se esiste già (viva o cancellata) non la
// tocca, se manca la crea. La funzione non "semina una volta": garantisce
// che i 5 esistano, ogni volta che viene chiamata — quello che il nome
// promette. Una riga con deleted_at valorizzato conta come "esiste": non
// ricrea un pasto che l'utente ha cancellato deliberatamente, PURCHÉ questo
// dispositivo sappia già che è stato cancellato — cioè l'abbia già in Dexie,
// da quando l'ha cancellato lui stesso o da una discesa riuscita in
// precedenza. Il residuo: un dispositivo che non ha MAI visto quella riga
// (nuovo, o Dexie svuotata) e la cui discesa di best-effort qui sotto
// fallisce (offline, errore) non ha modo di sapere che era stata cancellata
// altrove, e la ricrea. Rischio ristretto — nuovo dispositivo insieme a
// discesa fallita insieme a un pasto predefinito già cancellato — ma va
// scritto, non dato per eliminato: PUNTO_DI_PARTENZA.md, sezione 9.2.
//
// Prima del controllo, un tentativo di discesa best-effort della sola
// tabella pasti: se il server ha già la riga (creata da un altro
// dispositivo, o da questo stesso account in precedenza), la discesa la
// scrive in Dexie prima che il controllo per-id la trovi — evitando una
// creazione locale che upsert() dovrebbe poi solo confermare. Se la
// discesa fallisce (offline, errore) il controllo prosegue comunque sullo
// stato locale che c'è: con id deterministico non è più una scelta fra
// "semina" e "non seminare in attesa di conferma" (quel dilemma esisteva
// solo perché gli id casuali potevano collidere) — qui seminare è sempre
// sicuro, nel peggiore dei casi upsert() aggiorna una riga che il server
// aveva già, mai un doppione.
export async function garantisciPastiPredefiniti(userId: string): Promise<void> {
  if (seedInCorso.has(userId)) return;

  seedInCorso.add(userId);
  try {
    await scaricaTabella(userId, db.pasti, "pasti").catch((errore) => {
      console.error(
        "garantisciPastiPredefiniti: discesa dei pasti fallita, procedo sullo stato locale.",
        errore
      );
    });

    for (const pasto of PASTI_PREDEFINITI) {
      const id = idPastoPredefinito(userId, pasto.nome);
      const esistente = await repositoryPasti.ottieniPerId(id);
      if (esistente) continue;

      await repositoryPasti.crea({ user_id: userId, ...pasto }, id);
    }
  } finally {
    seedInCorso.delete(userId);
  }
}
