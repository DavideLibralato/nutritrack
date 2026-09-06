"use client";

// La tab bar in basso (PUNTO_DI_PARTENZA.md, sezione 3): tre voci — Oggi,
// Statistiche, Profilo. La pagina di inserimento non è una tab, si apre
// sopra.
//
// usePathname() (next/navigation) dà il percorso corrente lato client:
// serve per evidenziare in verde la voce attiva. Vive nel layout del route
// group (app), quindi non compare su login/registrazione.

import Link from "next/link";
import { usePathname } from "next/navigation";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const VOCI = [
  { href: "/", etichetta: "Oggi" },
  { href: "/statistiche", etichetta: "Statistiche" },
  { href: "/profilo", etichetta: "Profilo" },
] as const;

export default function BarraNavigazione() {
  const percorso = usePathname();

  return (
    <nav className="shrink-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md">
        {VOCI.map((voce) => {
          const attiva =
            voce.href === "/" ? percorso === "/" : percorso.startsWith(voce.href);
          return (
            <li key={voce.href} className="flex-1">
              <Link
                href={voce.href}
                aria-current={attiva ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2 text-xs ${
                  attiva ? "text-accent" : "text-muted"
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
