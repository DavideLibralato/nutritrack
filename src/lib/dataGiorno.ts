// Il "giorno" della pagina Oggi è una stringa "YYYY-MM-DD", la stessa forma
// con cui `voci_diario.data` è salvata (PUNTO_DI_PARTENZA.md, sezione 4).
//
// Funzioni pure: solo stringhe e Date dentro, stringhe fuori. Niente Dexie,
// niente React — così la navigazione fra i giorni (frecce, calendario) si
// testa senza montare nulla. `GiornoSettimana` è solo un tipo (si compila via,
// non introduce Dexie): stesso principio di totaliDiario.ts, che importa i
// tipi delle tabelle senza toccare il database.
//
// Perché non usare `new Date().toISOString().slice(0, 10)` come altrove:
// toISOString() dà la data in UTC. A Roma, fra mezzanotte e le 02:00 d'estate,
// sarebbe ancora "ieri". Qui il giorno è sempre quello dell'orologio locale.

import type { GiornoSettimana } from "./db/tipi";

// "YYYY-MM-DD" dell'orologio locale.
export function oggiLocale(d: Date = new Date()): string {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, "0");
  const giorno = String(d.getDate()).padStart(2, "0");
  return `${anno}-${mese}-${giorno}`;
}

// Da "YYYY-MM-DD" a Date locale a mezzogiorno: l'ora 12:00 evita che un
// cambio d'ora legale (che scatta di notte) sposti il giorno avanti o
// indietro quando si somma/sottrae 24 h.
function daISO(iso: string): Date {
  const [anno, mese, giorno] = iso.split("-").map(Number);
  return new Date(anno, mese - 1, giorno, 12, 0, 0);
}

export function giornoPrecedente(iso: string): string {
  const d = daISO(iso);
  d.setDate(d.getDate() - 1);
  return oggiLocale(d);
}

export function giornoSuccessivo(iso: string): string {
  const d = daISO(iso);
  d.setDate(d.getDate() + 1);
  return oggiLocale(d);
}

// "Mercoledì 4 set" — come nel mockup. toLocaleDateString dà "mercoledì 4
// set" (minuscolo), qui si alza solo la prima lettera.
export function formattaData(iso: string): string {
  const testo = daISO(iso).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

// "2026-09-21" → "21/09/2026": solo stringhe, niente Date e quindi niente
// fusi orari. Per le date in Profilo (data di nascita, inizio di un periodo).
export function formattaDataBreve(iso: string): string {
  const [anno, mese, giorno] = iso.split("-");
  return `${giorno}/${mese}/${anno}`;
}

export function eOggi(iso: string, adesso: Date = new Date()): boolean {
  return iso === oggiLocale(adesso);
}

// Il giorno futuro non è mai inseribile né visualizzabile (sezione
// "Inserimento retroattivo"): la navigazione si ferma a oggi.
export function eFuturo(iso: string, adesso: Date = new Date()): boolean {
  return iso > oggiLocale(adesso);
}

// "HH:mm" dell'orologio locale. Serve alla proposta del pasto in base
// all'ora quando si inserisce nel giorno corrente (sezione "I pasti").
export function oraCorrente(d: Date = new Date()): string {
  const ore = String(d.getHours()).padStart(2, "0");
  const minuti = String(d.getMinutes()).padStart(2, "0");
  return `${ore}:${minuti}`;
}

// Il "giorno logico" a cui appartiene un inserimento fatto adesso
// (PUNTO_DI_PARTENZA.md, sezione "Il giorno logico"). L'ultimo pasto scavalca
// la mezzanotte (la Cena dura fino alla mattina dopo), quindi:
//
//   un inserimento fatto PRIMA dell'ora di inizio del primo pasto appartiene
//   al giorno precedente.
//
// Registri qualcosa all'una di notte → finisce nella giornata di "ieri", non
// nell'oggi del calendario. È la stessa logica con cui l'app propone il pasto,
// applicata alla data.
//
// `oraInizioPrimoPasto` è "HH:mm" (l'ora del pasto più mattiniero, non del
// primo per `ordine`: le fasce sono riordinabili dall'utente). Se è null
// — nessun pasto ancora, nessuna regola da applicare — vale il giorno del
// calendario. Il confronto fra stringhe "HH:mm" funziona perché sono a
// lunghezza fissa e zero-padded, come già in pastoPerOrario.
export function giornoLogico(
  oraInizioPrimoPasto: string | null,
  adesso: Date = new Date()
): string {
  const oggi = oggiLocale(adesso);
  if (oraInizioPrimoPasto && oraCorrente(adesso) < oraInizioPrimoPasto) {
    return giornoPrecedente(oggi);
  }
  return oggi;
}

// getDay() di JS parte dalla domenica (0): l'indice qui sotto rispetta
// quell'ordine per poterlo usare direttamente, non l'ordine lunedì-prima
// dell'array OPZIONI_GIORNO nella pagina Profilo.
const GIORNI_SETTIMANA: readonly GiornoSettimana[] = [
  "domenica",
  "lunedi",
  "martedi",
  "mercoledi",
  "giovedi",
  "venerdi",
  "sabato",
];

// Il giorno della settimana di una data "YYYY-MM-DD", per confrontarla con
// `profili.giorni_allenamento_default` (sezione 3, "Giorni normali e giorni
// di allenamento"). daISO usa il mezzogiorno locale come le altre funzioni
// di questo file: nessun rischio legato al cambio d'ora legale.
export function giornoSettimanaDi(iso: string): GiornoSettimana {
  return GIORNI_SETTIMANA[daISO(iso).getDay()];
}
