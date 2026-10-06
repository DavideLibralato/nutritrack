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
import { liberaPuntatore, rivendicaPuntatore } from "./puntatoriRivendicati";

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
  // oppure è arrivato un `contextmenu` senza gesti in corso
  // (`daContextmenu`: tasto destro o tastiera, il fuoco può andare al menu).
  onMenu: (riga: RigaPremuta, daContextmenu: boolean) => void;
  // Fine di un trascinamento: il dito si è alzato in (x, y).
  // Facoltativa: finché non c'è (passi A–C) il trascinamento non fa niente.
  onLasciato?: (riga: RigaPremuta, x: number, y: number) => void;
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

// Restituisce:
// - `rif`: la ref callback da mettere sulla lista;
// - `azzera`: chiude il gesto in corso e rilascia il dito preso, se ci
//   sono. La chiama chi chiude il menu (chiudiMenu in Oggi): quando il menu
//   si chiude il dito che l'ha aperto è finito, anche se il browser non
//   l'ha detto.
export function useTieniPremuto(opzioni: OpzioniTieniPremuto) {
  // Gli ascoltatori sono attaccati una volta sola: leggono le opzioni più
  // recenti da qui, aggiornate dopo ogni render.
  const rifOpzioni = useRef(opzioni);
  useEffect(() => {
    rifOpzioni.current = opzioni;
  });

  const rifAzzera = useRef<(() => void) | null>(null);
  const azzera = useCallback(() => rifAzzera.current?.(), []);

  const rif = useCallback((el: HTMLElement | null) => {
    if (!el) return;

    // Due cose separate, perché finiscono in momenti diversi:
    // - `gesto`: la decisione in corso (attesa → sollevato → trascina o
    //   menu). Finisce appena il ramo è deciso: il menu si apre col dito
    //   ancora giù, e da lì il gesto non ha più niente da decidere;
    // - `ditoPreso`: il dito che dal sollevamento è nostro (niente scroll,
    //   niente swipe). Si rilascia quando quel dito si alza.
    // Rete di sicurezza (bug del 6/10 su iPhone): se Safari non consegna
    // mai la fine di quel tocco, un gesto o un dito rimasti "aperti"
    // bloccherebbero per sempre scroll e tieni-premuto. Un nuovo pointerdown
    // PRIMARIO vuol dire che nessun altro dito è giù: quello che era rimasto
    // aperto è finito di sicuro, e si chiude lì.
    let gesto: Gesto | null = null;
    let ditoPreso: number | null = null;
    const blocco = creaBloccoClick();
    // Quando è finito l'ultimo gesto che ha sollevato una riga
    // (performance.now()): per non aprire il menu una seconda volta con un
    // `contextmenu` che arriva in ritardo.
    let fineUltimoSollevato: number | null = null;

    // Fine della decisione: la riga torna giù e il timer si ferma. Il dito,
    // se era stato preso, resta preso finché non si alza.
    function chiudiGesto(g: Gesto) {
      if (gesto === g) gesto = null;
      if (g.timer !== null) clearTimeout(g.timer);
      g.timer = null;
      g.riga.elemento.removeAttribute("data-sollevato");
      if (eSollevato(g.stato)) {
        const ora = performance.now();
        blocco.trascinamentoConcluso(ora);
        fineUltimoSollevato = ora;
      }
    }

    // Il dito preso torna libero: lista di nuovo scorrevole, swipe di nuovo
    // possibile, cattura del puntatore rilasciata.
    function rilasciaDito() {
      if (ditoPreso === null) return;
      const id = ditoPreso;
      ditoPreso = null;
      liberaPuntatore(id);
      el!.style.overflowY = "";
      try {
        if (el!.hasPointerCapture?.(id)) el!.releasePointerCapture(id);
      } catch {
        // Puntatore già finito: niente da rilasciare.
      }
    }

    // Applica il nuovo stato: effetti del cambio di fase e timer seguente.
    function applica(g: Gesto, nuovo: StatoTieniPremuto, x: number, y: number) {
      const prima = g.stato.fase;
      g.stato = nuovo;
      if (prima === nuovo.fase) return;

      if (prima === "attesa" && eSollevato(nuovo)) {
        // La riga si stacca: da qui il dito è nostro.
        ditoPreso = g.id;
        rivendicaPuntatore(g.id);
        g.riga.elemento.setAttribute("data-sollevato", "");
        el!.style.overflowY = "hidden";
        try {
          el!.setPointerCapture(g.id);
        } catch {
          // Puntatore già rilasciato: niente da catturare.
        }
      }
      switch (nuovo.fase) {
        case "menu":
          chiudiGesto(g);
          rifOpzioni.current.onMenu(g.riga, false);
          return;
        case "lasciato":
          chiudiGesto(g);
          rifOpzioni.current.onLasciato?.(g.riga, x, y);
          return;
        case "annullato":
          chiudiGesto(g);
          return;
        default:
          programma(g);
      }
    }

    function programma(g: Gesto) {
      if (g.timer !== null) clearTimeout(g.timer);
      g.timer = null;
      const scadenza = prossimaScadenza(g.stato);
      if (scadenza === null) return;
      g.timer = setTimeout(() => {
        if (gesto !== g) return;
        g.timer = null;
        const nuovo = aggiornaTempo(g.stato, performance.now());
        // Un timer può scattare una frazione di millisecondo prima della
        // scadenza misurata con performance.now() (visto nei test: 0,2–0,3
        // ms). Senza cambio di fase si riprova, altrimenti il gesto resta
        // fermo lì finché il dito non si alza.
        if (nuovo.fase === g.stato.fase) {
          programma(g);
          return;
        }
        applica(g, nuovo, g.stato.x, g.stato.y);
      }, Math.max(0, scadenza - performance.now()));
    }

    function suPointerDown(e: PointerEvent) {
      if (gesto || ditoPreso !== null) {
        if (!e.isPrimary) return; // secondo dito: si ignora
        // Primo dito nuovo: quello di prima è finito anche se la sua fine
        // non è mai arrivata (vedi sopra).
        if (gesto) chiudiGesto(gesto);
        rilasciaDito();
      }
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
      applica(g, aggiornaMovimento(g.stato, e.clientX, e.clientY, performance.now()), e.clientX, e.clientY);
    }

    function fine(e: PointerEvent, annullato: boolean) {
      const g = gesto;
      if (g && e.pointerId === g.id) {
        if (annullato) chiudiGesto(g);
        else applica(g, aggiornaRilascio(g.stato, performance.now()), e.clientX, e.clientY);
      }
      if (ditoPreso === e.pointerId) {
        rilasciaDito();
        // Il click che segue il dito alzato non deve aprire lo sheet.
        blocco.trascinamentoConcluso(performance.now());
      }
    }

    const suPointerUp = (e: PointerEvent) => fine(e, false);
    const suPointerCancel = (e: PointerEvent) => fine(e, true);

    function suTouchMove(e: TouchEvent) {
      if (ditoPreso !== null && e.cancelable) e.preventDefault();
    }

    function suContextMenu(e: MouseEvent) {
      const riga = rigaDa(e.target, el!);
      if (!riga) return;
      e.preventDefault();
      const msDaUltimoSollevato =
        fineUltimoSollevato === null ? null : performance.now() - fineUltimoSollevato;
      const inCorso = gesto !== null || ditoPreso !== null;
      if (!rifOpzioni.current.attivo || !contextmenuApreMenu(inCorso, msDaUltimoSollevato)) {
        return;
      }
      rifOpzioni.current.onMenu(riga, true);
    }

    // In fase di "capture": il click viene fermato qui, prima di arrivare
    // al pulsante della riga.
    function suClick(e: MouseEvent) {
      if (blocco.consumaClick(performance.now())) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    rifAzzera.current = () => {
      if (gesto) chiudiGesto(gesto);
      rilasciaDito();
    };

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
      if (gesto) chiudiGesto(gesto);
      rilasciaDito();
      rifAzzera.current = null;
    };
  }, []);

  return { rif, azzera };
}
