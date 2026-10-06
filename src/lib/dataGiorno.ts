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
//
// `oggiLocale()` è l'unico "oggi" dell'app: Oggi, l'inserimento, il periodo
// in corso del Profilo e la pesata usano tutti la data del calendario.
// Anche all'una di notte (PUNTO_DI_PARTENZA.md, sezione 4, "Il giorno è
// quello del calendario").

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

// I due livelli del titolo di Oggi ("giorno sopra la data", come nei
// mockup): sopra il giorno della settimana in piccolo, sotto "4 set" in
// grande. "mercoledì" esce minuscolo: il maiuscolo lo fa il CSS
// (`uppercase`), così il testo resta quello vero.
export function formattaGiornoSettimana(iso: string): string {
  return daISO(iso).toLocaleDateString("it-IT", { weekday: "long" });
}

export function formattaGiornoMese(iso: string): string {
  return daISO(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// "mercoledì 4 settembre" — la data per esteso, per lo screen reader: il
// titolo a schermo ("4 set", mese abbreviato) letto ad alta voce è peggio.
export function formattaDataEstesa(iso: string): string {
  return daISO(iso).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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

// "lun 5 ott": il giorno in breve, dentro una frase (il messaggio di
// Duplica su un altro giorno, "Duplicato: Mela in Pranzo di lun 5 ott").
export function formattaGiornoCorto(iso: string): string {
  return daISO(iso).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
}

// Una data scritta o scelta dall'utente su cui si può registrare: un
// giorno vero "YYYY-MM-DD" (non "2026-02-30") e non nel futuro rispetto a
// oggiLocale — l'orologio locale, non UTC: all'una di notte il giorno nuovo
// è già scrivibile. Un campo data col `max` non basta: alcuni browser
// lasciano digitare una data oltre il massimo.
export function dataScrivibile(iso: string, adesso: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  if (oggiLocale(daISO(iso)) !== iso) return false;
  return !eFuturo(iso, adesso);
}

// "HH:mm" dell'orologio locale. Serve alla proposta del pasto in base
// all'ora quando si inserisce nel giorno corrente (sezione "I pasti").
export function oraCorrente(d: Date = new Date()): string {
  const ore = String(d.getHours()).padStart(2, "0");
  const minuti = String(d.getMinutes()).padStart(2, "0");
  return `${ore}:${minuti}`;
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
