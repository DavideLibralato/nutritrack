// Il campo di ricerca con la lente e la croce «Svuota la ricerca»
// (PUNTO_DI_PARTENZA.md §3, "Aggiungi alimento", "Aspetto"): alto 48 px, su
// fondo bg-surface, angoli tondi. Spostato da src/app/aggiungi/page.tsx con
// le stesse classi (12/11); dal commit 5 di `alimenti-aspetto` lo usa anche
// Impostazioni > Alimenti.
//
// L'etichetta è anche il segnaposto: lo stesso testo, perché il segnaposto
// sparisce appena si scrive e ai lettori di schermo serve sempre.
// `enterKeyHint` e `onKeyDown` li decide la pagina (in Aggiungi: Invio con
// una ricerca che non trova niente apre «Nuovo alimento»).

import type { KeyboardEvent } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IconaLente from "@/components/IconaLente";
import IconaCroce from "@/components/IconaCroce";

export default function CampoRicerca({
  valore,
  onCambia,
  etichetta,
  enterKeyHint = "search",
  onKeyDown,
  disabled,
}: {
  valore: string;
  onCambia: (valore: string) => void;
  etichetta: string;
  enterKeyHint?: "search" | "go";
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  // Spento e attenuato: Impostazioni > Alimenti a catalogo vuoto, dove non
  // c'è niente da cercare. La classe si aggiunge solo qui, così il campo
  // di Aggiungi (mai spento) resta con le classi di sempre.
  disabled?: boolean;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <IconaLente
        size={20}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        value={valore}
        onChange={(e) => onCambia(e.target.value)}
        placeholder={etichetta}
        aria-label={etichetta}
        enterKeyHint={enterKeyHint}
        onKeyDown={onKeyDown}
        disabled={disabled}
        className={`h-12 w-full rounded-full border border-border bg-surface pl-12 pr-12 text-base ${CLASSE_FOCUS}${disabled ? " opacity-[0.55]" : ""}`}
      />
      {valore !== "" && (
        <button
          type="button"
          onClick={() => onCambia("")}
          aria-label="Svuota la ricerca"
          className={`absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted ${CLASSE_FOCUS}`}
        >
          <IconaCroce />
        </button>
      )}
    </div>
  );
}
