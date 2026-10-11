"use client";

// All'apertura dell'app, una volta: se c'è il segno "eliminazione in corso"
// (src/lib/account/eliminazioneInCorso.ts), finisce la pulizia di questo
// dispositivo dopo "Elimina il mio account" (PUNTO_DI_PARTENZA.md §9.6).
// Sta nel layout principale, quindi gira anche sulla pagina di login, dove
// si atterra dopo l'eliminazione. Nessuna interfaccia, come
// Sincronizzazione e RegistraServiceWorker.

import { useEffect } from "react";
import { riprendiEliminazioneInSospeso } from "@/lib/account/eliminazioneInCorso";
import { verificaUtenteSulServer } from "@/lib/account/eliminaAccount";

export default function RipresaEliminazioneAccount() {
  useEffect(() => {
    riprendiEliminazioneInSospeso(verificaUtenteSulServer).catch(() => {});
  }, []);

  return null;
}
