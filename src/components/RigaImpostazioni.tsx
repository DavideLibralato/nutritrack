// Una riga di un GruppoImpostazioni: icona in un quadratino (facoltativa),
// etichetta, valore grigio a destra e freccia ›. Con `href` è un link a una
// sotto-pagina (tutta la riga è toccabile, alta almeno 52 px); senza, è solo
// una riga da leggere.
//
// La linea di separazione fra due righe la disegna globals.css
// (.riga-impostazioni): parte dal testo, quindi più a destra se la riga ha
// l'icona. Colori solo da token: icona in accento sulla capsula
// (--capsula-attiva), valore e freccia in --tenue.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

export default function RigaImpostazioni({
  etichetta,
  icona,
  valore,
  href,
}: {
  etichetta: string;
  icona?: ReactNode;
  valore?: ReactNode;
  href?: string;
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
      <span className="min-w-0 flex-1 truncate">{etichetta}</span>
      {valore != null && <span className="shrink-0 text-[15px] text-muted">{valore}</span>}
      {href && <FrecciaDestra />}
    </>
  );

  const classe = "riga-impostazioni relative flex min-h-[52px] items-center gap-2.5 px-4 text-base";

  if (href) {
    return (
      <Link href={href} style={stile} className={`${classe} ${CLASSE_FOCUS}`}>
        {contenuto}
      </Link>
    );
  }
  return (
    <div style={stile} className={classe}>
      {contenuto}
    </div>
  );
}

function FrecciaDestra() {
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
