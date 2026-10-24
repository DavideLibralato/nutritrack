"use client";

// L'animazione di apertura di Oggi (PUNTO_DI_PARTENZA.md §7, "Animazione di
// apertura"): uno strato a tutto schermo con la bilancia che si mette in
// equilibrio, sopra la pagina. Come si muove sta tutto in globals.css
// (.animazione-apertura e seguenti); qui c'è solo quando c'è e quando se ne
// va.
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
// Quando se ne va (regola A, uscitaApertura): al più tardi fra "oscillazione
// finita" (l'animazione CSS apertura-minimo, 700 ms) e "Oggi pronta" →
// dissolvenza di 150 ms (data-esce), poi lo strato si toglie dalla pagina.
// Dopo 3 s comunque (solo CSS, funziona anche senza JavaScript).
// Finché è pieno blocca i tocchi (copre la pagina); durante l'uscita no.
//
// Dove sta: Oggi (aspetta i dati, attende="oggi") e Accedi (niente da
// aspettare, attende="niente": oscillazione intera, poi via). In tutte e due
// prima del <Suspense> della pagina.

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

export default function AnimazioneApertura({ attende }: { attende: "oggi" | "niente" }) {
  // Al primo disegno nel browser (idratazione) vale true, come sul server:
  // stesso HTML, quindi React tiene l'elemento. Cambiando scheda vale false
  // e lo strato non esiste.
  const [presente, setPresente] = useState(() => !aperturaGiaPassata());
  const [esce, setEsce] = useState(false);
  const strato = useRef<HTMLDivElement>(null);

  useEffect(() => {
    segnaAperturaPassata();
    let attivo = true;
    let minimoFinito = false;
    // Su Accedi non c'è niente da aspettare: conta solo il minimo.
    let oggiPronta = attende === "niente";

    function decidi() {
      if (!attivo) return;
      const mostrata =
        document.documentElement.getAttribute(ATTRIBUTO_APERTURA) === "mostra";
      const esito = uscitaApertura(mostrata, minimoFinito, oggiPronta);
      if (esito === "togli") setPresente(false);
      else if (esito === "sfuma") setEsce(true);
    }

    // L'oscillazione intera. Non si ascolta l'evento di fine: se il
    // JavaScript arriva dopo 700 ms (succede, all'apertura) l'evento è già
    // passato e non tornerebbe più. Si chiede invece al browser
    // l'animazione stessa: se c'è, si aspetta la sua fine (`finished`); se
    // non c'è più (già finita) o lo strato è nascosto (nessuna animazione),
    // il minimo è passato. Senza getAnimations (iOS prima del 13.1) si
    // considera passato: si esce quando Oggi è pronta, come prima.
    const minimo = strato.current
      ?.getAnimations?.()
      .find((a) => (a as CSSAnimation).animationName === "apertura-minimo");
    if (minimo && minimo.playState !== "finished") {
      minimo.finished.then(
        () => {
          minimoFinito = true;
          decidi();
        },
        () => {}
      );
    } else {
      minimoFinito = true;
    }

    // Su Accedi nessun ascolto: il segnale di Oggi non lo riguarda. Si
    // decide subito: se il minimo è già passato (JavaScript arrivato
    // tardi) esce, altrimenti aspetta `finished` qui sopra.
    let smetti = () => {};
    if (attende === "oggi") {
      smetti = quandoOggiPronta(() => {
        oggiPronta = true;
        decidi();
      });
    } else {
      decidi();
    }
    return () => {
      attivo = false;
      smetti();
    };
  }, [attende]);

  // Fine dell'uscita o della rete di sicurezza: lo strato si toglie dalla
  // pagina. Gli altri nomi (la bilancia, il minimo) non contano.
  function fineAnimazione(e: AnimationEvent<HTMLDivElement>) {
    if (e.animationName === "apertura-uscita" || e.animationName === "apertura-sicurezza") {
      setPresente(false);
    }
  }

  if (!presente) return null;

  return (
    <div
      ref={strato}
      className="animazione-apertura"
      aria-hidden="true"
      data-esce={esce ? "" : undefined}
      onAnimationEnd={fineAnimazione}
    >
      <div className="animazione-apertura-fondo">
        <svg viewBox={VIEWBOX_BILANCIA} className="animazione-apertura-bilancia">
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
    </div>
  );
}
