// Il conto alla rovescia della barra dei messaggi (BarraAnnulla), con la
// pausa: finché il dito o il fuoco è sulla barra il tempo è fermo, e quando
// se ne va riprende da quanto restava, non da capo (dal 3/10: prima
// ripartiva pieno, e un tocco per sbaglio allungava la barra, tocchi
// ripetuti la tenevano aperta).
//
// Funzioni pure, senza timer: ricevono l'istante attuale (`ora`, in ms) e
// restituiscono uno stato nuovo. Il componente le chiama nei momenti giusti
// e da `rimanenteMs` ricava sia il timer di chiusura sia la posizione della
// linea del tempo, così le due cose non possono andare fuori passo. Test in
// tempoBarra.test.ts.

export interface TempoBarra {
  durataMs: number;
  // Il tempo che restava all'ultimo cambio (partenza, pausa, ripresa).
  rimanenteMs: number;
  // Quando il conto è ripartito l'ultima volta; null = in pausa.
  partitoAlle: number | null;
}

export function avviaTempo(durataMs: number, ora: number): TempoBarra {
  return { durataMs, rimanenteMs: durataMs, partitoAlle: ora };
}

// Quanto manca adesso, mai sotto zero. In pausa non scende.
export function tempoRimasto(tempo: TempoBarra, ora: number): number {
  if (tempo.partitoAlle === null) return tempo.rimanenteMs;
  return Math.max(0, tempo.rimanenteMs - (ora - tempo.partitoAlle));
}

// Ferma il conto: mette da parte quanto mancava. Già in pausa: non cambia.
export function pausaTempo(tempo: TempoBarra, ora: number): TempoBarra {
  if (tempo.partitoAlle === null) return tempo;
  return { ...tempo, rimanenteMs: tempoRimasto(tempo, ora), partitoAlle: null };
}

// Fa ripartire il conto da quanto mancava. Già in corso: non cambia.
export function riprendiTempo(tempo: TempoBarra, ora: number): TempoBarra {
  if (tempo.partitoAlle !== null) return tempo;
  return { ...tempo, partitoAlle: ora };
}
