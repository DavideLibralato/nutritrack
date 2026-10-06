"use client";

// Tieni premuto su un alimento o sul nome di un pasto in Oggi
// (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto: sposta, duplica,
// elimina"). Le decisioni (soglie, fasi) sono funzioni pure in
// decisioneTieniPremuto.ts; qui c'è solo il collegamento col browser.
//
// Uso: `const rifLista = useTieniPremuto({...})` e `<ul ref={rifLista}>`
// sulla lista. Gli ascoltatori stanno sulla lista, non su ogni riga ("event
// delegation"): un evento che parte da una riga risale fino alla lista, che
// guarda da quale riga arriva con `closest("[data-tieni-premuto]")`. Una
// riga partecipa al gesto se ha:
//   data-tieni-premuto="voce" | "pasto"   e   data-id="<id>"
// Così le righe restano semplici <button> e non serve un hook per riga.
//
// Ascoltatori nativi e non onPointerDown di React, come in swipeGiorno.ts:
// serve un `touchmove` non passivo (React non lo sa registrare) e il
// sollevamento si disegna scrivendo un attributo sulla riga, senza
// ridisegnare la pagina.
//
// Convivenza con lo scroll e con lo swipe del giorno:
// - prima del sollevamento il dito non è nostro: se si muove oltre 8 px il
//   gesto si annulla e il browser scorre (o lo swipe decide, a 10 px);
// - al sollevamento il dito diventa nostro: lo "rivendichiamo"
//   (puntatoriRivendicati.ts) così lo swipe, che ascolta sul pannello
//   attorno, lo lascia andare; `preventDefault()` su ogni `touchmove`
//   ferma lo scroll (è il modo che iOS rispetta) e `overflow-y: hidden`
//   sulla lista fa da seconda cintura, come nello swipe;
// - il click che il browser manda dopo un gesto sollevato non deve aprire
//   lo sheet della riga né aprire/chiudere il pasto: stesso blocco di un
//   click solo dello swipe (creaBloccoClick).
//
// `contextmenu` (tasto destro, Maiusc+F10, tasto Menu, tieni-premuto nativo
// di Android): il menu del browser è sempre soppresso sulle righe; apre il
// nostro solo se non c'è un gesto col dito in corso né appena finito, così
// su Android il nostro tieni-premuto e quello nativo non aprono il menu due
// volte (regola in contextmenuApreMenu).

import { useCallback, useEffect, useRef } from "react";
import {
  aggiornaMovimento,
  aggiornaRilascio,
  aggiornaTempo,
  avviaTieniPremuto,
  contextmenuApreMenu,
  eSollevato,
  prossimaScadenza,
  type StatoTieniPremuto,
} from "./decisioneTieniPremuto";
import { creaBloccoClick } from "./decisioneSwipe";
import { liberaPuntatore, puntatoreRivendicato, rivendicaPuntatore } from "./puntatoriRivendicati";

export type TipoRiga = "voce" | "pasto";

export interface RigaPremuta {
  tipo: TipoRiga;
  id: string;
  // La riga nella pagina: serve ad ancorarci il menu.
  elemento: HTMLElement;
}

interface OpzioniTieniPremuto {
  // Falso con uno sheet o un menu aperto: il gesto non parte.
  attivo: boolean;
  // Il gesto è finito sul ramo menu (dito fermo, o alzato senza muoversi),
  // oppure è arrivato un `contextmenu` senza gesti in corso.
  onMenu: (riga: RigaPremuta) => void;
  // Fine di un trascinamento: il dito si è alzato in (x, y).
  onLasciato: (riga: RigaPremuta, x: number, y: number) => void;
}

interface Gesto {
  id: number;
  riga: RigaPremuta;
  stato: StatoTieniPremuto;
  timer: ReturnType<typeof setTimeout> | null;
}

function rigaDa(target: EventTarget | null, contenitore: HTMLElement): RigaPremuta | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>("[data-tieni-premuto]");
  if (!el || !contenitore.contains(el)) return null;
  const tipo = el.dataset.tieniPremuto;
  const id = el.dataset.id;
  if ((tipo !== "voce" && tipo !== "pasto") || !id) return null;
  return { tipo, id, elemento: el };
}

export function useTieniPremuto(opzioni: OpzioniTieniPremuto) {
  // Gli ascoltatori sono attaccati una volta sola: leggono le opzioni più
  // recenti da qui, aggiornate dopo ogni render.
  const rifOpzioni = useRef(opzioni);
  useEffect(() => {
    rifOpzioni.current = opzioni;
  });

  return useCallback((el: HTMLElement | null) => {
    if (!el) return;

    let gesto: Gesto | null = null;
    const blocco = creaBloccoClick();
    // Quando è finito l'ultimo gesto che ha sollevato una riga (timeStamp
    // dell'evento): per non aprire il menu una seconda volta con un
    // `contextmenu` che arriva in ritardo.
    let fineUltimoSollevato: number | null = null;

    function pulisci(g: Gesto) {
      if (g.timer !== null) clearTimeout(g.timer);
      g.riga.elemento.removeAttribute("data-sollevato");
      el!.style.overflowY = "";
      liberaPuntatore(g.id);
    }

    // Applica il nuovo stato: effetti del cambio di fase e timer seguente.
    function applica(g: Gesto, nuovo: StatoTieniPremuto) {
      const prima = g.stato.fase;
      g.stato = nuovo;
      if (prima === nuovo.fase) return;

      if (prima === "attesa" && eSollevato(nuovo)) {
        // La riga si stacca: da qui il dito è nostro.
        rivendicaPuntatore(g.id);
        g.riga.elemento.setAttribute("data-sollevato", "");
        el!.style.overflowY = "hidden";
        try {
          el!.setPointerCapture(g.id);
        } catch {
          // Puntatore già rilasciato: niente da catturare.
        }
      }
      if (nuovo.fase === "menu") rifOpzioni.current.onMenu(g.riga);
      programma(g);
    }

    function programma(g: Gesto) {
      if (g.timer !== null) clearTimeout(g.timer);
      g.timer = null;
      const scadenza = prossimaScadenza(g.stato);
      if (scadenza === null) return;
      g.timer = setTimeout(() => {
        if (gesto !== g) return;
        g.timer = null;
        applica(g, aggiornaTempo(g.stato, performance.now()));
      }, Math.max(0, scadenza - performance.now()));
    }

    function suPointerDown(e: PointerEvent) {
      if (gesto) return; // secondo dito: si ignora
      blocco.inizioGesto();
      // Solo il tasto principale: il destro passa da `contextmenu`.
      if (!e.isPrimary || e.button !== 0 || !rifOpzioni.current.attivo) return;
      const riga = rigaDa(e.target, el!);
      if (!riga) return;
      liberaPuntatore(e.pointerId); // un id rimasto da un gesto interrotto
      gesto = {
        id: e.pointerId,
        riga,
        stato: avviaTieniPremuto(e.clientX, e.clientY, performance.now()),
        timer: null,
      };
      programma(gesto);
    }

    function suPointerMove(e: PointerEvent) {
      const g = gesto;
      if (!g || e.pointerId !== g.id) return;
      applica(g, aggiornaMovimento(g.stato, e.clientX, e.clientY, performance.now()));
      if (g.stato.fase === "annullato") {
        // Scroll o swipe: il resto del gesto non ci riguarda.
        pulisci(g);
        gesto = null;
      }
    }

    function fine(e: PointerEvent, annullato: boolean) {
      const g = gesto;
      if (!g || e.pointerId !== g.id) return;
      gesto = null;
      const eraSollevato = eSollevato(g.stato);
      if (!annullato) applica(g, aggiornaRilascio(g.stato, performance.now()));
      pulisci(g);
      if (!eraSollevato) return; // un tap: il click fa il suo lavoro
      blocco.trascinamentoConcluso(e.timeStamp);
      fineUltimoSollevato = e.timeStamp;
      if (!annullato && g.stato.fase === "lasciato") {
        rifOpzioni.current.onLasciato(g.riga, e.clientX, e.clientY);
      }
    }

    const suPointerUp = (e: PointerEvent) => fine(e, false);
    const suPointerCancel = (e: PointerEvent) => fine(e, true);

    function suTouchMove(e: TouchEvent) {
      if (gesto && puntatoreRivendicato(gesto.id) && e.cancelable) e.preventDefault();
    }

    function suContextMenu(e: MouseEvent) {
      const riga = rigaDa(e.target, el!);
      if (!riga) return;
      e.preventDefault();
      const msDaUltimoSollevato =
        fineUltimoSollevato === null ? null : e.timeStamp - fineUltimoSollevato;
      if (!rifOpzioni.current.attivo || !contextmenuApreMenu(gesto !== null, msDaUltimoSollevato)) {
        return;
      }
      rifOpzioni.current.onMenu(riga);
    }

    // In fase di "capture": il click viene fermato qui, prima di arrivare
    // al pulsante della riga.
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
    el.addEventListener("contextmenu", suContextMenu);
    el.addEventListener("click", suClick, true);
    return () => {
      el.removeEventListener("pointerdown", suPointerDown);
      el.removeEventListener("pointermove", suPointerMove);
      el.removeEventListener("pointerup", suPointerUp);
      el.removeEventListener("pointercancel", suPointerCancel);
      el.removeEventListener("touchmove", suTouchMove);
      el.removeEventListener("contextmenu", suContextMenu);
      el.removeEventListener("click", suClick, true);
      if (gesto) pulisci(gesto);
      gesto = null;
    };
  }, []);
}
