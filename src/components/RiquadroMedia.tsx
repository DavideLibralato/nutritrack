// Un riquadro della griglia 2×2 di Statistiche (PUNTO_DI_PARTENZA.md §3,
// "Quattro riquadri"): la media, "su N giorni", l'obiettivo (o l'obiettivo
// medio, se cambia fra i giorni contati) e lo stato. Senza giorni contati
// "—" e "nessun giorno registrato", mai 0.

import PastigliaEsito from "./PastigliaEsito";
import { esitoRispettoObiettivo, type Grandezza } from "@/lib/esitoObiettivo";
import type { Media } from "@/lib/medieStatistiche";

interface Props {
  etichetta: string; // "Media kcal", "Media grassi"...
  grandezza: Grandezza;
  media: Media | null;
}

export default function RiquadroMedia({ etichetta, grandezza, media }: Props) {
  const unita = grandezza === "kcal" ? "" : " g";

  if (!media) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-surface px-3.5 pt-3.5 pb-[13px]">
        <span className="text-[13px] text-muted">{etichetta}</span>
        <span className="mt-1 font-display text-[30px] font-semibold leading-tight">—</span>
        <span className="text-[13px] text-muted">nessun giorno registrato</span>
      </div>
    );
  }

  const valore = Math.round(media.valore);
  const obiettivo = media.obiettivo !== null ? Math.round(media.obiettivo) : null;
  const esito = esitoRispettoObiettivo(
    media.valore,
    media.obiettivo,
    grandezza,
    media.tipoObiettivo
  );
  const giorni = media.giorniContati === 1 ? "su 1 giorno" : `su ${media.giorniContati} giorni`;
  const testoObiettivo =
    obiettivo === null
      ? "nessun obiettivo"
      : `${media.obiettivoUnico ? "obiettivo" : "obiettivo medio"} ${obiettivo}${unita}`;

  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-surface px-3.5 pt-3.5 pb-[13px]">
      <span className="text-[13px] text-muted">{etichetta}</span>
      <div className="mt-1 flex items-center justify-between gap-1.5">
        <span className="font-display text-[30px] font-semibold leading-tight tabular-nums">
          {valore}
          {unita && <small className="text-lg font-medium">{unita}</small>}
        </span>
        <PastigliaEsito esito={esito} />
      </div>
      <span className="text-[13px] text-muted tabular-nums">{giorni}</span>
      <span className="text-[13px] text-muted tabular-nums">{testoObiettivo}</span>
    </div>
  );
}
