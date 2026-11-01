"use client";

// All'apertura dell'app, una volta: se c'è il segno "eliminazione in corso"
// (src/lib/account/eliminazioneInCorso.ts), finisce la pulizia di questo
// dispositivo dopo "Elimina il mio account" (PUNTO_DI_PARTENZA.md §9.6).
// Sta nel layout principale, quindi gira anche sulla pagina di login, dove
// si atterra dopo l'eliminazione. Nessuna interfaccia, come
// Sincronizzazione e RegistraServiceWorker.
//
// Dal 26/10/2026: se il flusso si era interrotto prima di chiudere la
// sessione, la ripresa la chiude e ricarica su /login?eliminato=1. Le
// servono chi c'è sulla sessione, come chiuderla e come navigare: glieli
// passa questo componente.

import { useEffect } from "react";
import { riprendiEliminazioneInSospeso } from "@/lib/account/eliminazioneInCorso";
import { chiudiSessioneQui, verificaUtenteSulServer } from "@/lib/account/eliminaAccount";
import { idUtenteDellaSessione } from "@/lib/supabase/utenteDellaSessione";

export default function RipresaEliminazioneAccount() {
  useEffect(() => {
    riprendiEliminazioneInSospeso(verificaUtenteSulServer, {
      utenteAttuale: () => idUtenteDellaSessione(),
      chiudiSessione: chiudiSessioneQui,
      naviga: (indirizzo) => window.location.replace(indirizzo),
    }).catch(() => {});
  }, []);

  return null;
}
