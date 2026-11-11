// L'anello delle calorie della pagina Oggi: a sinistra della fascia alta,
// con il consumato grande al centro e l'obiettivo sotto ("1580 / 2200").
//
// Il testo al centro è HTML sovrapposto all'SVG, non un <text> dentro l'SVG:
// così eredita il font dell'app e si allinea con flexbox senza calcoli di
// baseline.
//
// Colore: la regola unica dei colori (PUNTO_DI_PARTENZA.md §7, "La regola
// dei colori"; esitoRispettoObiettivo), la stessa delle barre di
// Statistiche. Con Dimagrire le kcal sono un tetto: colore principale fino
// all'obiettivo, arancio da 1 kcal sopra (come l'anello faceva già). Con
// Massa e Mantenere: neutro sotto la fascia, colore principale dentro,
// arancio sopra. Fino all'11/11 l'anello era verde fino all'obiettivo con
// qualunque obiettivo. Cambia solo il colore: i numeri restano gli stessi.

import { esitoRispettoObiettivo, type Tono } from "@/lib/esitoObiettivo";
import type { TipoObiettivo } from "@/lib/db/tipi";

interface Props {
  consumate: number;
  obiettivo: number | null;
  // Il tipo di obiettivo del giorno mostrato (targetDelGiorno).
  tipoObiettivo: TipoObiettivo | null;
}

const DIMENSIONE = 132;
const SPESSORE = 13;

const STROKE_TONO: Record<Tono, string> = {
  buono: "stroke-accent",
  oltre: "stroke-warning",
  neutro: "stroke-neutral",
};

export default function AnelloCalorie({ consumate, obiettivo, tipoObiettivo }: Props) {
  const raggio = (DIMENSIONE - SPESSORE) / 2;
  const circonferenza = 2 * Math.PI * raggio;
  const centro = DIMENSIONE / 2;

  const frazione =
    obiettivo != null && obiettivo > 0 ? Math.min(consumate / obiettivo, 1) : 0;
  const esito = esitoRispettoObiettivo(consumate, obiettivo, "kcal", tipoObiettivo);

  return (
    <div
      className="relative shrink-0"
      style={{ width: DIMENSIONE, height: DIMENSIONE }}
    >
      <svg
        width={DIMENSIONE}
        height={DIMENSIONE}
        viewBox={`0 0 ${DIMENSIONE} ${DIMENSIONE}`}
        aria-hidden
      >
        <circle
          cx={centro}
          cy={centro}
          r={raggio}
          fill="none"
          strokeWidth={SPESSORE}
          className="stroke-border"
        />
        <circle
          cx={centro}
          cy={centro}
          r={raggio}
          fill="none"
          strokeWidth={SPESSORE}
          strokeLinecap="round"
          strokeDasharray={`${frazione * circonferenza} ${circonferenza}`}
          transform={`rotate(-90 ${centro} ${centro})`}
          className={STROKE_TONO[esito?.tono ?? "neutro"]}
          data-segno="arco-calorie"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold leading-none">
          {Math.round(consumate)}
        </span>
        <span className="mt-1 text-sm text-muted">
          {obiettivo != null ? `/ ${obiettivo}` : "/ —"}
        </span>
      </div>
    </div>
  );
}
