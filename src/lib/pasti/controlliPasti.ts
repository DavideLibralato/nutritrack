// I controlli della pagina Impostazioni > Pasti e orari (PUNTO_DI_PARTENZA.md,
// sezione 3, "Pasti e orari"). Funzioni pure, testate in modo permanente:
// stanno nell'app e non sul server, perché un vincolo violato sul server
// bloccherebbe in silenzio la coda outbox (sezione 4, "pasti").
//
// Ogni riga di `pasti` ha un PERIODO, [valido_dal, valido_al] con i confini
// inclusi e null = nessun limite da quella parte. Due righe "hanno giorni in
// comune" se esiste almeno un giorno che sta in tutti e due i periodi: è lì
// che non possono avere lo stesso nome o la stessa ora. Scritto in generale,
// non solo per "oggi": servirà così com'è con le date future (passo 5).

import type { Pasto } from "../db/tipi";
import { formattaGiornoMese } from "../dataGiorno";

export interface Periodo {
  dal: string | null;
  al: string | null;
}

export function periodoDi(pasto: Pick<Pasto, "valido_dal" | "valido_al">): Periodo {
  return { dal: pasto.valido_dal ?? null, al: pasto.valido_al ?? null };
}

// Due periodi hanno almeno un giorno in comune se ciascuno comincia non
// dopo la fine dell'altro. Le date sono "YYYY-MM-DD": l'ordine alfabetico è
// quello del calendario.
export function periodiInComune(a: Periodo, b: Periodo): boolean {
  const aPrimaDellaFineDiB = a.dal === null || b.al === null || a.dal <= b.al;
  const bPrimaDellaFineDiA = b.dal === null || a.al === null || b.dal <= a.al;
  return aPrimaDellaFineDiB && bPrimaDellaFineDiA;
}

// Il nome come si salva: senza spazi all'inizio e alla fine, e con gli
// spazi doppi interni ridotti a uno ("  Pranzo   1 " → "Pranzo 1").
export function normalizzaNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

// Il nome come si confronta: normalizzato e senza maiuscole. "pranzo" e
// "Pranzo" in Oggi si confonderebbero, quindi contano come lo stesso nome.
function chiaveNome(nome: string): string {
  return normalizzaNome(nome).toLocaleLowerCase("it");
}

// L'ora come si salva e si confronta: "HH:mm". Da Postgres arriva
// "HH:mm:ss", dal campo time del browser "HH:mm".
export function normalizzaOra(ora: string): string {
  return ora.slice(0, 5);
}

// Le righe vive, diverse da quelle escluse, che hanno giorni in comune con
// il periodo dato.
function concorrenti(righe: Pasto[], periodo: Periodo, escludi: string[]): Pasto[] {
  return righe.filter(
    (r) => r.deleted_at === null && !escludi.includes(r.id) && periodiInComune(periodoDi(r), periodo)
  );
}

export const ERRORE_NOME_VUOTO = "Scrivi un nome.";
export const ERRORE_NOME_USATO = "C'è già un pasto con questo nome.";
export const ERRORE_ORA_VUOTA = "Scegli un orario.";

// null se il nome va bene per una riga con questo periodo. `escludi`: gli
// id da non confrontare (la riga stessa, e nella rinomina "da oggi" anche
// quella vecchia).
export function erroreNome(
  nome: string,
  periodo: Periodo,
  righe: Pasto[],
  escludi: string[]
): string | null {
  const chiave = chiaveNome(nome);
  if (chiave === "") return ERRORE_NOME_VUOTO;
  const uguale = concorrenti(righe, periodo, escludi).some((r) => chiaveNome(r.nome) === chiave);
  return uguale ? ERRORE_NOME_USATO : null;
}

// "all'8 ott", "al 12 ott": l'articolo segue il suono del numero.
function alGiorno(data: string): string {
  const testo = formattaGiornoMese(data);
  return /^(1|8|11) /.test(testo) ? `all'${testo}` : `al ${testo}`;
}

// null se l'ora va bene per una riga con questo periodo. Il messaggio
// nomina il pasto che la usa già; se quel pasto oggi non c'è (chiuso nel
// passato, o che comincerà più avanti) lo dice, altrimenti l'utente non
// lo troverebbe nell'elenco.
export function erroreOra(
  ora: string,
  periodo: Periodo,
  righe: Pasto[],
  escludi: string[],
  oggi: string
): string | null {
  const hhmm = normalizzaOra(ora);
  if (hhmm === "") return ERRORE_ORA_VUOTA;
  const occupato = concorrenti(righe, periodo, escludi).find((r) => normalizzaOra(r.ora_inizio) === hhmm);
  if (!occupato) return null;
  const { dal, al } = periodoDi(occupato);
  if (al !== null && al < oggi) {
    return `Alle ${hhmm} iniziava già ${occupato.nome} (fino ${alGiorno(al)}).`;
  }
  if (dal !== null && dal > oggi) {
    return `Alle ${hhmm} inizierà ${occupato.nome} (dal ${formattaGiornoMese(dal)}).`;
  }
  return `Alle ${hhmm} inizia già ${occupato.nome}.`;
}

// Cosa chiedere quando si salva un pasto con un nome nuovo:
// - "niente": il nome non è cambiato;
// - "correggi": si corregge senza domanda. Succede se cambiano solo
//   maiuscole o spazi ("pranzo" → "Pranzo": è lo stesso nome), o se il
//   pasto comincia oggi o più avanti: chiuderlo "da oggi" lo lascerebbe
//   senza nemmeno un giorno (la stessa regola degli obiettivi);
// - "chiedi": la domanda "da quando", Correggi o Da oggi.
export type DomandaNome = "niente" | "correggi" | "chiedi";

export function domandaPerNome(
  pasto: Pick<Pasto, "nome" | "valido_dal">,
  nomeNuovo: string,
  oggi: string
): DomandaNome {
  if (normalizzaNome(nomeNuovo) === normalizzaNome(pasto.nome)) return "niente";
  if (chiaveNome(nomeNuovo) === chiaveNome(pasto.nome)) return "correggi";
  const dal = pasto.valido_dal ?? null;
  if (dal !== null && dal >= oggi) return "correggi";
  return "chiedi";
}

// L'`ordine` di un pasto aggiunto: il più alto fra TUTTE le righe
// dell'utente, cancellate comprese, più uno. Decide solo fra due pasti alla
// stessa ora (sezione 3): così il nuovo va dopo, e nessun valore si riusa.
export function prossimoOrdine(righe: Pick<Pasto, "ordine">[]): number {
  return righe.reduce((max, r) => Math.max(max, r.ordine + 1), 0);
}
