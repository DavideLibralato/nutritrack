"use client";

// Lo username di chi è entrato, per la riga "Username" in Profilo (e poi per
// Amici). Solo online: `nomi_utente` non sta in Dexie (PUNTO_DI_PARTENZA.md
// §4). Si legge all'apertura della pagina; dopo un salvataggio riuscito la
// pagina lo aggiorna con `impostato`, senza rileggere.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { leggiMioUsername, type LetturaUsername } from "./nomiUtente";

// "caricamento": la risposta non è ancora arrivata (o l'utente non è ancora
// noto). "errore": non è arrivata e non arriverà da sola (offline): si
// riprova con `ricarica`.
export type StatoMioUsername = { esito: "caricamento" } | LetturaUsername;

export function useMioUsername() {
  const userId = useUtenteId();
  const [stato, setStato] = useState<StatoMioUsername>({ esito: "caricamento" });
  // Cambia a ogni "ricarica": fa ripartire la lettura.
  const [giro, setGiro] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let annullato = false;
    void leggiMioUsername(createClient(), userId).then((lettura) => {
      if (!annullato) setStato(lettura);
    });
    return () => {
      annullato = true;
    };
  }, [userId, giro]);

  const ricarica = useCallback(() => {
    setStato({ esito: "caricamento" });
    setGiro((g) => g + 1);
  }, []);

  const impostato = useCallback((username: string) => {
    setStato({ esito: "ok", username });
  }, []);

  return { stato, ricarica, impostato };
}
