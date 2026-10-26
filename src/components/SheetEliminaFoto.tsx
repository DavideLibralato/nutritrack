"use client";

// La conferma di Elimina foto (mockup docs/mockups/foto-profilo.html,
// schermata 3): "Eliminare la foto?", il testo, il pulsante rosso pieno e
// "Annulla" sotto. Una conferma prima perché il file si cancella davvero:
// niente barra "Annulla" dopo. Un tentativo fallito resta qui, con il suo
// errore, e si può ripetere.

import { CLASSE_FOCUS } from "@/lib/classeFocus";
import {
  TESTO_CONFERMA_ELIMINA,
  TITOLO_CONFERMA_ELIMINA,
  VOCE_ELIMINA_FOTO,
} from "@/lib/foto/testiFoto";
import FoglioDalBasso from "./FoglioDalBasso";

export default function SheetEliminaFoto({
  inCorso,
  errore,
  onConferma,
  onAnnulla,
}: {
  inCorso: boolean;
  errore: string | null;
  onConferma: () => void;
  onAnnulla: () => void;
}) {
  return (
    <FoglioDalBasso
      titolo={TITOLO_CONFERMA_ELIMINA}
      ruolo="alertdialog"
      bloccato={inCorso}
      onChiudi={onAnnulla}
    >
      <p className="-mt-1.5 text-[15px] text-muted">{TESTO_CONFERMA_ELIMINA}</p>
      {errore && (
        <p role="alert" className="text-sm text-warning">
          {errore}
        </p>
      )}
      <button
        type="button"
        onClick={onConferma}
        disabled={inCorso}
        className={`min-h-[46px] w-full rounded-[10px] bg-danger-strong font-semibold text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        {inCorso ? "Eliminazione…" : VOCE_ELIMINA_FOTO}
      </button>
      <button
        type="button"
        autoFocus
        onClick={onAnnulla}
        disabled={inCorso}
        className={`self-center rounded-lg px-3 py-1 disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        Annulla
      </button>
    </FoglioDalBasso>
  );
}
