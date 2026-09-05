"use client";

// Hook per sapere, in un componente client, chi è l'utente loggato.
// Serve perché i dati locali (Dexie) sono divisi per user_id: prima di
// leggere/scrivere il profilo di qualcuno dobbiamo sapere di chi si tratta.
//
// Il valore torna `undefined` finché non abbiamo ancora controllato (primo
// istante dopo il montaggio), `null` se non c'è nessuna sessione, altrimenti
// l'id dell'utente.

import { useEffect, useState } from "react";
import { createClient } from "./client";

export function useUtenteId(): string | null | undefined {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    // Se la sessione cambia (login/logout in un'altra scheda, token
    // rinnovato...) aggiorniamo senza bisogno di un refresh manuale.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, sessione) => {
      setUserId(sessione?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return userId;
}
