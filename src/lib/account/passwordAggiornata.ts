"use client";

// "Password aggiornata" in Profilo dopo Cambia password (mockup
// docs/mockups/cambia-password.html, schermata 5). CambiaPassword.tsx torna
// a Profilo con ?password=aggiornata; Profilo lo legge una volta, mostra la
// barra e lo toglie SUBITO dall'indirizzo: un ricaricamento, o la pagina
// salvata dal service worker, non la fa ricomparire.
//
// Perché un parametro e non uno stato: le due pagine non si passano niente
// in memoria, ed è lo stesso schema di /login?eliminato=1.
//
// Si legge window.location in un useEffect, non con useSearchParams di
// Next: quello obbliga a mettere una <Suspense> attorno alla pagina (perché
// durante la build l'indirizzo non c'è), e qui basta guardarlo una volta
// dopo l'apertura. Per toglierlo, history.replaceState: cambia l'indirizzo
// senza ricaricare né navigare, e Next lo accetta (lo tiene allineato al
// suo router).

import { useCallback, useEffect, useState } from "react";

const PARAMETRO = "password";
const VALORE = "aggiornata";

export const PROFILO_CON_PASSWORD_AGGIORNATA = `/impostazioni/profilo?${PARAMETRO}=${VALORE}`;

// Funzione pura: l'indirizzo c'era il segno? E l'indirizzo senza (gli
// altri parametri e il frammento restano).
export function leggiSegnoPasswordAggiornata(href: string): { aggiornata: boolean; senzaSegno: string } {
  const url = new URL(href);
  const aggiornata = url.searchParams.get(PARAMETRO) === VALORE;
  url.searchParams.delete(PARAMETRO);
  return { aggiornata, senzaSegno: url.pathname + url.search + url.hash };
}

export function usePasswordAggiornata(): { visibile: boolean; chiudi: () => void } {
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    const { aggiornata, senzaSegno } = leggiSegnoPasswordAggiornata(window.location.href);
    if (!aggiornata) return;
    window.history.replaceState(null, "", senzaSegno);
    // Solo a true: in sviluppo (StrictMode) l'effect gira due volte, e la
    // seconda il segno non c'è già più. Nell'effect e non nel valore
    // iniziale di useState: la pagina è prerenderizzata senza indirizzo, e
    // leggerlo al primo render darebbe un HTML diverso da quello del server.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizzazione con una sorgente esterna (l'indirizzo), una volta al montaggio
    setVisibile(true);
  }, []);

  const chiudi = useCallback(() => setVisibile(false), []);
  return { visibile, chiudi };
}
