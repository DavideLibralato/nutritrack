// La coda outbox (PUNTO_DI_PARTENZA.md, sezione 9.2): ogni scrittura fatta
// dal repository finisce qui, oltre che nella tabella locale. Quando la rete
// c'è, sincronizza.ts svuota questa coda verso Supabase.
//
// Un solo tipo di mutazione: "manda lo stato attuale di questa riga".
// Non esistono insert/update/delete separati perché in questo schema il
// delete fisico non esiste mai (sezione 4): cancellare una riga vuol dire
// scriverci sopra un deleted_at, che dal punto di vista della coda è una
// mutazione uguale a tutte le altre.
//
// L'id della voce in coda è "<tabella>:<id della riga>", non un uuid
// casuale: così, se la stessa riga viene modificata due volte prima che la
// sincronizzazione parta (es. due tap veloci offline), la seconda mutazione
// sovrascrive la prima invece di accodarsi — in coda resta solo lo stato più
// recente, che è tutto ciò che serve mandare.
//
// Per lo stesso motivo (dal 01/11/2026, audit #1): chi cancella o aggiorna
// una voce DOPO UN'ATTESA (una chiamata di rete, per esempio) deve prima
// controllare che il suo creato_il sia ancora quello letto. Altrimenti
// scrive sulla versione nuova, arrivata nel frattempo, e una delete la
// perde per sempre. Vedi seAncoraQuella in sincronizza.ts.

import { db } from "../db/database";
import type { NomeTabella, RigaBase } from "../db/tipi";
import { millisecondiDi } from "../istanti";

export interface VoceOutbox {
  id: string;
  tabella: NomeTabella;
  record_id: string;
  dati: RigaBase;
  creato_il: string;
  tentativi: number;
  ultimo_errore: string | null;
  // Valorizzato quando sincronizzaOutbox smette di ritentare questa voce
  // dopo troppi fallimenti consecutivi (vedi sincronizza.ts). La riga non
  // sparisce — resta qui, visibile e ispezionabile — solo esclusa dal ciclo
  // normale, così una voce irrecuperabile non blocca tutte le altre dietro
  // di lei per sempre.
  sospesa_il: string | null;
  // Lo status HTTP dell'ultimo invio fallito (0 = non arrivato, 401 =
  // sessione, 4xx/5xx = rifiuto del server), null se l'ultimo fallimento è
  // stata un'eccezione o se non ha mai fallito. Dal 10/10/2026, per i
  // "Dettagli tecnici" delle voci accantonate in Impostazioni >
  // Sincronizzazione. Facoltativo (`?`): le voci salvate prima della
  // version(8) di Dexie non ce l'hanno, e chi lo legge ha il suo ripiego.
  ultimo_status?: number | null;
  // Le cancellazioni che questa voce annulla (dal 14/11/2026, audit del
  // 14/11, A2): i valori di deleted_at che la riga aveva quando è stata
  // rimessa in vita (deleted_at → null) da repository.aggiorna. La discesa
  // non fa vincere una di queste cancellazioni sulla voce: è proprio
  // quella che l'utente ha annullato (discesa.ts, cancellazioneAnnullata
  // qui sotto). Una cancellazione diversa, fatta altrove, vince come
  // sempre. Facoltativo (`?`): manca nelle voci senza nessuna rimessa in
  // vita e in quelle salvate prima della version(11) di Dexie, e vale [].
  cancellazioni_annullate?: string[];
}

// Il livello di ogni tabella nelle foreign key del server (lette da
// pg_constraint il 9/10/2026): 0 = nessun genitore fra le tabelle
// dell'app, 1 = figlia di una tabella di livello 0, 2 = figlia di una di
// livello 1. Un `Record` su NomeTabella: una tabella nuova senza livello
// è un errore di compilazione, non una voce che parte nel posto sbagliato.
//   voci_diario       → pasti, alimenti
//   composizioni      → alimenti
//   preferiti         → alimenti
//   obiettivi_target  → obiettivi
//   composizioni_voci → composizioni, alimenti
const LIVELLO_TABELLA: Record<NomeTabella, number> = {
  profili: 0,
  obiettivi: 0,
  pasti: 0,
  alimenti: 0,
  giorni: 0,
  misurazioni: 0,
  obiettivi_target: 1,
  voci_diario: 1,
  composizioni: 1,
  preferiti: 1,
  composizioni_voci: 2,
};

// L'ordine in cui la coda si manda al server: prima per livello (i
// genitori prima dei figli), poi per creato_il, poi per id (a parità di
// millisecondo, un ordine sempre uguale).
//
// Perché non basta creato_il (difetto trovato il 9/10/2026): riscrivere
// una riga già in coda sostituisce la sua voce, con un creato_il NUOVO
// (accodaMutazione, sotto). Un genitore modificato dopo i suoi figli
// finisce quindi dietro di loro. Esempio, offline: crei un alimento, lo
// registri in una voce, poi correggi l'alimento; alla rete la voce parte
// per prima, il server la rifiuta (foreign key: l'alimento non c'è
// ancora), la coda si ferma e dopo 5 giri la voce viene accantonata — non
// arriva più. Tenere il creato_il della prima volta non risolve: rompe il
// caso opposto (una voce già in coda spostata dopo su un pasto nuovo).
//
// Mandare un genitore "troppo presto" invece non rompe niente: ogni riga
// vince da sola (l'upsert scrive solo quella riga) e le cancellazioni sono
// logiche, quindi nessuna foreign key si viola nell'altro verso.
export function ordinaOutbox(voci: VoceOutbox[]): VoceOutbox[] {
  return [...voci].sort(
    (a, b) =>
      LIVELLO_TABELLA[a.tabella] - LIVELLO_TABELLA[b.tabella] ||
      a.creato_il.localeCompare(b.creato_il) ||
      a.id.localeCompare(b.id)
  );
}

// Ogni voce deve avere dati.user_id (dall'11/10/2026): la salita manda
// solo le voci dell'utente della sessione (sincronizza.ts), quindi una
// voce senza user_id non partirebbe mai, in silenzio. Oggi ogni scrittura
// lo porta (verificato l'11/10 su tutti i punti che arrivano qui); questo
// controllo fa sì che un errore futuro sia un'eccezione subito, non una
// modifica che non arriva mai al server. Il catalogo condiviso (user_id
// null) non si scrive mai dal client: RLS lo rifiuterebbe comunque.
// La chiama anche il repository PRIMA di scrivere la riga in locale, così
// una riga senza utente non resta in Dexie senza la sua voce.
export function controllaUtenteDellaRiga(tabella: NomeTabella, riga: RigaBase): void {
  if (typeof riga.user_id !== "string" || riga.user_id === "") {
    throw new Error(`Riga senza user_id, non si accoda: ${tabella}:${riga.id}`);
  }
}

// `cancellazioneAnnullata`: il deleted_at che la riga aveva, quando questa
// scrittura la rimette in vita (lo passa repository.aggiorna); null
// altrimenti.
//
// La voce nuova EREDITA le cancellazioni annullate della voce che
// sostituisce, sia che la scrittura nuova lasci la riga viva sia che la
// cancelli di nuovo. Il motivo: finché una voce è in coda, il server non ha
// visto niente di ciò che contiene, quindi ha ancora la cancellazione
// annullata la prima volta (o una arrivata nel frattempo durante un invio,
// vedi seAncoraQuella in sincronizza.ts). Senza l'eredità, "rimetti, togli,
// rimetti" offline ricorderebbe solo la cancellazione fatta sul telefono,
// che il server non ha mai visto, e la discesa farebbe vincere la sua. Una
// voce già salita non c'è più, e con lei l'elenco: si riparte da zero.
export async function accodaMutazione(
  tabella: NomeTabella,
  riga: RigaBase,
  cancellazioneAnnullata: string | null = null
): Promise<void> {
  controllaUtenteDellaRiga(tabella, riga);
  const id = `${tabella}:${riga.id}`;
  const ereditate = (await db.outbox.get(id))?.cancellazioni_annullate ?? [];
  const annullate =
    cancellazioneAnnullata !== null && !ereditate.includes(cancellazioneAnnullata)
      ? [...ereditate, cancellazioneAnnullata]
      : ereditate;
  const voce: VoceOutbox = {
    id,
    tabella,
    record_id: riga.id,
    dati: riga,
    creato_il: new Date().toISOString(),
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
    ultimo_status: null,
    // Solo se c'è: le voci senza rimesse in vita restano identiche a prima.
    ...(annullate.length > 0 ? { cancellazioni_annullate: annullate } : {}),
  };

  await db.outbox.put(voce);
}

// Se la cancellazione arrivata dal server (`deletedAt`) è una di quelle che
// la voce annulla. Uguaglianza dell'ISTANTE (millisecondiDi), perché il
// server rimanda lo stesso valore in un altro formato ("…000000+00:00"
// invece di "…000Z"). Mai un confronto più recente/più vecchio: l'orologio
// del telefono non è affidabile (discesa.ts). Il deleted_at non lo tocca
// nessun trigger (set_updated_at scrive solo updated_at, verificato il
// 14/11), quindi sul server resta esattamente il valore scritto.
export function cancellazioneAnnullata(voce: VoceOutbox, deletedAt: string): boolean {
  const istante = millisecondiDi(deletedAt);
  return (voce.cancellazioni_annullate ?? []).some((d) => millisecondiDi(d) === istante);
}
