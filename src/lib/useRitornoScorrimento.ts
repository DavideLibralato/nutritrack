"use client";

// Alla chiusura di una schermata a tutto schermo, l'elenco della pagina
// torna al punto dove era arrivato lo scorrimento (PUNTO_DI_PARTENZA.md §3,
// "Alimenti"). Lo usano Impostazioni > Alimenti (il modulo), Preferiti (il
// pasto salvato) e Aggiungi («Crea alimento a mano» e la matita, con
// `zona`).
//
// Perché serve. Con la schermata aperta la pagina non disegna l'elenco
// sotto (il rimedio al problema di scorrimento di iOS dell'11/10, PUNTO
// §3): il documento diventa alto quanto lo schermo e lo scorrimento va per
// forza a 0. Alla chiusura l'elenco ricompare e va riportato dov'era.
//
// Il difetto (12/11): il recupero di prima, un solo window.scrollTo dopo
// la chiusura, funzionava in Safari ma NON nell'app installata su iPhone,
// dove l'elenco ripartiva dall'inizio. Il meccanismo esatto di iOS non è
// verificato: o il valore letto al tocco era già 0, o qualcosa rimetteva
// lo scorrimento a 0 subito dopo il recupero. Questo hook regge tutti e due
// i casi:
// - il punto non si legge al tocco ma si annota a ogni scorrimento
//   (evento "scroll") mentre l'elenco è a schermo; all'apertura si smette
//   di annotare PRIMA che il documento si accorci (useLayoutEffect), così
//   lo 0 di quel momento non sovrascrive il punto buono;
// - alla chiusura si rimette il punto prima che lo schermo si ridisegni
//   (useLayoutEffect: niente lampo dell'elenco in cima), e per qualche
//   ridisegno dopo si ricontrolla: se qualcosa l'ha spostato, si rimette;
// - il ricontrollo si ferma al primo tocco, rotella o tasto dell'utente:
//   non si combatte con il dito.
//
// Tutte le strade di chiusura (freccia, swipe, Salva, Crea, Elimina)
// passano da qui: l'hook guarda solo `aperto` che torna falso.
//
// `zona` (facoltativa): l'elemento che scorre, quando non è il documento.
// In Aggiungi scorre solo la zona sotto la ricerca, e con «Crea alimento a
// mano» aperto il modulo prende il suo posto: alla chiusura la zona è un
// elemento NUOVO, con lo scorrimento a 0. Con `zona` il punto si annota
// dall'evento "scroll" dell'elemento (che non arriva a window) e si
// rimette nel suo scrollTop, sull'elemento che c'è alla chiusura. L'ascolto
// segue l'elemento: si ricontrolla a ogni ridisegno, e si toglie da quello
// su cui era stato messo anche se il riferimento punta già altrove.

import { useLayoutEffect, useRef, type RefObject } from "react";

// Per quanti ridisegni dopo il recupero si ricontrolla: circa un sesto di
// secondo a 60 Hz. Valore scelto a occhio, da rivedere se sull'iPhone non
// basta.
export const RIDISEGNI_DI_CONTROLLO = 10;

const GESTI_UTENTE = ["touchstart", "pointerdown", "wheel", "keydown"] as const;

// Dove si legge e si scrive lo scorrimento: il documento, o un elemento.
interface Scorrevole {
  bersaglio: Window | HTMLElement;
  leggi: () => number;
  scrivi: (y: number) => void;
}

function scorrevole(elemento: HTMLElement | null | undefined): Scorrevole | null {
  if (elemento === undefined) {
    return {
      bersaglio: window,
      leggi: () => window.scrollY,
      scrivi: (y) => window.scrollTo(0, y),
    };
  }
  if (elemento === null) return null;
  return {
    bersaglio: elemento,
    leggi: () => elemento.scrollTop,
    scrivi: (y) => {
      elemento.scrollTop = y;
    },
  };
}

// `aperto`: vero mentre la schermata copre la pagina e l'elenco non è
// disegnato. Se resta sempre falso non succede niente. `zona`: vedi sopra;
// senza, scorre il documento.
export function useRitornoScorrimento(aperto: boolean, zona?: RefObject<HTMLElement | null>) {
  // L'ultimo punto annotato mentre l'elenco era a schermo.
  const ultimo = useRef(0);
  // Il punto da rimettere alla chiusura; null = niente da rimettere.
  const daRimettere = useRef<number | null>(null);

  // Annota lo scorrimento solo a schermata chiusa, su quello che scorre
  // adesso. Si ricontrolla a ogni ridisegno, perché la zona può arrivare
  // dopo (Aggiungi si apre con «Caricamento...», senza la zona) o
  // rinascere: se è cambiata, l'ascolto si sposta. All'apertura si toglie
  // nell'aggiornamento stesso, prima che il browser mandi lo "scroll"
  // dell'accorciamento.
  const ascolto = useRef<{ bersaglio: Window | HTMLElement; annota: () => void } | null>(null);
  useLayoutEffect(() => {
    const s = aperto ? null : scorrevole(zona ? zona.current : undefined);
    const bersaglio = s ? s.bersaglio : null;
    if ((ascolto.current?.bersaglio ?? null) === bersaglio) return;
    if (ascolto.current) {
      ascolto.current.bersaglio.removeEventListener("scroll", ascolto.current.annota);
      ascolto.current = null;
    }
    if (!s) return;
    const annota = () => {
      ultimo.current = s.leggi();
    };
    s.bersaglio.addEventListener("scroll", annota, { passive: true });
    ascolto.current = { bersaglio: s.bersaglio, annota };
  });
  useLayoutEffect(
    () => () => {
      if (ascolto.current) {
        ascolto.current.bersaglio.removeEventListener("scroll", ascolto.current.annota);
        ascolto.current = null;
      }
    },
    []
  );

  useLayoutEffect(() => {
    if (aperto) {
      daRimettere.current = ultimo.current;
      return;
    }
    const punto = daRimettere.current;
    if (punto === null) return;
    daRimettere.current = null;
    // Alla chiusura: l'elemento che c'è adesso (in Aggiungi, quello nuovo).
    const s = scorrevole(zona ? zona.current : undefined);
    if (!s) return;
    s.scrivi(punto);

    let fermo = false;
    let ridisegni = 0;
    let richiesta = 0;
    const ferma = () => {
      fermo = true;
    };
    const pulisci = () => {
      cancelAnimationFrame(richiesta);
      GESTI_UTENTE.forEach((g) => window.removeEventListener(g, ferma));
    };
    const controlla = () => {
      if (fermo) return pulisci();
      if (Math.abs(s.leggi() - punto) > 1) s.scrivi(punto);
      ridisegni++;
      if (ridisegni < RIDISEGNI_DI_CONTROLLO) richiesta = requestAnimationFrame(controlla);
      else pulisci();
    };
    GESTI_UTENTE.forEach((g) => window.addEventListener(g, ferma, { passive: true }));
    richiesta = requestAnimationFrame(controlla);
    return pulisci;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto]);
}
