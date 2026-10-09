"use client";

// La domanda "da quando vale?" di Pasti e orari (PUNTO_DI_PARTENZA.md,
// sezione 3, "Pasti e orari"; mockup docs/mockups/pasti-e-orari.html):
// - rinomina: "Correggi" (anche i giorni passati) o "Da oggi";
// - pasto nuovo: "Anche nei giorni passati" o "Da oggi".
// Come nel mockup, "Da oggi" è già scelto (non riscrive il passato), e il
// pulsante in basso dice cosa succede ("Rinomina", "Aggiungi pasto").
//
// Un'opzione può essere bloccata (`bloccata`: il motivo, mostrato al posto
// della spiegazione): per esempio "Correggi" quando il nome nuovo c'è già
// in un giorno passato, mentre "Da oggi" va bene.
//
// "Indietro" torna allo sheet del pasto con i campi come li hai lasciati.
// Stessa struttura visiva di SheetCambioObiettivo.

import { useEffect, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export interface OpzioneDaQuando<K extends string> {
  chiave: K;
  titolo: string;
  spiegazione: string;
  bloccata?: string | null;
}

export default function SheetDaQuando<K extends string>({
  titolo,
  opzioni,
  predefinita,
  testoConferma,
  inCorso,
  errore,
  onIndietro,
  onConferma,
}: {
  titolo: string;
  opzioni: OpzioneDaQuando<K>[];
  predefinita: K;
  testoConferma: string;
  inCorso: boolean;
  errore: string | null;
  onIndietro: () => void;
  onConferma: (scelta: K) => void;
}) {
  const [scelta, setScelta] = useState<K>(predefinita);
  const areaVisibile = useAreaVisibile();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onIndietro();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onIndietro, inCorso]);

  const opzioneScelta = opzioni.find((o) => o.chiave === scelta);
  const confermabile = !!opzioneScelta && !opzioneScelta.bloccata && !inCorso;

  function classeOpzione(attiva: boolean) {
    return `w-full rounded-lg border p-3 text-left disabled:opacity-50 ${CLASSE_FOCUS} ${
      attiva ? "border-accent bg-accent/10" : "border-border"
    }`;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-veil" onClick={inCorso ? undefined : onIndietro} aria-hidden />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        onClick={inCorso ? undefined : onIndietro}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titolo}
          className="max-h-full w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-xl font-bold [overflow-wrap:anywhere]">{titolo}</h2>
          <p className="mt-1 text-sm text-muted">Da quando vale?</p>

          <div className="mt-4 space-y-3">
            {opzioni.map((o) => (
              <button
                key={o.chiave}
                type="button"
                onClick={() => setScelta(o.chiave)}
                disabled={!!o.bloccata || inCorso}
                aria-pressed={scelta === o.chiave}
                className={classeOpzione(scelta === o.chiave)}
              >
                <span className="block font-medium">{o.titolo}</span>
                <span className={`block text-sm ${o.bloccata ? "text-warning" : "text-muted"}`}>
                  {o.bloccata ?? o.spiegazione}
                </span>
              </button>
            ))}
          </div>

          {errore && (
            <p role="alert" className="mt-3 text-sm text-warning">
              {errore}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onIndietro}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Indietro
            </button>
            <button
              type="button"
              onClick={() => confermabile && onConferma(scelta)}
              disabled={!confermabile}
              className={`flex-1 rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Salvo..." : testoConferma}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
