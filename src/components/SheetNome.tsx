"use client";

// Sheet minimo per chiedere un nome testuale — oggi solo "Salva come
// preferito" in Oggi. Sostituisce window.prompt(): in alcuni ambienti
// (webview integrate come il Simple Browser di VSCode, alcune PWA installate)
// prompt() non è disponibile e lancia un errore invece di aprire il dialogo
// nativo, invece di limitarsi a non fare nulla.
//
// Stessa struttura visiva di SheetQuantita (overlay, pannello ancorato in
// basso, riga di pulsanti Annulla/conferma) per restare coerente con l'unico
// altro sheet dell'app, non per riuso di codice — i campi sono troppo
// diversi per condividere il componente.

import { useEffect, useRef, useState } from "react";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface Props {
  titolo: string;
  valoreIniziale: string;
  testoConferma?: string;
  inCorso?: boolean;
  errore?: string | null;
  onAnnulla: () => void;
  onConferma: (nome: string) => void;
}

export default function SheetNome({
  titolo,
  valoreIniziale,
  testoConferma = "Salva",
  inCorso = false,
  errore = null,
  onAnnulla,
  onConferma,
}: Props) {
  const [nome, setNome] = useState(valoreIniziale);
  const rifInput = useRef<HTMLInputElement>(null);

  // All'apertura: fuoco sul campo e testo selezionato, come nello sheet
  // quantità — un valore diverso si digita senza prima cancellare.
  useEffect(() => {
    const el = rifInput.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla]);

  const valido = nome.trim() !== "";

  function conferma() {
    if (!valido || inCorso) return;
    onConferma(nome.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40"
      onClick={onAnnulla}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titolo}
        className="w-full max-w-md rounded-t-2xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-bold">{titolo}</h2>

        <input
          ref={rifInput}
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") conferma();
          }}
          className={`mt-4 w-full rounded-lg border border-border p-3 text-lg ${CLASSE_FOCUS}`}
        />

        {errore && <p className="mt-2 text-sm text-warning">{errore}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onAnnulla}
            disabled={inCorso}
            className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={conferma}
            disabled={!valido || inCorso}
            className={`flex-1 rounded-lg bg-accent p-3 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            {inCorso ? "Salvo..." : testoConferma}
          </button>
        </div>
      </div>
    </div>
  );
}
