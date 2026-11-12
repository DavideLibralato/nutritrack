"use client";

// Alla chiusura di una schermata a tutto schermo, l'elenco della pagina
// torna al punto dove era arrivato lo scorrimento (PUNTO_DI_PARTENZA.md §3,
// "Alimenti"). Lo usano Impostazioni > Alimenti (il modulo) e Preferiti (il
// pasto salvato).
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

import { useLayoutEffect, useRef } from "react";

// Per quanti ridisegni dopo il recupero si ricontrolla: circa un sesto di
// secondo a 60 Hz. Valore scelto a occhio, da rivedere se sull'iPhone non
// basta.
export const RIDISEGNI_DI_CONTROLLO = 10;

const GESTI_UTENTE = ["touchstart", "pointerdown", "wheel", "keydown"] as const;

// `aperto`: vero mentre la schermata copre la pagina e l'elenco non è
// disegnato. Se resta sempre falso non succede niente.
export function useRitornoScorrimento(aperto: boolean) {
  // L'ultimo punto annotato mentre l'elenco era a schermo.
  const ultimo = useRef(0);
  // Il punto da rimettere alla chiusura; null = niente da rimettere.
  const daRimettere = useRef<number | null>(null);

  // Annota lo scorrimento solo a schermata chiusa. La pulizia gira
  // nell'aggiornamento stesso in cui la schermata si apre, prima che il
  // browser mandi lo "scroll" dell'accorciamento.
  useLayoutEffect(() => {
    if (aperto) return;
    const annota = () => {
      ultimo.current = window.scrollY;
    };
    window.addEventListener("scroll", annota, { passive: true });
    return () => window.removeEventListener("scroll", annota);
  }, [aperto]);

  useLayoutEffect(() => {
    if (aperto) {
      daRimettere.current = ultimo.current;
      return;
    }
    const punto = daRimettere.current;
    if (punto === null) return;
    daRimettere.current = null;
    window.scrollTo(0, punto);

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
      if (Math.abs(window.scrollY - punto) > 1) window.scrollTo(0, punto);
      ridisegni++;
      if (ridisegni < RIDISEGNI_DI_CONTROLLO) richiesta = requestAnimationFrame(controlla);
      else pulisci();
    };
    GESTI_UTENTE.forEach((g) => window.addEventListener(g, ferma, { passive: true }));
    richiesta = requestAnimationFrame(controlla);
    return pulisci;
  }, [aperto]);
}
