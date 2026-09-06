"use client";

// Fa partire la sincronizzazione outbox -> Supabase (src/lib/sync): appena
// c'è un utente loggato, e di nuovo ogni volta che il browser torna online.
// Componente a parte da RegistraServiceWorker apposta: quello gestisce
// l'app shell offline (service worker), questo i dati — due responsabilità
// diverse anche se entrambi non hanno un'interfaccia visibile.

import { useEffect } from "react";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { sincronizzaOutbox, avviaSincronizzazioneAutomatica } from "@/lib/sync/sincronizza";

export default function SincronizzaOutbox() {
  const userId = useUtenteId();

  useEffect(() => {
    if (!userId) return;

    sincronizzaOutbox();

    // Ritorna la funzione di cleanup che toglie il listener "online":
    // se l'utente fa logout (userId torna null) o il componente si
    // smonta, non deve restare a sincronizzare per un utente che non c'è
    // più.
    return avviaSincronizzazioneAutomatica();
  }, [userId]);

  return null;
}
