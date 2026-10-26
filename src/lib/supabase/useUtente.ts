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
//
// Unica eccezione: con `user_not_found` (account eliminato) l'hook fa
// partire anche la pulizia e l'uscita (accountEliminatoAltrove.ts).

import { useEffect, useReducer, useState } from "react";
import { createClient } from "./client";
import {
  chiaveSessione,
  classificaErroreVerifica,
  leggiSessioneSalvata,
  prossimoStatoUtente,
  STATO_UTENTE_INIZIALE,
  utenteEliminato,
} from "./utenteOffline";
import { gestisciAccountEliminatoAltrove } from "../account/accountEliminatoAltrove";

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
      .then(({ data, error }) => {
        invia({ tipo: "verifica", idUtente: data.user?.id ?? null, esito: classificaErroreVerifica(error) });
        // L'account non esiste più (eliminato da un altro dispositivo, dal
        // 26/10/2026): si pulisce questo dispositivo, si chiude la sessione
        // e si va su Accedi (accountEliminatoAltrove.ts). Solo con questa
        // risposta: rete, sessione revocata e gli altri rifiuti restano come
        // prima. Ogni componente che usa questo hook arriva qui; il modulo
        // agisce una volta sola.
        if (utenteEliminato(error)) gestisciAccountEliminatoAltrove().catch(() => {});
      })
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
  return useTestoDaiMetadati("nome");
}

// Un testo dai metadati dell'account (useMetadatiUtente, sotto). null
// finché i metadati non sono letti, e se il testo non c'è.
function useTestoDaiMetadati(chiave: string): string | null {
  const valore = useMetadatiUtente()?.[chiave];
  return typeof valore === "string" && valore.trim() !== "" ? valore.trim() : null;
}

// I metadati dell'account, con la stessa strada per tutti: prima la
// sessione salvata sul dispositivo (senza rete), e con il token scaduto
// offline il cookie. Si aggiornano da soli con onAuthStateChange, anche
// dopo un updateUser (evento USER_UPDATED, con la sessione nuova).
// `undefined` finché non sono letti; `null` se non ci sono (nessuna
// sessione, o un'uscita). Il segno dell'onboarding ha bisogno di
// distinguere i due casi: "non ancora letto" non è "utente senza segno".
export function useMetadatiUtente(): Record<string, unknown> | null | undefined {
  const [metadati, setMetadati] = useState<Record<string, unknown> | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setMetadati(data.session?.user.user_metadata ?? sessioneSalvata()?.metadati ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sessione) => {
      if (sessione) setMetadati(sessione.user.user_metadata ?? null);
      else if (evento === "SIGNED_OUT") setMetadati(null);
      else setMetadati(sessioneSalvata()?.metadati ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return metadati;
}

// L'email dell'account, per mostrarla in sola lettura in Impostazioni >
// Profilo. Stessa strada di useNomeUtente: prima la sessione salvata sul
// dispositivo (senza rete), e con il token scaduto offline il cookie.
// null se non c'è.
export function useEmailUtente(): string | null {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? sessioneSalvata()?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sessione) => {
      if (sessione) setEmail(sessione.user.email ?? null);
      else if (evento === "SIGNED_OUT") setEmail(null);
      else setEmail(sessioneSalvata()?.email ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return email;
}
