"use client";

// Tiene aggiornata la copia della propria foto profilo sul telefono
// (PUNTO_DI_PARTENZA.md §3, "La foto profilo"): all'apertura con la rete,
// al ritorno in primo piano e al ritorno della rete. Non disegna niente,
// come Sincronizzazione, accanto alla quale sta nel layout principale.
//
// All'apertura parte dopo RITARDO_APERTURA_MS, non subito: Oggi si apre
// dalla copia in Dexie e la prima discesa ha la precedenza sulla rete. La
// foto non serve a Oggi, e una lettura con forse un download da 50 KB può
// aspettare due secondi. I giri doppi li evita avviaAggiornamentoFoto.

import { useEffect } from "react";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { avviaAggiornamentoFoto } from "@/lib/foto/aggiornamentoFoto";

const RITARDO_APERTURA_MS = 2000;

export default function AggiornamentoFotoProfilo() {
  const userId = useUtenteId();

  useEffect(() => {
    if (!userId) return;

    function avvia() {
      if (navigator.onLine) void avviaAggiornamentoFoto(userId!);
    }
    function alRitorno() {
      if (document.visibilityState === "visible") avvia();
    }

    const timer = setTimeout(avvia, RITARDO_APERTURA_MS);
    document.addEventListener("visibilitychange", alRitorno);
    window.addEventListener("online", avvia);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", alRitorno);
      window.removeEventListener("online", avvia);
    };
  }, [userId]);

  return null;
}
