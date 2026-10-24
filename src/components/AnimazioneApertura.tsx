"use client";

// L'animazione di apertura di Oggi (PUNTO_DI_PARTENZA.md §7, "Animazione di
// apertura"): uno strato a tutto schermo con la bilancia che si mette in
// equilibrio, sopra la pagina, che se ne va appena Oggi ha i dati. Come si
// muove sta tutto in globals.css (.animazione-apertura e seguenti); qui c'è
// solo quando c'è e quando se ne va.
//
// Perché fuori dal <Suspense> di Oggi e non nel suo fallback: nell'HTML del
// server il fallback è marcato come "da rifare nel browser", e quando React
// prende in mano la pagina (idratazione) lo butta e lo rifà; l'animazione
// ripartirebbe da capo. Fuori, React trova lo stesso HTML che disegnerebbe
// lui e tiene l'elemento com'è: l'animazione CSS, partita col primo disegno,
// continua senza interruzioni.
//
// Quando c'è (src/lib/animazioneApertura.ts):
// - lo script in <head> decide prima del primo disegno; senza
//   data-apertura="mostra" il CSS tiene lo strato nascosto;
// - tornando su Oggi da un'altra scheda (senza ricaricare) lo strato non si
//   disegna proprio: aperturaGiaPassata() è già vera.
//
// Quando se ne va:
// - Oggi pronta → dissolvenza di 150 ms (data-esce), poi lo strato si toglie
//   dalla pagina; se la bilancia non si era ancora vista, via subito;
// - dopo 3 s comunque (solo CSS, funziona anche senza JavaScript).
// La regola A: non aggiunge mai attesa, e non blocca i tocchi
// (pointer-events: none).

import { useEffect, useRef, useState, type AnimationEvent } from "react";
import {
  ATTRIBUTO_APERTURA,
  aperturaGiaPassata,
  quandoOggiPronta,
  segnaAperturaPassata,
  uscitaApertura,
} from "@/lib/animazioneApertura";
import {
  ASTA,
  BASE,
  FILI_DESTRA,
  FILI_SINISTRA,
  GIOGO,
  PERNO,
  PIATTO_DESTRA,
  PIATTO_SINISTRA,
  SPESSORE_ASTA,
  SPESSORE_BASE,
  SPESSORE_FILI,
  SPESSORE_GIOGO,
  VIEWBOX_BILANCIA,
} from "@/lib/glifoBilancia";

export default function AnimazioneApertura() {
  // Al primo disegno nel browser (idratazione) vale true, come sul server:
  // stesso HTML, quindi React tiene l'elemento. Cambiando scheda vale false
  // e lo strato non esiste.
  const [presente, setPresente] = useState(() => !aperturaGiaPassata());
  const [esce, setEsce] = useState(false);
  const bilancia = useRef<SVGSVGElement>(null);

  useEffect(() => {
    segnaAperturaPassata();
    return quandoOggiPronta(() => {
      const mostrata =
        document.documentElement.getAttribute(ATTRIBUTO_APERTURA) === "mostra";
      // A che punto è la comparsa della bilancia. Con "riduci movimento"
      // non c'è nessuna animazione (null: si sfuma).
      const comparsa = bilancia.current?.getAnimations?.()[0];
      const tempo = typeof comparsa?.currentTime === "number" ? comparsa.currentTime : null;
      if (uscitaApertura(mostrata, tempo) === "togli") setPresente(false);
      else setEsce(true);
    });
  }, []);

  // Fine di una delle due dissolvenze dello strato (non delle animazioni
  // della bilancia, che arrivano qui risalendo dai figli).
  function fineAnimazione(e: AnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (e.animationName === "apertura-uscita" || e.animationName === "apertura-sicurezza") {
      setPresente(false);
    }
  }

  if (!presente) return null;

  return (
    <div
      className="animazione-apertura"
      aria-hidden="true"
      data-esce={esce ? "" : undefined}
      onAnimationEnd={fineAnimazione}
    >
      <svg ref={bilancia} viewBox={VIEWBOX_BILANCIA} className="animazione-apertura-bilancia">
        <g fill="currentColor" stroke="currentColor" strokeLinecap="round">
          {/* Fermi: asta e base. */}
          <path d={ASTA} strokeWidth={SPESSORE_ASTA} fill="none" />
          <path d={BASE} strokeWidth={SPESSORE_BASE} fill="none" />
          {/* I piatti salgono e scendono restando dritti. */}
          <g className="apertura-piatto-sinistra">
            <path d={FILI_SINISTRA} strokeWidth={SPESSORE_FILI} fill="none" />
            <path d={PIATTO_SINISTRA} stroke="none" />
          </g>
          <g className="apertura-piatto-destra">
            <path d={FILI_DESTRA} strokeWidth={SPESSORE_FILI} fill="none" />
            <path d={PIATTO_DESTRA} stroke="none" />
          </g>
          {/* Il giogo ruota attorno al fulcro, sopra i fili come nell'icona. */}
          <g className="apertura-giogo">
            <path d={GIOGO} strokeWidth={SPESSORE_GIOGO} fill="none" />
          </g>
          <circle {...PERNO} stroke="none" />
        </g>
      </svg>
    </div>
  );
}
