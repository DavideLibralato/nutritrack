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

// Quanto resta la barra, in un posto solo (mai numeri nei componenti):
// - conAzione, 3 s: c'è "Annulla" (Aggiunto, Eliminato), serve il tempo di
//   decidere e toccare;
// - senzaAzione, 2,5 s: tutto il resto, frasi e conferme brevi (Salvato,
//   Ripristinato, Annullato, il messaggio della stella, gli avvisi).
// Dal 3/10; prima 5 s, 4 s e 2,5 s: 5 e 4 erano troppi inserendo più
// alimenti di fila. La barra sceglie da sola (c'è un'azione o no), i
// messaggi non portano una durata loro. Il dito o il fuoco sulla barra
// fermano il conto, che poi riprende da dove era (tempoBarra.ts).
export const DURATE_BARRA = {
  conAzione: 3000,
  senzaAzione: 2500,
} as const;

export interface MessaggioBarra {
  testo: string;
  nome?: string;
  coda?: string;
  icona?: IconaBarra;
  durataMs?: number;
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

// `numeroAlimenti`: null per una cosa sola (un alimento del catalogo in
// /aggiungi, una voce in Oggi), il numero di voci cancellate per "Elimina
// tutto il pasto" in Oggi — stessa forma di messaggioAggiunto per un pasto
// salvato: "Eliminato: Pranzo (3 alimenti)".
export function messaggioEliminato(
  nome: string,
  numeroAlimenti: number | null = null
): MessaggioBarra {
  if (numeroAlimenti === null) return { testo: "Eliminato:", nome, icona: "elimina" };
  const parola = numeroAlimenti === 1 ? "alimento" : "alimenti";
  return { testo: "Eliminato:", nome, coda: `(${numeroAlimenti} ${parola})`, icona: "elimina" };
}

export function messaggioRipristinato(nome: string): MessaggioBarra {
  return { testo: "Ripristinato:", nome, icona: "spunta" };
}

export const MESSAGGIO_ANNULLATO: MessaggioBarra = {
  testo: "Annullato.",
  icona: "annulla",
};

export const MESSAGGIO_SALVATO: MessaggioBarra = {
  testo: "Salvato.",
  icona: "spunta",
};
