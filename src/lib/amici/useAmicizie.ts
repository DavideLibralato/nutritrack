"use client";

// Le amicizie per la pagina Amici e per la riga Amici in Impostazioni
// (PUNTO_DI_PARTENZA.md §3 "Amici"). Solo online. Si rilegge:
// all'apertura, dopo ogni azione (chi agisce chiama `ricarica`), al ritorno
// in primo piano (visibilitychange) e al ritorno della rete (online).
// Niente polling, niente Realtime (§9.2).
//
// Una rilettura non rimette "caricamento": l'elenco già a schermo resta
// finché non arriva quello nuovo, senza lampeggiare. Se le letture si
// accavallano vale solo l'ultima partita: una lenta, arrivata dopo, non
// riporta indietro l'elenco.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { dividiAmicizie, leggiAmicizie, type AmicizieDivise } from "./amicizie";
import { impostaNovita } from "./novita";

export type StatoAmicizie =
  | { esito: "caricamento" }
  | { esito: "errore" }
  | { esito: "ok"; divise: AmicizieDivise };

export function useAmicizie() {
  const userId = useUtenteId();
  const [stato, setStato] = useState<StatoAmicizie>({ esito: "caricamento" });
  // Il numero dell'ultima lettura partita: una risposta con un numero più
  // vecchio si scarta.
  const ultimaLettura = useRef(0);

  // Lo stato si aggiorna solo nella risposta (.then), mai subito: così si
  // può chiamare anche dentro un effetto. Restituisce la promessa, per chi
  // vuole aspettare la rilettura (la pagina, dopo un'azione).
  const ricarica = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    const numero = ++ultimaLettura.current;
    return leggiAmicizie(createClient(), userId).then((lettura) => {
      if (numero !== ultimaLettura.current) return;
      if (lettura.esito === "ok") {
        const divise = dividiAmicizie(lettura.righe, lettura.nomi, userId);
        setStato({ esito: "ok", divise });
        // Le stesse righe danno anche il pallino: dopo un'azione nella
        // pagina, tab e riga Amici si aggiornano senza un'altra lettura.
        impostaNovita(userId, { richiesteRicevute: divise.ricevute.length });
      } else {
        // Un elenco già a schermo resta: l'errore conta solo se non c'è niente.
        setStato((prima) => (prima.esito === "ok" ? prima : { esito: "errore" }));
      }
    });
  }, [userId]);

  useEffect(() => {
    void ricarica();

    function alRitorno() {
      if (document.visibilityState === "visible") void ricarica();
    }
    function allaRete() {
      void ricarica();
    }
    document.addEventListener("visibilitychange", alRitorno);
    window.addEventListener("online", allaRete);
    return () => {
      document.removeEventListener("visibilitychange", alRitorno);
      window.removeEventListener("online", allaRete);
    };
  }, [ricarica]);

  return { stato, ricarica };
}
