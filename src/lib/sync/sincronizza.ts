// Svuota la coda outbox verso Supabase.
//
// Non è ancora collegata a nulla nell'app: serve un utente autenticato
// perché le policy RLS accettino le scritture, e l'auth è il prossimo passo
// (punto 1). Per ora questo modulo è pronto e testabile da solo; lo si
// aggancia (es. all'avvio dell'app e a `window.addEventListener("online")`)
// quando il login esiste davvero.
//
// Nota per quando la si collega: se un nome di campo su un tipo in
// src/lib/db/tipi.ts non corrisponde esattamente al nome della colonna su
// Supabase, upsert() risponde con un errore leggibile (colonna sconosciuta) —
// non un fallimento silenzioso — quindi il fix è puntuale, campo per campo.

import { createClient } from "../supabase/client";
import { db } from "../db/database";

export interface RisultatoSincronizzazione {
  inviate: number;
  fallite: number;
}

export async function sincronizzaOutbox(): Promise<RisultatoSincronizzazione> {
  const supabase = createClient();
  const voci = await db.outbox.orderBy("creato_il").toArray();

  let inviate = 0;
  let fallite = 0;

  // In sequenza, non in parallelo: se due voci toccano righe collegate
  // (es. un pasto e le sue voci di diario), mandarle nell'ordine in cui sono
  // state create evita di invertire l'ordine delle scritture sul server.
  for (const voce of voci) {
    const { error } = await supabase.from(voce.tabella).upsert(voce.dati);

    if (error) {
      fallite += 1;
      await db.outbox.update(voce.id, {
        tentativi: voce.tentativi + 1,
        ultimo_errore: error.message,
      });
      continue;
    }

    inviate += 1;
    await db.outbox.delete(voce.id);
  }

  return { inviate, fallite };
}

// Da chiamare una volta all'avvio dell'app quando l'auth ci sarà.
// Ritorna una funzione di cleanup (da usare in un useEffect) che rimuove il
// listener.
export function avviaSincronizzazioneAutomatica(): () => void {
  const provaSincronizzazione = () => {
    sincronizzaOutbox();
  };

  window.addEventListener("online", provaSincronizzazione);
  return () => window.removeEventListener("online", provaSincronizzazione);
}
