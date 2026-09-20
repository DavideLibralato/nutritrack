// Helper specifici per obiettivi_target, oltre al CRUD generico di
// repositoryObiettiviTarget. Vivono qui e non nella pagina Profilo perché la
// UI non deve mai costruire da sola la logica "aggiorna se c'è già, crea se
// no" — lo stesso principio di registraPesoSenzaDuplicati in misurazioni.ts.

import { repositoryObiettiviTarget } from "./index";
import { TIPO_GIORNO_NORMALE } from "../db/tipi";
import type { ObiettivoTarget } from "../db/tipi";

// La riga di un obiettivo per un tipo di giorno specifico, se esiste.
export function targetPerTipo(
  righe: ObiettivoTarget[],
  obiettivoId: string,
  tipoGiorno: string
): ObiettivoTarget | null {
  return (
    righe.find(
      (riga) => riga.obiettivo_id === obiettivoId && riga.tipo_giorno === tipoGiorno
    ) ?? null
  );
}

// Il target da mostrare per un tipo di giorno, con la regola di fallback
// (PUNTO_DI_PARTENZA.md, sezione 4, "obiettivi_target"): se manca la riga
// per il tipo esatto — tipicamente un obiettivo cambiato da poco, il cui
// target "allenamento" non è ancora stato risalvato per il nuovo periodo —
// si ripiega sul target "normale" dello stesso obiettivo, che esiste sempre
// per costruzione (ogni "Salva obiettivo" ne crea una). Chi chiama e sa
// distinguere il caso di ripiego da quello diretto (per non mostrare in giro
// un tipo di giorno per cui il target non esiste davvero, es. la pastiglia
// in Oggi) usa targetPerTipo per il confronto e questa solo per il numero.
export function targetEffettivo(
  righe: ObiettivoTarget[],
  obiettivoId: string,
  tipoGiorno: string
): ObiettivoTarget | null {
  return (
    targetPerTipo(righe, obiettivoId, tipoGiorno) ??
    targetPerTipo(righe, obiettivoId, TIPO_GIORNO_NORMALE)
  );
}

// Crea o aggiorna la riga di un obiettivo per un tipo di giorno: la UI non
// deve sapere se esisteva già (sezione 3: il secondo set di target si salva
// con lo stesso bottone la prima volta e le volte successive).
export async function salvaTarget(
  userId: string,
  obiettivoId: string,
  tipoGiorno: string,
  target: {
    kcal: number;
    proteine_g: number;
    carboidrati_g: number;
    grassi_g: number;
  },
  righeEsistenti: ObiettivoTarget[]
): Promise<ObiettivoTarget> {
  const esistente = targetPerTipo(righeEsistenti, obiettivoId, tipoGiorno);

  if (esistente) {
    return repositoryObiettiviTarget.aggiorna(esistente.id, target);
  }

  return repositoryObiettiviTarget.crea({
    user_id: userId,
    obiettivo_id: obiettivoId,
    tipo_giorno: tipoGiorno,
    ...target,
  });
}
