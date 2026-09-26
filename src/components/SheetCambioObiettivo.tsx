"use client";

// La domanda che il Salva del Profilo fa SOLO quando sono cambiati
// l'obiettivo o un target di un periodo già esistente
// (serveSceltaPeriodo in src/lib/profilo/salvataggioProfilo.ts):
//
//   - "È un cambio vero" (predefinita) → periodo nuovo nello storico, con la
//     data d'inizio modificabile: "ho cambiato dieta la settimana scorsa e me
//     ne ricordo adesso". I giorni da quella data in poi prendono i target
//     nuovi, quelli prima restano con i vecchi.
//   - "Avevo sbagliato a inserirlo" → corregge il periodo in corso, senza
//     crearne uno nuovo: i valori corretti valgono per tutto il periodo,
//     anche per i giorni già passati.
//
// Limiti della data (limitiDataInizio): dal giorno dopo l'inizio del
// periodo in corso fino a oggi. Se il periodo è iniziato oggi non c'è
// nessuna data possibile, e il cambio vero è disattivato.
//
// Stessa struttura visiva di SheetNome (overlay, pannello in basso ancorato
// al visual viewport, riga Annulla / conferma).

import { useEffect, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import type { SceltaPeriodo } from "@/lib/profilo/salvataggioProfilo";
import { formattaDataBreve } from "@/lib/dataGiorno";

export default function SheetCambioObiettivo({
  inizioPeriodo,
  limiti,
  inCorso,
  errore,
  onAnnulla,
  onConferma,
}: {
  // valido_dal del periodo in corso, per dire all'utente cosa corregge.
  inizioPeriodo: string;
  limiti: { min: string; max: string } | null;
  inCorso: boolean;
  errore: string | null;
  onAnnulla: () => void;
  onConferma: (scelta: SceltaPeriodo) => void;
}) {
  const cambioPossibile = limiti !== null;
  const [tipo, setTipo] = useState<SceltaPeriodo["tipo"]>(
    cambioPossibile ? "nuovo" : "correzione"
  );
  // Predefinita: oggi (il giorno logico, come in Oggi) — il massimo.
  const [validoDal, setValidoDal] = useState(limiti?.max ?? "");
  const areaVisibile = useAreaVisibile();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla, inCorso]);

  const dataValida =
    limiti !== null && validoDal !== "" && validoDal >= limiti.min && validoDal <= limiti.max;
  const confermabile = tipo === "correzione" || dataValida;

  function conferma() {
    if (!confermabile || inCorso) return;
    onConferma(tipo === "nuovo" ? { tipo: "nuovo", validoDal } : { tipo: "correzione" });
  }

  function classeOpzione(attiva: boolean) {
    return `w-full rounded-lg border p-3 text-left disabled:opacity-50 ${CLASSE_FOCUS} ${
      attiva ? "border-accent bg-accent/10" : "border-border"
    }`;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-foreground/40"
        onClick={inCorso ? undefined : onAnnulla}
        aria-hidden
      />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        onClick={inCorso ? undefined : onAnnulla}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Com'è cambiato l'obiettivo?"
          className="max-h-full w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-xl font-bold">Com&apos;è cambiato l&apos;obiettivo?</h2>

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => setTipo("nuovo")}
              disabled={!cambioPossibile || inCorso}
              aria-pressed={tipo === "nuovo"}
              className={classeOpzione(tipo === "nuovo")}
            >
              <span className="block font-medium">È un cambio vero</span>
              <span className="block text-sm text-muted">
                {cambioPossibile
                  ? "Inizia un periodo nuovo. I giorni prima della data d'inizio restano con i target di prima."
                  : "Il periodo in corso è iniziato oggi: puoi solo correggerlo."}
              </span>
            </button>

            {tipo === "nuovo" && limiti && (
              <div className="pl-3">
                <label htmlFor="cambio-valido-dal" className="block text-sm font-medium mb-1">
                  Valido dal
                </label>
                <input
                  id="cambio-valido-dal"
                  type="date"
                  value={validoDal}
                  min={limiti.min}
                  max={limiti.max}
                  onChange={(e) => setValidoDal(e.target.value)}
                  className={`w-full rounded-lg border border-border bg-background p-2 text-base ${CLASSE_FOCUS}`}
                />
                <p className={`mt-1 text-sm ${dataValida ? "text-muted" : "text-warning"}`}>
                  {limiti.min === limiti.max
                    ? `Può essere solo oggi, ${formattaDataBreve(limiti.max)}.`
                    : `Fra il ${formattaDataBreve(limiti.min)} e oggi, ${formattaDataBreve(limiti.max)}.`}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setTipo("correzione")}
              disabled={inCorso}
              aria-pressed={tipo === "correzione"}
              className={classeOpzione(tipo === "correzione")}
            >
              <span className="block font-medium">Avevo sbagliato a inserirlo</span>
              <span className="block text-sm text-muted">
                Corregge il periodo in corso, iniziato il {formattaDataBreve(inizioPeriodo)}: i
                valori nuovi valgono anche per i giorni già passati di quel periodo.
              </span>
            </button>
          </div>

          {errore && <p className="mt-3 text-sm text-warning">{errore}</p>}

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
              disabled={!confermabile || inCorso}
              className={`flex-1 rounded-lg bg-accent p-3 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Salvo..." : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
