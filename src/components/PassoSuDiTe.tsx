// Passo 2 dell'onboarding, "Parlami un po' di te" (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"; mockup docs/mockups/onboarding.html, stile B).
// Gli stessi quattro campi di Impostazioni > Profilo, con le stesse scelte
// (opzioniProfilo.ts), a domanda grande.
//
// È un componente "controllato": i valori stanno nella pagina, che li passa
// qui e riceve ogni modifica con onCambia. Così tornando indietro e avanti i
// valori scritti restano, anche se questo componente sparisce e ricompare.
//
// Avanti si accende con suDiTeCompleto (passiOnboarding.ts): il sesso
// toccato, anche "Non indicato", e gli altri tre campi validi.

import type { LivelloAttivita } from "@/lib/db/tipi";
import { oggiLocale } from "@/lib/dataGiorno";
import { OPZIONI_ATTIVITA, OPZIONI_SESSO } from "@/lib/profilo/opzioniProfilo";
import { suDiTeCompleto, type ValoriSuDiTe } from "@/lib/onboarding/passiOnboarding";
import {
  CLASSE_CAMPO,
  CLASSE_DOMANDA,
  CLASSE_ETICHETTA,
  CLASSE_RIQUADRO_CAMPO,
  CLASSE_SOTTO,
} from "@/lib/onboarding/classiOnboarding";
import StrutturaPasso from "./StrutturaPasso";
import TessereScelta from "./TessereScelta";

export default function PassoSuDiTe({
  valori,
  onCambia,
  onAvanti,
  inCorso,
  errore,
}: {
  valori: ValoriSuDiTe;
  onCambia: (valori: ValoriSuDiTe) => void;
  onAvanti: () => void;
  inCorso: boolean;
  errore: string | null;
}) {
  const cambia = (campi: Partial<ValoriSuDiTe>) => onCambia({ ...valori, ...campi });

  return (
    <StrutturaPasso
      etichetta="Avanti"
      attivo={suDiTeCompleto(valori)}
      inCorso={inCorso}
      errore={errore}
      onAvanti={onAvanti}
    >
      <h1 className={CLASSE_DOMANDA}>Parlami un po&apos; di te</h1>
      <p className={CLASSE_SOTTO}>Servono solo per il calcolo.</p>

      <div className="mb-5">
        <p className={CLASSE_ETICHETTA}>Sesso</p>
        <TessereScelta
          etichetta="Sesso"
          tessere={OPZIONI_SESSO}
          valore={valori.sesso}
          onScegli={(sesso) => cambia({ sesso })}
        />
      </div>

      <div className="mb-5">
        <label htmlFor="onboarding-data-nascita" className={CLASSE_ETICHETTA}>
          Data di nascita
        </label>
        <div className={CLASSE_RIQUADRO_CAMPO}>
          {/* campo-data: a tutta larghezza, senza il controllo nativo di
              Safari che ignorerebbe width: 100% (globals.css,
              campiData.test.ts). */}
          <input
            id="onboarding-data-nascita"
            type="date"
            value={valori.dataNascita}
            max={oggiLocale()}
            onChange={(e) => cambia({ dataNascita: e.target.value })}
            className={`campo-data ${CLASSE_CAMPO}`}
          />
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="onboarding-altezza" className={CLASSE_ETICHETTA}>
          Altezza
        </label>
        <div className={CLASSE_RIQUADRO_CAMPO}>
          <input
            id="onboarding-altezza"
            type="text"
            inputMode="decimal"
            value={valori.altezzaCm}
            onChange={(e) => cambia({ altezzaCm: e.target.value })}
            className={CLASSE_CAMPO}
          />
          <span className="text-muted">cm</span>
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="onboarding-attivita" className={CLASSE_ETICHETTA}>
          Quanto ti muovi
        </label>
        <div className={CLASSE_RIQUADRO_CAMPO}>
          <select
            id="onboarding-attivita"
            value={valori.livelloAttivita}
            onChange={(e) => cambia({ livelloAttivita: e.target.value as LivelloAttivita | "" })}
            className={CLASSE_CAMPO}
          >
            <option value="">Scegli…</option>
            {OPZIONI_ATTIVITA.map((o) => (
              <option key={o.valore} value={o.valore}>
                {o.etichetta}
              </option>
            ))}
          </select>
        </div>
      </div>
    </StrutturaPasso>
  );
}
