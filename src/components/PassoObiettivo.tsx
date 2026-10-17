// Passo 4 dell'onboarding, "Cosa vuoi ottenere?" (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"; mockup docs/mockups/onboarding.html, stile B):
// l'obiettivo e il peso obiettivo facoltativo.
//
// Controllato come gli altri passi: i valori stanno nella pagina. Avanti
// NON salva: obiettivo e target sono una sezione sola di salvaProfilo, e
// sulla tabella obiettivi kcal e macro sono obbligatori, quindi si salva
// tutto insieme alla fine del passo 5. Si accende con obiettivoCompleto.

import type { TipoObiettivo } from "@/lib/db/tipi";
import { obiettivoCompleto } from "@/lib/onboarding/passiOnboarding";
import {
  CLASSE_CAMPO,
  CLASSE_DOMANDA,
  CLASSE_ETICHETTA,
  CLASSE_RIQUADRO_CAMPO,
} from "@/lib/onboarding/classiOnboarding";
import StrutturaPasso from "./StrutturaPasso";
import SchedeObiettivo from "./SchedeObiettivo";

export default function PassoObiettivo({
  tipo,
  pesoObiettivo,
  onScegliTipo,
  onCambiaPeso,
  onAvanti,
}: {
  tipo: TipoObiettivo | null;
  pesoObiettivo: string;
  onScegliTipo: (tipo: TipoObiettivo) => void;
  onCambiaPeso: (valore: string) => void;
  onAvanti: () => void;
}) {
  return (
    <StrutturaPasso etichetta="Avanti" attivo={obiettivoCompleto(tipo, pesoObiettivo)} onAvanti={onAvanti}>
      <h1 className={`${CLASSE_DOMANDA} mb-6`}>Cosa vuoi ottenere?</h1>

      <div className="mb-5">
        <SchedeObiettivo valore={tipo} onScegli={onScegliTipo} />
      </div>

      <div className="mb-5">
        <label htmlFor="onboarding-peso-obiettivo" className={CLASSE_ETICHETTA}>
          Peso obiettivo (facoltativo)
        </label>
        <div className={CLASSE_RIQUADRO_CAMPO}>
          <input
            id="onboarding-peso-obiettivo"
            type="text"
            inputMode="decimal"
            placeholder="—"
            value={pesoObiettivo}
            onChange={(e) => onCambiaPeso(e.target.value)}
            className={CLASSE_CAMPO}
          />
          <span className="text-muted">kg</span>
        </div>
      </div>
    </StrutturaPasso>
  );
}
