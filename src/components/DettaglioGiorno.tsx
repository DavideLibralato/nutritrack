// Il riquadro sotto il grafico delle calorie (PUNTO_DI_PARTENZA.md §3,
// "Tocco su una barra"): giorno, tipo, kcal / obiettivo con lo stato, i tre
// macro (proteine / obiettivo) e «Apri il giorno», che porta a Oggi su
// quella data (/?giorno=, che Oggi sa già leggere). Senza un giorno
// toccato, solo l'invito "Tocca una barra per vedere il giorno".
//
// role="status": lo screen reader legge il riquadro quando cambia, cioè
// quando si tocca una barra.

import Link from "next/link";
import IconaAvanti from "./IconaAvanti";
import PastigliaEsito from "./PastigliaEsito";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { formattaDataEstesa } from "@/lib/dataGiorno";
import { esitoRispettoObiettivo } from "@/lib/esitoObiettivo";
import { TIPO_GIORNO_NORMALE } from "@/lib/db/tipi";
import type { GiornoStatistiche } from "@/lib/medieStatistiche";

interface Props {
  giorno: GiornoStatistiche | null;
  differenziaGiorni: boolean;
}

function maiuscola(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

export default function DettaglioGiorno({ giorno, differenziaGiorni }: Props) {
  if (!giorno || !giorno.totali) {
    return (
      <p role="status" className="min-h-5 text-center text-[13px] text-muted">
        Tocca una barra per vedere il giorno
      </p>
    );
  }

  const t = giorno.totali;
  const kcal = Math.round(t.kcal);
  const obiettivo = giorno.target;
  const esito = esitoRispettoObiettivo(kcal, obiettivo?.kcal ?? null, "kcal", giorno.tipoObiettivo);
  // Il tipo solo dove dice qualcosa: con i differenziati accesi, o un
  // giorno che non è normale (variante V7). È quello mostrato da Oggi.
  const mostraTipo = differenziaGiorni || giorno.tipoGiornoMostrato !== TIPO_GIORNO_NORMALE;

  return (
    <div role="status" className="flex flex-col gap-1.5 rounded-[14px] bg-surface px-3.5 py-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{maiuscola(formattaDataEstesa(giorno.data))}</span>
        {mostraTipo && (
          <span className="rounded-full border border-border px-2 py-px text-xs text-muted">
            {maiuscola(giorno.tipoGiornoMostrato)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
        <span className="text-2xl font-semibold">{kcal} kcal</span>
        {obiettivo && <span className="text-muted">/ {obiettivo.kcal}</span>}
        <PastigliaEsito esito={esito} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-[12.5px] text-muted tabular-nums">
        <span className="flex flex-col gap-px">
          Grassi
          <span className="text-[15px] font-medium text-foreground">{Math.round(t.grassi)} g</span>
        </span>
        <span className="flex flex-col gap-px">
          Carboidrati
          <span className="text-[15px] font-medium text-foreground">
            {Math.round(t.carboidrati)} g
          </span>
        </span>
        <span className="flex flex-col gap-px">
          Proteine
          <span className="text-[15px] font-medium text-foreground">
            {Math.round(t.proteine)}
            {obiettivo ? ` / ${obiettivo.proteine_g}` : ""} g
          </span>
        </span>
      </div>

      <Link
        href={`/?giorno=${giorno.data}`}
        className={`inline-flex min-h-11 items-center gap-0.5 self-start rounded-lg text-sm font-semibold text-accent ${CLASSE_FOCUS}`}
      >
        Apri il giorno
        <IconaAvanti size={18} />
      </Link>
    </div>
  );
}
