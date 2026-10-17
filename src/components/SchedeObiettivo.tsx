// Le tre schede dell'obiettivo al passo 4 dell'onboarding (mockup
// docs/mockups/onboarding.html, stile B): una sotto l'altra, il nome in
// grassetto e una riga sotto che dice cosa vuol dire per le calorie.
// Pulsanti con aria-pressed dentro un gruppo "Obiettivo", come
// TessereScelta.
//
// Nomi da OPZIONI_OBIETTIVO (come in Obiettivi), righe da
// descrizioneObiettivo, che prende i numeri da calcolaFabbisogno. `valore`
// null = nessuna scelta: si parte così. La scheda scelta: capsula d'accento
// con il bordo d'accento, come le tessere del passo 2; il testo resta del
// colore normale, e la riga sotto tenue.

import { OPZIONI_OBIETTIVO } from "@/lib/profilo/opzioniProfilo";
import { descrizioneObiettivo } from "@/lib/onboarding/passiOnboarding";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import type { TipoObiettivo } from "@/lib/db/tipi";

export default function SchedeObiettivo({
  valore,
  onScegli,
}: {
  valore: TipoObiettivo | null;
  onScegli: (valore: TipoObiettivo) => void;
}) {
  return (
    <div role="group" aria-label="Obiettivo" className="flex flex-col gap-2.5">
      {OPZIONI_OBIETTIVO.map((o) => {
        const scelta = o.valore === valore;
        return (
          <button
            key={o.valore}
            type="button"
            aria-pressed={scelta}
            onClick={() => onScegli(o.valore)}
            className={`flex flex-col gap-[3px] rounded-[18px] border px-4 py-3.5 text-left text-foreground ${
              scelta
                ? "border-accent bg-[var(--capsula-attiva)] shadow-[inset_0_0_0_1px_var(--accento)]"
                : "border-border bg-surface"
            } ${CLASSE_FOCUS}`}
          >
            <span className="text-[17px] font-bold">{o.etichetta}</span>
            <span className="text-[13.5px] leading-[1.4] text-muted">{descrizioneObiettivo(o.valore)}</span>
          </button>
        );
      })}
    </div>
  );
}
