// I totali giornalieri NON si memorizzano mai: si ricalcolano sempre dalle
// voci (PUNTO_DI_PARTENZA.md, sezione "Inserimento retroattivo" e regola non
// negoziabile). Su IndexedDB è istantaneo, e un totale memorizzato
// diventerebbe sbagliato ogni volta che si tocca un giorno passato.
//
// Funzioni pure, testate in modo permanente (sezione 10.5, punto 1: "il
// calcolo dei totali giornalieri a partire dalle voci" è uno dei pezzi di
// logica che sbagliano in silenzio).

import type { VoceDiario, Obiettivo } from "./db/tipi";

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
// cambiare obiettivo inserisce una riga nuova, non modifica quella vecchia).
// A parità di `valido_dal` (due cambi lo stesso giorno) vince `updated_at`.
//
// Restituisce null se a quella data non era ancora stato impostato nessun
// obiettivo: un giorno passato prima del primo obiettivo non deve mostrare
// un target inventato — è lo stesso principio per cui il passato non si
// riscrive mai da solo (sezione "Il giorno logico").
export function obiettivoValidoPer(
  obiettivi: Obiettivo[],
  giornoISO: string
): Obiettivo | null {
  const validi = obiettivi
    .filter((o) => o.deleted_at === null && o.valido_dal <= giornoISO)
    .sort((a, b) => {
      const perValidoDal = b.valido_dal.localeCompare(a.valido_dal);
      return perValidoDal !== 0
        ? perValidoDal
        : b.updated_at.localeCompare(a.updated_at);
    });

  return validi[0] ?? null;
}
