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

import {
  leggiNumeroDecimale,
  numeroPerCampo,
  MASSIMO_NUMERIC_7_2,
  type ErroreDecimale,
} from "../numeriDecimali";

export const GRAMMI_MASSIMI = MASSIMO_NUMERIC_7_2;

export type LetturaGrammi = { grammi: number; errore: null } | { grammi: null; errore: string };

const MESSAGGI: Record<ErroreDecimale, string> = {
  "non-numero": "Inserisci i grammi",
  "oltre-massimo": "Al massimo 99999,99 g",
  "sotto-minimo": "Deve essere maggiore di zero",
};

// Fino a due decimali, come numeric(7,2). Le stesse cifre per il testo e
// per il campo.
const DECIMALI_GRAMMI = 2;

// Una quantità in grammi come la legge l'utente: virgola decimale, al
// massimo due decimali, "g" in coda ("80 g", "12,5 g"). Senza, JavaScript
// stamperebbe "12.5". Il punto delle migliaia compare solo da 10.000 in su
// ("12.500 g"), come vuole la convenzione italiana di Intl.
export function formattaGrammi(g: number): string {
  return `${g.toLocaleString("it-IT", { maximumFractionDigits: DECIMALI_GRAMMI })} g`;
}

// La stessa quantità come testo di partenza di un campo: solo il numero
// ("12,5", "100"), senza "g" e senza il punto delle migliaia (numeroPerCampo,
// dove c'è il perché).
export function grammiPerCampo(g: number): string {
  return numeroPerCampo(g, DECIMALI_GRAMMI);
}

export function leggiGrammi(valore: string): LetturaGrammi {
  const lettura = leggiNumeroDecimale(valore, { zeroAmmesso: false });
  return lettura.errore === null
    ? { grammi: lettura.valore, errore: null }
    : { grammi: null, errore: MESSAGGI[lettura.errore] };
}
