"use client";

// La tab bar in basso (PUNTO_DI_PARTENZA.md, sezione 3): tre voci — Oggi,
// Statistiche, Profilo. La pagina di inserimento non è una tab, si apre
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
// attiva ha una capsula di sfondo (--capsula-attiva) e il colore accento.
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

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

const VOCI = [
  { href: "/", etichetta: "Oggi" },
  { href: "/statistiche", etichetta: "Statistiche" },
  { href: "/profilo", etichetta: "Profilo" },
] as const;

export default function BarraNavigazione() {
  const percorso = usePathname();

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
                <Link
                  href={voce.href}
                  aria-current={attiva ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-xs ${
                    attiva ? "bg-[var(--capsula-attiva)] font-medium text-accent" : "text-muted"
                  } ${CLASSE_FOCUS}`}
                >
                  <Icona nome={voce.etichetta} />
                  {voce.etichetta}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

// Icone in stile lineare, come nel mockup: cerchio (l'anello) per Oggi, barre
// per Statistiche, sagoma per Profilo. `currentColor` eredita il colore del
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
  return (
    <svg {...comuni}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
    </svg>
  );
}
