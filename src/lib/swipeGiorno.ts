"use client";

// Swipe orizzontale per cambiare giorno in Oggi (PUNTO_DI_PARTENZA.md,
// sezione 3, "Swipe per cambiare giorno"). Dito verso sinistra = giorno
// dopo, verso destra = giorno prima; oltre oggi + 7 non si va (effetto
// elastico). Le decisioni (direzione, soglie, bordi, elastico) sono funzioni pure in
// decisioneSwipe.ts; qui c'è solo il collegamento col browser.
//
// Uso: `const rifPannello = useSwipeGiorno({...})` e poi
// `<div ref={rifPannello}>` sul pannello che si muove. È una *ref callback*:
// React la chiama quando l'elemento compare (e chiama la funzione che
// restituisce quando sparisce), così gli ascoltatori si attaccano anche se il
// pannello non c'è al primo render (in Oggi c'è prima "Caricamento...").
//
// Perché ascoltatori nativi e non onPointerMove di React: durante il
// trascinamento il pannello si sposta scrivendo `transform` direttamente
// sull'elemento, senza aggiornare lo stato React. Altrimenti a ogni pixel
// React ridisegnerebbe tutta la pagina Oggi. E serve un `touchmove` non
// passivo (vedi sotto), che React non sa registrare.
//
// Verticale contro orizzontale:
// - il pannello ha `touch-action: pan-y` (in pagina): lo scroll verticale
//   lo fa il browser, con lo slancio nativo; quello orizzontale arriva a noi;
// - se il browser decide che è uno scroll, manda `pointercancel` e il gesto
//   si annulla;
// - una volta deciso "orizzontale", la lista non deve più scorrere per il
//   resto del gesto. `touch-action` non basta: il browser lo legge solo
//   all'inizio del tocco, cambiarlo a metà non ha effetto, e con pan-y un
//   dito che dopo la decisione scende in diagonale farebbe scorrere la
//   lista. Quindi: `preventDefault()` su ogni `touchmove` del gesto
//   orizzontale (è il modo che iOS rispetta per fermare uno scroll), più
//   `overflow-y: hidden` sull'area che scorre finché il dito non si alza,
//   come seconda cintura. `hidden` non azzera la posizione dello scroll.
//
// Tieni premuto (tieniPremuto.ts): quando una riga della lista si solleva,
// il dito è "rivendicato" da quel gesto e lo swipe lo lascia andare. Non
// può aver già deciso "orizzontale": il tieni-premuto si annulla a 8 px, lo
// swipe decide a 10.

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { flushSync } from "react-dom";
import {
  creaBloccoClick,
  decidiDirezione,
  DURATA_ENTRATA_MS,
  DURATA_RITORNO_MS,
  DURATA_USCITA_MS,
  esitoRilascio,
  partenzaValida,
  spostamentoMostrato,
  velocitaRecente,
  type Campione,
  type Direzione,
  type EsitoSwipe,
} from "./decisioneSwipe";
import { ultimoGiornoDiario } from "./dataGiorno";
import { puntatoreRivendicato } from "./puntatoriRivendicati";
import { movimentoRidotto } from "./movimentoRidotto";

export type VersoGiorno = Exclude<EsitoSwipe, "ritorno">;

interface OpzioniSwipe {
  // Il giorno mostrato, "YYYY-MM-DD": serve a sapere se si può andare avanti
  // (oltre oggi + 7 no). Confrontato con ultimoGiornoDiario() a ogni gesto,
  // così regge anche a cavallo della mezzanotte.
  giorno: string;
  // Falso con uno sheet aperto: il gesto non parte.
  attivo: boolean;
  // Cambia il giorno. Chiamata dentro flushSync: quando ritorna, il pannello
  // mostra già il giorno nuovo e può entrare.
  onCambia: (verso: VersoGiorno) => void;
  // L'area che scorre in verticale dentro il pannello (la lista dei pasti).
  rifScorrimento: RefObject<HTMLElement | null>;
}

interface Gesto {
  id: number;
  x0: number;
  y0: number;
  direzione: Direzione | null;
  campioni: Campione[];
  puoAvanti: boolean;
  // prefers-reduced-motion: il gesto vale, ma niente si muove.
  ridotto: boolean;
  spostamento: number;
}

// Campi che aprono la tastiera. Select e date no: aprono un selettore, e
// dopo la scelta il fuoco ci resta — non devono spegnere lo swipe.
const TIPI_CON_TASTIERA = new Set(["text", "number", "email", "password", "search", "tel", "url"]);

function tastieraAperta(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && TIPI_CON_TASTIERA.has(el.type);
}

// Porta il pannello da `da` ad `a` (px) in `durata` ms. Lo stile finale si
// scrive subito: l'animazione lo copre finché gira, poi resta quello.
async function anima(el: HTMLElement, da: number, a: number, durata: number, easing: string) {
  el.style.transform = `translateX(${a}px)`;
  if (typeof el.animate !== "function") return;
  const animazione = el.animate(
    [{ transform: `translateX(${da}px)` }, { transform: `translateX(${a}px)` }],
    { duration: durata, easing }
  );
  await animazione.finished.catch(() => {});
}

export function useSwipeGiorno(opzioni: OpzioniSwipe) {
  // Gli ascoltatori sono attaccati una volta sola: leggono le opzioni più
  // recenti da qui, aggiornate dopo ogni render.
  const rifOpzioni = useRef(opzioni);
  useEffect(() => {
    rifOpzioni.current = opzioni;
  });

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;

    let gesto: Gesto | null = null;
    let inAnimazione = false;
    const blocco = creaBloccoClick();

    function sbloccaScorrimento() {
      const scorr = rifOpzioni.current.rifScorrimento.current;
      if (scorr) scorr.style.overflowY = "";
    }

    async function concludi(esito: EsitoSwipe, da: number, ridotto: boolean) {
      inAnimazione = true;
      try {
        if (esito === "ritorno") {
          if (!ridotto) await anima(el!, da, 0, DURATA_RITORNO_MS, "ease-out");
          return;
        }
        // Il giorno dopo arriva da destra, quello prima da sinistra.
        const segno = esito === "successivo" ? -1 : 1;
        const larghezza = el!.offsetWidth;
        if (!ridotto) await anima(el!, da, segno * larghezza, DURATA_USCITA_MS, "ease-in");
        flushSync(() => rifOpzioni.current.onCambia(esito));
        if (!ridotto) await anima(el!, -segno * larghezza, 0, DURATA_ENTRATA_MS, "ease-out");
      } finally {
        el!.style.transform = "";
        inAnimazione = false;
      }
    }

    function suPointerDown(e: PointerEvent) {
      if (gesto) {
        if (!e.isPrimary) return; // secondo dito: si ignora
        // Un primo dito nuovo vuol dire che nessun altro è giù: il gesto di
        // prima è finito anche se la sua fine non è mai arrivata (Safari, bug
        // del 6/10 col menu del tieni-premuto). Senza, il gesto rimasto
        // aperto spegnerebbe lo swipe per sempre.
        gesto = null;
        sbloccaScorrimento();
        if (!inAnimazione) el!.style.transform = "";
      }
      blocco.inizioGesto();
      const { attivo, giorno } = rifOpzioni.current;
      if (
        e.pointerType === "mouse" || // al PC ci sono le freccette
        inAnimazione ||
        !attivo ||
        tastieraAperta() ||
        !partenzaValida(e.clientX, window.innerWidth)
      ) {
        return;
      }
      gesto = {
        id: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        direzione: null,
        campioni: [{ t: e.timeStamp, x: e.clientX }],
        puoAvanti: giorno < ultimoGiornoDiario(),
        ridotto: movimentoRidotto(),
        spostamento: 0,
      };
    }

    function suPointerMove(e: PointerEvent) {
      if (!gesto || e.pointerId !== gesto.id) return;
      if (gesto.direzione === null && puntatoreRivendicato(e.pointerId)) {
        // Il dito è del tieni-premuto: questo gesto non c'è più.
        gesto = null;
        return;
      }
      const dx = e.clientX - gesto.x0;
      if (gesto.direzione === null) {
        gesto.direzione = decidiDirezione(dx, e.clientY - gesto.y0);
        if (gesto.direzione === null) return;
        if (gesto.direzione === "verticale") {
          // Uno scroll: il resto del gesto non ci riguarda.
          gesto = null;
          return;
        }
        // Orizzontale: da qui il dito è nostro.
        try {
          el!.setPointerCapture(e.pointerId);
        } catch {
          // Puntatore già rilasciato: niente da catturare.
        }
        const scorr = rifOpzioni.current.rifScorrimento.current;
        if (scorr) scorr.style.overflowY = "hidden";
      }
      gesto.campioni.push({ t: e.timeStamp, x: e.clientX });
      if (gesto.campioni.length > 20) gesto.campioni.shift();
      gesto.spostamento = spostamentoMostrato(dx, gesto.puoAvanti);
      if (!gesto.ridotto) el!.style.transform = `translateX(${gesto.spostamento}px)`;
    }

    function fine(e: PointerEvent, annullato: boolean) {
      if (!gesto || e.pointerId !== gesto.id) return;
      const g = gesto;
      gesto = null;
      if (g.direzione !== "orizzontale") return;
      blocco.trascinamentoConcluso(e.timeStamp);
      sbloccaScorrimento();
      g.campioni.push({ t: e.timeStamp, x: e.clientX });
      const esito = annullato
        ? "ritorno"
        : esitoRilascio({
            dx: e.clientX - g.x0,
            velocita: velocitaRecente(g.campioni),
            puoAvanti: g.puoAvanti,
          });
      void concludi(esito, g.spostamento, g.ridotto);
    }

    const suPointerUp = (e: PointerEvent) => fine(e, false);
    const suPointerCancel = (e: PointerEvent) => fine(e, true);

    function suTouchMove(e: TouchEvent) {
      if (gesto?.direzione === "orizzontale" && e.cancelable) e.preventDefault();
    }

    // In fase di "capture" (terzo argomento true): il click viene fermato
    // qui, prima di arrivare al pulsante della riga o alla stella.
    function suClick(e: MouseEvent) {
      if (blocco.consumaClick(e.timeStamp)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    el.addEventListener("pointerdown", suPointerDown);
    el.addEventListener("pointermove", suPointerMove);
    el.addEventListener("pointerup", suPointerUp);
    el.addEventListener("pointercancel", suPointerCancel);
    el.addEventListener("touchmove", suTouchMove, { passive: false });
    el.addEventListener("click", suClick, true);
    return () => {
      el.removeEventListener("pointerdown", suPointerDown);
      el.removeEventListener("pointermove", suPointerMove);
      el.removeEventListener("pointerup", suPointerUp);
      el.removeEventListener("pointercancel", suPointerCancel);
      el.removeEventListener("touchmove", suTouchMove);
      el.removeEventListener("click", suClick, true);
      sbloccaScorrimento();
    };
  }, []);
}
