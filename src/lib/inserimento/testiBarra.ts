// I messaggi della barra in basso (BarraAnnulla) dopo un inserimento, una
// cancellazione, un ripristino o un salvataggio (PUNTO_DI_PARTENZA.md, punto
// 10.2).
//
// Il verbo sta PRIMA del nome ("Aggiunto: Pane", non "Pane aggiunto"): con
// il nome dopo, il participio si accorderebbe male con metà degli alimenti
// ("Mela aggiunto"). Le parti restano separate, mai una stringa unica: la
// barra mette il nome in evidenza e lo tronca con "…" su una riga sola,
// lasciando sempre visibili il verbo (`testo`) e il dettaglio (`coda`).

// L'icona nel cerchio a sinistra della barra (BarraAnnulla):
// - "spunta": è andato a buon fine (Aggiunto, Salvato, Ripristinato);
// - "annulla": freccia ↶, un'azione è stata annullata;
// - "elimina": cestino, qualcosa è stato eliminato;
// - "info": tutto il resto (avvisi, errori, il messaggio della stella). È il
//   predefinito della barra: su un errore una spunta direbbe il contrario.
export type IconaBarra = "spunta" | "annulla" | "elimina" | "info";

export interface MessaggioBarra {
  testo: string;
  nome?: string;
  coda?: string;
  icona?: IconaBarra;
}

// `numeroAlimenti`: null per un alimento singolo (sheet o "+" rapido), il
// numero di voci scritte per un pasto salvato.
export function messaggioAggiunto(
  nome: string,
  numeroAlimenti: number | null
): MessaggioBarra {
  if (numeroAlimenti === null) return { testo: "Aggiunto:", nome, icona: "spunta" };
  const parola = numeroAlimenti === 1 ? "alimento" : "alimenti";
  return { testo: "Aggiunto:", nome, coda: `(${numeroAlimenti} ${parola})`, icona: "spunta" };
}

export function messaggioEliminato(nome: string): MessaggioBarra {
  return { testo: "Eliminato:", nome, icona: "elimina" };
}

export function messaggioRipristinato(nome: string): MessaggioBarra {
  return { testo: "Ripristinato:", nome, icona: "spunta" };
}

export const MESSAGGIO_ANNULLATO: MessaggioBarra = { testo: "Annullato.", icona: "annulla" };

export const MESSAGGIO_SALVATO: MessaggioBarra = { testo: "Salvato.", icona: "spunta" };
