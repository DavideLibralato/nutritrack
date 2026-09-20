"use client";

// Fa partire la sincronizzazione bidirezionale (src/lib/sync/orchestratore.ts):
// appena c'è un utente loggato, e di nuovo quando il browser torna online o
// la PWA torna in primo piano dopo essere stata in background. Componente a
// parte da RegistraServiceWorker apposta: quello gestisce l'app shell
// offline (service worker), questo i dati — due responsabilità diverse
// anche se entrambi non hanno un'interfaccia visibile.
//
// Rinominato da SincronizzaOutbox: prima faceva solo salita (outbox ->
// Supabase), ora orchestra anche la discesa (Supabase -> Dexie).

import { useEffect } from "react";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  sincronizzaBidirezionale,
  avviaSincronizzazioneAutomatica,
} from "@/lib/sync/orchestratore";

export default function Sincronizzazione() {
  const userId = useUtenteId();

  useEffect(() => {
    if (!userId) return;

    sincronizzaBidirezionale(userId).catch(() => {});

    // Ritorna la funzione di cleanup che toglie i listener: se l'utente fa
    // logout (userId torna null) o il componente si smonta, non deve
    // restare a sincronizzare per un utente che non c'è più.
    return avviaSincronizzazioneAutomatica(userId);
  }, [userId]);

  return null;
}
