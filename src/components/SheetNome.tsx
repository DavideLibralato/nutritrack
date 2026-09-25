"use client";

// Sheet minimo per chiedere un nome testuale — "Salva come preferito" in
// Oggi, e rinominare/eliminare un pasto salvato da Aggiungi alimento.
// Sostituisce window.prompt(): in alcuni ambienti (webview integrate come il
// Simple Browser di VSCode, alcune PWA installate) prompt() non è disponibile
// e lancia un errore invece di aprire il dialogo nativo, invece di limitarsi
// a non fare nulla.
//
// Stessa struttura visiva di SheetQuantita (overlay, pannello ancorato in
// basso, riga di pulsanti Annulla/conferma, e lo stesso pattern di
// modifica+Elimina con conferma "No / Sì, elimina" sulla stessa riga) per
// restare coerente con l'unico altro sheet dell'app, non per riuso di
// codice — i campi sono troppo diversi per condividere il componente.

import { useEffect, useRef, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

interface Props {
  titolo: string;
  valoreIniziale: string;
  testoConferma?: string;
  inCorso?: boolean;
  errore?: string | null;
  // Testo informativo mostrato già all'apertura, sotto il titolo — non un
  // errore, quindi non nel colore di avviso. Oggi: quali alimenti di un pasto
  // NON verranno salvati perché non più nel catalogo (regola "Alimenti
  // cancellati", punto 1). Lo sheet ha già Annulla e conferma: "Salva" vale
  // come "sì, salva lo stesso", Annulla non salva niente.
  avviso?: string | null;
  onAnnulla: () => void;
  onConferma: (nome: string) => void;
  // --- Solo in modifica di qualcosa che esiste già ---
  modifica?: boolean;
  onElimina?: () => void;
}

export default function SheetNome({
  titolo,
  valoreIniziale,
  testoConferma = "Salva",
  inCorso = false,
  errore = null,
  avviso = null,
  onAnnulla,
  onConferma,
  modifica = false,
  onElimina,
}: Props) {
  const [nome, setNome] = useState(valoreIniziale);
  const [confermaElim, setConfermaElim] = useState(false);
  const rifInput = useRef<HTMLInputElement>(null);
  // Ancorato al VISUAL viewport, non al layout viewport: stesso motivo di
  // SheetQuantita (vedi il commento in src/lib/areaVisibile.ts).
  const areaVisibile = useAreaVisibile();

  // In modifica il pulsante di sinistra diventa "Elimina" (che poi chiede
  // conferma nella stessa riga) — identico a SheetQuantita.
  const modificaConElimina = modifica && !!onElimina;

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
    <>
      {/* Due livelli separati: stesso motivo e stessa strategia di
          tap-per-chiudere di SheetQuantita (vedi il commento lì) — lo
          sfondo scurito copre tutto il layout viewport, il contenitore del
          pannello resta ancorato al visual viewport ma trasparente. */}
      <div className="fixed inset-0 z-50 bg-foreground/40" onClick={onAnnulla} aria-hidden />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
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

        {/* role="status": se l'avviso cambia mentre lo sheet è aperto
            (esclusi cambiati nel frattempo), lo screen reader lo rilegge. */}
        {avviso && (
          <p role="status" className="mt-2 text-sm">
            {avviso}
          </p>
        )}

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

        {/* Stessa riga [sinistra] [destra] di SheetQuantita:
            - creazione:            [Annulla]      [testoConferma]
            - modifica:             [Elimina]      [testoConferma]
            - modifica, conferma:   [No]           [Sì, elimina] */}
        <div className="mt-5 flex gap-3">
          {!modificaConElimina ? (
            <button
              type="button"
              onClick={onAnnulla}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Annulla
            </button>
          ) : confermaElim ? (
            <button
              type="button"
              onClick={() => setConfermaElim(false)}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              No
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfermaElim(true)}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-warning p-3 text-warning disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Elimina
            </button>
          )}

          {modificaConElimina && confermaElim ? (
            <button
              type="button"
              onClick={() => onElimina?.()}
              disabled={inCorso}
              className={`flex-1 rounded-lg bg-warning p-3 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Elimino..." : "Sì, elimina"}
            </button>
          ) : (
            <button
              type="button"
              onClick={conferma}
              disabled={!valido || inCorso}
              className={`flex-1 rounded-lg bg-accent p-3 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Salvo..." : testoConferma}
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
