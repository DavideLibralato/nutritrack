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

import { db } from "../db/database";
import type { NomeTabella, RigaBase } from "../db/tipi";

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

export async function accodaMutazione(
  tabella: NomeTabella,
  riga: RigaBase
): Promise<void> {
  const voce: VoceOutbox = {
    id: `${tabella}:${riga.id}`,
    tabella,
    record_id: riga.id,
    dati: riga,
    creato_il: new Date().toISOString(),
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
  };

  await db.outbox.put(voce);
}
