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
import { formattaGiornoMese, giornoSuccessivo } from "../dataGiorno";

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
export function chiaveNome(nome: string): string {
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
  if (iniziaOggiODopo(pasto, oggi)) return "correggi";
  return "chiedi";
}

// Il pasto comincia oggi o più avanti (valido_dal >= oggi): non ha giorni
// passati. Chiuderlo "da oggi" (rinomina o eliminazione) lo lascerebbe
// senza nemmeno un giorno, quindi per lui "da oggi" non esiste: si corregge
// o si elimina del tutto, senza domanda.
export function iniziaOggiODopo(pasto: Pick<Pasto, "valido_dal">, oggi: string): boolean {
  const dal = pasto.valido_dal ?? null;
  return dal !== null && dal >= oggi;
}

// Ogni giorno del periodo ha almeno uno dei pasti `altri` valido? (Passo 4,
// Elimina pasto: nessun giorno deve restare senza pasti, perché da un
// giorno senza pasti non si registra niente.) I pasti cancellati non
// contano. Si cammina dal primo giorno del periodo: fra i pasti che valgono
// quel giorno si prende quello che arriva più lontano, e si riparte dal
// giorno dopo la sua fine, finché il periodo è coperto o resta un buco.
export function periodoCoperto(periodo: Periodo, altri: Pasto[]): boolean {
  const vivi = altri.filter((p) => p.deleted_at === null).map(periodoDi);
  // Il primo giorno ancora da coprire; null = "da sempre".
  let da = periodo.dal;
  for (;;) {
    const coprono = vivi.filter(
      (p) =>
        (p.dal === null || (da !== null && p.dal <= da)) && (p.al === null || da === null || p.al >= da)
    );
    if (coprono.length === 0) return false;
    // Fra quelli che coprono `da`, quello che arriva più lontano.
    const fine = coprono.some((p) => p.al === null)
      ? null
      : coprono.reduce((max, p) => ((p.al as string) > max ? (p.al as string) : max), coprono[0].al as string);
    if (fine === null) return true;
    if (periodo.al !== null && fine >= periodo.al) return true;
    da = giornoSuccessivo(fine);
  }
}

export const ERRORE_UNICO_PASTO = "È l'unico pasto: almeno uno deve restare.";
export const ERRORE_GIORNI_SENZA_PASTI = "Alcuni giorni passati resterebbero senza pasti.";

// Cosa permette "Elimina pasto" su questo pasto, oggi:
// - motivoSpento: il pulsante è spento (con questo motivo) se da oggi in
//   poi, nel periodo del pasto, qualche giorno resterebbe senza pasti.
//   Con i pasti di adesso vuol dire "è l'unico pasto valido oggi";
// - senzaDomanda: il pasto comincia oggi o dopo, quindi si elimina del
//   tutto, senza "da quando";
// - motivoPassatiSpento: "Anche nei giorni passati" è spento se in qualche
//   giorno del periodo intero del pasto resterebbe senza pasti.
export interface RegoleElimina {
  motivoSpento: string | null;
  senzaDomanda: boolean;
  motivoPassatiSpento: string | null;
}

export function regoleElimina(pasto: Pasto, righe: Pasto[], oggi: string): RegoleElimina {
  const altri = righe.filter((r) => r.id !== pasto.id);
  const periodo = periodoDi(pasto);
  const daOggi: Periodo = { dal: periodo.dal !== null && periodo.dal > oggi ? periodo.dal : oggi, al: periodo.al };
  return {
    motivoSpento: periodoCoperto(daOggi, altri) ? null : ERRORE_UNICO_PASTO,
    senzaDomanda: iniziaOggiODopo(pasto, oggi),
    motivoPassatiSpento: periodoCoperto(periodo, altri) ? null : ERRORE_GIORNI_SENZA_PASTI,
  };
}

// L'`ordine` di un pasto aggiunto: il più alto fra TUTTE le righe
// dell'utente, cancellate comprese, più uno. Decide solo fra due pasti alla
// stessa ora (sezione 3): così il nuovo va dopo, e nessun valore si riusa.
export function prossimoOrdine(righe: Pick<Pasto, "ordine">[]): number {
  return righe.reduce((max, r) => Math.max(max, r.ordine + 1), 0);
}
