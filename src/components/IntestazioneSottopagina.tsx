// In cima a ogni sotto-pagina di Impostazioni: "‹ Impostazioni" per tornare
// all'elenco (o "‹ Profilo" per Cambia password) e il titolo grande della
// pagina.
//
// È un link a /impostazioni, non un "torna indietro" (router.back()): se la
// pagina è stata aperta da un indirizzo diretto, o ricaricata offline, la
// cronologia è vuota e "indietro" non saprebbe dove andare. Passa dal
// guardiano delle modifiche non salvate (LinkProtetto): con modifiche da
// salvare chiede prima "Esci senza salvare?".

import LinkProtetto from "./LinkProtetto";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

// `indietro`: dove porta la freccia, se non all'elenco. Lo usa Cambia
// password, sottopagina di Profilo ("‹ Profilo").
export default function IntestazioneSottopagina({
  titolo,
  indietro = { href: "/impostazioni", etichetta: "Impostazioni" },
}: {
  titolo: string;
  indietro?: { href: string; etichetta: string };
}) {
  return (
    <header className="w-full">
      {/* -ml-2 + px-2: area toccabile più larga del testo, testo allineato
          al resto della pagina. */}
      <LinkProtetto
        href={indietro.href}
        className={`-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-base text-accent ${CLASSE_FOCUS}`}
      >
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
        >
          <path d="M7.5 1.5l-6 6 6 6" />
        </svg>
        {indietro.etichetta}
      </LinkProtetto>
      <h1 className="mx-1 mt-1 font-display text-[34px] font-bold leading-tight">{titolo}</h1>
    </header>
  );
}
