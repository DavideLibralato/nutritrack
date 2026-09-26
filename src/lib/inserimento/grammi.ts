// Validazione unica di una quantità in grammi scritta dall'utente: la usano
// lo sheet quantità (voci_diario.quantita_g) e la modifica di un pasto
// salvato (composizioni_voci.quantita_g). Una funzione sola, così i due
// campi non possono accettare cose diverse.
//
// Tutte e due le colonne sono numeric(7,2) su Supabase (verificato su
// information_schema.columns il 2026-09-26): limiti e arrotondamento vengono
// da leggiNumeroDecimale (src/lib/numeriDecimali.ts, dove c'è il perché).
// Qui si aggiunge solo che una quantità deve essere maggiore di zero (anche
// dopo l'arrotondamento: 0,001 non vale), e i messaggi.

import { leggiNumeroDecimale, MASSIMO_NUMERIC_7_2, type ErroreDecimale } from "../numeriDecimali";

export const GRAMMI_MASSIMI = MASSIMO_NUMERIC_7_2;

export type LetturaGrammi = { grammi: number; errore: null } | { grammi: null; errore: string };

const MESSAGGI: Record<ErroreDecimale, string> = {
  "non-numero": "Inserisci i grammi",
  "oltre-massimo": "Al massimo 99999,99 g",
  "sotto-minimo": "Deve essere maggiore di zero",
};

export function leggiGrammi(valore: string): LetturaGrammi {
  const lettura = leggiNumeroDecimale(valore, { zeroAmmesso: false });
  return lettura.errore === null
    ? { grammi: lettura.valore, errore: null }
    : { grammi: null, errore: MESSAGGI[lettura.errore] };
}
