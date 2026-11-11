"use client";

// Il riquadro «Nel catalogo» di Aggiungi (PUNTO_DI_PARTENZA.md §10.1;
// mockup docs/mockups/catalogo-precaricato.html, schermata 3). Compare solo
// quando la ricerca fra i tuoi alimenti e i pasti salvati non trova niente:
// al massimo 3 alimenti del catalogo precaricato, tolti quelli che hai già
// (suggerimentiCatalogo). Ha il colore del catalogo, un tono d'accento
// leggero, perché si veda che è un'altra cosa, non uno dei tuoi.
//
// Il «+» tondo (e il tocco sul nome) aggiunge l'alimento ai tuoi e apre
// subito i grammi: lo fa la pagina (onAggiungi), con l'alimento restituito
// da aggiungiDalCatalogo. In fondo «Vedi tutto il catalogo», che apre la
// scheda «Catalogo» di Impostazioni > Alimenti con la ricerca già scritta.

import type { AlimentoCatalogo } from "@/lib/catalogo/catalogoPrecaricato";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IconaPiu from "@/components/IconaPiu";

export default function RiquadroNelCatalogo({
  voci,
  inCorso,
  errore,
  onAggiungi,
  onVediTutto,
}: {
  voci: AlimentoCatalogo[];
  // L'id del catalogo che si sta aggiungendo: tutti i «+» si spengono.
  inCorso: string | null;
  errore: string | null;
  onAggiungi: (voce: AlimentoCatalogo) => void;
  onVediTutto: () => void;
}) {
  return (
    <section
      aria-labelledby="titolo-nel-catalogo"
      className="rounded-[18px] border border-[color-mix(in_srgb,var(--accento)_35%,transparent)] bg-[color-mix(in_srgb,var(--accento)_10%,transparent)] px-3.5 pt-3.5"
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-strong text-on-strong"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
            <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14z" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 id="titolo-nel-catalogo" className="text-[15px] font-semibold">
            Nel catalogo
          </h2>
          <p className="text-[13px] leading-snug text-muted">
            Con il + lo aggiungi ai tuoi alimenti e scegli i grammi.
          </p>
        </div>
      </div>

      <ul className="mt-1.5">
        {voci.map((v) => {
          const etichetta = v.marca ? `${v.nome} · ${v.marca}` : v.nome;
          return (
            <li
              key={v.id}
              className="flex min-h-[58px] items-center gap-3 border-b border-[color-mix(in_srgb,var(--accento)_35%,transparent)] last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onAggiungi(v)}
                disabled={inCorso !== null}
                className={`flex min-w-0 flex-1 flex-col rounded-lg py-2.5 text-left ${CLASSE_FOCUS}`}
              >
                <span className="truncate">
                  {v.nome}
                  {v.marca && <span className="text-muted"> · {v.marca}</span>}
                </span>
                <span className="text-sm tabular-nums text-muted">
                  {Math.round(v.kcal_100g)} kcal / 100 g
                </span>
              </button>
              {/* 44 px di tocco, il cerchio da 40 dentro è il disegno. */}
              <button
                type="button"
                onClick={() => onAggiungi(v)}
                disabled={inCorso !== null}
                aria-label={`Aggiungi ${etichetta} ai tuoi alimenti e scegli i grammi`}
                className={`flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60 ${CLASSE_FOCUS}`}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-strong text-on-strong">
                  <IconaPiu size={20} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {errore && (
        <p role="alert" className="pb-2 text-sm text-danger">
          {errore}
        </p>
      )}

      <button
        type="button"
        onClick={onVediTutto}
        className={`flex min-h-11 w-full items-center justify-center gap-1 border-t border-[color-mix(in_srgb,var(--accento)_35%,transparent)] text-[15px] font-semibold text-accent ${CLASSE_FOCUS}`}
      >
        Vedi tutto il catalogo
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </section>
  );
}
