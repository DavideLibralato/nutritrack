"use client";

// Tastiera su iOS nelle pagine con la tab bar (layout "(app)"): con la
// tastiera aperta la tab bar e le barre in fondo (es. il Salva del Profilo)
// restano COPERTE, e il campo attivo viene portato in vista sopra la
// tastiera facendo scorrere l'area del contenuto. Chiusa la tastiera, tutto
// torna com'era.
//
// Perché serve. In quel layout l'area che scorre è un <div> interno e la
// pagina è alta esattamente 100dvh. iOS non accorcia il layout quando apre
// la tastiera (interactive-widget è ignorato): la tastiera copre la parte
// bassa. Se il campo toccato cade in quella parte, il <div> non ha niente da
// scorrere — per lui il campo è già visibile — e iOS sposta invece TUTTA la
// finestra (il "visual viewport", visualViewport.offsetTop > 0) fino al
// fondo del layout: tab bar e barra Salva comparivano sopra la tastiera,
// del campo restava una striscia. Se il campo era già più in alto, iOS non
// spostava niente e le barre restavano coperte: due comportamenti diversi a
// seconda di dove stava il campo (difetto visto su iPhone il 2026-09-26).
//
// Correzione: quando iOS sposta la finestra, la si riporta a zero e si fa
// scorrere il <div> quanto basta a mostrare il campo sopra la tastiera. In
// fondo al <div>, finché la tastiera è aperta, uno spazio alto quanto lei:
// così anche l'ultimo campo della pagina ha spazio per salire.
//
// NON tocca gli sheet (SheetNome, SheetQuantita, SheetCambioObiettivo): per
// decisione del 2026-09-24 stanno SOPRA la tastiera, agganciati al visual
// viewport con useAreaVisibile (src/lib/areaVisibile.ts). Un campo dentro un
// role="dialog" qui si ignora. Nemmeno /aggiungi è toccata: sta fuori da
// questo layout e il suo <main> è agganciato al visual viewport apposta.

import { useEffect, useState, type RefObject } from "react";

// Distanza fra il campo e il bordo della tastiera (o il bordo in alto).
const MARGINE = 16;

function apreTastiera(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement || el.isContentEditable) return true;
  if (el instanceof HTMLSelectElement) return false;
  if (!(el instanceof HTMLInputElement)) return false;
  // Pulsanti, caselle, date: niente tastiera di testo.
  return !["button", "submit", "reset", "checkbox", "radio", "date", "file", "range", "color"].includes(
    el.type
  );
}

// Restituisce lo spazio da aggiungere in fondo all'area (px): l'altezza della
// tastiera mentre un campo dell'area la tiene aperta, 0 altrimenti.
export function useCampoSopraTastiera(rifArea: RefObject<HTMLElement | null>): number {
  const [spazioTastiera, setSpazioTastiera] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    const area = rifArea.current;
    if (!vv || !area) return;
    const vista = vv;
    const contenitore = area;

    let fotogramma = 0;

    function correggi() {
      const attivo = document.activeElement;
      const campoNellArea =
        apreTastiera(attivo) &&
        contenitore.contains(attivo) &&
        !attivo.closest('[role="dialog"]');

      // Altezza della tastiera: quanto manca al visual viewport per
      // arrivare in fondo al layout.
      const tastiera = Math.max(0, Math.round(window.innerHeight - vista.height));
      if (!campoNellArea || tastiera === 0) {
        setSpazioTastiera(0);
        return;
      }
      setSpazioTastiera(tastiera);

      // 1. iOS ha spostato tutta la finestra: si rimette a zero, le barre in
      //    fondo tornano coperte dalla tastiera.
      if (vista.offsetTop > 0 || window.scrollY > 0) window.scrollTo(0, 0);

      // 2. Il campo sopra la tastiera, facendo scorrere solo l'area.
      const r = attivo.getBoundingClientRect();
      const limiteBasso = vista.height - MARGINE;
      const limiteAlto = contenitore.getBoundingClientRect().top + MARGINE;
      if (r.bottom > limiteBasso) {
        contenitore.scrollTop += r.bottom - limiteBasso;
      } else if (r.top < limiteAlto) {
        contenitore.scrollTop -= limiteAlto - r.top;
      }
    }

    // Una correzione per fotogramma: resize e scroll del visual viewport
    // arrivano a raffica mentre la tastiera si apre.
    function pianifica() {
      cancelAnimationFrame(fotogramma);
      fotogramma = requestAnimationFrame(correggi);
    }

    vista.addEventListener("resize", pianifica);
    vista.addEventListener("scroll", pianifica);
    // Da un campo all'altro con la tastiera già aperta: nessun resize, ma il
    // nuovo campo va comunque portato in vista.
    contenitore.addEventListener("focusin", pianifica);
    contenitore.addEventListener("focusout", pianifica);
    return () => {
      cancelAnimationFrame(fotogramma);
      vista.removeEventListener("resize", pianifica);
      vista.removeEventListener("scroll", pianifica);
      contenitore.removeEventListener("focusin", pianifica);
      contenitore.removeEventListener("focusout", pianifica);
    };
  }, [rifArea]);

  return spazioTastiera;
}
