// L'anello delle calorie della pagina Oggi: a sinistra della fascia alta,
// con il consumato grande al centro e l'obiettivo sotto ("1580 / 2200").
//
// Il testo al centro è HTML sovrapposto all'SVG, non un <text> dentro l'SVG:
// così eredita il font dell'app e si allinea con flexbox senza calcoli di
// baseline.
//
// Colore (sezione 7 di PUNTO_DI_PARTENZA.md): l'anello è verde finché si
// resta entro l'obiettivo, arancio quando lo si supera — "verde = stai
// andando come volevi, arancio = hai superato". Va scritto così nel codice.

interface Props {
  consumate: number;
  obiettivo: number | null;
}

const DIMENSIONE = 132;
const SPESSORE = 13;

export default function AnelloCalorie({ consumate, obiettivo }: Props) {
  const raggio = (DIMENSIONE - SPESSORE) / 2;
  const circonferenza = 2 * Math.PI * raggio;
  const centro = DIMENSIONE / 2;

  const frazione =
    obiettivo != null && obiettivo > 0 ? Math.min(consumate / obiettivo, 1) : 0;
  const superato = obiettivo != null && Math.round(consumate) > obiettivo;

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
          className={superato ? "stroke-warning" : "stroke-accent"}
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
