"use client";

// Lo sheet quantità (PUNTO_DI_PARTENZA.md, sezione 5): UI di conferma
// quantità **unica**, identica per ogni sorgente di alimento. Oggi la usano
// la ricerca manuale e la creazione a mano; domani, senza modifiche qui,
// anche Open Food Facts e la scansione etichetta.
//
// Sezione 9.3: i grammi sono precompilati con la porzione di default e già
// selezionati (basta confermare, o digitare subito il numero giusto senza
// cancellare). Tastierino numerico, nessun menu a tendina.

import { useEffect, useRef, useState } from "react";
import type { AlimentoPerSheet } from "@/lib/inserimento/alimentoPerSheet";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface Props {
  alimento: AlimentoPerSheet;
  nomePasto: string;
  inCorso?: boolean;
  errore?: string | null;
  onAnnulla: () => void;
  onConferma: (grammi: number) => void;
}

export default function SheetQuantita({
  alimento,
  nomePasto,
  inCorso = false,
  errore = null,
  onAnnulla,
  onConferma,
}: Props) {
  const [grammi, setGrammi] = useState(String(alimento.porzione_default_g));
  const rifInput = useRef<HTMLInputElement>(null);

  // All'apertura: fuoco sul campo e testo selezionato, così un valore
  // diverso si digita senza prima cancellare.
  useEffect(() => {
    const el = rifInput.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  // Chiusura con Esc, come ci si aspetta da un pannello modale.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla]);

  const grammiNum = Number(grammi.replace(",", "."));
  const valido = grammi.trim() !== "" && !Number.isNaN(grammiNum) && grammiNum > 0;

  const fattore = valido ? grammiNum / 100 : 0;
  const kcal = Math.round(alimento.kcal_100g * fattore);
  const proteine = Math.round(alimento.proteine_100g * fattore);
  const carboidrati = Math.round(alimento.carboidrati_100g * fattore);
  const grassi = Math.round(alimento.grassi_100g * fattore);

  function conferma() {
    if (!valido || inCorso) return;
    onConferma(grammiNum);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40"
      onClick={onAnnulla}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Quantità di ${alimento.nome}`}
        className="w-full max-w-md rounded-t-2xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-wide text-muted">{nomePasto}</p>
        <h2 className="mt-1 font-display text-xl font-bold">{alimento.nome}</h2>

        <label htmlFor="sheet-grammi" className="mt-4 block text-sm font-medium">
          Quantità (g)
        </label>
        <input
          id="sheet-grammi"
          ref={rifInput}
          type="text"
          inputMode="decimal"
          value={grammi}
          onChange={(e) => setGrammi(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") conferma();
          }}
          className={`mt-1 w-full rounded-lg border border-border p-3 text-lg ${CLASSE_FOCUS}`}
        />

        <p className="mt-3 text-sm text-muted">
          {valido
            ? `${kcal} kcal · P ${proteine} g · C ${carboidrati} g · G ${grassi} g`
            : "Inserisci una quantità in grammi"}
        </p>

        {errore && <p className="mt-2 text-sm text-warning">{errore}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onAnnulla}
            className={`flex-1 rounded-lg border border-border p-3 ${CLASSE_FOCUS}`}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={conferma}
            disabled={!valido || inCorso}
            className={`flex-1 rounded-lg bg-accent p-3 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            {inCorso ? "Aggiungo..." : "Aggiungi"}
          </button>
        </div>
      </div>
    </div>
  );
}
