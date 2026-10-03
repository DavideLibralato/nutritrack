"use client";

// Il guardiano delle modifiche non salvate (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni"): se la pagina aperta ha un modulo con modifiche non
// salvate, i link interni protetti (LinkProtetto: "‹ Impostazioni" e le voci
// della tab bar) non navigano subito ma chiedono "Esci senza salvare?".
//
// Funziona con un CONTESTO React: un valore che un componente "fornitore"
// (il provider, qui sotto) mette a disposizione di tutti i componenti che
// stanno dentro di lui, a qualunque profondità, senza passarlo a mano di
// componente in componente. La pagina col modulo scrive "ho modifiche"
// (useSegnalaModifiche); i link lo leggono (useNavigazioneProtetta).
//
// Il provider sta in src/app/(app)/layout.tsx perché deve avvolgere INSIEME
// le pagine e la tab bar: un contesto si vede solo dentro il suo provider, e
// la tab bar è un fratello delle pagine in quel layout, non un loro figlio.
// Un provider in impostazioni/layout.tsx avvolgerebbe solo le pagine di
// Impostazioni, e la tab bar non lo vedrebbe.
//
// La ricarica e la chiusura della pagina non passano da qui: le copre il
// `beforeunload` della pagina col modulo. Il gesto "indietro" di Safari dal
// bordo dello schermo non si può intercettare (nell'app installata non c'è).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import SheetConferma from "./SheetConferma";

interface ValoreGuardiano {
  impostaModificato: (modificato: boolean) => void;
  // Da chiamare nell'onClick di un link interno. Se ci sono modifiche, ferma
  // la navigazione e apre la conferma; se no non fa niente e il link naviga.
  proteggiNavigazione: (evento: MouseEvent, destinazione: string) => void;
}

// Fuori dal provider (es. /aggiungi, che non sta nel gruppo (app)) il
// guardiano non c'è: nessuna modifica segnalata, nessuna navigazione fermata.
const ContestoGuardiano = createContext<ValoreGuardiano>({
  impostaModificato: () => {},
  proteggiNavigazione: () => {},
});

export default function GuardianoModifiche({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [modificato, setModificato] = useState(false);
  // Dove voleva andare l'utente: non null = la conferma è aperta.
  const [destinazione, setDestinazione] = useState<string | null>(null);

  const proteggiNavigazione = useCallback(
    (evento: MouseEvent, verso: string) => {
      if (!modificato) return;
      // preventDefault su un Link di Next ferma la navigazione: Next
      // controlla se l'evento è già stato annullato prima di cambiare pagina.
      evento.preventDefault();
      setDestinazione(verso);
    },
    [modificato]
  );

  // useMemo: lo stesso oggetto finché non cambia `proteggiNavigazione`,
  // così i componenti che leggono il contesto non si ridisegnano per niente.
  const valore = useMemo(
    () => ({ impostaModificato: setModificato, proteggiNavigazione }),
    [proteggiNavigazione]
  );

  function esciSenzaSalvare() {
    if (destinazione === null) return;
    // Prima "nessuna modifica", poi la navigazione: la pagina col modulo si
    // smonta e il suo useSegnalaModifiche lo rimetterebbe comunque a false.
    setModificato(false);
    setDestinazione(null);
    router.push(destinazione);
  }

  return (
    <ContestoGuardiano.Provider value={valore}>
      {children}
      {destinazione !== null && (
        <SheetConferma
          titolo="Esci senza salvare?"
          testo="Le modifiche che non hai salvato andranno perse."
          etichettaNo="Annulla"
          etichettaSi="Esci senza salvare"
          distruttiva
          onNo={() => setDestinazione(null)}
          onSi={esciSenzaSalvare}
        />
      )}
    </ContestoGuardiano.Provider>
  );
}

// Per la pagina col modulo: dice al guardiano se ci sono modifiche. Quando
// il valore cambia, o la pagina si chiude (smontaggio), la pulizia
// dell'effetto rimette "nessuna modifica": lo stato non resta appeso dopo
// aver lasciato la pagina.
export function useSegnalaModifiche(modificato: boolean) {
  const { impostaModificato } = useContext(ContestoGuardiano);
  useEffect(() => {
    impostaModificato(modificato);
    return () => impostaModificato(false);
  }, [modificato, impostaModificato]);
}

export function useNavigazioneProtetta() {
  return useContext(ContestoGuardiano).proteggiNavigazione;
}
