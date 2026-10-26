"use client";

// Il foglio "Foto profilo" (mockup docs/mockups/foto-profilo.html,
// schermata 2): si apre toccando il cerchio in Profilo quando la foto c'è.
// "Modifica foto" riapre il menu dell'iPhone (e poi il ritaglio), "Elimina
// foto" in rosso porta alla conferma, "Annulla" in un blocco suo, in
// grassetto, come i fogli d'azione dell'iPhone. Esc e tocco fuori = Annulla.

import { useEffect, useId } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { TITOLO_SCELTA_FOTO, VOCE_ELIMINA_FOTO, VOCE_MODIFICA_FOTO } from "@/lib/foto/testiFoto";

const CLASSE_VOCE = `flex min-h-[54px] w-full items-center justify-center border-b border-border text-[17px] font-medium last:border-b-0 ${CLASSE_FOCUS}`;

export default function SheetSceltaFoto({
  onModifica,
  onElimina,
  onAnnulla,
}: {
  onModifica: () => void;
  onElimina: () => void;
  onAnnulla: () => void;
}) {
  const areaVisibile = useAreaVisibile();
  const idTitolo = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-veil" onClick={onAnnulla} aria-hidden />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        onClick={onAnnulla}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={idTitolo}
          className="flex w-full max-w-md flex-col gap-2 px-2 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="overflow-hidden rounded-2xl bg-surface">
            <h2
              id={idTitolo}
              className="border-b border-border px-4 py-3 text-center text-[13px] font-normal text-muted"
            >
              {TITOLO_SCELTA_FOTO}
            </h2>
            <button
              type="button"
              autoFocus
              onClick={onModifica}
              className={`${CLASSE_VOCE} text-accent`}
            >
              {VOCE_MODIFICA_FOTO}
            </button>
            <button type="button" onClick={onElimina} className={`${CLASSE_VOCE} text-danger`}>
              {VOCE_ELIMINA_FOTO}
            </button>
          </div>
          <div className="overflow-hidden rounded-2xl bg-surface">
            <button
              type="button"
              onClick={onAnnulla}
              className={`${CLASSE_VOCE} font-bold text-accent`}
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
