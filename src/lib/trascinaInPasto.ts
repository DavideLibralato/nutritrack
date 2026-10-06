"use client";

// Trascinare un alimento o un pasto intero su un altro pasto in Oggi
// (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto", passo D). Il gesto lo
// riconosce useTieniPremuto (tieniPremuto.ts), che da qui riceve inizio,
// movimento e fine del ramo "trascina"; le decisioni (quale pasto sta
// sotto il dito) sono funzioni pure in decisioneTrascinamento.ts. Qui c'è
// il collegamento col browser.
//
// A seguire il dito è una COPIA della riga (CopiaTrascinata), in un portale
// su document.body con position: fixed. Non la riga vera: la lista dei
// pasti è un contenitore con overflow-y: auto, che per le regole CSS taglia
// anche in orizzontale e in ogni direzione — la riga spostata sparirebbe
// appena esce dalla lista (verso l'anello, o fuori dai bordi). La copia si
// muove scrivendo `transform` direttamente sull'elemento, come lo swipe del
// giorno: React non ridisegna la pagina a ogni pixel. Lo stato React
// cambia solo all'inizio, alla fine, e quando cambia il pasto sotto il dito.
//
// Al rilascio:
// - su un altro pasto: la copia sparisce e si chiama onRilascio, che fa lo
//   stesso spostamento di "Sposta" dal menu (foglio dei doppioni, messaggio,
//   Annulla);
// - altrove (fuori dai pasti, sul pasto di partenza, sopra "+ Aggiungi" e
//   la pillola) o gesto interrotto dal sistema: niente si scrive, la copia
//   torna verso la riga e sparisce. Con "Riduci movimento" sparisce subito.
// Dopo un rilascio, il click che il browser può mandare dove si è alzato il
// dito (per esempio sopra "+ Aggiungi", fuori dalla lista) viene fermato
// per SCADENZA_BLOCCO_CLICK_MS: nessuno sheet o pagina si apre per errore.
//
// Scorrimento automatico (deciso il 6/10): con il dito nelle fasce sensibili
// in alto o in basso della lista, la lista scorre da sola
// (velocitaScorrimento in decisioneTrascinamento.ts). Lo fa un ciclo
// requestAnimationFrame — una funzione richiamata a ogni fotogramma dello
// schermo — che si ferma quando il dito esce dalla fascia o la lista è a
// fine corsa. La lista ha overflow hidden durante il gesto (il dito non la
// fa scorrere), ma scrivere scrollTop da codice funziona lo stesso. I pasti
// restano quelli misurati all'inizio, spostati di quanto la lista ha
// scorso; a ogni fotogramma il pasto sotto il dito si ricalcola, anche a
// dito fermo. Vale anche con "Riduci movimento": è una funzione, non un
// effetto.

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  bersaglioSotto,
  pastiDopoScorrimento,
  prossimoScrollTop,
  velocitaScorrimento,
  zonaBersagli,
  type PastoSulloSchermo,
  type Rettangolo,
} from "./decisioneTrascinamento";
import { SCADENZA_BLOCCO_CLICK_MS } from "./decisioneSwipe";
import { movimentoRidotto } from "./movimentoRidotto";
import type { AscoltatoriTrascinamento, RigaPremuta } from "./tieniPremuto";

export const DURATA_RITORNO_COPIA_MS = 200;

export interface Trascinamento {
  riga: { tipo: RigaPremuta["tipo"]; id: string };
  pastoPartenzaId: string | null;
  // Dove disegnare la copia all'inizio: sopra la riga vera.
  rettangolo: { top: number; left: number; width: number };
}

interface Opzioni {
  // La lista dei pasti: ogni pasto è un elemento con data-pasto-id.
  rifLista: RefObject<HTMLElement | null>;
  // La fascia in basso con "+ Aggiungi" (e la pillola sotto): da lì in giù
  // non c'è nessun bersaglio.
  rifFasciaAggiungi: RefObject<HTMLElement | null>;
  // Il pasto da cui parte la riga (per escluderlo dai bersagli).
  pastoDi: (riga: RigaPremuta) => string | null;
  onRilascio: (riga: RigaPremuta, pastoDestinazioneId: string) => void;
}

function rettangolo(el: Element): Rettangolo {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}

// Ferma UN click nei prossimi SCADENZA_BLOCCO_CLICK_MS, ovunque nella
// pagina (fase di capture su window). Poi si toglie da solo.
function bloccaClickFantasma() {
  function suClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    togli();
  }
  function togli() {
    window.removeEventListener("click", suClick, true);
    clearTimeout(timer);
  }
  window.addEventListener("click", suClick, true);
  const timer = setTimeout(togli, SCADENZA_BLOCCO_CLICK_MS);
}

export function useTrascinaInPasto({ rifLista, rifFasciaAggiungi, pastoDi, onRilascio }: Opzioni) {
  const [trascinamento, setTrascinamento] = useState<Trascinamento | null>(null);
  const [bersaglio, setBersaglio] = useState<string | null>(null);

  // Tutto quello che cambia a ogni movimento sta in ref, non nello stato.
  const rifCopia = useRef<HTMLElement | null>(null);
  const rifCorrente = useRef<{
    lista: HTMLElement;
    origine: { x: number; y: number };
    // I pasti come erano all'inizio, con lo scrollTop di allora.
    pasti: PastoSulloSchermo[];
    scrollIniziale: number;
    zona: Rettangolo;
    partenza: string | null;
    // Dove è il dito, e lo spostamento della copia.
    x: number;
    y: number;
    dx: number;
    dy: number;
    bersaglio: string | null;
    // Scorrimento automatico: il fotogramma prenotato, il tempo del
    // precedente, e lo scrollTop con i decimali (il browser lo arrotonda:
    // a bassa velocità un passo sotto il pixel si perderebbe ogni volta).
    fotogramma: number | null;
    tempoPrecedente: number | null;
    scrollPreciso: number;
  } | null>(null);
  // Le opzioni più recenti (le funzioni della pagina cambiano a ogni render).
  const rifOpzioni = useRef({ pastoDi, onRilascio });
  useEffect(() => {
    rifOpzioni.current = { pastoDi, onRilascio };
  });

  function scriviPosizione() {
    const c = rifCorrente.current;
    if (c && rifCopia.current) rifCopia.current.style.transform = `translate(${c.dx}px, ${c.dy}px)`;
  }

  // Ref callback della copia: appena compare, la porta dove è già il dito.
  function rifElementoCopia(el: HTMLElement | null) {
    rifCopia.current = el;
    scriviPosizione();
  }

  function fermaScorrimento() {
    const c = rifCorrente.current;
    if (c?.fotogramma != null) cancelAnimationFrame(c.fotogramma);
    if (c) c.fotogramma = null;
  }

  // Quanto ha scorso la lista dall'inizio del trascinamento.
  function scorso(c: NonNullable<typeof rifCorrente.current>): number {
    return c.lista.scrollTop - c.scrollIniziale;
  }

  function aggiornaBersaglio() {
    const c = rifCorrente.current;
    if (!c) return;
    const sotto = bersaglioSotto(
      c.x,
      c.y,
      pastiDopoScorrimento(c.pasti, scorso(c)),
      c.partenza,
      c.zona,
    );
    if (sotto !== c.bersaglio) {
      c.bersaglio = sotto;
      setBersaglio(sotto);
    }
  }

  // Un fotogramma dello scorrimento automatico.
  function passoScorrimento(tempo: number) {
    const c = rifCorrente.current;
    if (!c) return;
    c.fotogramma = null;
    const velocita = velocitaScorrimento(c.y, c.zona);
    if (velocita === 0) return; // il dito è uscito dalla fascia
    const dt = c.tempoPrecedente === null ? 16 : tempo - c.tempoPrecedente;
    c.tempoPrecedente = tempo;
    const massimo = c.lista.scrollHeight - c.lista.clientHeight;
    const nuovo = prossimoScrollTop(c.scrollPreciso, velocita, dt, Math.max(0, massimo));
    if (nuovo === c.scrollPreciso) return; // fine corsa
    c.scrollPreciso = nuovo;
    c.lista.scrollTop = nuovo;
    aggiornaBersaglio();
    c.fotogramma = requestAnimationFrame(passoScorrimento);
  }

  function avviaScorrimento() {
    const c = rifCorrente.current;
    if (!c || c.fotogramma !== null || velocitaScorrimento(c.y, c.zona) === 0) return;
    c.tempoPrecedente = null;
    c.scrollPreciso = c.lista.scrollTop;
    c.fotogramma = requestAnimationFrame(passoScorrimento);
  }

  function chiudi() {
    fermaScorrimento();
    rifCorrente.current = null;
    setTrascinamento(null);
    setBersaglio(null);
  }

  function inizio(...[riga, origine, x, y]: Parameters<AscoltatoriTrascinamento["inizio"]>) {
    const lista = rifLista.current;
    if (!lista) return;
    // I pasti si misurano una volta: il dito non fa scorrere la lista
    // (overflow hidden e touchmove bloccati dal gesto), e quando la fa
    // scorrere lo scorrimento automatico si sa di quanto.
    const pasti = [...lista.querySelectorAll<HTMLElement>("[data-pasto-id]")].map((el) => ({
      id: el.dataset.pastoId!,
      rettangolo: rettangolo(el),
    }));
    const limiteBasso =
      rifFasciaAggiungi.current?.getBoundingClientRect().top ?? window.innerHeight;
    const partenza = rifOpzioni.current.pastoDi(riga);
    const r = riga.elemento.getBoundingClientRect();
    rifCorrente.current = {
      lista,
      origine,
      pasti,
      scrollIniziale: lista.scrollTop,
      zona: zonaBersagli(rettangolo(lista), limiteBasso),
      partenza,
      x,
      y,
      dx: x - origine.x,
      dy: y - origine.y,
      bersaglio: null,
      fotogramma: null,
      tempoPrecedente: null,
      scrollPreciso: lista.scrollTop,
    };
    setTrascinamento({
      riga: { tipo: riga.tipo, id: riga.id },
      pastoPartenzaId: partenza,
      rettangolo: { top: r.top, left: r.left, width: r.width },
    });
    movimento(x, y);
  }

  function movimento(x: number, y: number) {
    const c = rifCorrente.current;
    if (!c) return;
    c.x = x;
    c.y = y;
    c.dx = x - c.origine.x;
    c.dy = y - c.origine.y;
    scriviPosizione();
    aggiornaBersaglio();
    avviaScorrimento();
  }

  function fine(...[riga, x, y, interrotto]: Parameters<AscoltatoriTrascinamento["fine"]>) {
    const c = rifCorrente.current;
    if (!c) return;
    fermaScorrimento();
    bloccaClickFantasma();
    const destinazione = interrotto
      ? null
      : bersaglioSotto(x, y, pastiDopoScorrimento(c.pasti, scorso(c)), c.partenza, c.zona);
    if (destinazione) {
      chiudi();
      rifOpzioni.current.onRilascio(riga, destinazione);
      return;
    }
    // Niente bersaglio: la copia torna verso la riga e sparisce. Se la
    // lista ha scorso, la riga sullo schermo si è spostata con lei.
    setBersaglio(null);
    const rientro = `translate(0px, ${-scorso(c)}px)`;
    const copia = rifCopia.current;
    if (!copia || movimentoRidotto() || typeof copia.animate !== "function") {
      chiudi();
      return;
    }
    copia.style.transform = rientro;
    copia
      .animate([{ transform: `translate(${c.dx}px, ${c.dy}px)` }, { transform: rientro }], {
        duration: DURATA_RITORNO_COPIA_MS,
        easing: "ease-out",
      })
      .finished.catch(() => {})
      .finally(chiudi);
  }

  const ascoltatori: AscoltatoriTrascinamento = { inizio, movimento, fine };
  return { trascinamento, bersaglio, rifElementoCopia, ascoltatori };
}
