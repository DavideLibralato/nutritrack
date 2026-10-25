// Il disegno della bilancia, una sola copia (PUNTO_DI_PARTENZA.md §7, "Nome e
// icona"): lo usano il marchio delle pagine di accesso (MarchioLibra) e
// l'animazione di apertura (AnimazioneApertura). È l'icona dell'app
// (docs/mockups/icona-libra.html) ridisegnata con tratti più spessi e senza
// il quadrato scuro. Coordinate nel viewBox "10 18 80 62".
//
// Diviso in pezzi perché l'animazione muove il giogo e i due piatti
// separatamente; il marchio li disegna tutti insieme, fermi.

export const VIEWBOX_BILANCIA = "10 18 80 62";

export const PERNO = { cx: 50, cy: 25, r: 5.5 };
export const ASTA = "M50 29 V73";
export const BASE = "M33 75 H67";
export const GIOGO = "M21 34 H79";

// I quattro fili uno per uno: l'animazione li allunga dal giogo verso il
// piatto con stroke-dashoffset, tutti e due insieme. In un percorso solo
// il tratteggio li disegnerebbe uno dopo l'altro.
export const FILI_SINISTRA_SEPARATI = ["M22 35 L14 55", "M22 35 L30 55"] as const;
export const FILI_DESTRA_SEPARATI = ["M78 35 L70 55", "M78 35 L86 55"] as const;
// Ogni filo è lungo √(8² + 20²) = √464 ≈ 21,54 unità: il tratteggio in
// globals.css (.apertura-filo) usa questo numero.
// Gli stessi fili in un percorso solo, come li disegna il marchio
// ("M22 35 L14 55 M22 35 L30 55": il testo non cambia).
export const FILI_SINISTRA = FILI_SINISTRA_SEPARATI.join(" ");
export const FILI_DESTRA = FILI_DESTRA_SEPARATI.join(" ");
export const PIATTO_SINISTRA = "M12 55 H32 A10 8 0 0 1 12 55 Z";
export const PIATTO_DESTRA = "M68 55 H88 A10 8 0 0 1 68 55 Z";

export const SPESSORE_ASTA = 7;
export const SPESSORE_BASE = 8;
export const SPESSORE_GIOGO = 7;
export const SPESSORE_FILI = 3.5;
