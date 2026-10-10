"use client";

// La tab bar in basso (PUNTO_DI_PARTENZA.md, sezione 3): tre voci — Oggi,
// Statistiche, Impostazioni. La pagina di inserimento non è una tab, si apre
// sopra.
//
// usePathname() (next/navigation) dà il percorso corrente lato client:
// serve per evidenziare in verde la voce attiva. Vive nel layout del route
// group (app), quindi non compare su login/registrazione.
//
// Una "pillola" staccata dai bordi (16 px ai lati), alta --tab-bar-altezza e
// appoggiata a --tab-bar-distanza dal fondo, appena sopra la barretta home
// di iOS (globals.css: lì stanno tutti i numeri). Sfondo "vetro": la pagina
// passa sotto sfocata; dove la sfocatura non c'è, sfondo pieno. La voce
// attiva ha una capsula di sfondo (--capsula-attiva) e il colore accento
// (--testo-capsula: l'accento appena più scuro, per il contrasto in chiaro).
//
// Sotto la pillola, una sfumatura dal trasparente al colore di fondo
// (.sfumatura-in-basso): il testo che scorre sotto non disturba. Non riceve
// tocchi. In Oggi sale fino a coprire anche "+ Aggiungi".
//
// Pillola e sfumatura si nascondono mentre un campo ha il fuoco
// (`data-nascondi-mentre-scrivi`, regola in globals.css), così non compaiono
// mai sopra la tastiera. Livelli: sfumatura z-20, pillola z-30 (come
// "+ Aggiungi" e la barra Salva di Profilo), sotto BarraAnnulla (z-40) e gli
// sheet (z-50), che la coprono con lo sfondo scuro.
//
// Le voci sono LinkProtetto: se la pagina ha modifiche non salvate
// (GuardianoModifiche), toccarle chiede prima "Esci senza salvare?". Vale
// anche per la voce già attiva: da una sotto-pagina di Impostazioni riporta
// all'elenco, come su iPhone.
//
// Sulla voce Impostazioni, un pallino arancio quando la sincronizzazione
// chiede attenzione (usePallinoSincronizzazione, dal 10/10): sull'icona,
// con il suo bordo del colore della pillola per staccarlo dal disegno.

import LinkProtetto from "./LinkProtetto";
import { usePallinoSincronizzazione } from "@/lib/sync/usePallinoSincronizzazione";
import { usePathname } from "next/navigation";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

const VOCI = [
  { href: "/", etichetta: "Oggi" },
  { href: "/statistiche", etichetta: "Statistiche" },
  { href: "/impostazioni", etichetta: "Impostazioni" },
] as const;

export default function BarraNavigazione() {
  const percorso = usePathname();
  const pallino = usePallinoSincronizzazione();

  return (
    <>
      <div
        aria-hidden
        data-nascondi-mentre-scrivi
        className="sfumatura-in-basso pointer-events-none fixed inset-x-0 bottom-0 z-20"
      />
      <nav
        aria-label="Navigazione principale"
        data-nascondi-mentre-scrivi
        style={{ boxShadow: "var(--ombra-fluttuante)" }}
        className="vetro fixed inset-x-4 bottom-[var(--tab-bar-distanza)] z-30 mx-auto h-[var(--tab-bar-altezza)] max-w-md rounded-full border border-border"
      >
        <ul className="flex h-full gap-1 p-1.5">
          {VOCI.map((voce) => {
            const attiva =
              voce.href === "/" ? percorso === "/" : percorso.startsWith(voce.href);
            return (
              <li key={voce.href} className="flex-1">
                {/* Area toccabile: tutta la capsula, alta ~52 px. */}
                <LinkProtetto
                  href={voce.href}
                  aria-current={attiva ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-xs ${
                    attiva ? "bg-[var(--capsula-attiva)] font-medium text-[var(--testo-capsula)]" : "text-muted"
                  } ${CLASSE_FOCUS}`}
                >
                  <span className="relative">
                    <Icona nome={voce.etichetta} />
                    {voce.href === "/impostazioni" && pallino && (
                      <span
                        aria-hidden="true"
                        data-pallino-sincronizzazione
                        className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-warning ring-2 ring-surface"
                      />
                    )}
                  </span>
                  {voce.etichetta}
                  {/* Il pallino si vede soltanto: a uno screen reader la
                      voce lo dice a parole, dopo il nome. */}
                  {voce.href === "/impostazioni" && pallino && (
                    <span className="sr-only">, sincronizzazione da controllare</span>
                  )}
                </LinkProtetto>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

// Icone in stile lineare, come nel mockup: cerchio (l'anello) per Oggi, barre
// per Statistiche, ingranaggio per Impostazioni. `currentColor` eredita il colore del
// Link (verde se attivo, grigio se no), così non c'è nessun colore scritto a
// mano qui dentro.
function Icona({ nome }: { nome: string }) {
  const comuni = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (nome === "Oggi") {
    return (
      <svg {...comuni}>
        <circle cx="12" cy="12" r="8" />
      </svg>
    );
  }
  if (nome === "Statistiche") {
    return (
      <svg {...comuni}>
        <path d="M5 20V11M12 20V4M19 20v-6" />
      </svg>
    );
  }
  // Ingranaggio, lo stesso disegno del mockup (docs/mockups/impostazioni.html).
  return (
    <svg {...comuni}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" />
    </svg>
  );
}
