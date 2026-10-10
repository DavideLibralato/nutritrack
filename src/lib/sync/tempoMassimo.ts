// La rete di sicurezza sul tempo di ogni richiesta della sincronizzazione,
// in salita (sincronizza.ts) e in discesa (discesa.ts). Dal 10/10/2026.
//
// Perché: le richieste non avevano un limite. Su iPhone, con l'app che va
// in background a metà di una richiesta, la fetch può non rispondere più.
// Il giro resta "in corso" per sempre, ogni giro nuovo si prenota dietro
// di lui (un giro per volta, sincronizza.ts) e niente parte più finché
// l'app non si chiude.
//
// Il rimedio vero è nel client Supabase: ogni richiesta viene ANNULLATA
// dopo SCADENZA_FETCH_MS (src/lib/supabase/fetchConScadenza.ts, che spiega
// perché abbandonarla non basta). Questa è la seconda linea: una corsa fra
// la richiesta e un timer un po' più lungo, per il caso in cui
// l'annullamento non chiuda la richiesta (una fetch sospesa che lo
// ignora). Se vince il timer, il chiamante riceve SCADUTA e tratta la
// richiesta come non arrivata. In quel caso la richiesta resta viva e può
// ancora arrivare tardi: è il rischio scritto in PUNTO_DI_PARTENZA.md,
// sezione 11.

import { SCADENZA_FETCH_MS } from "../supabase/fetchConScadenza";

// Cinque secondi dopo l'annullamento: di norma la richiesta annullata è
// già tornata come status 0, e questo timer non vince mai.
export const TEMPO_MASSIMO_RICHIESTA_MS = SCADENZA_FETCH_MS + 5_000;

export const SCADUTA = Symbol("richiesta scaduta");

export const MESSAGGIO_SCADUTA = "Nessuna risposta dal server entro il tempo massimo.";

// `PromiseLike`: le query di Supabase non sono Promise vere, ma oggetti
// con un `then` (si possono attendere con await). Promise.resolve le
// trasforma in Promise.
export async function conTempoMassimo<T>(
  richiesta: PromiseLike<T>,
  ms: number = TEMPO_MASSIMO_RICHIESTA_MS
): Promise<T | typeof SCADUTA> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scadenza = new Promise<typeof SCADUTA>((risolvi) => {
    timer = setTimeout(() => risolvi(SCADUTA), ms);
  });
  try {
    return await Promise.race([Promise.resolve(richiesta), scadenza]);
  } finally {
    clearTimeout(timer);
  }
}
