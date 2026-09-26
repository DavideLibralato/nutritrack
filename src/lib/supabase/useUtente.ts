"use client";

// Hook per sapere, in un componente client, chi è l'utente loggato.
// Serve perché i dati locali (Dexie) sono divisi per user_id: prima di
// leggere/scrivere il profilo di qualcuno dobbiamo sapere di chi si tratta.
//
// Il valore torna `undefined` finché non abbiamo ancora controllato (primo
// istante dopo il montaggio), `null` se non c'è nessuna sessione, altrimenti
// l'id dell'utente.
//
// Offline con il token scaduto supabase-js risponde "nessuna sessione" anche
// se la sessione è ancora salvata: la regola per decidere (e perché) sta in
// utenteOffline.ts. Qui si raccolgono solo i segnali.

import { useEffect, useReducer, useState } from "react";
import { createClient } from "./client";
import {
  chiaveSessione,
  classificaErroreVerifica,
  leggiSessioneSalvata,
  prossimoStatoUtente,
  STATO_UTENTE_INIZIALE,
} from "./utenteOffline";

function sessioneSalvata() {
  return leggiSessioneSalvata(
    document.cookie,
    chiaveSessione(process.env.NEXT_PUBLIC_SUPABASE_URL!)
  );
}

export function useUtenteId(): string | null | undefined {
  // useReducer: come useState, ma il nuovo valore lo calcola una funzione
  // (prossimoStatoUtente) a partire dal valore attuale e da un "segnale".
  // Comodo quando i segnali arrivano da più parti in ordine qualunque.
  const [stato, invia] = useReducer(prossimoStatoUtente, STATO_UTENTE_INIZIALE);

  useEffect(() => {
    const supabase = createClient();

    // Verifica col server (va in rete): conferma l'utente, oppure lo
    // rifiuta davvero. Un errore di rete non cambia niente.
    supabase.auth
      .getUser()
      .then(({ data, error }) =>
        invia({ tipo: "verifica", idUtente: data.user?.id ?? null, esito: classificaErroreVerifica(error) })
      )
      .catch(() => invia({ tipo: "verifica", idUtente: null, esito: "rete" }));

    // Sessione iniziale e cambi successivi (login/logout, token
    // rinnovato...), senza bisogno di un refresh manuale.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sessione) => {
      invia({
        tipo: "evento",
        evento,
        idSessione: sessione?.user?.id ?? null,
        idSalvato: sessione ? null : (sessioneSalvata()?.id ?? null),
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  return stato.userId;
}

// Il nome scritto alla registrazione. Non sta in `profili.nome` (colonna che
// nessuna schermata scrive ancora) ma nei metadati dell'utente Supabase
// (`options.data.nome` in src/lib/actions/auth.ts). getSession() legge la
// sessione già salvata sul dispositivo, senza rete: l'intestazione del
// Profilo si vede anche offline. Con il token scaduto offline getSession()
// risponde null (vedi utenteOffline.ts): allora il nome si prende dal
// cookie. null se il nome non c'è.
export function useNomeUtente(): string | null {
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function daMetadati(metadati: Record<string, unknown> | undefined): string | null {
      const valore = metadati?.nome;
      return typeof valore === "string" && valore.trim() !== "" ? valore.trim() : null;
    }

    supabase.auth.getSession().then(({ data }) => {
      setNome(daMetadati(data.session?.user.user_metadata ?? sessioneSalvata()?.metadati));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sessione) => {
      if (sessione) setNome(daMetadati(sessione.user.user_metadata));
      else if (evento === "SIGNED_OUT") setNome(null);
      else setNome(daMetadati(sessioneSalvata()?.metadati));
    });

    return () => subscription.unsubscribe();
  }, []);

  return nome;
}
