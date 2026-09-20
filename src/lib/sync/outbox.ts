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
