// Quando parte l'aggiornamento della copia della propria foto
// (aggiornaMiaFoto in fotoProfilo.ts; PUNTO_DI_PARTENZA.md §3, "La foto
// profilo"): all'apertura con la rete e al ritorno in primo piano. Lo fa
// partire il componente AggiornamentoFotoProfilo, qui c'è la regola.
//
// Niente giri doppi:
// - un giro già in corso per lo stesso utente non ne fa partire un altro:
//   chi chiama riceve la stessa promessa (tornare in primo piano due volte
//   di fila mentre il primo giro scarica);
// - dopo un giro riuscito, per INTERVALLO_MINIMO_MS non se ne fa un altro
//   (tornare in primo piano due volte di fila a giro finito). Un giro
//   fallito (server senza risposta, foto non scaricata) non conta: il
//   ritorno dopo riprova subito.
//
// Con funzioni passate da fuori (aggiorna, ora) per i test; l'app usa
// avviaAggiornamentoFoto, qui sotto.

import { createClient } from "../supabase/client";
import { aggiornaMiaFoto, type EsitoAggiornaFoto } from "./fotoProfilo";

export const INTERVALLO_MINIMO_MS = 30_000;

// Esiti che non contano come giro riuscito: si può riprovare subito.
const FALLITI: readonly EsitoAggiornaFoto[] = ["non-letta", "non-scaricata"];

// null = giro saltato (uno riuscito da poco).
export type Avvio = (userId: string) => Promise<EsitoAggiornaFoto | null>;

export function creaAggiornatoreFoto(
  aggiorna: (userId: string) => Promise<EsitoAggiornaFoto>,
  ora: () => number = Date.now,
  intervalloMinimoMs: number = INTERVALLO_MINIMO_MS
): Avvio {
  const inCorso = new Map<string, Promise<EsitoAggiornaFoto | null>>();
  const ultimoRiuscito = new Map<string, number>();

  return (userId) => {
    const giro = inCorso.get(userId);
    if (giro) return giro;

    const ultimo = ultimoRiuscito.get(userId);
    if (ultimo !== undefined && ora() - ultimo < intervalloMinimoMs) return Promise.resolve(null);

    const nuovo = aggiorna(userId)
      .catch((): EsitoAggiornaFoto => "non-letta")
      .then((esito) => {
        if (!FALLITI.includes(esito)) ultimoRiuscito.set(userId, ora());
        return esito;
      })
      .finally(() => inCorso.delete(userId));
    inCorso.set(userId, nuovo);
    return nuovo;
  };
}

// Quello dell'app: un solo aggiornatore per tutta la pagina, così il
// conteggio dei giri è uno solo.
export const avviaAggiornamentoFoto: Avvio = creaAggiornatoreFoto((userId) =>
  aggiornaMiaFoto(createClient(), userId)
);
