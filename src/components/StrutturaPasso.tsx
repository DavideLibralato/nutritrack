// La struttura di un passo dell'onboarding (mockup
// docs/mockups/onboarding.html, stile B): il contenuto, che scorre se non
// sta nello schermo, e in fondo il pulsante a pillola ("Iniziamo",
// "Avanti"), con l'eventuale messaggio d'errore sotto.
//
// Il pulsante è l'ultimo elemento della colonna della pagina, che è alta
// quanto la parte visibile dello schermo (useAreaVisibile, in
// src/app/onboarding/page.tsx): con la tastiera aperta resta appena sopra la
// tastiera, come in /aggiungi. In fondo lascia lo spazio della barretta
// home dell'iPhone (safe-area-inset-bottom).
//
// Spento (opacità ridotta, non cliccabile) finché il passo non è completo,
// e mentre il salvataggio è in corso.

import type { ReactNode } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function StrutturaPasso({
  children,
  etichetta,
  attivo,
  inCorso = false,
  errore = null,
  onAvanti,
}: {
  children: ReactNode;
  etichetta: string;
  attivo: boolean;
  inCorso?: boolean;
  errore?: string | null;
  onAvanti: () => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pt-1.5 pb-4">{children}</div>
      <div className="shrink-0 px-[18px] pt-3.5 pb-[calc(1.625rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onAvanti}
          disabled={!attivo || inCorso}
          className={`min-h-[50px] w-full rounded-full bg-accent-strong text-base font-semibold text-on-strong disabled:opacity-45 ${CLASSE_FOCUS}`}
        >
          {etichetta}
        </button>
        <div role="status" className="empty:hidden">
          {errore && <p className="mt-2 text-center text-sm text-warning">{errore}</p>}
        </div>
      </div>
    </>
  );
}
