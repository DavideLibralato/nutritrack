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
  sospese: number;
}

// Oltre questo numero di tentativi consecutivi falliti, una voce smette di
// essere ritentata (vedi più sotto perché, e perché non capiva da sola se
// l'errore era transitorio o no). Cinque perché con tre inneschi (avvio,
// evento online, ogni scrittura) è già più di una giornata di uso normale
// prima di arrendersi su una voce — non un numero piccolo scelto a caso, ma
// nemmeno così alto da lasciarla bloccare la coda per settimane come
// successo nel caso reale che ha fatto scoprire il problema.
const SOGLIA_SOSPENSIONE = 5;

export async function sincronizzaOutbox(): Promise<RisultatoSincronizzazione> {
  const supabase = createClient();
  // Le voci già accantonate (vedi sotto) restano in Dexie ma escluse da ogni
  // passata: altrimenti tornerebbero a bloccare l'ordine ogni volta.
  const voci = (await db.outbox.orderBy("creato_il").toArray()).filter(
    (v) => !v.sospesa_il
  );

  let inviate = 0;
  let fallite = 0;
  let sospese = 0;

  // In sequenza, non in parallelo: se due voci toccano righe collegate
  // (es. un obiettivo e il suo target, o un pasto e le sue voci di diario),
  // mandarle nell'ordine in cui sono state create evita di invertire
  // l'ordine delle scritture sul server.
  //
  // Se una voce fallisce e non ha ancora raggiunto la soglia, ci si ferma
  // qui: non si tenta la successiva nella stessa passata. `continue`
  // sembrava innocuo ma tradiva questa garanzia — se la voce genitore
  // fallisce anche solo per un singhiozzo di rete, la voce figlia (creata
  // subito dopo, quindi con un creato_il successivo) verrebbe comunque
  // tentata: fallirebbe per forza (per una FK come
  // obiettivi_target.obiettivo_id, "violazione chiave esterna" perché il
  // genitore non è ancora sul server), e trattandosi di un fallimento di
  // sync non arriva mai a schermo (vedi sezione 11 del documento) —
  // resterebbe un dato mancante scoperto solo controllando Supabase a mano,
  // mesi dopo. Fermarsi al primo fallimento rimanda anche le voci successive
  // non collegate a un prossimo giro (online, riavvio, o la prossima
  // scrittura) — costa un piccolo ritardo, non una riga persa.
  //
  // Ma "fermarsi sempre" ha un altro rischio, visto in pratica: se la voce
  // che fallisce non è un intoppo di rete ma un errore che non si
  // risolverà mai da solo (schema vecchio, vincolo violato, permessi
  // mancanti...), fermarsi blocca tutte le voci dietro di lei per sempre —
  // è esattamente quello che ha bloccato la sync per settimane nel caso che
  // ha fatto scoprire questo file. Non si prova a distinguere "transitorio"
  // da "permanente" leggendo il testo dell'errore (fragile: i messaggi di
  // Postgres/PostgREST possono cambiare) — più robusto contare i tentativi:
  // oltre SOGLIA_SOSPENSIONE la voce si accantona (vedi sotto) e si prosegue
  // con le altre, invece di continuare a bloccare tutto in eterno.
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
      const tentativi = voce.tentativi + 1;

      if (tentativi >= SOGLIA_SOSPENSIONE) {
        // Accantonata, non cancellata: la riga resta in Dexie, ispezionabile
        // (tabella outbox, campo sospesa_il), solo esclusa dal ciclo. Non è
        // un'eliminazione silenziosa — è il contrario: un segnale esplicito
        // che prima si perdeva del tutto.
        sospese += 1;
        await db.outbox.update(voce.id, {
          tentativi,
          ultimo_errore: messaggioErrore,
          sospesa_il: new Date().toISOString(),
        });
        console.error(
          `Sincronizzazione: voce accantonata dopo ${tentativi} tentativi ` +
            `(${voce.tabella}:${voce.record_id}) — ${messaggioErrore}`
        );
        continue;
      }

      await db.outbox.update(voce.id, { tentativi, ultimo_errore: messaggioErrore });
      break;
    }

    inviate += 1;
    await db.outbox.delete(voce.id);
  }

  return { inviate, fallite, sospese };
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
