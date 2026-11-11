// La pastiglia dello stato rispetto all'obiettivo: "sotto", "in linea",
// "sopra" (PUNTO_DI_PARTENZA.md §7, "La regola dei colori"). Il testo è il
// fatto (esito), il colore il giudizio (tono): con Dimagrire un giorno
// molto sotto è "sotto" ma verde. Senza esito (nessun obiettivo) non
// disegna niente.

import { TESTI_ESITO, type EsitoObiettivo, type Tono } from "@/lib/esitoObiettivo";

const CLASSI: Record<Tono, string> = {
  buono: "bg-accent-soft text-on-accent-soft",
  oltre: "bg-warning-soft text-on-warning-soft",
  neutro: "bg-neutral-soft text-on-neutral-soft",
};

export default function PastigliaEsito({ esito }: { esito: EsitoObiettivo | null }) {
  if (!esito) return null;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold tracking-[0.3px] ${CLASSI[esito.tono]}`}
    >
      {TESTI_ESITO[esito.esito]}
    </span>
  );
}
