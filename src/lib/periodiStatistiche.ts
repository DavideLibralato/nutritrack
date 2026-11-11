// I periodi della pagina Statistiche (PUNTO_DI_PARTENZA.md, sezione 3,
// "Statistiche"): settimana di calendario lunedì–domenica o mese di
// calendario, le frecce ‹ › e il titolo.
//
// Un periodo si identifica con il suo primo giorno ("inizio"): il lunedì
// per la settimana, il primo del mese per il mese. Solo stringhe
// "YYYY-MM-DD", con l'aritmetica di dataGiorno.ts (regola del mezzogiorno).
// Funzioni pure: niente Dexie, niente React, testate in modo permanente
// (sezione 10.5, le regole sulle date).

import {
  eGiornoVero,
  formattaGiornoMese,
  formattaMeseLungo,
  giornoSettimanaDi,
  giorniNelMese,
  lunediDi,
  piuGiorni,
  piuMesi,
  primoDelMese,
} from "./dataGiorno";

export type ModoPeriodo = "settimana" | "mese";

// Il primo giorno del periodo che contiene la data.
export function inizioPeriodo(modo: ModoPeriodo, iso: string): string {
  return modo === "settimana" ? lunediDi(iso) : primoDelMese(iso);
}

// Tutti i giorni del periodo, in ordine: 7 per la settimana, 28–31 per il
// mese.
export function giorniDelPeriodo(modo: ModoPeriodo, inizio: string): string[] {
  const quanti = modo === "settimana" ? 7 : giorniNelMese(inizio);
  return Array.from({ length: quanti }, (_, i) => piuGiorni(inizio, i));
}

// Il periodo prima (-1) o dopo (+1).
export function periodoAdiacente(modo: ModoPeriodo, inizio: string, passo: -1 | 1): string {
  return modo === "settimana" ? piuGiorni(inizio, 7 * passo) : piuMesi(inizio, passo);
}

// Il primo periodo raggiungibile con la freccia ‹: quello della prima voce
// con data fino a oggi (la passa chi chiama). Senza voci, il periodo in
// corso: le frecce sono tutte e due spente. Una data dopo oggi non può
// spostare il limite oltre il periodo in corso.
function primoPeriodo(modo: ModoPeriodo, primoGiornoConVoci: string | null, oggi: string): string {
  const inCorso = inizioPeriodo(modo, oggi);
  if (primoGiornoConVoci === null) return inCorso;
  const primo = inizioPeriodo(modo, primoGiornoConVoci);
  return primo < inCorso ? primo : inCorso;
}

// Quali frecce sono accese: non si va oltre il periodo in corso, né prima
// del periodo della prima voce.
export function limitiFrecce(
  modo: ModoPeriodo,
  inizio: string,
  primoGiornoConVoci: string | null,
  oggi: string
): { precedente: boolean; successivo: boolean } {
  return {
    precedente: inizio > primoPeriodo(modo, primoGiornoConVoci, oggi),
    successivo: inizio < inizioPeriodo(modo, oggi),
  };
}

// Il titolo sopra le frecce e la riga sotto:
//   "2 – 8 novembre"   settimana dentro un mese solo
//   "26 ott – 1 nov"   settimana a cavallo di due mesi
//   "Novembre 2026"    mese
// Sotto: "Questa settimana", "Settimana scorsa", "Questo mese", o niente.
export function etichettaPeriodo(
  modo: ModoPeriodo,
  inizio: string,
  oggi: string
): { titolo: string; sottotitolo: string | null } {
  if (modo === "mese") {
    const nome = formattaMeseLungo(inizio);
    return {
      titolo: `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${inizio.slice(0, 4)}`,
      sottotitolo: inizio === primoDelMese(oggi) ? "Questo mese" : null,
    };
  }

  const fine = piuGiorni(inizio, 6);
  const titolo =
    inizio.slice(0, 7) === fine.slice(0, 7)
      ? `${Number(inizio.slice(8))} – ${Number(fine.slice(8))} ${formattaMeseLungo(fine)}`
      : `${formattaGiornoMese(inizio)} – ${formattaGiornoMese(fine)}`;

  const questa = lunediDi(oggi);
  let sottotitolo: string | null = null;
  if (inizio === questa) sottotitolo = "Questa settimana";
  else if (inizio === piuGiorni(questa, -7)) sottotitolo = "Settimana scorsa";
  return { titolo, sottotitolo };
}

const LETTERE: Record<ReturnType<typeof giornoSettimanaDi>, string> = {
  lunedi: "L",
  martedi: "M",
  mercoledi: "M",
  giovedi: "G",
  venerdi: "V",
  sabato: "S",
  domenica: "D",
};

// I giorni del mese con l'etichetta sotto la barra (oltre a oggi): uno
// ogni settimana, perché 31 numeri non ci stanno.
const GIORNI_CON_ETICHETTA = [1, 8, 15, 22, 29];

// L'etichetta sotto una barra: la lettera del giorno nella settimana; nel
// mese il numero solo per 1, 8, 15, 22, 29 e oggi, altrimenti "".
export function etichettaBarra(modo: ModoPeriodo, iso: string, oggi: string): string {
  if (modo === "settimana") return LETTERE[giornoSettimanaDi(iso)];
  const giorno = Number(iso.slice(8));
  return GIORNI_CON_ETICHETTA.includes(giorno) || iso === oggi ? String(giorno) : "";
}

// Dove si arriva cambiando fra Settimana e Mese, come nel mockup: dalla
// settimana al suo mese (quello del lunedì); dal mese alla settimana del
// suo primo giorno, ma non prima della settimana della prima voce (il
// primo del mese può cadere in una settimana senza dati).
export function periodoCambiandoModo(
  modoNuovo: ModoPeriodo,
  inizio: string,
  primoGiornoConVoci: string | null,
  oggi: string
): string {
  if (modoNuovo === "mese") return primoDelMese(inizio);
  const lunedi = lunediDi(inizio);
  const primo = primoPeriodo("settimana", primoGiornoConVoci, oggi);
  return lunedi < primo ? primo : lunedi;
}

// Il periodo da mostrare a partire dall'indirizzo (?vista=mese&dal=2026-10-01),
// controllato come ?giorno= di Oggi: un valore mancante, non valido, che non
// è l'inizio di un periodo, futuro o fuori dai limiti delle frecce riporta
// alla settimana in corso, senza errori.
export function periodoDaIndirizzo(
  vista: string | null,
  dal: string | null,
  primoGiornoConVoci: string | null,
  oggi: string
): { modo: ModoPeriodo; inizio: string } {
  const predefinito = { modo: "settimana" as const, inizio: lunediDi(oggi) };

  if (vista !== "settimana" && vista !== "mese") return predefinito;
  if (dal === null || !eGiornoVero(dal)) return predefinito;
  if (dal !== inizioPeriodo(vista, dal)) return predefinito;
  if (dal > inizioPeriodo(vista, oggi)) return predefinito;
  if (dal < primoPeriodo(vista, primoGiornoConVoci, oggi)) return predefinito;

  return { modo: vista, inizio: dal };
}
