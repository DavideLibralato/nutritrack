// Una riga macro della fascia alta di Oggi: nome a sinistra, "valore / target
// g" a destra, barra di avanzamento sotto. Tre di queste affiancate
// all'anello (Grassi, Carboidrati, Proteine).
//
// Colore della barra: la regola unica dei colori (PUNTO_DI_PARTENZA.md §7,
// "La regola dei colori"; esitoRispettoObiettivo), con la fascia anche con
// Dimagrire: neutro sotto la fascia, colore principale dentro, arancio
// sopra. Fino all'11/11 la regola era "accento solo se esattamente uguale
// al target, arancio da 1 g sopra": 151 g di proteine su 150 era arancio,
// ora è in linea. Il neutro è il grigio caldo --neutro di tutta l'app (prima
// il colore del testo). Cambia solo il colore: i numeri restano gli stessi.

import { esitoRispettoObiettivo, type Grandezza, type Tono } from "@/lib/esitoObiettivo";
import type { TipoObiettivo } from "@/lib/db/tipi";

interface Props {
  nome: string;
  grandezza: Exclude<Grandezza, "kcal">;
  valore: number;
  obiettivo: number | null;
  // Il tipo di obiettivo del giorno mostrato (targetDelGiorno).
  tipoObiettivo: TipoObiettivo | null;
}

const BG_TONO: Record<Tono, string> = {
  buono: "bg-accent",
  oltre: "bg-warning",
  neutro: "bg-neutral",
};

export default function BarraMacro({ nome, grandezza, valore, obiettivo, tipoObiettivo }: Props) {
  const valoreArr = Math.round(valore);
  const target = obiettivo != null ? Math.round(obiettivo) : null;

  const frazione = target && target > 0 ? Math.min(valoreArr / target, 1) : 0;
  const esito = esitoRispettoObiettivo(valore, obiettivo, grandezza, tipoObiettivo);

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span>{nome}</span>
        <span>{target != null ? `${valoreArr} / ${target} g` : `${valoreArr} g`}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full ${BG_TONO[esito?.tono ?? "neutro"]}`}
          style={{ width: `${frazione * 100}%` }}
          data-segno={`barra-${grandezza}`}
        />
      </div>
    </div>
  );
}
