"use client";

// All'apertura dell'app, una volta: se c'è il segno "uscita in corso"
// (src/lib/account/uscitaInCorso.ts), finisce la pulizia di questo
// dispositivo dopo Esci (PUNTO_DI_PARTENZA.md §9.6, "Esci svuota i dati
// locali"). Sta nel layout principale, quindi gira anche sulla pagina di
// login, dove si atterra dopo l'uscita. Nessuna interfaccia, come
// RipresaEliminazioneAccount.

import { useEffect } from "react";
import { riprendiUscitaInSospeso } from "@/lib/account/uscitaInCorso";
import { idUtenteDellaSessione } from "@/lib/supabase/utenteDellaSessione";

export default function RipresaUscita() {
  useEffect(() => {
    riprendiUscitaInSospeso(() => idUtenteDellaSessione()).catch(() => {});
  }, []);

  return null;
}
