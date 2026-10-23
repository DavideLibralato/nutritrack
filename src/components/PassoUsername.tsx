// Il passo "Scegli il tuo nome su Libra" dell'onboarding, subito dopo il
// Benvenuto, solo per chi non ha ancora uno username (PUNTO_DI_PARTENZA.md
// §3, Amici, "Lo username dopo l'accesso"; quando compare lo decide
// mostraPassoUsername in src/lib/onboarding/passoUsername.ts).
//
// Stesso aspetto degli altri passi (StrutturaPasso, domanda e riga sotto)
// e lo stesso campo di Amici (CampoUsername). La logica è
// useSceltaUsername: la pagina la tiene accesa e la passa qui, così il
// campo ritrova il suo valore tornando indietro da "Su di te".
//
// Obbligatorio, quindi la barra in alto non ha "Dopo". Si salta solo
// quando non si può verificare se il nome è libero: offline, o con un
// salvataggio la cui risposta non è arrivata. Allora compare "Lo scelgo
// dopo", e lo username lo chiede Amici alla prima apertura. Con il nome
// preso nel frattempo, invece, si resta qui: basta sceglierne un altro.

import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { CLASSE_DOMANDA, CLASSE_NOTA, CLASSE_SOTTO } from "@/lib/onboarding/classiOnboarding";
import type { SceltaUsernameInCorso } from "@/lib/amici/useSceltaUsername";
import {
  TESTO_NOME_IN_USO,
  TESTO_NOME_SENZA_RETE_ONBOARDING,
  TESTO_USERNAME_REGOLE,
  testoStatoUsername,
} from "@/lib/amici/testiUsername";
import CampoUsername from "./CampoUsername";
import StrutturaPasso from "./StrutturaPasso";

export default function PassoUsername({
  scelta,
  onSalta,
}: {
  scelta: SceltaUsernameInCorso;
  onSalta: () => void;
}) {
  const salta = !scelta.online || scelta.esitoFallito === "errore";
  const esito =
    scelta.errore ??
    (scelta.online
      ? testoStatoUsername(scelta.stato, "quando vai avanti", TESTO_NOME_IN_USO)
      : TESTO_NOME_SENZA_RETE_ONBOARDING);

  return (
    <StrutturaPasso
      etichetta="Avanti"
      attivo={scelta.salvabile}
      inCorso={scelta.inCorso}
      onAvanti={() => void scelta.salva()}
    >
      <h1 className={CLASSE_DOMANDA}>Scegli il tuo nome su Libra</h1>
      <p className={CLASSE_SOTTO}>
        Gli amici ti trovano solo con il nome esatto. Potrai cambiarlo da Profilo.
      </p>

      <CampoUsername
        id="onboarding-nome-utente"
        ariaLabel="Il tuo nome su Libra"
        enterKeyHint="next"
        valore={scelta.valore}
        onCambia={scelta.cambia}
        onInvio={() => void scelta.salva()}
        esito={esito}
        tono={
          scelta.errore || scelta.daCorreggere || !scelta.online
            ? "avviso"
            : scelta.stato === "disponibile"
              ? "positivo"
              : "neutro"
        }
        invalido={scelta.daCorreggere}
        variante="onboarding"
      />
      <p className={`${CLASSE_NOTA} mt-1`}>{TESTO_USERNAME_REGOLE}</p>

      {salta && (
        <button
          type="button"
          onClick={onSalta}
          className={`mt-5 rounded text-sm text-foreground underline ${CLASSE_FOCUS}`}
        >
          Lo scelgo dopo
        </button>
      )}
    </StrutturaPasso>
  );
}
