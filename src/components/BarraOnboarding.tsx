// La barra in alto dell'onboarding, dal passo 2 (mockup
// docs/mockups/onboarding.html, stile B): a sinistra Indietro, al centro i
// cinque puntini, a destra "Dopo" (= "Lo faccio dopo").
//
// I puntini: quelli dei passi fatti pieni d'accento, quello del passo
// attuale d'accento e più lungo, gli altri del colore della linea. Per lo
// screen reader sono un'immagine sola, "Passo N di 5".
//
// L'allungamento si fa con `transform`, non animando la larghezza (che
// farebbe ricalcolare la disposizione di tutta la barra a ogni fotogramma):
// ogni puntino occupa sempre 8 px nella disposizione, quello attuale si
// allarga da sinistra (scaleX) fino a 22 px, e quelli dopo di lui scorrono
// di 14 px a destra (translateX). Il contenitore è già largo quanto la fila
// finale (4 × 8 + 22 + 4 × 6 = 78 px), quindi niente esce dai bordi. Con
// "riduci movimento" (prefers-reduced-motion) i puntini cambiano senza
// animazione: `motion-safe:` applica la transizione solo senza quella
// preferenza.

import { CLASSE_FOCUS } from "@/lib/classeFocus";

export const NUMERO_PASSI = 5;

const LARGO = 22;
const STRETTO = 8;
const SPAZIO = 6;

export default function BarraOnboarding({
  passo,
  onIndietro,
  onDopo,
}: {
  passo: number;
  onIndietro: () => void;
  onDopo: () => void;
}) {
  return (
    <div className="flex min-h-11 shrink-0 items-center justify-between">
      <button
        type="button"
        onClick={onIndietro}
        aria-label="Indietro"
        className={`flex size-[38px] items-center justify-center rounded-full border border-border bg-surface text-foreground ${CLASSE_FOCUS}`}
      >
        <svg width="9" height="15" viewBox="0 0 9 15" aria-hidden>
          <path
            d="M7.5 1.5 1.5 7.5l6 6"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        role="img"
        aria-label={`Passo ${passo} di ${NUMERO_PASSI}`}
        className="flex"
        style={{ gap: SPAZIO, width: (NUMERO_PASSI - 1) * (STRETTO + SPAZIO) + LARGO }}
      >
        {Array.from({ length: NUMERO_PASSI }, (_, i) => {
          const numero = i + 1;
          const attuale = numero === passo;
          const transform = attuale
            ? `scaleX(${LARGO / STRETTO})`
            : numero > passo
              ? `translateX(${LARGO - STRETTO}px)`
              : undefined;
          return (
            <span
              key={numero}
              data-puntino={attuale ? "attuale" : numero < passo ? "fatto" : "da-fare"}
              className={`h-2 w-2 shrink-0 origin-left rounded-full motion-safe:transition-transform motion-safe:duration-200 ${
                numero <= passo ? "bg-accent" : "bg-border"
              }`}
              style={{ transform }}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onDopo}
        className={`min-w-[38px] rounded text-right text-sm text-muted ${CLASSE_FOCUS}`}
      >
        Dopo
      </button>
    </div>
  );
}
