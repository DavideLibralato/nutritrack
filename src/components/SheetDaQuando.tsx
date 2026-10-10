"use client";

// La domanda "da quando vale?" di Pasti e orari (PUNTO_DI_PARTENZA.md,
// sezione 3, "Pasti e orari"; mockup docs/mockups/pasti-e-orari.html):
// - rinomina: "Correggi" (anche i giorni passati), "Da oggi" o "Da una
//   data";
// - solo l'orario (passo 5): "Subito" o "Da una data";
// - pasto nuovo: "Anche nei giorni passati", "Da oggi" o "Da una data";
// - elimina pasto: "Anche nei giorni passati", "Da oggi" o "Da una data".
// Come nel mockup, "Da oggi" (o "Subito") è già scelto (non riscrive il
// passato), e il pulsante in basso dice cosa succede ("Rinomina",
// "Aggiungi pasto").
//
// Un'opzione può essere bloccata (`bloccata`: il motivo, mostrato al posto
// della spiegazione): per esempio "Correggi" quando il nome nuovo c'è già
// in un giorno passato, mentre "Da oggi" va bene.
//
// "Da una data" (`data`): scelta quell'opzione, sotto compare il campo
// "Dal giorno". Il campo è CONTROLLATO dalla pagina: il valore e i suoi
// cambi passano da lei (`valore`, `onCambia`), perché è lei a sapere quali
// giorni vanno bene e a scrivere le spiegazioni, che dipendono dalla data
// ("Fino a dom 11 ott resta «Pranzo»"). Se la pagina dice che c'è un
// `errore` (giorno fuori dai limiti, nome già usato quel giorno), il
// pulsante resta spento.
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

// Il campo data di "Da una data". `nota`: una riga in più sotto il campo
// (per esempio un cambio già programmato che fissa il massimo).
export interface CampoDataDaQuando<K extends string> {
  chiave: K;
  min: string;
  max: string | null;
  valore: string;
  onCambia: (data: string) => void;
  nota?: string | null;
  errore?: string | null;
}

export default function SheetDaQuando<K extends string>({
  titolo,
  opzioni,
  predefinita,
  testoConferma,
  data,
  inCorso,
  errore,
  onIndietro,
  onConferma,
}: {
  titolo: string;
  opzioni: OpzioneDaQuando<K>[];
  predefinita: K;
  data?: CampoDataDaQuando<K>;
  // Il testo del pulsante, che può dipendere dalla scelta (Elimina pasto:
  // "Continua" se la scelta tocca delle voci e chiede conferma, "Elimina
  // pasto" se no, come nel mockup).
  testoConferma: string | ((scelta: K) => string);
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
  const dataSbagliata = !!data && scelta === data.chiave && !!data.errore;
  const confermabile = !!opzioneScelta && !opzioneScelta.bloccata && !dataSbagliata && !inCorso;

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
          className="max-h-full w-full max-w-md min-w-0 overflow-x-hidden overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-xl font-bold [overflow-wrap:anywhere]">{titolo}</h2>
          <p className="mt-1 text-sm text-muted">Da quando vale?</p>

          <div className="mt-4 space-y-3">
            {opzioni.map((o) => (
              <div key={o.chiave}>
                <button
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
                {data && data.chiave === o.chiave && scelta === o.chiave && (
                  <div className="mt-2 px-1">
                    <label htmlFor="da-quando-data" className="block text-sm font-medium">
                      Dal giorno
                    </label>
                    <input
                      id="da-quando-data"
                      type="date"
                      min={data.min}
                      max={data.max ?? undefined}
                      value={data.valore}
                      onChange={(e) => data.onCambia(e.target.value)}
                      disabled={inCorso}
                      aria-invalid={!!data.errore}
                      aria-describedby="da-quando-data-dettagli"
                      className={`campo-data mt-1 w-full rounded-lg border border-border bg-background p-3 ${CLASSE_FOCUS}`}
                    />
                    <div id="da-quando-data-dettagli">
                      {data.errore && <p className="mt-1 text-sm text-warning">{data.errore}</p>}
                      {data.nota && <p className="mt-1 text-sm text-muted">{data.nota}</p>}
                    </div>
                  </div>
                )}
              </div>
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
              {inCorso ? "Salvo..." : typeof testoConferma === "function" ? testoConferma(scelta) : testoConferma}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
