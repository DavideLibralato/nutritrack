// Il valore a destra della riga "Obiettivi" nell'elenco Impostazioni
// (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni", decisione A):
//   - "Da impostare" se non c'è ancora nessun periodo in obiettivi;
//   - "2500 kcal" con i giorni differenziati spenti;
//   - "2500 · 2950 kcal" accesi: giorno normale · giorno di allenamento.
// I numeri sono quelli del periodo valido oggi (periodoInCorso), cioè quelli
// che usa Oggi:
//   - normale: la riga "normale" di obiettivi_target, con il ripiego sulle
//     colonne del periodo se la riga mancasse (come valoriDaDati);
//   - allenamento: la riga "allenamento", con il ripiego sul normale se non
//     esiste ancora (targetEffettivo: Oggi usa quello). Interruttore acceso
//     senza target di allenamento = "2500 · 2500 kcal", che è la verità.
// Funzione pura, testata in rigaObiettivi.test.ts.

import { targetPerTipo } from "../repository/obiettiviTarget";
import { TIPO_GIORNO_ALLENAMENTO, TIPO_GIORNO_NORMALE } from "../db/tipi";
import type { Obiettivo, ObiettivoTarget } from "../db/tipi";

export function testoRigaObiettivi(
  periodo: Obiettivo | null,
  righeTarget: ObiettivoTarget[],
  differenziaGiorni: boolean
): string {
  if (!periodo) return "Da impostare";

  const normale = targetPerTipo(righeTarget, periodo.id, TIPO_GIORNO_NORMALE)?.kcal ?? periodo.kcal;
  if (!differenziaGiorni) return `${normale} kcal`;

  const allenamento =
    targetPerTipo(righeTarget, periodo.id, TIPO_GIORNO_ALLENAMENTO)?.kcal ?? normale;
  return `${normale} · ${allenamento} kcal`;
}
