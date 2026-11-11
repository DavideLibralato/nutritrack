"use client";

// Una riga della scheda «Catalogo» di Impostazioni > Alimenti
// (PUNTO_DI_PARTENZA.md §10.1; mockup docs/mockups/catalogo-precaricato.html,
// schermata 1): «Nome · Marca» (la marca in grigio), sotto «600 kcal /
// 100 g · 30 g», a destra «Aggiungi» oppure «Nei tuoi» con la spunta.
//
// Due bersagli separati, come le righe di Aggiungi: il testo apre la
// scheda dell'alimento, «Aggiungi» è un pulsante vero, alto 36 px con
// l'area di tocco allargata a 44. «Nei tuoi» non è un pulsante: la riga
// apre la scheda, e da lì «Apri».

import type { AlimentoCatalogo } from "@/lib/catalogo/catalogoPrecaricato";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IconaPiu from "@/components/IconaPiu";

export default function RigaCatalogoPrecaricato({
  voce,
  neiTuoi,
  inCorso,
  onApriScheda,
  onAggiungi,
}: {
  voce: AlimentoCatalogo;
  neiTuoi: boolean;
  inCorso: boolean;
  onApriScheda: () => void;
  onAggiungi: () => void;
}) {
  const etichetta = voce.marca ? `${voce.nome} · ${voce.marca}` : voce.nome;
  return (
    <li className="flex min-h-16 items-center gap-3 border-b border-border">
      <button
        type="button"
        onClick={onApriScheda}
        aria-label={`${etichetta}, ${Math.round(voce.kcal_100g)} kcal per 100 g${neiTuoi ? ", già nei tuoi" : ""}`}
        className={`flex min-w-0 flex-1 flex-col rounded-lg py-3 text-left ${CLASSE_FOCUS}`}
      >
        <span className={`truncate ${neiTuoi ? "text-muted" : ""}`}>
          {voce.nome}
          {voce.marca && <span className="text-muted"> · {voce.marca}</span>}
        </span>
        <span className="mt-0.5 text-sm tabular-nums text-muted">
          {Math.round(voce.kcal_100g)} kcal / 100 g · {voce.porzione_default_g} g
        </span>
      </button>
      {neiTuoi ? (
        <span className="flex h-9 shrink-0 items-center gap-1.5 px-1 text-sm text-muted">
          <svg
            className="text-accent"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Nei tuoi
        </span>
      ) : (
        // Il pulsante è alto 44 (il tocco), la capsula dentro 36 (il disegno).
        <button
          type="button"
          onClick={onAggiungi}
          disabled={inCorso}
          aria-label={`Aggiungi ${etichetta} ai tuoi alimenti`}
          className={`flex min-h-11 shrink-0 items-center rounded-full disabled:opacity-60 ${CLASSE_FOCUS}`}
        >
          <span className="flex h-9 items-center gap-1 rounded-full border border-accent pr-3 pl-2.5 text-sm font-semibold text-accent">
            <IconaPiu size={18} />
            Aggiungi
          </span>
        </button>
      )}
    </li>
  );
}
