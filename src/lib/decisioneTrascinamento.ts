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
