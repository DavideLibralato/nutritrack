"use client";

import { useEffect } from "react";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { chiediRiscaldamento } from "@/lib/serviceWorker";

// Solo in produzione: in sviluppo (npm run dev) la cache del service worker
// rischierebbe di mostrarti versioni vecchie dei file mentre stai ancora
// modificando il codice.
const ATTIVO = process.env.NODE_ENV === "production";

// Registra il service worker e, con un utente entrato e la rete, gli chiede
// di salvare le pagine principali per l'uso offline (il "riscaldamento",
// vedi public/sw.js). Sta nel layout radice, quindi gira a ogni apertura
// dell'app; il riscaldamento riparte anche quando torna la rete.
export default function RegistraServiceWorker() {
  const userId = useUtenteId();

  useEffect(() => {
    if (ATTIVO && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((errore) => {
        console.error("Registrazione service worker fallita:", errore);
      });
    }
  }, []);

  useEffect(() => {
    if (!ATTIVO || !userId) return;

    function riscalda() {
      // navigator.onLine su iOS non è affidabile: se dice "online" ma la
      // rete non c'è, il riscaldamento fallisce senza danni.
      if (navigator.onLine) chiediRiscaldamento().catch(() => {});
    }

    riscalda();
    window.addEventListener("online", riscalda);
    return () => window.removeEventListener("online", riscalda);
  }, [userId]);

  return null;
}
