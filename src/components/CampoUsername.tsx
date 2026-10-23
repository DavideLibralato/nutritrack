// Il campo dello username con la "@" davanti e la riga d'esito sotto
// (PUNTO_DI_PARTENZA.md §3, "Amici"): in "Scegli il tuo nome su Libra" e,
// dal branch username-dopo-accesso, nel passo dell'onboarding. Cosa dire
// sotto il campo lo decide chi lo usa (con useSceltaUsername); qui solo
// l'aspetto.
//
// La "@" sta dentro il campo ma non fa parte del valore. Niente parola
// "username" nell'aria-label, perché iPhone non lo prenda per un campo di
// accesso: il perché in SheetUsername. type="search" per lo stesso motivo.
// La riga d'esito ha role="status" (uno screen reader la legge quando
// cambia) e un'altezza minima fissa, così comparendo non fa saltare quello
// che sta sotto.

import { CLASSE_FOCUS } from "@/lib/classeFocus";

export type TonoEsitoUsername = "positivo" | "avviso" | "neutro";

const CLASSE_TONO: Record<TonoEsitoUsername, string> = {
  positivo: "text-accent",
  avviso: "text-warning",
  neutro: "text-muted",
};

// "normale": la card di Amici. "onboarding": le misure dei riquadri degli
// altri passi (CLASSE_RIQUADRO_CAMPO in classiOnboarding.ts: alto 54 px,
// angoli da 16 px, testo a 17 px).
const CLASSI_VARIANTE = {
  normale: { chiocciola: "left-2", campo: "rounded-lg bg-background p-2 pl-7 text-base" },
  onboarding: {
    chiocciola: "left-4 text-[17px]",
    campo: "min-h-[54px] rounded-2xl bg-surface py-3 pr-4 pl-9 text-[17px]",
  },
};

export default function CampoUsername({
  id,
  ariaLabel,
  enterKeyHint,
  valore,
  onCambia,
  onInvio,
  esito,
  tono,
  invalido,
  variante = "normale",
}: {
  id: string;
  ariaLabel: string;
  enterKeyHint: "go" | "next" | "done";
  valore: string;
  onCambia: (valore: string) => void;
  onInvio: () => void;
  esito: string;
  tono: TonoEsitoUsername;
  invalido: boolean;
  variante?: keyof typeof CLASSI_VARIANTE;
}) {
  const idEsito = `${id}-esito`;
  const classi = CLASSI_VARIANTE[variante];
  return (
    <div>
      <div className="relative">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${classi.chiocciola}`}
        >
          @
        </span>
        <input
          id={id}
          type="search"
          enterKeyHint={enterKeyHint}
          aria-label={ariaLabel}
          value={valore}
          onChange={(e) => onCambia(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onInvio();
          }}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="nickname"
          spellCheck={false}
          aria-describedby={idEsito}
          aria-invalid={invalido}
          className={`w-full border border-border ${classi.campo} ${CLASSE_FOCUS}`}
        />
      </div>
      <p id={idEsito} role="status" className={`mt-1 min-h-5 text-sm ${CLASSE_TONO[tono]}`}>
        {esito}
      </p>
    </div>
  );
}
