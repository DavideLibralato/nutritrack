// Il valore a destra della riga "Sincronizzazione" in Impostazioni (mockup
// del 10/10, "2 · Pallino + testo"): pallino colorato e testo breve. Il
// testo e il tono arrivano da rigaSincronizzazione
// (src/lib/sync/rigaSincronizzazione.ts); qui solo l'aspetto, con i colori
// dai token. Il pallino è decorativo (aria-hidden): lo stato lo dice il
// testo.

import type { RigaSincronizzazione, TonoRiga } from "@/lib/sync/rigaSincronizzazione";

// Classi scritte per intero: Tailwind genera solo quelle che trova così.
const PALLINO: Record<TonoRiga, string> = {
  neutro: "bg-accent",
  attesa: "bg-pending",
  avviso: "bg-warning",
};

const TESTO: Record<TonoRiga, string> = {
  neutro: "",
  attesa: "font-semibold text-pending",
  avviso: "font-semibold text-warning",
};

export default function ValoreRigaSincronizzazione({ riga }: { riga: RigaSincronizzazione }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${TESTO[riga.tono]}`}>
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${PALLINO[riga.tono]} ${
          riga.pulsa ? "animate-pulse motion-reduce:animate-none" : ""
        }`}
      />
      {riga.testo}
    </span>
  );
}
