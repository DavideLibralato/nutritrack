"use client";

// Lo sheet di un pasto in Impostazioni > Pasti e orari (PUNTO_DI_PARTENZA.md,
// sezione 3, "Pasti e orari"): Nome e "Inizia alle", Annulla e Salva. Serve
// sia a modificare un pasto (tocco sulla riga) sia ad aggiungerne uno
// ("+ Aggiungi pasto", campi vuoti). Su un pasto esistente, in fondo,
// "Elimina pasto" (passo 4): spento, con il motivo sotto, se il pasto non
// si può eliminare (l'unico pasto). Elimina non usa i campi: un nome o
// un'ora cambiati e non salvati si perdono.
//
// Lo sheet non decide niente: al Salva passa nome e ora alla pagina, che
// fa i controlli (controlliPasti.ts) e restituisce gli errori da mostrare
// sotto i campi, o apre la domanda "da quando". Toccare un campo toglie il
// suo errore: resta solo quello che vale ancora.
//
// Stessa struttura visiva di SheetNome (overlay, pannello in basso ancorato
// al visual viewport, riga Annulla / Salva).

import { useEffect, useRef, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export interface ErroriPasto {
  nome?: string | null;
  ora?: string | null;
  // Un errore che non riguarda un campo (salvataggio fallito).
  generale?: string | null;
}

export default function SheetPasto({
  titolo,
  sottotitolo,
  nomeIniziale,
  oraIniziale,
  errori,
  inCorso,
  onCambiaCampo,
  onAnnulla,
  onSalva,
  elimina,
}: {
  titolo: string;
  sottotitolo?: string;
  nomeIniziale: string;
  // "HH:mm", o "" per nessuna ora proposta (pasto nuovo).
  oraIniziale: string;
  errori: ErroriPasto;
  inCorso: boolean;
  onCambiaCampo: (campo: "nome" | "ora") => void;
  onAnnulla: () => void;
  onSalva: (nome: string, ora: string) => void;
  // Solo su un pasto esistente. motivoSpento: perché il pulsante è spento.
  // inAttesa: le voci del pasto non sono ancora state lette.
  elimina?: { motivoSpento: string | null; inAttesa?: boolean; onElimina: () => void };
}) {
  const [nome, setNome] = useState(nomeIniziale);
  const [ora, setOra] = useState(oraIniziale);
  const rifNome = useRef<HTMLInputElement>(null);
  const areaVisibile = useAreaVisibile();

  // Un pasto nuovo comincia dal nome: fuoco lì. Su un pasto esistente no,
  // perché spesso si cambia solo l'ora, e la tastiera coprirebbe metà sheet.
  useEffect(() => {
    if (nomeIniziale === "") rifNome.current?.focus();
  }, [nomeIniziale]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla, inCorso]);

  function salva() {
    if (inCorso) return;
    onSalva(nome, ora);
  }

  const classeCampo = `w-full rounded-lg border bg-background p-3 text-lg ${CLASSE_FOCUS}`;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-veil" onClick={inCorso ? undefined : onAnnulla} aria-hidden />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        onClick={inCorso ? undefined : onAnnulla}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titolo}
          className="max-h-full w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-xl font-bold">{titolo}</h2>
          {sottotitolo && <p className="mt-1 text-sm text-muted">{sottotitolo}</p>}

          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              salva();
            }}
          >
            <div>
              <label htmlFor="pasto-nome" className="mb-1 block text-sm font-medium">
                Nome
              </label>
              <input
                ref={rifNome}
                id="pasto-nome"
                type="text"
                value={nome}
                placeholder="Es. Spuntino sera"
                autoComplete="off"
                aria-invalid={!!errori.nome}
                aria-describedby={errori.nome ? "pasto-nome-errore" : undefined}
                onChange={(e) => {
                  setNome(e.target.value);
                  onCambiaCampo("nome");
                }}
                className={`${classeCampo} ${errori.nome ? "border-warning" : "border-border"}`}
              />
              {errori.nome && (
                <p id="pasto-nome-errore" className="mt-1 text-sm text-warning">
                  {errori.nome}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="pasto-ora" className="mb-1 block text-sm font-medium">
                Inizia alle
              </label>
              <input
                id="pasto-ora"
                type="time"
                value={ora}
                aria-invalid={!!errori.ora}
                aria-describedby={errori.ora ? "pasto-ora-errore" : undefined}
                onChange={(e) => {
                  setOra(e.target.value);
                  onCambiaCampo("ora");
                }}
                className={`campo-data ${classeCampo} ${errori.ora ? "border-warning" : "border-border"}`}
              />
              {errori.ora && (
                <p id="pasto-ora-errore" className="mt-1 text-sm text-warning">
                  {errori.ora}
                </p>
              )}
            </div>

            {errori.generale && (
              <p role="alert" className="text-sm text-warning">
                {errori.generale}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onAnnulla}
                disabled={inCorso}
                className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={inCorso}
                className={`flex-1 rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                {inCorso ? "Salvo..." : "Salva"}
              </button>
            </div>
          </form>

          {elimina && (
            <div className="mt-5 border-t border-border pt-4">
              <button
                type="button"
                onClick={elimina.onElimina}
                disabled={inCorso || !!elimina.motivoSpento || !!elimina.inAttesa}
                aria-describedby={elimina.motivoSpento ? "pasto-elimina-motivo" : undefined}
                className={`w-full rounded-lg border border-warning p-3 font-medium text-warning disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                Elimina pasto
              </button>
              {elimina.motivoSpento && (
                <p id="pasto-elimina-motivo" className="mt-2 text-center text-sm text-muted">
                  {elimina.motivoSpento}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
