// I totali giornalieri NON si memorizzano mai: si ricalcolano sempre dalle
// voci (PUNTO_DI_PARTENZA.md, sezione "Inserimento retroattivo" e regola non
// negoziabile). Su IndexedDB è istantaneo, e un totale memorizzato
// diventerebbe sbagliato ogni volta che si tocca un giorno passato.
//
// Funzioni pure, testate in modo permanente (sezione 10.5, punto 1: "il
// calcolo dei totali giornalieri a partire dalle voci" è uno dei pezzi di
// logica che sbagliano in silenzio).

import type { VoceDiario, Obiettivo } from "./db/tipi";
import { millisecondiDi } from "./istanti";

export interface TotaliNutrizionali {
  kcal: number;
  proteine: number;
  carboidrati: number;
  grassi: number;
}

export const TOTALI_ZERO: TotaliNutrizionali = {
  kcal: 0,
  proteine: 0,
  carboidrati: 0,
  grassi: 0,
};

// Contributo di una singola voce. I valori sulla voce sono per 100 g (una
// copia di quelli dell'alimento al momento dell'inserimento, sezione 4), la
// quantità è in grammi: si scala di quantita_g / 100.
export function totaleVoce(voce: VoceDiario): TotaliNutrizionali {
  const fattore = voce.quantita_g / 100;
  return {
    kcal: voce.kcal_100g * fattore,
    proteine: voce.proteine_100g * fattore,
    carboidrati: voce.carboidrati_100g * fattore,
    grassi: voce.grassi_100g * fattore,
  };
}

export function sommaTotali(voci: VoceDiario[]): TotaliNutrizionali {
  return voci.reduce<TotaliNutrizionali>((acc, voce) => {
    const t = totaleVoce(voce);
    return {
      kcal: acc.kcal + t.kcal,
      proteine: acc.proteine + t.proteine,
      carboidrati: acc.carboidrati + t.carboidrati,
      grassi: acc.grassi + t.grassi,
    };
  }, { ...TOTALI_ZERO });
}

// Le voci di un certo giorno logico. `deleted_at` è ricontrollato qui anche
// se il repository lo filtra già: la funzione è pura e deve dare il
// risultato giusto da sola, a chiunque le passi una lista.
export function vociDelGiorno(voci: VoceDiario[], giornoISO: string): VoceDiario[] {
  return voci.filter((v) => v.data === giornoISO && v.deleted_at === null);
}

// L'obiettivo in vigore in una certa data: la riga con `valido_dal` più
// recente ma non successivo alla data (obiettivi è uno storico, sezione 4 —
// un cambio vero inserisce una riga nuova, non modifica quella vecchia).
// A parità di `valido_dal` (due cambi lo stesso giorno) vince `updated_at`,
// confrontato come istante (millisecondiDi) e non come stringa: una riga
// scritta in locale e una scaricata da PostgREST hanno formati diversi (vedi
// src/lib/istanti.ts).
//
// Un giorno PRECEDENTE a tutti i periodi prende il periodo più vecchio: il
// primo periodo vale "da sempre" (PUNTO_DI_PARTENZA.md, sezione 4,
// "obiettivi", decisione del 2026-09-26). Serve perché in Oggi si possono
// registrare giornate a ritroso, anche prima del giorno in cui si è
// impostato il primo obiettivo, e quelle giornate devono avere un target.
// È una regola di lettura, non una data finta (tipo 1900-01-01) scritta nei
// dati. Prima di questa decisione qui si restituiva null.
//
// null solo se non esiste nessun obiettivo.
export function obiettivoValidoPer(
  obiettivi: Obiettivo[],
  giornoISO: string
): Obiettivo | null {
  const vivi = obiettivi.filter((o) => o.deleted_at === null);

  const validi = vivi
    .filter((o) => o.valido_dal <= giornoISO)
    .sort((a, b) => {
      const perValidoDal = b.valido_dal.localeCompare(a.valido_dal);
      return perValidoDal !== 0
        ? perValidoDal
        : millisecondiDi(b.updated_at) - millisecondiDi(a.updated_at);
    });
  if (validi[0]) return validi[0];

  // Prima di tutti i periodi: il più vecchio, e fra due periodi nati lo
  // stesso giorno quello che vince in quel giorno (updated_at più recente).
  const piuVecchi = [...vivi].sort((a, b) => {
    const perValidoDal = a.valido_dal.localeCompare(b.valido_dal);
    return perValidoDal !== 0
      ? perValidoDal
      : millisecondiDi(b.updated_at) - millisecondiDi(a.updated_at);
  });
  return piuVecchi[0] ?? null;
}

// "Il periodo in corso": UNA sola definizione per tutta l'app — il periodo
// valido nel giorno logico corrente (giornoLogico in dataGiorno.ts), lo
// stesso "oggi" della pagina Oggi. Non il più recente per updated_at né per
// valido_dal: con la data d'inizio modificabile, il periodo scritto per
// ultimo non è per forza quello in vigore.
export function periodoInCorso(
  obiettivi: Obiettivo[],
  giornoCorrente: string
): Obiettivo | null {
  return obiettivoValidoPer(obiettivi, giornoCorrente);
}
