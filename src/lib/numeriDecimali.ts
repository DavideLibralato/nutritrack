// Lettura di un numero scritto dall'utente in un campo che finirà in una
// colonna numeric(7,2) su Supabase: grammi (voci_diario, composizioni_voci)
// e valori del catalogo (alimenti: kcal e macro per 100 g, porzione).
// Una base sola; i chiamanti aggiungono i loro limiti e i loro messaggi
// (leggiGrammi in src/lib/inserimento/grammi.ts, validaValoriAlimento in
// src/lib/inserimento/valoriAlimento.ts).
//
// Perché i limiti vengono da numeric(7,2):
// - massimo 99999.99: un valore più grande si salverebbe in Dexie e poi
//   farebbe fallire la sync in silenzio (la voce resta in outbox e viene
//   accantonata dopo 5 tentativi);
// - due decimali: il server arrotonda (12.345 → 12.35) mentre Dexie terrebbe
//   12.345. Si arrotonda PRIMA di scrivere, allo stesso modo, così dispositivo
//   e server tengono lo stesso valore.

export const MASSIMO_NUMERIC_7_2 = 99999.99;

// Perché il campo non va, senza messaggio: ogni chiamante ha le sue parole
// ("Inserisci i grammi", "Al massimo 100 g per 100 g"...).
// - "non-numero": vuoto o non numerico;
// - "oltre-massimo": oltre 99999.99 (o infinito);
// - "sotto-minimo": negativo, oppure — se lo zero non è ammesso — un valore
//   che arrotondato fa 0.
export type ErroreDecimale = "non-numero" | "oltre-massimo" | "sotto-minimo";

export type LetturaDecimale =
  | { valore: number; errore: null }
  | { valore: null; errore: ErroreDecimale };

// Arrotondamento a 2 decimali "mezzo per eccesso", come numeric di Postgres
// sui positivi. Il passaggio dalla notazione "e2" evita gli errori della
// virgola mobile di Math.round(n * 100) / 100 (1.005 * 100 = 100.49999...).
// Solo per n ≥ 0.005: sotto, JavaScript può scrivere il numero in forma
// esponenziale ("1e-7") e "1e-7e2" non si legge. I chiamanti lo garantiscono.
function arrotondaCentesimi(n: number): number {
  return Number((Math.round(Number(`${n}e2`)) / 100).toFixed(2));
}

// La virgola vale come separatore decimale. `zeroAmmesso`: 0 è un valore
// valido (una kcal o un macro possono essere zero, una quantità no).
export function leggiNumeroDecimale(
  valore: string,
  opzioni: { zeroAmmesso: boolean }
): LetturaDecimale {
  const pulito = valore.trim().replace(",", ".");
  const n = pulito === "" ? NaN : Number(pulito);
  if (Number.isNaN(n)) return { valore: null, errore: "non-numero" };
  if (!Number.isFinite(n) || n > MASSIMO_NUMERIC_7_2) {
    return { valore: null, errore: "oltre-massimo" };
  }
  if (n < 0) return { valore: null, errore: "sotto-minimo" };
  // Sotto 0,005 l'arrotondamento dà 0 (controllo PRIMA di arrotondare,
  // vedi arrotondaCentesimi).
  if (n < 0.005) {
    return opzioni.zeroAmmesso
      ? { valore: 0, errore: null }
      : { valore: null, errore: "sotto-minimo" };
  }
  return { valore: arrotondaCentesimi(n), errore: null };
}
