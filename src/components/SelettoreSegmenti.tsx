// Un selettore a segmenti come quelli dell'iPhone (mockup
// docs/mockups/impostazioni.html, "Normale | Allenamento"): due o tre scelte
// affiancate in una capsula grigia, quella attiva su una pastiglia più
// chiara (--segmento-attivo: bianca in chiaro, marrone chiaro al buio).
// Lo usano Obiettivi (Normale | Allenamento) e Profilo (il sesso).
//
// Ogni segmento è un bottone con aria-pressed, come i pulsanti di scelta di
// prima. `pallino`: un puntino d'accento accanto all'etichetta, per dire che
// in quella scheda ci sono modifiche non salvate.

import { CLASSE_FOCUS } from "@/lib/classeFocus";

export interface Segmento<T extends string> {
  valore: T;
  etichetta: string;
  // Nome completo per lo screen reader, se l'etichetta è abbreviata.
  etichettaAccessibile?: string;
  pallino?: boolean;
}

export default function SelettoreSegmenti<T extends string>({
  segmenti,
  valore,
  onCambia,
  etichetta,
}: {
  segmenti: Segmento<T>[];
  valore: T;
  onCambia: (valore: T) => void;
  // Cosa si sceglie, per lo screen reader ("Tipo di giorno", "Sesso").
  etichetta: string;
}) {
  return (
    <div
      role="group"
      aria-label={etichetta}
      className="flex w-full rounded-xl bg-[color-mix(in_srgb,var(--linea)_70%,transparent)] p-[3px]"
    >
      {segmenti.map((s) => {
        const attivo = s.valore === valore;
        return (
          <button
            key={s.valore}
            type="button"
            aria-pressed={attivo}
            aria-label={s.etichettaAccessibile}
            onClick={() => onCambia(s.valore)}
            style={attivo ? { boxShadow: "var(--ombra-fluttuante)" } : undefined}
            className={`flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[15px] font-medium ${
              attivo ? "bg-[var(--segmento-attivo)] text-foreground" : "text-muted"
            } ${CLASSE_FOCUS}`}
          >
            {s.etichetta}
            {s.pallino && (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
            )}
            {s.pallino && <span className="sr-only">(modificato)</span>}
          </button>
        );
      })}
    </div>
  );
}
