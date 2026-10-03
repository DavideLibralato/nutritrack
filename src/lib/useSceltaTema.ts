"use client";

// La scelta del tema salvata sul dispositivo (src/lib/tema.ts), letta da un
// componente e aggiornata da sola quando cambia: dalla pagina Aspetto
// (EVENTO_TEMA) o da un'altra scheda dello stesso browser ("storage").
//
// useSyncExternalStore è il modo di React per leggere un valore che vive
// fuori da React (qui localStorage) e ridisegnare quando cambia: gli si
// danno una funzione che si iscrive ai cambiamenti e una che legge il valore.
// Sul server localStorage non c'è: lì restituisce null, e la pagina non
// mostra nessuna scelta finché il browser non ha letto quella vera.

import { useSyncExternalStore } from "react";
import { EVENTO_TEMA, leggiSceltaTema, type SceltaTema } from "./tema";

function iscriviti(avvisa: () => void) {
  window.addEventListener(EVENTO_TEMA, avvisa);
  window.addEventListener("storage", avvisa);
  return () => {
    window.removeEventListener(EVENTO_TEMA, avvisa);
    window.removeEventListener("storage", avvisa);
  };
}

export function useSceltaTema(): SceltaTema | null {
  return useSyncExternalStore(iscriviti, leggiSceltaTema, () => null);
}
