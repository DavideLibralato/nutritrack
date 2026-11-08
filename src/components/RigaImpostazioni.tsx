// Una riga di un GruppoImpostazioni: icona in un quadratino (facoltativa),
// etichetta, valore grigio a destra e freccia ›. Con `href` è un link a una
// sotto-pagina (tutta la riga è toccabile, alta almeno 52 px); con
// `onClick` è un pulsante, stesso aspetto (Pasti e orari: apre lo sheet del
// pasto); senza nessuno dei due, è solo una riga da leggere.
//
// La linea di separazione fra due righe la disegna globals.css
// (.riga-impostazioni): parte dal testo, quindi più a destra se la riga ha
// l'icona. Colori solo da token: icona in accento sulla capsula
// (--capsula-attiva), valore e freccia in --tenue. Con `pericolo`
// l'etichetta è rossa (--pericolo): solo per le azioni che non si possono
// annullare ("Elimina il mio account", sezione 7).
//
// Dal 08/11 (Esporta, riga «Esporta il diario per Excel»): `sottotitolo`,
// una riga di testo piccolo sotto l'etichetta, che va a capo invece di
// accorciarsi; `spenta`, il pulsante non si tocca e la riga è più chiara.

//
// Il link passa dal guardiano delle modifiche non salvate (LinkProtetto,
// dal 18/10/2026): la riga "Password" sta in Profilo, che ha un modulo, e
// con modifiche da salvare deve chiedere "Esci senza salvare?" come
// "‹ Impostazioni". Nelle pagine senza modulo si comporta come un Link.

import type { CSSProperties, ReactNode } from "react";
import LinkProtetto from "./LinkProtetto";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function RigaImpostazioni({
  etichetta,
  icona,
  valore,
  href,
  onClick,
  pericolo = false,
  sottotitolo,
  spenta = false,
}: {
  etichetta: string;
  icona?: ReactNode;
  valore?: ReactNode;
  href?: string;
  onClick?: () => void;
  pericolo?: boolean;
  sottotitolo?: ReactNode;
  spenta?: boolean;
}) {
  const stile = { "--rientro-linea": icona ? "58px" : "16px" } as CSSProperties;
  const contenuto = (
    <>
      {icona && (
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--capsula-attiva)] text-accent"
        >
          {icona}
        </span>
      )}
      {sottotitolo ? (
        <span className="min-w-0 flex-1 py-2.5">
          <span className={`block truncate ${pericolo ? "text-danger" : ""}`}>{etichetta}</span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">{sottotitolo}</span>
        </span>
      ) : (
        <span className={`min-w-0 flex-1 truncate ${pericolo ? "text-danger" : ""}`}>{etichetta}</span>
      )}
      {valore != null && <span className="shrink-0 text-[15px] text-muted">{valore}</span>}
      {(href || onClick) && <FrecciaDestra />}
    </>
  );

  const classe = "riga-impostazioni relative flex min-h-[52px] items-center gap-2.5 px-4 text-base";

  if (href) {
    return (
      <LinkProtetto href={href} style={stile} className={`${classe} ${CLASSE_FOCUS}`}>
        {contenuto}
      </LinkProtetto>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={spenta}
        style={stile}
        className={`${classe} w-full text-left disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        {contenuto}
      </button>
    );
  }
  return (
    <div style={stile} className={classe}>
      {contenuto}
    </div>
  );
}

// Esportata: la usa anche "Esci e rientra" nel gruppo Dati di
// Impostazioni > Sincronizzazione (EsciAccount, variante "riga").
export function FrecciaDestra() {
  return (
    <svg
      aria-hidden
      width="9"
      height="15"
      viewBox="0 0 9 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-muted opacity-70"
    >
      <path d="M1.5 1.5l6 6-6 6" />
    </svg>
  );
}
