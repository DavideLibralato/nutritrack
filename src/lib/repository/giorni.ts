// Helper specifici per la classificazione dei giorni (PUNTO_DI_PARTENZA.md,
// sezione 3 "Giorni normali e giorni di allenamento"), oltre al CRUD
// generico di repositoryGiorni.
//
// `giorni` è una tabella SPARSA: una riga esiste solo per le giornate
// effettivamente classificate (sezione 4). Nessuna riga per una data = quel
// giorno è "normale" per convenzione applicativa, non per un default scritto
// nel database.

import { v5 as uuidv5 } from "uuid";
import { repositoryGiorni } from "./index";
import { giornoSettimanaDi } from "../dataGiorno";
import { TIPO_GIORNO_NORMALE, TIPO_GIORNO_ALLENAMENTO } from "../db/tipi";
import type { Giorno, Profilo, TipoGiorno } from "../db/tipi";

// Namespace fisso per calcolare l'id di una riga di `giorni` come UUID v5 da
// utente + data, invece che casuale — stesso schema di idPastoPredefinito in
// pasti.ts, ma con un namespace TUTTO SUO: una costante che si chiama
// "pasti predefiniti" usata per righe di giorni confonderebbe chi la legge
// fra sei mesi, anche se non ci sarebbe un vero rischio di collisione.
//
// Qui l'id deterministico non è solo un'ottimizzazione anti-doppioni come
// per i pasti: su Supabase esiste `giorni_user_data_idx UNIQUE (user_id,
// data) WHERE deleted_at IS NULL` (verificato in produzione) — un vincolo
// voluto, perché due righe per lo stesso giorno sarebbero un errore di
// modello, non un dettaglio estetico come `pasti_user_nome_idx` (quello sì
// rimosso, sezione 4 di CHANGELOG.md del 20/9). QUESTO indice non va MAI
// tolto: è l'id deterministico qui sotto a garantire che due dispositivi
// offline che classificano indipendentemente lo stesso giorno (prima voce
// su uno, pastiglia sull'altro, prima di essersi mai sincronizzati)
// producano la STESSA riga invece di scontrarsi contro il vincolo.
//
// COSTANTE IMMUTABILE. Generata una volta con crypto.randomUUID(), non un
// UUID "storico" di RFC4122 — non serve che lo sia. Se cambia, ogni
// dispositivo esistente calcola id diversi da quelli già sul server per le
// stesse identiche righe: il doppione che questo meccanismo esiste per
// evitare, solo ritardato al giorno in cui qualcuno la tocca credendola
// innocua.
const NAMESPACE_GIORNI = "e417e7f6-16e8-4e13-85e6-cbcf7c20e8e2";

// `data` DEVE essere sempre nella forma canonica "YYYY-MM-DD" prodotta da
// giornoLogico()/oggiLocale() in dataGiorno.ts — mai un oggetto Date, mai una
// stringa con un formato diverso. Due chiamanti che passano forme diverse
// per lo stesso giorno calcolerebbero id diversi per la stessa riga logica,
// e il doppione che il vincolo unico dovrebbe impedire tornerebbe in
// silenzio (l'upsert lato sync scriverebbe due id diversi che il vincolo su
// Supabase respingerebbe uno dei due, non li fonderebbe).
export function idGiorno(userId: string, data: string): string {
  return uuidv5(`${userId}:${data}`, NAMESPACE_GIORNI);
}

// La riga scritta per una data, se esiste. `deleted_at` ricontrollato qui
// anche se repositoryGiorni.ottieniTutti lo filtra già: funzione pura,
// stesso principio di vociDelGiorno in totaliDiario.ts.
export function giornoScritto(righe: Giorno[], data: string): Giorno | null {
  return righe.find((g) => g.data === data && g.deleted_at === null) ?? null;
}

// Cosa propone il pattern settimanale del profilo per una data (sezione 3):
// solo un suggerimento, mai la fonte della verità. Se la differenziazione
// non è attiva la proposta è sempre "normale" — coerente con "da spenta
// l'app è identica a com'è adesso".
export function tipoGiornoProposto(profilo: Profilo | null, data: string): TipoGiorno {
  if (!profilo?.differenzia_giorni) return TIPO_GIORNO_NORMALE;
  const giornoSettimana = giornoSettimanaDi(data);
  const inPattern = profilo.giorni_allenamento_default?.includes(giornoSettimana) ?? false;
  return inPattern ? TIPO_GIORNO_ALLENAMENTO : TIPO_GIORNO_NORMALE;
}

// Il tipo da usare in lettura per qualunque giorno, scritto o no (sezione 3,
// "La trappola"): la riga scritta vince SEMPRE; solo per un giorno mai
// scritto si propone dal pattern attuale — anche se quel giorno è nel
// passato ("caso ambiguo accettato": la proposta arriva dal pattern di
// adesso, che allora poteva essere diverso).
export function tipoGiornoEffettivo(
  righe: Giorno[],
  profilo: Profilo | null,
  data: string
): TipoGiorno {
  return giornoScritto(righe, data)?.tipo_giorno ?? tipoGiornoProposto(profilo, data);
}

// Scrive la riga di un giorno mai classificato, quando riceve la sua prima
// voce di diario (regola 1 della sezione 3). Va chiamata da ogni percorso di
// inserimento che crea una voce (oggi: creaVoce in src/app/aggiungi/page.tsx).
//
// Non fa nulla se il giorno è già scritto (vince sempre la riga esistente,
// non si tocca) o se la differenziazione non è attiva: senza differenzia_
// giorni, scrivere righe qui sarebbe un effetto collaterale invisibile ma
// reale (spazio, sync) per la maggioranza degli utenti che non useranno mai
// questa funzione — "da spenta l'app è identica a com'è adesso" vale anche
// per quello che finisce silenziosamente su Supabase, non solo per lo
// schermo.
//
// Importante: anche quando il pattern propone "normale", la riga va scritta
// lo stesso. È esattamente la trappola descritta in sezione 3: se si
// scrivesse solo per "allenamento" lasciando "normale" implicito, spostare
// l'allenamento dal mercoledì al giovedì nel pattern farebbe diventare
// "allenamento" anche i mercoledì passati mai scritti (la lettura li
// ricalcolerebbe dal pattern nuovo), riscrivendo silenziosamente la storia.
//
// Il controllo "è già scritto?" rilegge Dexie DIRETTAMENTE per id
// (repositoryGiorni.ottieniPerId), non riceve una lista di righe dal
// chiamante — stesso motivo per cui garantisciPastiPredefiniti in pasti.ts
// non prende più `pasti` da chi lo chiama. Il chiamante reale
// (creaVoce in /aggiungi) ha quella lista solo come stato React di
// useLiveQuery: se fosse passata qui e capitasse vecchia (un giro di
// ridisegno indietro rispetto a Dexie — es. l'utente ha appena corretto la
// pastiglia su un altro giorno, o su questo stesso giorno un attimo prima),
// questa funzione non vedrebbe la classificazione già scritta e la
// sovrascriverebbe con la proposta del pattern: esattamente la regola 3
// ("la pastiglia vince sempre") che cade in silenzio. L'id è deterministico
// apposta anche per questo: una lettura per id è O(1) e sempre lo stato vero
// del dispositivo, mai quello di un render passato.
export async function garantisciGiornoPerPrimaVoce(
  userId: string,
  data: string,
  profilo: Profilo | null
): Promise<void> {
  if (!profilo?.differenzia_giorni) return;

  const esistente = await repositoryGiorni.ottieniPerId(idGiorno(userId, data));
  if (esistente && esistente.deleted_at === null) return;

  await repositoryGiorni.crea(
    {
      user_id: userId,
      data,
      tipo_giorno: tipoGiornoProposto(profilo, data),
    },
    idGiorno(userId, data)
  );
}

// Tocco della pastiglia in Oggi: scelta esplicita dell'utente, vince sempre
// su qualunque proposta (sezione 3). A differenza di garantisciGiornoPer
// PrimaVoce qui non serve sapere se il giorno era già scritto: l'id è
// sempre lo stesso (idGiorno(userId, data)), quindi una crea() incondizionata
// SOVRASCRIVE la riga esistente con la scelta dell'utente invece di crearne
// una seconda — non un'ottimizzazione, la stessa identica riga che una
// aggiorna() avrebbe prodotto, senza bisogno di leggerla prima per deciderlo
// (e quindi senza nessuno stato, fresco o vecchio che sia, da cui dipendere).
export async function scriviTipoGiornoScelto(
  userId: string,
  data: string,
  tipoGiorno: TipoGiorno
): Promise<Giorno> {
  return repositoryGiorni.crea(
    { user_id: userId, data, tipo_giorno: tipoGiorno },
    idGiorno(userId, data)
  );
}
