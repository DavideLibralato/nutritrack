"use client";

import { useEffect } from "react";

// Registra il service worker solo in produzione: in sviluppo (npm run dev)
// la cache del service worker rischierebbe di mostrarti versioni vecchie
// dei file mentre stai ancora modificando il codice.
export default function RegistraServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch((errore) => {
        console.error("Registrazione service worker fallita:", errore);
      });
    }
  }, []);

  return null;
}
