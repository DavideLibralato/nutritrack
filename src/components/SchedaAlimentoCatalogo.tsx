"use client";

// La scheda di un alimento del catalogo precaricato (PUNTO_DI_PARTENZA.md
// §10.1; mockup docs/mockups/catalogo-precaricato.html, schermata 2): si
// apre dal basso toccando una riga della scheda «Catalogo».
//
// Mostra solo le quattro cifre che l'app usa (kcal, proteine, carboidrati,
// grassi per 100 g), la porzione proposta, il codice a barre e la fonte.
// Zuccheri, fibre, saturi e sale no (Davide, 08/11): si salvano nella
// copia, ma l'app non li mostra da nessuna parte.
//
// - Da aggiungere: «Aggiungi ai miei alimenti», e sotto che diventa un
//   alimento tuo, che potrai cambiare.
// - Nei tuoi: perché (la copia, anche rinominata; oppure un alimento
//   uguale per codice o per nome e marca, con il testo di sempre,
//   testoDoppione) e «Apri «nome»», che porta alla modifica del tuo. Se il
//   tuo non si può modificare (verificato: oggi nessuno), niente «Apri».
//   I valori in grande restano quelli del catalogo: i tuoi possono essere
//   diversi, e il titolo lo dice («Per 100 g, nel catalogo»).

import type { Alimento } from "@/lib/db/tipi";
import type { AlimentoCatalogo } from "@/lib/catalogo/catalogoPrecaricato";
import type { StatoNelCatalogo } from "@/lib/catalogo/neiTuoi";
import { testoDoppione } from "@/lib/catalogo/doppioniAlimenti";
import { etichettaAlimento } from "@/lib/repository/alimenti";
import { numeroPerCampo } from "@/lib/numeriDecimali";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import FoglioDalBasso from "@/components/FoglioDalBasso";

export const TESTO_FONTE: Record<AlimentoCatalogo["origine"], string> = {
  ciqual: "Fonte: Ciqual 2025 (Anses)",
  off: "Fonte: Open Food Facts",
};

// Il motivo di «Nei tuoi», sopra i valori.
export function testoNeiTuoi(
  voce: AlimentoCatalogo,
  mio: Alimento,
  perche: "copia" | "doppione"
): string {
  if (perche === "copia") return `È già nei tuoi alimenti come «${etichettaAlimento(mio)}».`;
  return testoDoppione(mio, voce);
}

export default function SchedaAlimentoCatalogo({
  voce,
  stato,
  puoAprire,
  inCorso,
  onAggiungi,
  onApri,
  onChiudi,
}: {
  voce: AlimentoCatalogo;
  stato: StatoNelCatalogo;
  puoAprire: (alimento: Alimento) => boolean;
  // Un'aggiunta in corso: il pulsante si spegne (niente doppio tocco).
  inCorso: boolean;
  onAggiungi: () => void;
  onApri: (alimento: Alimento) => void;
  onChiudi: () => void;
}) {
  const neiTuoi = stato.stato === "nei-tuoi" ? stato : null;
  const valori = [
    { cifra: voce.kcal_100g, nome: "kcal" },
    { cifra: voce.proteine_100g, nome: "proteine" },
    { cifra: voce.carboidrati_100g, nome: "carboidrati" },
    { cifra: voce.grassi_100g, nome: "grassi" },
  ];

  return (
    <FoglioDalBasso
      titolo={voce.nome}
      sottotitolo={`${voce.marca ?? "Senza marca"} · ${voce.categoria}`}
      conChiudi
      onChiudi={onChiudi}
    >
      {neiTuoi && (
        <p
          role="status"
          className="flex gap-2 rounded-xl bg-[color-mix(in_srgb,var(--accento)_12%,transparent)] p-3 text-sm leading-snug"
        >
          <Spunta />
          <span>{testoNeiTuoi(voce, neiTuoi.alimento, neiTuoi.perche)}</span>
        </p>
      )}

      <p className="text-xs font-semibold uppercase tracking-[0.8px] text-muted">
        {neiTuoi ? "Per 100 g, nel catalogo" : "Per 100 g"}
      </p>
      <dl className="grid grid-cols-4 gap-2">
        {valori.map((v) => (
          <div
            key={v.nome}
            className="flex flex-col-reverse rounded-xl border border-border bg-background px-2 py-2.5 text-center"
          >
            <dt className="text-xs text-muted">{v.nome}</dt>
            <dd className="text-xl font-semibold tabular-nums">{numeroPerCampo(v.cifra, 1)}</dd>
          </div>
        ))}
      </dl>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Porzione proposta</dt>
        <dd className="text-right tabular-nums">{numeroPerCampo(voce.porzione_default_g, 1)} g</dd>
        <dt className="text-muted">Codice a barre</dt>
        <dd className="text-right tabular-nums">{voce.barcode ?? "nessuno (sfuso)"}</dd>
      </dl>

      {neiTuoi ? (
        puoAprire(neiTuoi.alimento) && (
          <button
            type="button"
            onClick={() => onApri(neiTuoi.alimento)}
            className={`flex min-h-[50px] items-center justify-center gap-2 rounded-xl border border-accent px-4 font-semibold text-accent ${CLASSE_FOCUS}`}
          >
            <span className="truncate">Apri «{neiTuoi.alimento.nome}»</span>
            <ChevronDestra />
          </button>
        )
      ) : (
        <button
          type="button"
          onClick={onAggiungi}
          disabled={inCorso}
          className={`flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-accent-strong px-4 font-semibold text-on-strong disabled:opacity-60 ${CLASSE_FOCUS}`}
        >
          <Piu />
          Aggiungi ai miei alimenti
        </button>
      )}

      <p className="text-center text-[13px] leading-relaxed text-muted">
        {!neiTuoi && (
          <>
            Diventa un alimento tuo: dopo puoi cambiare nome, marca e valori.
            <br />
          </>
        )}
        {TESTO_FONTE[voce.origine]}
      </p>
    </FoglioDalBasso>
  );
}

function Spunta() {
  return (
    <svg
      className="mt-px shrink-0 text-accent"
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
  );
}

function Piu() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronDestra() {
  return (
    <svg
      className="shrink-0"
      width="18"
      height="18"
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
  );
}
