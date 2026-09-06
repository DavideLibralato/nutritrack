// Svuota la coda outbox verso Supabase.
//
// Chiamata da tre punti (src/lib/repository/repository.ts e
// src/components/SincronizzaOutbox.tsx): subito dopo ogni scrittura locale,
// all'avvio dell'app, e quando il browser torna online. Deve quindi
// funzionare bene anche se chiamata spesso e mentre non c'è rete — non è
// un'operazione rara innescata a mano.
//
// Nota: se un nome di campo su un tipo in src/lib/db/tipi.ts non
// corrisponde esattamente al nome della colonna su Supabase, upsert()
// risponde con un errore leggibile (colonna sconosciuta) — non un
// fallimento silenzioso — quindi il fix è puntuale, campo per campo.

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
    // Senza rete, o con la rete che cade a metà, upsert() può rifiutare la
    // promise invece di restituire un { error } (fetch fallito). Lo
    // trattiamo come un fallimento normale della voce, non come un errore
    // che deve fermare tutte le altre.
    let messaggioErrore: string | null = null;
    try {
      const { error } = await supabase.from(voce.tabella).upsert(voce.dati);
      messaggioErrore = error?.message ?? null;
    } catch (eccezione) {
      messaggioErrore = eccezione instanceof Error ? eccezione.message : "Errore di rete.";
    }

    if (messaggioErrore) {
      fallite += 1;
      await db.outbox.update(voce.id, {
        tentativi: voce.tentativi + 1,
        ultimo_errore: messaggioErrore,
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
