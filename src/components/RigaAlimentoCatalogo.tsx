"use client";

// Una riga di Impostazioni > Alimenti, scheda «I miei» (PUNTO_DI_PARTENZA.md,
// sezione 3, "Alimenti"; dal 12/11 l'aspetto di Aggiungi, mockup
// docs/mockups/alimenti-aspetto.html, versione B): il nome, con la marca se
// c'è ("Yogurt · Fage", per distinguere due omonimi), e sotto le kcal per
// 100 g. Il numero di usi non si mostra: serve solo a ordinare. Le classi
// sono quelle delle righe di Aggiungi (classiElenchi.ts); la riga sta nel
// riquadro della pagina (CLASSE_RIQUADRO), che disegna le linee fra le
// righe.
//
// Due bersagli, come in Aggiungi: il nome e la matita a destra. Tutti e due
// chiamano `onTocco`, che decide la pagina: fuori dalla selezione apre
// "Modifica alimento" (la matita dice che la riga si modifica), in
// selezione spunta o toglie la spunta. In selezione la matita non c'è e a
// sinistra compare il cerchio, che spunta anche lui.
//
// Il tieni premuto lo gestisce l'hook sulla lista (useTieniPremuto), che
// riconosce la riga da data-tieni-premuto="alimento" e data-id: stanno sul
// <li>, così il gesto parte da tutta la riga, matita compresa, e la riga si
// solleva intera come in Oggi. La classe riga-tieni-premuto toglie il menu
// di selezione del testo di Safari e disegna la riga sollevata
// (globals.css). Il click che arriva dopo il gesto lo ferma l'hook su tutta
// la lista, da qualunque dei due pulsanti.

import type { Alimento } from "@/lib/db/tipi";
import { etichettaAlimento } from "@/lib/repository/alimenti";
import {
  CLASSE_MATITA,
  CLASSE_NOME_RIGA,
  CLASSE_RIGA,
  CLASSE_SOTTOTITOLO_RIGA,
} from "@/lib/classiElenchi";
import IconaMatita from "@/components/IconaMatita";

interface Props {
  alimento: Alimento;
  // null fuori dalla selezione: niente cerchio. true/false in selezione.
  selezionato: boolean | null;
  onTocco: () => void;
}

export default function RigaAlimentoCatalogo({ alimento, selezionato, onTocco }: Props) {
  const etichetta = etichettaAlimento(alimento);
  return (
    <li
      data-tieni-premuto="alimento"
      data-id={alimento.id}
      className={`riga-tieni-premuto ${CLASSE_RIGA}`}
    >
      {/* Il cerchio: largo quanto lui più lo stacco (mockup: 22 + 6 px),
          alto quanto la riga, così il tocco lo prende comodo. Per i
          lettori di schermo conta il pulsante del nome, con aria-pressed. */}
      {selezionato !== null && (
        <button
          type="button"
          onClick={onTocco}
          tabIndex={-1}
          aria-hidden
          className="flex w-7 shrink-0 items-center self-stretch"
        >
          <Spunta piena={selezionato} />
        </button>
      )}
      <button
        type="button"
        onClick={onTocco}
        aria-pressed={selezionato ?? undefined}
        className={CLASSE_NOME_RIGA}
      >
        <span className="truncate">{etichetta}</span>
        <span className={CLASSE_SOTTOTITOLO_RIGA}>
          {Math.round(alimento.kcal_100g)} kcal / 100 g
          {/* Una copia presa dal catalogo precaricato, per riconoscerla
              (PUNTO §10.1; scelta di Davide, 08/11). */}
          {(alimento.catalogo_id ?? null) !== null && (
            <>
              {" · "}
              <span className="font-medium text-accent">dal catalogo</span>
            </>
          )}
        </span>
      </button>
      {selezionato === null && (
        <button
          type="button"
          onClick={onTocco}
          aria-label={`Modifica ${etichetta}`}
          className={CLASSE_MATITA}
        >
          <IconaMatita />
        </button>
      )}
    </li>
  );
}

// Il cerchio della selezione: vuoto, o pieno nel colore principale con la
// spunta. Come nel mockup.
function Spunta({ piena }: { piena: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${
        piena ? "border-accent-strong bg-accent-strong text-on-strong" : "border-border"
      }`}
    >
      {piena && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </span>
  );
}
