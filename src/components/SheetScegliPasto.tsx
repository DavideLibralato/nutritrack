"use client";

// "Sposta" dal menu contestuale di Oggi (PUNTO_DI_PARTENZA.md, sezione 3,
// "Tieni premuto"): l'alternativa al trascinare. L'elenco dei pasti della
// giornata, escluso quello di partenza (lo toglie chi chiama); un tocco su
// un pasto sceglie la destinazione. Annulla, tocco fuori o Esc: niente.
//
// Stessa struttura di SheetConferma: sfondo scurito su tutto il layout
// viewport, pannello ancorato al visual viewport (useAreaVisibile).

import { useEffect } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

interface Props {
  titolo: string;
  pasti: { id: string; nome: string }[];
  inCorso?: boolean;
  errore?: string | null;
  onScegli: (pastoId: string) => void;
  onAnnulla: () => void;
}

export default function SheetScegliPasto({
  titolo,
  pasti,
  inCorso = false,
  errore = null,
  onScegli,
  onAnnulla,
}: Props) {
  const areaVisibile = useAreaVisibile();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla, inCorso]);

  function chiudi() {
    if (!inCorso) onAnnulla();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-veil" onClick={chiudi} aria-hidden />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        onClick={chiudi}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titolo}
          className="flex max-h-full w-full max-w-md flex-col rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="shrink-0 font-display text-xl font-bold">{titolo}</h2>

          {pasti.length === 0 && (
            <p className="mt-3 shrink-0 text-sm text-muted">Non ci sono altri pasti in questa giornata.</p>
          )}
          <ul className="mt-3 min-h-0 overflow-y-auto">
            {pasti.map((p) => (
              <li key={p.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => onScegli(p.id)}
                  disabled={inCorso}
                  className={`flex min-h-12 w-full items-center rounded text-left text-lg disabled:opacity-50 ${CLASSE_FOCUS}`}
                >
                  {p.nome}
                </button>
              </li>
            ))}
          </ul>

          {errore && <p className="mt-2 shrink-0 text-sm text-warning">{errore}</p>}

          <button
            type="button"
            onClick={onAnnulla}
            disabled={inCorso}
            className={`mt-4 shrink-0 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            Annulla
          </button>
        </div>
      </div>
    </>
  );
}
