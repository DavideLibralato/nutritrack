"use client";

// Una riga di Impostazioni > Alimenti (PUNTO_DI_PARTENZA.md, sezione 3,
// "Alimenti"; mockup docs/mockups/catalogo-alimenti.html): il nome, con la
// marca se c'è ("Yogurt · Fage", per distinguere due omonimi), e sotto le
// kcal per 100 g. Il numero di usi non si mostra: serve solo a ordinare.
// Il tocco apre "Modifica alimento".

import type { Alimento } from "@/lib/db/tipi";
import { etichettaAlimento } from "@/lib/repository/alimenti";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

interface Props {
  alimento: Alimento;
  onApri: () => void;
}

export default function RigaAlimentoCatalogo({ alimento, onApri }: Props) {
  return (
    <li className="border-b border-border">
      <button
        type="button"
        onClick={onApri}
        className={`flex w-full flex-col py-3.5 text-left ${CLASSE_FOCUS}`}
      >
        <span className="truncate">{etichettaAlimento(alimento)}</span>
        <span className="mt-0.5 text-sm text-muted">
          {Math.round(alimento.kcal_100g)} kcal / 100 g
        </span>
      </button>
    </li>
  );
}
