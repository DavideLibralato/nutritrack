// I messaggi della barra in basso (BarraAnnulla) dopo un inserimento, una
// cancellazione o un ripristino (PUNTO_DI_PARTENZA.md, punto 10.2).
//
// Il verbo sta PRIMA del nome ("Aggiunto: Pane", non "Pane aggiunto"): con
// il nome dopo, il participio si accorderebbe male con metà degli alimenti
// ("Mela aggiunto"). Il nome è separato dal resto perché la barra lo tronca
// con "…" su una riga sola, lasciando sempre visibili il verbo e il
// conteggio.

export interface MessaggioBarra {
  testo: string;
  nome?: string;
  coda?: string;
}

// `numeroAlimenti`: null per un alimento singolo (sheet o "+" rapido), il
// numero di voci scritte per un pasto salvato.
export function messaggioAggiunto(
  nome: string,
  numeroAlimenti: number | null
): MessaggioBarra {
  if (numeroAlimenti === null) return { testo: "Aggiunto:", nome };
  const parola = numeroAlimenti === 1 ? "alimento" : "alimenti";
  return { testo: "Aggiunto:", nome, coda: `(${numeroAlimenti} ${parola})` };
}

export function messaggioEliminato(nome: string): MessaggioBarra {
  return { testo: "Eliminato:", nome };
}

export function messaggioRipristinato(nome: string): MessaggioBarra {
  return { testo: "Ripristinato:", nome };
}

export const MESSAGGIO_ANNULLATO: MessaggioBarra = { testo: "Annullato." };
