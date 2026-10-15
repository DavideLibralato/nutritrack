// I messaggi della barra in basso (BarraAnnulla) dopo un inserimento, una
// cancellazione, un ripristino o un salvataggio (PUNTO_DI_PARTENZA.md, punto
// 10.2).
//
// Il verbo sta PRIMA del nome ("Aggiunto: Pane", non "Pane aggiunto"): con
// il nome dopo, il participio si accorderebbe male con metà degli alimenti
// ("Mela aggiunto"). Le parti restano separate, mai una stringa unica: la
// barra mette il nome in evidenza e lo tronca con "…" su una riga sola,
// lasciando sempre visibili il verbo (`testo`) e il dettaglio (`coda`).

import { accorcia, elencoAlimenti, MASSIMO_ALIMENTO } from "../diario/testiSpostamento";
import type { PianoInserimento } from "../diario/pianoInserimento";

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

// Il messaggio dopo un inserimento da /aggiungi con i doppioni (sezione 3,
// "Doppioni"), dal piano che è stato applicato. Dice cosa è successo
// DAVVERO, come i messaggi di Sposta e Duplica:
// - un alimento in una riga nuova (anche "Tieni separati"): "Aggiunto: Mela";
// - un alimento sommato a quello che c'era: "Sommato: Mela → 150 g";
// - un alimento con la quantità scritta a mano: "Aggiornato: Mela → 120 g";
// - un pasto salvato: "Aggiunto: Colazione (3 alimenti)", contando gli
//   alimenti aggiunti e quelli sommati o scritti;
// - un pasto salvato con esclusi ("Non aggiungerlo"): "Aggiunto:
//   «Colazione» (tranne «Mela», che c'era già)." — con più esclusi
//   l'elenco di Duplica: «Mela» e «Pane», oppure «Mela», «Pane» e altri 2;
// - niente aggiunto: null, nessuna barra (si resta su /aggiungi). Mai la
//   parola "Aggiunto" se non è entrato niente.
// Il nome del pasto salvato, scelto dall'utente come quello di un alimento,
// nella frase lunga si accorcia come i nomi degli alimenti.
export function messaggioInserimento(
  tipo: "alimento" | "pasto-salvato",
  nome: string,
  piano: Pick<PianoInserimento, "inseriti" | "esclusi" | "aggiornati">
): MessaggioBarra | null {
  if (piano.inseriti.length === 0) return null;

  if (tipo === "alimento") {
    const aggiornato = piano.aggiornati[0];
    if (!aggiornato) return messaggioAggiunto(nome, null);
    const grammi = `${aggiornato.grammi.toLocaleString("it-IT", { maximumFractionDigits: 2 })} g`;
    return {
      testo: aggiornato.tipo === "somma" ? "Sommato:" : "Aggiornato:",
      nome,
      coda: `→ ${grammi}`,
      icona: "spunta",
    };
  }

  if (piano.esclusi.length === 0) return messaggioAggiunto(nome, piano.inseriti.length);
  const plurale = new Set(piano.esclusi).size > 1;
  return {
    testo:
      `Aggiunto: «${accorcia(nome, MASSIMO_ALIMENTO)}» ` +
      `(tranne ${elencoAlimenti(piano.esclusi)}, che ${plurale ? "c'erano" : "c'era"} già).`,
    icona: "spunta",
  };
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

// Impostazioni > Alimenti, dopo l'eliminazione dalla selezione:
// "Eliminato: Mela" con un alimento solo, "Eliminati: 3 alimenti" con più.
export function messaggioAlimentiEliminati(nomi: string[]): MessaggioBarra {
  if (nomi.length === 1) return messaggioEliminato(nomi[0]);
  return { testo: "Eliminati:", nome: `${nomi.length} alimenti`, icona: "elimina" };
}

export function messaggioRipristinato(nome: string): MessaggioBarra {
  return { testo: "Ripristinato:", nome, icona: "spunta" };
}

// Impostazioni > Preferiti e pasti salvati, dopo la stella svuotata sulla
// riga di un alimento (con "Annulla", che lo rimette).
export function messaggioToltoDaiPreferiti(nome: string): MessaggioBarra {
  return { testo: "Tolto dai preferiti:", nome };
}

// Impostazioni > Alimenti, dopo "Nuovo alimento": con "Più usati" un
// alimento appena creato (0 usi) finisce in fondo all'elenco, e senza la
// barra non si vedrebbe che è stato salvato.
export function messaggioAlimentoCreato(nome: string): MessaggioBarra {
  return { testo: "Creato:", nome, icona: "spunta" };
}

export const MESSAGGIO_ANNULLATO: MessaggioBarra = {
  testo: "Annullato.",
  icona: "annulla",
};

export const MESSAGGIO_SALVATO: MessaggioBarra = {
  testo: "Salvato.",
  icona: "spunta",
};
