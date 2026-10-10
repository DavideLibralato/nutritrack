"use client";

// L'oggi del calendario per una pagina che resta aperta a lungo (Oggi):
// "YYYY-MM-DD", come oggiLocale(), ma che si aggiorna da solo quando il
// giorno cambia, e la pagina si ridisegna.
//
// Perché serve: oggiLocale() letto durante il render vale solo per quel
// render. Su iPhone l'app installata, riaperta la mattina dal multitasking,
// non si ricarica: senza un nuovo render la pagina crederebbe ancora che
// oggi sia ieri ("Rimangono X kcal" su ieri, niente pulsante "Oggi").
//
// Due modi di accorgersene (PUNTO_DI_PARTENZA.md, sezione 3, "Inserimento
// retroattivo"):
// - un timer fino alla prossima mezzanotte locale (msAllaMezzanotte), per
//   l'app aperta a cavallo della mezzanotte;
// - il ritorno in primo piano (`visibilitychange`, lo stesso evento della
//   sincronizzazione in orchestratore.ts): in background iOS sospende i
//   timer, quindi il timer da solo non basta.
// A ogni controllo il timer si riprogramma da capo. Scrivere nello stato
// lo stesso giorno di prima non ridisegna niente: React lo ignora.
//
// Un hook (funzione `use...`) è il modo di React per dare a un componente
// un valore che cambia nel tempo: quando cambia, il componente si
// ridisegna con quello nuovo.

import { useEffect, useState } from "react";
import { msAllaMezzanotte, oggiLocale } from "./dataGiorno";

export function useGiornoCorrente(): string {
  const [giorno, setGiorno] = useState(() => oggiLocale());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    function controlla() {
      setGiorno(oggiLocale());
      programma();
    }

    function programma() {
      clearTimeout(timer);
      timer = setTimeout(controlla, msAllaMezzanotte());
    }

    function alRitornoInPrimoPiano() {
      if (document.visibilityState === "visible") controlla();
    }

    programma();
    document.addEventListener("visibilitychange", alRitornoInPrimoPiano);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", alRitornoInPrimoPiano);
    };
  }, []);

  return giorno;
}
