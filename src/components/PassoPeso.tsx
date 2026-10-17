// Passo 3 dell'onboarding, "Quanto pesi oggi?" (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"; mockup docs/mockups/onboarding.html, stile B):
// un solo campo grande al centro, in kg, con la virgola.
//
// Controllato come PassoSuDiTe: il valore sta nella pagina. Avanti si
// accende con un peso valido (pesoDaRegistrare, cioè leggiPesoKg: lo
// stesso controllo di "Registra peso").

import { pesoDaRegistrare } from "@/lib/onboarding/passiOnboarding";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { CLASSE_DOMANDA, CLASSE_NOTA, CLASSE_SOTTO } from "@/lib/onboarding/classiOnboarding";
import StrutturaPasso from "./StrutturaPasso";

export default function PassoPeso({
  valore,
  onCambia,
  onAvanti,
  inCorso,
  errore,
}: {
  valore: string;
  onCambia: (valore: string) => void;
  onAvanti: () => void;
  inCorso: boolean;
  errore: string | null;
}) {
  return (
    <StrutturaPasso
      etichetta="Avanti"
      attivo={pesoDaRegistrare(valore) !== null}
      inCorso={inCorso}
      errore={errore}
      onAvanti={onAvanti}
    >
      <h1 className={CLASSE_DOMANDA}>Quanto pesi oggi?</h1>
      <p className={CLASSE_SOTTO}>Sarà la tua prima pesata.</p>

      <div className="mt-[34px] mb-2.5 flex items-baseline justify-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          aria-label="Peso in kg"
          value={valore}
          onChange={(e) => onCambia(e.target.value)}
          className={`w-[180px] rounded border-0 border-b-2 border-border bg-transparent p-0 text-center font-display text-[80px] leading-none font-bold tabular-nums focus:border-accent ${CLASSE_FOCUS}`}
        />
        <span className="font-display text-[28px] text-muted">kg</span>
      </div>
      <p className={`${CLASSE_NOTA} text-center`}>
        Ne puoi registrare una al giorno in Impostazioni &gt; Peso.
      </p>
    </StrutturaPasso>
  );
}
