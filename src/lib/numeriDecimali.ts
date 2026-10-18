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

// Si arrotonda ai decimali della colonna PRIMA di scrivere in Dexie: il
// server arrotonda da sé (numeric(7,2): 12,345 → 12,35; numeric(5,1):
// 175,55 → 175,6), e senza questo passaggio Dexie terrebbe il valore
// lungo e il server quello corto. È l'unica funzione di arrotondamento dei
// numeri decimali scritti dall'utente: la usano leggiNumeroDecimale (qui
// sotto), altezza e peso obiettivo (salvataggioProfilo.ts), la pesata
// (letturaPeso.ts) e la somma dei doppioni (pianoSpostamento.ts).
// Si arrotonda solo il valore che si sta scrivendo, mai una riga già
// salvata riletta da Dexie.
//
// "Mezzo per eccesso", come numeric di Postgres sui positivi (tutti i
// valori qui sono ≥ 0). Il passaggio dalla notazione "e2" evita gli errori
// della virgola mobile di Math.round(n * 100) / 100 (1.005 * 100 =
// 100.49999..., che darebbe 1 invece di 1,01), e dà lo stesso risultato di
// toLocaleString, quindi di numeroPerCampo: il campo mostra quello che si
// è salvato. Sotto 0,000001 JavaScript scrive il numero in forma
// esponenziale ("1e-7") e "1e-7e2" non si legge: lì il risultato è
// comunque 0.
export function arrotondaDecimali(n: number, decimali: number): number {
  if (Math.abs(n) < 1e-6) return 0;
  return Number((Math.round(Number(`${n}e${decimali}`)) / 10 ** decimali).toFixed(decimali));
}

// Il contrario di leggiNumeroDecimale: un numero salvato come testo di
// partenza di un campo, come lo scriverebbe l'utente. Virgola decimale
// ("12,5", non "12.5"), niente zeri inutili ("100", non "100,00"), al
// massimo `decimaliMassimi` cifre dopo la virgola (quelle della colonna:
// 2 per numeric(7,2), 1 per numeric(5,1)). Niente punto delle migliaia:
// questa stessa lettura prende il punto per una virgola, quindi "12.500"
// tornerebbe indietro come 12,5. Vale per ogni campo numerico dell'app.
export function numeroPerCampo(n: number, decimaliMassimi: number): string {
  return n.toLocaleString("it-IT", { maximumFractionDigits: decimaliMassimi, useGrouping: false });
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
  // Sotto 0,005 l'arrotondamento dà 0.
  if (n < 0.005) {
    return opzioni.zeroAmmesso
      ? { valore: 0, errore: null }
      : { valore: null, errore: "sotto-minimo" };
  }
  return { valore: arrotondaDecimali(n, 2), errore: null };
}
