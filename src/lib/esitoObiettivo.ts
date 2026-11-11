// La regola dei colori, una sola per tutta l'app (PUNTO_DI_PARTENZA.md,
// sezione 7, "La regola dei colori"): Statistiche e Oggi (anello, barre
// macro, la riga "X kcal oltre l'obiettivo"). Fino all'11/11 l'anello
// diceva "superato = sopra l'obiettivo" e BarraMacro "raggiunto =
// esattamente uguale".
//
// Due risposte separate:
//   - `esito`, il fatto, scritto nella pastiglia: sotto / in linea / sopra;
//   - `tono`, il giudizio, cioè il colore: neutro / buono (il colore
//     principale) / oltre (l'arancio).
// Di solito vanno insieme. L'eccezione sono le kcal con Dimagrire: un
// giorno molto sotto l'obiettivo è "sotto" ma verde, perché lì l'obiettivo è
// un tetto e restarci sotto è "come volevi".
//
// Funzione pura, testata in modo permanente (sezione 10.5): sbagliare un
// bordo non fa rumore, colora solo il giorno sbagliato.

import type { TipoObiettivo } from "./db/tipi";

// PROVVISORIA: si fissa dopo averla vista su iPhone (lezione del 24/10).
// In percento intero: i bordi si calcolano con soli numeri interi
// (valore * 100 contro obiettivo * 95), esatti per costruzione. Con i
// decimali (obiettivo * 0.95) l'esito oggi sarebbe lo stesso, verificato
// su tutti gli obiettivi da 1 a 5000, ma andrebbe ridimostrato a ogni
// valore nuovo della fascia.
export const FASCIA_PERCENTO = 5;

export type Grandezza = "kcal" | "grassi" | "carboidrati" | "proteine";
export type Esito = "sotto" | "in-linea" | "sopra";
export type Tono = "neutro" | "buono" | "oltre";

export interface EsitoObiettivo {
  esito: Esito;
  tono: Tono;
}

export const TESTI_ESITO: Record<Esito, string> = {
  sotto: "sotto",
  "in-linea": "in linea",
  sopra: "sopra",
};

// `valore` e `obiettivo` si confrontano arrotondati all'intero, come si
// vedono a schermo: il colore dice quello che il numero mostra (2310,4 kcal
// si legge 2310, in linea; 2310,6 si legge 2311, sopra).
// Senza obiettivo, o con obiettivo 0: null (nessuna pastiglia, colore
// neutro).
// `tipoObiettivo`: quello del periodo valido quel giorno (targetDelGiorno).
export function esitoRispettoObiettivo(
  valore: number,
  obiettivo: number | null,
  grandezza: Grandezza,
  tipoObiettivo: TipoObiettivo | null
): EsitoObiettivo | null {
  if (obiettivo === null) return null;
  const v = Math.round(valore);
  const t = Math.round(obiettivo);
  if (t <= 0) return null;

  // Bordi inclusi: con 2200 e ±5% "in linea" va da 2090 a 2310.
  const sottoFascia = v * 100 < t * (100 - FASCIA_PERCENTO);
  const sopraFascia = v * 100 > t * (100 + FASCIA_PERCENTO);

  // Le kcal con Dimagrire sono un tetto: nessuna fascia sopra, 1 kcal oltre
  // è già "sopra" (la regola che l'anello di Oggi aveva già). Grassi e
  // carboidrati con Dimagrire no: si trattano come le proteine (PUNTO §7).
  if (grandezza === "kcal" && tipoObiettivo === "dimagrire") {
    if (v > t) return { esito: "sopra", tono: "oltre" };
    return { esito: sottoFascia ? "sotto" : "in-linea", tono: "buono" };
  }

  if (sottoFascia) return { esito: "sotto", tono: "neutro" };
  if (sopraFascia) return { esito: "sopra", tono: "oltre" };
  return { esito: "in-linea", tono: "buono" };
}
