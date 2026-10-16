"use client";

// La riga "N alimenti in arrivo" in cima a Impostazioni > Alimenti
// (PUNTO_DI_PARTENZA.md §3 "Amici", "Condividere un alimento"; mockup
// docs/mockups/alimenti-in-arrivo.html, proposta B). Sotto il titolo chi li
// manda ("Da @sara_c", "Da @sara_c e @paolo_a", "Da 3 amici"), a destra il
// pallino nel colore principale e la freccia. Il tocco apre il foglio.
// La pagina la mostra solo online e solo con almeno un alimento in arrivo.

import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { sottotitoloMittenti, titoloRigaInArrivo } from "@/lib/catalogo/testiAlimentiInArrivo";

interface Props {
  numero: number;
  mittenti: (string | null)[];
  onApri: () => void;
}

export default function RigaAlimentiInArrivo({ numero, mittenti, onApri }: Props) {
  return (
    <button
      type="button"
      onClick={onApri}
      className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3 text-left ${CLASSE_FOCUS}`}
    >
      <span
        aria-hidden
        className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--capsula-attiva)] text-[var(--testo-capsula)]"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13h10" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{titoloRigaInArrivo(numero)}</span>
        <span className="mt-0.5 truncate text-sm text-muted">{sottotitoloMittenti(mittenti)}</span>
      </span>
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-accent" />
      <svg
        aria-hidden
        width="8"
        height="13"
        viewBox="0 0 8 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="shrink-0 text-muted"
      >
        <path d="M1.5 1.5l5 5-5 5" />
      </svg>
    </button>
  );
}
