// La scelta del colore principale in Impostazioni > Aspetto (mockup
// docs/mockups/colore-principale.html): quattro pallini affiancati con il
// nome sotto. Quello scelto ha un anello del colore del testo intorno e il
// nome in grassetto.
//
// I pallini non hanno colori propri: ognuno è un elemento con
// data-accento="blu" (o gli altri), e globals.css ricalcola lì dentro
// l'accento per quel colore, nel tema in uso. Così mostrano il colore vero,
// chiaro o scuro, e un colore nuovo aggiunto in CSS e in ACCENTI compare da
// solo.
//
// Veri <input type="radio">, come SelettoreTema: tutto il pallino col nome
// è toccabile, e da tastiera le frecce passano da un colore all'altro.

import { NOMI_ACCENTO, type Accento } from "@/lib/tema";

export default function SelettoreAccento({
  accenti,
  scelta,
  onCambia,
}: {
  accenti: readonly Accento[];
  // null: scelta non ancora letta, nessun pallino segnato.
  scelta: Accento | null;
  onCambia: (scelta: Accento) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Colore principale" className="flex justify-between px-[18px] pt-4 pb-3">
      {accenti.map((accento) => {
        const attivo = accento === scelta;
        return (
          <label key={accento} className="flex cursor-pointer flex-col items-center gap-[7px]">
            <input
              type="radio"
              name="accento"
              value={accento}
              checked={attivo}
              onChange={() => onCambia(accento)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              data-accento={accento}
              className={`block size-[34px] rounded-full bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-foreground peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
                attivo ? "outline-[2.5px] outline-offset-[3px] outline-foreground outline-solid" : ""
              }`}
            />
            <span className={`text-xs ${attivo ? "font-semibold text-foreground" : "text-muted"}`}>
              {NOMI_ACCENTO[accento]}
            </span>
          </label>
        );
      })}
    </div>
  );
}
