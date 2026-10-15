"use client";

// Una riga di Impostazioni > Alimenti (PUNTO_DI_PARTENZA.md, sezione 3,
// "Alimenti"; mockup docs/mockups/catalogo-alimenti.html): il nome, con la
// marca se c'è ("Yogurt · Fage", per distinguere due omonimi), e sotto le
// kcal per 100 g. Il numero di usi non si mostra: serve solo a ordinare.
//
// Il tocco lo decide la pagina (`onTocco`): fuori dalla selezione apre
// "Modifica alimento", in selezione spunta o toglie la spunta. Il tieni
// premuto lo gestisce l'hook sulla lista (useTieniPremuto), che riconosce
// la riga da data-tieni-premuto="alimento" e data-id; la classe
// riga-tieni-premuto toglie il menu di selezione del testo di Safari e
// disegna la riga sollevata (globals.css), come in Oggi.

import type { Alimento } from "@/lib/db/tipi";
import { etichettaAlimento } from "@/lib/repository/alimenti";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

interface Props {
  alimento: Alimento;
  // null fuori dalla selezione: niente cerchio. true/false in selezione.
  selezionato: boolean | null;
  onTocco: () => void;
}

export default function RigaAlimentoCatalogo({ alimento, selezionato, onTocco }: Props) {
  return (
    <li className="border-b border-border">
      <button
        type="button"
        onClick={onTocco}
        data-tieni-premuto="alimento"
        data-id={alimento.id}
        aria-pressed={selezionato ?? undefined}
        className={`riga-tieni-premuto flex w-full items-center gap-3 rounded-lg py-3.5 text-left ${CLASSE_FOCUS}`}
      >
        {selezionato !== null && <Spunta piena={selezionato} />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{etichettaAlimento(alimento)}</span>
          <span className="mt-0.5 text-sm text-muted">
            {Math.round(alimento.kcal_100g)} kcal / 100 g
          </span>
        </span>
      </button>
    </li>
  );
}

// Il cerchio della selezione: vuoto, o pieno nel colore principale con la
// spunta. Come nel mockup.
function Spunta({ piena }: { piena: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${
        piena ? "border-accent-strong bg-accent-strong text-on-strong" : "border-border"
      }`}
    >
      {piena && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </span>
  );
}
