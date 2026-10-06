// Trascinare un alimento o un pasto su un altro pasto in Oggi
// (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto"): le decisioni, senza
// browser. Il dito è in (x, y); i pasti sono rettangoli sullo schermo,
// misurati quando il trascinamento comincia (durante il trascinamento la
// lista non scorre, quindi non si muovono). Chi le usa: useTrascinaInPasto
// (src/lib/trascinaInPasto.ts).

export interface Rettangolo {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PastoSulloSchermo {
  id: string;
  rettangolo: Rettangolo;
}

function contiene(r: Rettangolo, x: number, y: number): boolean {
  // Bordo alto e sinistro dentro, basso e destro fuori: due pasti uno sotto
  // l'altro non si contendono mai la stessa riga di pixel.
  return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
}

// La zona in cui un pasto può essere un bersaglio: la parte VISIBILE della
// lista, tagliata in basso dove cominciano "+ Aggiungi" e la pillola
// (`limiteBasso`). Un pasto scorso sotto la testata o sotto le barre non si
// vede: un dito lì sopra non lo indica.
export function zonaBersagli(lista: Rettangolo, limiteBasso: number): Rettangolo {
  return { ...lista, bottom: Math.min(lista.bottom, limiteBasso) };
}

// Il pasto su cui finirebbe la riga se il dito si alzasse adesso: quello
// sotto il dito, dentro la zona dei bersagli, e mai quello di partenza.
// null = nessuno (fuori dai pasti, sopra le barre in basso, sul pasto di
// partenza): rilasciare lì non cambia niente.
export function bersaglioSotto(
  x: number,
  y: number,
  pasti: PastoSulloSchermo[],
  pastoPartenzaId: string | null,
  zona: Rettangolo
): string | null {
  if (!contiene(zona, x, y)) return null;
  const sotto = pasti.find((p) => contiene(p.rettangolo, x, y));
  if (!sotto || sotto.id === pastoPartenzaId) return null;
  return sotto.id;
}

// --- Scorrimento automatico (deciso il 6/10, al posto della decisione 2
// "niente scorrimento automatico": con molti pasti, quelli fuori schermo
// non si raggiungevano) ---
//
// In alto e in basso nella zona dei bersagli c'è una fascia sensibile alta
// ZONA_SCORRIMENTO_PX: con il dito lì dentro la lista scorre da sola verso
// quel lato. Quella in basso sta SOPRA "+ Aggiungi" e la pillola, perché la
// zona dei bersagli finisce dove cominciano loro. Più il dito è vicino al
// bordo, più si va veloci, fino a VELOCITA_MASSIMA_PX_S; oltre il bordo
// (sopra la testata, sopra le barre) si resta alla massima. Vale anche con
// "Riduci movimento": è una funzione, non un effetto.

export const ZONA_SCORRIMENTO_PX = 64;
export const VELOCITA_MASSIMA_PX_S = 800;
// Un fotogramma lento (l'app che torna dal background) non deve far saltare
// la lista: il tempo di un passo conta al massimo questo.
export const PASSO_MASSIMO_MS = 50;

// Velocità di scorrimento in px al secondo: negativa verso l'alto, positiva
// verso il basso, 0 fuori dalle fasce sensibili. Cresce in modo lineare da
// 0 (al limite interno della fascia) alla massima (sul bordo).
export function velocitaScorrimento(y: number, zona: Rettangolo): number {
  const inAlto = zona.top + ZONA_SCORRIMENTO_PX - y;
  if (inAlto > 0) return -VELOCITA_MASSIMA_PX_S * Math.min(1, inAlto / ZONA_SCORRIMENTO_PX);
  const inBasso = y - (zona.bottom - ZONA_SCORRIMENTO_PX);
  if (inBasso > 0) return VELOCITA_MASSIMA_PX_S * Math.min(1, inBasso / ZONA_SCORRIMENTO_PX);
  return 0;
}

// Il nuovo scrollTop dopo `dtMs` alla velocità data, fermo a fine corsa
// (0 in alto, `scrollMassimo` in basso).
export function prossimoScrollTop(
  scrollTop: number,
  velocita: number,
  dtMs: number,
  scrollMassimo: number
): number {
  const passo = (velocita * Math.min(dtMs, PASSO_MASSIMO_MS)) / 1000;
  return Math.max(0, Math.min(scrollMassimo, scrollTop + passo));
}

// I pasti sono misurati una volta, all'inizio del trascinamento. Se poi la
// lista scorre di `scorso` px verso il basso, sullo schermo stanno tutti
// `scorso` px più in alto.
export function pastiDopoScorrimento(pasti: PastoSulloSchermo[], scorso: number): PastoSulloSchermo[] {
  if (scorso === 0) return pasti;
  return pasti.map((p) => ({
    id: p.id,
    rettangolo: { ...p.rettangolo, top: p.rettangolo.top - scorso, bottom: p.rettangolo.bottom - scorso },
  }));
}
