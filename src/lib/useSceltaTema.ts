"use client";

// Le scelte di Aspetto salvate sul dispositivo (src/lib/tema.ts): tema e
// colore principale, letti da un componente e aggiornati da soli quando
// cambiano: dalla pagina Aspetto (EVENTO_TEMA) o da un'altra scheda dello
// stesso browser ("storage").
//
// useSyncExternalStore è il modo di React per leggere un valore che vive
// fuori da React (qui localStorage) e ridisegnare quando cambia: gli si
// danno una funzione che si iscrive ai cambiamenti e una che legge il valore.
// Sul server localStorage non c'è: lì restituisce null, e la pagina non
// mostra nessuna scelta finché il browser non ha letto quella vera.

import { useSyncExternalStore } from "react";
import {
  EVENTO_TEMA,
  leggiSceltaAccento,
  leggiSceltaTema,
  type Accento,
  type SceltaTema,
} from "./tema";

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

export function useSceltaAccento(): Accento | null {
  return useSyncExternalStore(iscriviti, leggiSceltaAccento, () => null);
}
