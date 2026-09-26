"use client";

// Sheet di conferma sì/no: una domanda, due pulsanti. Stessa struttura
// visiva e stessa strategia di tap-per-chiudere di SheetNome e SheetQuantita
// (vedi il commento lunghissimo in SheetQuantita): sfondo scurito su tutto il
// layout viewport, pannello ancorato al visual viewport. Toccare fuori o Esc
// equivalgono a "No".
//
// Oggi lo usa ModificaPastoSalvato: togliere l'ultimo alimento, "Elimina
// pasto", uscire con modifiche non salvate.

import { useEffect } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

interface Props {
  titolo: string;
  testo: string;
  etichettaNo: string;
  etichettaSi: string;
  // Il "sì" cancella qualcosa: pulsante col colore d'avviso invece che
  // d'accento.
  distruttiva?: boolean;
  inCorso?: boolean;
  errore?: string | null;
  onNo: () => void;
  onSi: () => void;
}

export default function SheetConferma({
  titolo,
  testo,
  etichettaNo,
  etichettaSi,
  distruttiva = false,
  inCorso = false,
  errore = null,
  onNo,
  onSi,
}: Props) {
  const areaVisibile = useAreaVisibile();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onNo();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNo, inCorso]);

  function chiudi() {
    if (!inCorso) onNo();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-foreground/40" onClick={chiudi} aria-hidden />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        onClick={chiudi}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label={titolo}
          className="w-full max-w-md rounded-t-2xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-xl font-bold">{titolo}</h2>
          <p className="mt-2 text-sm leading-relaxed">{testo}</p>

          {errore && <p className="mt-2 text-sm text-warning">{errore}</p>}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onNo}
              disabled={inCorso}
              autoFocus
              className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {etichettaNo}
            </button>
            <button
              type="button"
              onClick={onSi}
              disabled={inCorso}
              className={`flex-1 rounded-lg p-3 font-medium text-background disabled:opacity-50 ${distruttiva ? "bg-warning" : "bg-accent"} ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Attendi..." : etichettaSi}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
