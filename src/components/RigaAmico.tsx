// Una persona nella pagina Amici (mockup docs/mockups/amici.html, schermata
// 4): iniziali in un cerchio (o la foto profilo, per gli amici accettati:
// branch foto-profilo, CerchioFoto), "@username" e, sotto, una riga grigia
// facoltativa ("Vuole essere tuo amico", "In attesa che accetti", "Non
// accettata"); a destra i pulsanti della riga (`azioni`). Con `onClick`
// tutta la riga è un pulsante con la freccia (gli amici: il tocco apre la
// conferma di Rimuovi).
//
// La linea fra due righe la disegna globals.css (.riga-impostazioni), che
// parte dal testo: qui dopo il cerchio.

import type { CSSProperties, ReactNode } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { inizialiUsername } from "@/lib/amici/amicizie";
import { etichettaAmico } from "@/lib/amici/testiAmici";
import CerchioFoto from "./CerchioFoto";

// Il cerchio da 38 px di un amico: lo stesso nel foglio "Condividi con".
export const CLASSE_CERCHIO_AMICO =
  "size-[38px] bg-[var(--capsula-attiva)] text-sm font-bold text-accent";

export default function RigaAmico({
  username,
  foto,
  sotto,
  azioni,
  onClick,
  disattivata = false,
}: {
  username: string | null;
  // L'indirizzo firmato della sua foto (useFotoAmici), solo per gli amici
  // accettati; assente → iniziali.
  foto?: string | null;
  sotto?: string;
  azioni?: ReactNode;
  onClick?: () => void;
  disattivata?: boolean;
}) {
  const stile = { "--rientro-linea": "66px" } as CSSProperties;
  const contenuto = (
    <>
      <CerchioFoto
        indirizzo={foto}
        iniziali={inizialiUsername(username)}
        classe={CLASSE_CERCHIO_AMICO}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{etichettaAmico(username)}</span>
        {sotto && <span className="block text-[13px] leading-snug text-muted">{sotto}</span>}
      </span>
    </>
  );
  const classe = "riga-impostazioni relative flex min-h-[60px] items-center gap-3 px-4 py-2 text-base";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disattivata}
        style={stile}
        className={`${classe} w-full text-left disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        {contenuto}
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
      </button>
    );
  }

  return (
    <div style={stile} className={classe}>
      {contenuto}
      {azioni && <div className="flex shrink-0 items-center gap-2">{azioni}</div>}
    </div>
  );
}

// I due pulsanti delle righe: pieno (Accetta) e bordato (Rifiuta, Ok,
// Annulla). Spenti mentre un'azione sulla stessa riga è in corso.
const BASE_PULSANTE = `min-h-[38px] rounded-[10px] px-3 py-2 text-sm font-semibold disabled:opacity-50 ${CLASSE_FOCUS}`;

export function PulsanteRiga({
  children,
  pieno = false,
  disabled,
  onClick,
  etichettaAccessibile,
}: {
  children: ReactNode;
  pieno?: boolean;
  disabled?: boolean;
  onClick: () => void;
  etichettaAccessibile?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etichettaAccessibile}
      className={`${BASE_PULSANTE} ${
        pieno ? "bg-accent-strong text-on-strong" : "border border-border text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
