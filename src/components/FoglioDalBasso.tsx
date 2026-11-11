"use client";

// Il foglio dal basso della foto profilo (mockup
// docs/mockups/foto-profilo.html, proposta B e schermata 3): la maniglia,
// il titolo e il contenuto, su tutta la larghezza, con gli angoli in alto
// arrotondati. Stessa strategia degli altri sheet di Libra (SheetConferma):
// velo su tutto il layout viewport, pannello ancorato al visual viewport
// (useAreaVisibile). Esc o tocco fuori chiudono, tranne quando `bloccato`
// (un lavoro in corso).
//
// Niente animazione di apertura, come gli altri sheet: con "riduci
// movimento" non c'è niente da togliere.

import { useEffect, useId, type ReactNode } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IconaCroce from "@/components/IconaCroce";

export default function FoglioDalBasso({
  titolo,
  sottotitolo,
  conChiudi = false,
  bloccato = false,
  ruolo = "dialog",
  onChiudi,
  children,
}: {
  titolo: string;
  // Una riga grigia sotto il titolo (la scheda di un alimento del
  // catalogo: «Pavesi · Dolci e snack»).
  sottotitolo?: string;
  // Il pulsante tondo «Chiudi» a destra del titolo, come nel mockup del
  // catalogo precaricato.
  conChiudi?: boolean;
  bloccato?: boolean;
  // "alertdialog" per una conferma di qualcosa che non si annulla.
  ruolo?: "dialog" | "alertdialog";
  onChiudi: () => void;
  children: ReactNode;
}) {
  const areaVisibile = useAreaVisibile();
  const idTitolo = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !bloccato) onChiudi();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onChiudi, bloccato]);

  function chiudi() {
    if (!bloccato) onChiudi();
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
          role={ruolo}
          aria-modal="true"
          aria-labelledby={idTitolo}
          className="flex w-full max-w-md flex-col gap-3.5 rounded-t-[22px] bg-surface px-4 pt-3.5 pb-[calc(1.375rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden className="h-[5px] w-9 self-center rounded-full bg-border" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id={idTitolo} className="font-display text-xl font-bold">
                {titolo}
              </h2>
              {sottotitolo && <p className="mt-1 text-sm text-muted">{sottotitolo}</p>}
            </div>
            {conChiudi && (
              // 44 px di tocco, il cerchio grigio dentro è il disegno.
              <button
                type="button"
                onClick={chiudi}
                aria-label="Chiudi"
                className={`-m-1 flex size-11 shrink-0 items-center justify-center rounded-full ${CLASSE_FOCUS}`}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--linea)_70%,transparent)] text-muted">
                  <IconaCroce />
                </span>
              </button>
            )}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
