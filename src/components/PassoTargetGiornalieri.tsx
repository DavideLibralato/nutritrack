// Passo 5 dell'onboarding, gli obiettivi giornalieri (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"; mockup docs/mockups/onboarding.html, stile B):
// le calorie in grande, sotto grassi, carboidrati e proteine, nell'ordine
// delle etichette dei prodotti (sezione 7, "Le barre macro").
//
// I numeri: la proposta (propostaPasso5, calcolata dalla pagina) finché
// l'utente non li tocca; da lì in poi i suoi (`manuali`, non null). La
// pagina tiene `manuali`; qui si mostra e si raccoglie:
//   - "Torna alla proposta" → di nuovo la proposta (manuali null);
//   - "Ho già i miei valori" → quattro campi vuoti, il fuoco sulle calorie.
// Senza proposta (sesso non indicato, o dati mancanti) i campi partono
// vuoti e c'è il testo che spiega perché.
//
// "Inizia a usare Libra" si accende con i quattro numeri validi
// (targetCompleti, cioè validaModulo: anche lo zero va bene).

import { useRef } from "react";
import type { ValoriTarget } from "@/lib/profilo/salvataggioProfilo";
import {
  TARGET_VUOTO,
  targetCompleti,
  targetDelPasso5,
  type PropostaPasso5,
} from "@/lib/onboarding/passiOnboarding";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { CLASSE_DOMANDA, CLASSE_NOTA, CLASSE_SOTTO } from "@/lib/onboarding/classiOnboarding";
import StrutturaPasso from "./StrutturaPasso";

const MACRO: { chiave: keyof ValoriTarget; etichetta: string }[] = [
  { chiave: "grassi", etichetta: "Grassi g" },
  { chiave: "carboidrati", etichetta: "Carboidrati g" },
  { chiave: "proteine", etichetta: "Proteine g" },
];

const CLASSE_LINK = `rounded font-semibold text-accent ${CLASSE_FOCUS}`;

export default function PassoTargetGiornalieri({
  proposta,
  manuali,
  onCambiaManuali,
  onInizia,
  inCorso,
  errore,
}: {
  proposta: PropostaPasso5;
  manuali: ValoriTarget | null;
  onCambiaManuali: (valori: ValoriTarget | null) => void;
  onInizia: () => void;
  inCorso: boolean;
  errore: string | null;
}) {
  const rifCalorie = useRef<HTMLInputElement>(null);
  const conProposta = proposta.esito === "proposta";
  const target = targetDelPasso5(proposta, manuali);

  function cambia(chiave: keyof ValoriTarget, valore: string) {
    onCambiaManuali({ ...target, [chiave]: valore });
  }

  function hoGiaIMieiValori() {
    onCambiaManuali(TARGET_VUOTO);
    rifCalorie.current?.focus();
  }

  const propostaIntatta = conProposta && manuali === null;

  return (
    <StrutturaPasso
      etichetta={inCorso ? "Salvataggio…" : "Inizia a usare Libra"}
      attivo={targetCompleti(target)}
      inCorso={inCorso}
      errore={errore}
      onAvanti={onInizia}
    >
      <h1 className={CLASSE_DOMANDA}>{propostaIntatta ? "Ecco la tua proposta" : "I tuoi obiettivi"}</h1>
      <p className={`${CLASSE_SOTTO} mb-2`}>
        {propostaIntatta ? (
          "Calcolato dai tuoi dati. Tocca un numero per cambiarlo."
        ) : conProposta ? (
          <>
            Hai cambiato la proposta.{" "}
            <button type="button" onClick={() => onCambiaManuali(null)} className={CLASSE_LINK}>
              Torna alla proposta
            </button>
          </>
        ) : proposta.esito === "sesso-non-indicato" ? (
          "Con il sesso non indicato non posso calcolare una proposta: scrivi i tuoi valori, per esempio quelli del nutrizionista."
        ) : (
          "Non ho tutti i dati per una proposta: scrivi i tuoi valori."
        )}
      </p>

      <div className="mt-2.5 mb-1 flex items-baseline gap-2">
        <label htmlFor="onboarding-calorie" className="sr-only">
          Calorie
        </label>
        <input
          ref={rifCalorie}
          id="onboarding-calorie"
          type="text"
          inputMode="numeric"
          placeholder="—"
          value={target.kcal}
          onChange={(e) => cambia("kcal", e.target.value)}
          className={`w-[200px] min-w-0 rounded border-0 border-b-2 border-border bg-transparent p-0 font-display text-[64px] leading-none font-bold tabular-nums focus:border-accent ${CLASSE_FOCUS}`}
        />
        <span className="font-display text-[22px] text-muted">kcal al giorno</span>
      </div>

      <div className="mt-4 mb-3.5 grid grid-cols-3 gap-2">
        {MACRO.map((m) => (
          <label
            key={m.chiave}
            className="flex flex-col gap-1 rounded-2xl border border-border bg-surface px-3 py-2.5 text-[12.5px] font-semibold text-muted"
          >
            {m.etichetta}
            <input
              type="text"
              inputMode="numeric"
              placeholder="—"
              value={target[m.chiave]}
              onChange={(e) => cambia(m.chiave, e.target.value)}
              className={`w-full min-w-0 rounded bg-transparent p-0 font-display text-2xl font-bold text-foreground tabular-nums ${CLASSE_FOCUS}`}
            />
          </label>
        ))}
      </div>

      {conProposta && (
        <p className="mb-3">
          <button type="button" onClick={hoGiaIMieiValori} className={`${CLASSE_LINK} text-[15px]`}>
            Ho già i miei valori
          </button>
        </p>
      )}
      <p className={CLASSE_NOTA}>Giorni di allenamento, pasti e orari e colore dell&apos;app li trovi in Impostazioni.</p>
    </StrutturaPasso>
  );
}
