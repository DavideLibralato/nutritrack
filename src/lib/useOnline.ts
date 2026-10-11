"use client";

// Il browser crede di essere online? Solo per disattivare subito i pulsanti
// che senza rete non possono funzionare (Esci, Elimina il mio account).
// Non basta come verifica: su iOS navigator.onLine non è affidabile, e chi
// lo usa fa comunque una chiamata vera al server prima di agire.
//
// useSyncExternalStore: l'hook di React per leggere un valore che vive fuori
// da React (qui navigator.onLine) e ridisegnare quando cambia. `subscribe`
// si iscrive agli eventi online/offline; il terzo argomento è il valore
// durante il rendering sul server, dove navigator non esiste.

import { useSyncExternalStore } from "react";

function iscriviOnline(avvisa: () => void) {
  window.addEventListener("online", avvisa);
  window.addEventListener("offline", avvisa);
  return () => {
    window.removeEventListener("online", avvisa);
    window.removeEventListener("offline", avvisa);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    iscriviOnline,
    () => navigator.onLine,
    () => true
  );
}
