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

// Il nome scritto alla registrazione. Non sta in `profili.nome` (colonna che
// nessuna schermata scrive ancora) ma nei metadati dell'utente Supabase
// (`options.data.nome` in src/lib/actions/auth.ts). getSession() legge la
// sessione già salvata sul dispositivo, senza rete: l'intestazione del
// Profilo si vede anche offline. null se il nome non c'è.
export function useNomeUtente(): string | null {
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    function daMetadati(metadati: Record<string, unknown> | undefined): string | null {
      const valore = metadati?.nome;
      return typeof valore === "string" && valore.trim() !== "" ? valore.trim() : null;
    }

    supabase.auth.getSession().then(({ data }) => {
      setNome(daMetadati(data.session?.user.user_metadata));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, sessione) => {
      setNome(daMetadati(sessione?.user.user_metadata));
    });

    return () => subscription.unsubscribe();
  }, []);

  return nome;
}
