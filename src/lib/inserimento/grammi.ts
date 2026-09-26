// Validazione unica di una quantità in grammi scritta dall'utente: la usano
// lo sheet quantità (voci_diario.quantita_g) e la modifica di un pasto
// salvato (composizioni_voci.quantita_g). Una funzione sola, così i due
// campi non possono accettare cose diverse.
//
// I limiti vengono dallo schema su Supabase: tutte e due le colonne sono
// numeric(7,2) (verificato su information_schema.columns il 2026-09-26).
// - Massimo 99999.99: un valore più grande si salverebbe in Dexie e poi
//   farebbe fallire la sync in silenzio (la voce resta in outbox e viene
//   accantonata dopo 5 tentativi).
// - Due decimali: il server arrotonda (12.345 → 12.35) mentre Dexie terrebbe
//   12.345, e il dispositivo e il server avrebbero due valori diversi. Qui si
//   arrotonda PRIMA di scrivere, allo stesso modo, così i due lati
//   coincidono. Un valore che arrotondato diventa 0 (0,001) non vale.

export const GRAMMI_MASSIMI = 99999.99;

export type LetturaGrammi = { grammi: number; errore: null } | { grammi: null; errore: string };

// Arrotondamento a 2 decimali "mezzo per eccesso", come numeric di Postgres
// sui positivi. Il passaggio da toFixed evita gli errori della virgola
// mobile di Math.round(n * 100) / 100 (1.005 * 100 = 100.49999...).
function arrotondaCentesimi(n: number): number {
  return Number((Math.round(Number(`${n}e2`)) / 100).toFixed(2));
}

export function leggiGrammi(valore: string): LetturaGrammi {
  const pulito = valore.trim().replace(",", ".");
  const n = pulito === "" ? NaN : Number(pulito);
  if (Number.isNaN(n)) return { grammi: null, errore: "Inserisci i grammi" };
  if (!Number.isFinite(n) || n > GRAMMI_MASSIMI) {
    return { grammi: null, errore: "Al massimo 99999,99 g" };
  }
  // Sotto 0,005 l'arrotondamento dà 0 (e zero o negativo non vale). Il
  // controllo sta PRIMA di arrotondare anche perché i numeri piccolissimi
  // JavaScript li scrive in forma esponenziale ("1e-7"), che
  // arrotondaCentesimi non sa leggere.
  if (n < 0.005) return { grammi: null, errore: "Deve essere maggiore di zero" };
  return { grammi: arrotondaCentesimi(n), errore: null };
}
