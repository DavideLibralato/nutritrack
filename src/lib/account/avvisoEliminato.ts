"use client";

// Il riquadro "Account eliminato" su Accedi (PUNTO_DI_PARTENZA.md §9.6).
// Due strade portano qui con un segno nell'indirizzo:
// - ?eliminato=1: Elimina account da QUESTO dispositivo (EliminaAccount.tsx),
//   o la ripresa all'avvio dopo un'eliminazione interrotta;
// - ?eliminato=altrove: l'account è stato eliminato da un ALTRO dispositivo
//   (accountEliminatoAltrove.ts), con &perse=1 se in coda c'erano modifiche
//   di quell'utente, andate perse.
//
// Come passwordAggiornata.ts: si legge una volta dopo l'apertura e si
// toglie SUBITO dall'indirizzo (dal 01/11/2026, per tutti e due i valori),
// così un ricaricamento, o la pagina salvata dal service worker, non lo fa
// ricomparire. Si legge window.location in un useEffect: la pagina è
// prerenderizzata senza indirizzo, e leggerlo al primo disegno darebbe un
// HTML diverso da quello del server.

import { useEffect, useState } from "react";

export type AvvisoEliminato =
  | { tipo: "qui" }
  | { tipo: "altrove"; perse: boolean };

// Funzione pura: che avviso dice l'indirizzo, e l'indirizzo senza i due
// parametri (gli altri, come redirectTo, e il frammento restano). Un valore
// che non si capisce non mostra niente, ma si toglie lo stesso.
export function leggiAvvisoEliminato(href: string): {
  avviso: AvvisoEliminato | null;
  senzaSegno: string | null;
} {
  const url = new URL(href);
  const valore = url.searchParams.get("eliminato");
  const perse = url.searchParams.get("perse") === "1";
  if (valore === null && !url.searchParams.has("perse")) return { avviso: null, senzaSegno: null };

  url.searchParams.delete("eliminato");
  url.searchParams.delete("perse");
  const senzaSegno = url.pathname + url.search + url.hash;

  if (valore === "1") return { avviso: { tipo: "qui" }, senzaSegno };
  if (valore === "altrove") return { avviso: { tipo: "altrove", perse }, senzaSegno };
  return { avviso: null, senzaSegno };
}

export function useAvvisoEliminato(): AvvisoEliminato | null {
  const [avviso, setAvviso] = useState<AvvisoEliminato | null>(null);

  useEffect(() => {
    const letto = leggiAvvisoEliminato(window.location.href);
    if (letto.senzaSegno !== null) window.history.replaceState(null, "", letto.senzaSegno);
    // Solo se c'è: in sviluppo (StrictMode) l'effect gira due volte, e la
    // seconda il segno non c'è già più.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizzazione con una sorgente esterna (l'indirizzo), una volta al montaggio
    if (letto.avviso) setAvviso(letto.avviso);
  }, []);

  return avviso;
}
