// Il codice a barre di un prodotto, come si salva e si cerca
// (PUNTO_DI_PARTENZA.md §3, "Codice a barre", "Il codice valido").
//
// Tre formati, tutti fatti solo di cifre:
// - EAN-13: 13 cifre, i prodotti europei;
// - EAN-8: 8 cifre, le confezioni piccole;
// - UPC-A: 12 cifre, i prodotti americani. È lo stesso numero di un
//   EAN-13 con uno 0 davanti: si salva e si cerca SEMPRE a 13 cifre
//   (decisione di Davide, 07/11). Così lo stesso prodotto ha lo stesso
//   codice, che sia letto come UPC-A dal video o scritto a mano a 13.
//
// L'ultima cifra è la cifra di controllo: si calcola dalle altre, e
// scarta quasi tutti gli errori di lettura o di battitura (una cifra
// sbagliata, due cifre vicine scambiate).
//
// Funzioni pure: i test sono in codiceEan.test.ts.

export type ErroreCodice =
  | "vuoto" // niente di scritto
  | "non-cifre" // c'è qualcosa che non è una cifra
  | "lunghezza" // non sono 8, 12 o 13 cifre
  | "controllo"; // la cifra di controllo non torna

export type LetturaCodice = { codice: string; errore: null } | { codice: null; errore: ErroreCodice };

// La cifra di controllo che le cifre date dovrebbero avere (tutte tranne
// l'ultima). Regola GS1, uguale per EAN-13, EAN-8 e UPC-A: partendo da
// destra le cifre valgono alternativamente 3 e 1, si sommano, e la cifra
// di controllo è quella che porta la somma al multiplo di 10 successivo.
// Partire da destra è il punto: così un EAN-13 e lo stesso codice con uno
// 0 in meno davanti (UPC-A) danno la stessa cifra.
function cifraDiControllo(cifre: string): number {
  let somma = 0;
  for (let i = 0; i < cifre.length; i++) {
    const cifra = Number(cifre[cifre.length - 1 - i]);
    somma += i % 2 === 0 ? cifra * 3 : cifra;
  }
  return (10 - (somma % 10)) % 10;
}

// Legge un codice scritto o letto dalla fotocamera. Gli spazi (anche in
// mezzo: "8 001234 567890", come è stampato sotto le barre) non contano.
// Restituisce il codice come si salva: 13 cifre per EAN-13 e UPC-A, 8 per
// EAN-8.
export function leggiCodice(testo: string): LetturaCodice {
  const pulito = testo.replace(/\s/g, "");
  if (pulito === "") return { codice: null, errore: "vuoto" };
  if (!/^[0-9]+$/.test(pulito)) return { codice: null, errore: "non-cifre" };
  if (pulito.length !== 8 && pulito.length !== 12 && pulito.length !== 13) {
    return { codice: null, errore: "lunghezza" };
  }
  const corpo = pulito.slice(0, -1);
  if (cifraDiControllo(corpo) !== Number(pulito[pulito.length - 1])) {
    return { codice: null, errore: "controllo" };
  }
  return { codice: pulito.length === 12 ? `0${pulito}` : pulito, errore: null };
}
