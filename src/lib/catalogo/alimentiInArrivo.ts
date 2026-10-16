// Il confronto fra un alimento in arrivo da un amico e il proprio catalogo
// (PUNTO_DI_PARTENZA.md §3 "Amici", "Condividere un alimento"; decisioni
// del 16/10). Per ogni alimento in arrivo:
// - nuovo: nessun alimento vivo dell'utente con lo stesso nome e la stessa
//   marca → Rifiuta / Aggiungi;
// - uguale: c'è, con gli stessi valori → solo Ok;
// - diverso: c'è, con valori diversi → "Usa questi valori" / "Tieni i
//   miei", e la tabella del confronto.
//
// Il doppione è quello del catalogo (trovaDoppione, scritta una volta
// sola in doppioniAlimenti.ts). "Uguali" vuol dire tutti e nove i valori
// che "Usa questi valori" scriverebbe, in centesimi (la precisione di
// numeric(7,2) e del form): 3,30 e 3,31 sono diversi. Un valore assente
// non è uguale a 0.
//
// Due alimenti in arrivo uguali fra loro (stesso nome e marca, da due
// amici o due prodotti dello stesso amico): nessuno dei due è un doppione
// del catalogo, ma aggiungerli tutti e due ne farebbe due uguali. Nella
// selezione multipla se ne spunta uno solo per chiave; dopo l'Aggiungi e
// la discesa l'altro diventa un doppione normale.
//
// Funzioni pure, senza Dexie: i test sono in alimentiInArrivo.test.ts.

import type { Alimento, AlimentoCondiviso } from "../db/tipi";
import { chiaveAlimento, trovaDoppione } from "./doppioniAlimenti";
import { eModificabile } from "./alimentiModificabili";

// I nove valori che "Usa questi valori" scrive nel proprio alimento, e su
// cui si decide "uguale" o "diverso". Nome, marca, barcode e fonte no.
export const CAMPI_VALORI = [
  "kcal_100g",
  "grassi_100g",
  "carboidrati_100g",
  "proteine_100g",
  "porzione_default_g",
  "zuccheri_100g",
  "fibre_100g",
  "saturi_100g",
  "sale_100g",
] as const;

export type CampoValore = (typeof CAMPI_VALORI)[number];
export type ValoriAlimento = Pick<Alimento, CampoValore>;

// Le cinque righe che la tabella del confronto mostra sempre, nell'ordine
// delle etichette (kcal, grassi, carboidrati, proteine), più la porzione.
// Le altre quattro solo quando sono diverse, sotto.
const CAMPI_SEMPRE: readonly CampoValore[] = [
  "kcal_100g",
  "grassi_100g",
  "carboidrati_100g",
  "proteine_100g",
  "porzione_default_g",
];
const CAMPI_SE_DIVERSI: readonly CampoValore[] = [
  "zuccheri_100g",
  "fibre_100g",
  "saturi_100g",
  "sale_100g",
];

// I nove valori di un alimento (o di una copia in arrivo), e niente altro:
// quello che "Usa questi valori" scrive.
export function valoriDi(a: ValoriAlimento): ValoriAlimento {
  const valori = {} as Record<CampoValore, number | null>;
  for (const c of CAMPI_VALORI) valori[c] = a[c];
  return valori as ValoriAlimento;
}

// Gli username di chi manda, uno per mittente, nell'ordine dell'elenco
// (dal più recente): il sottotitolo della riga "N alimenti in arrivo".
// null se lo username non è arrivato.
export function usernameMittenti(
  righe: AlimentoCondiviso[],
  nomi: Record<string, string>
): (string | null)[] {
  const visti = new Set<string>();
  const username: (string | null)[] = [];
  for (const r of righe) {
    if (visti.has(r.user_id)) continue;
    visti.add(r.user_id);
    username.push(nomi[r.user_id] ?? null);
  }
  return username;
}

// Un valore in centesimi, intero. toPrecision toglie l'errore della
// moltiplicazione in virgola mobile (380.555 * 100 = 38055.49999…), così
// l'arrotondamento è quello di numeric(7,2): 380,555 → 380,56.
export function inCentesimi(valore: number | null): number | null {
  if (valore === null) return null;
  return Math.round(Number((valore * 100).toPrecision(12)));
}

function valoreUguale(a: number | null, b: number | null): boolean {
  return inCentesimi(a) === inCentesimi(b);
}

// I campi in cui i due alimenti hanno valori diversi, nell'ordine di
// CAMPI_VALORI.
export function campiDiversi(a: ValoriAlimento, b: ValoriAlimento): CampoValore[] {
  return CAMPI_VALORI.filter((c) => !valoreUguale(a[c], b[c]));
}

export function valoriIdentici(a: ValoriAlimento, b: ValoriAlimento): boolean {
  return campiDiversi(a, b).length === 0;
}

export interface RigaConfronto {
  campo: CampoValore;
  mio: number | null;
  inArrivo: number | null;
  diverso: boolean;
}

// Le righe della tabella "Confronta i valori": le cinque fisse, poi
// zuccheri, fibre, saturi e sale solo se diversi.
export function righeConfronto(mio: ValoriAlimento, inArrivo: ValoriAlimento): RigaConfronto[] {
  const riga = (campo: CampoValore): RigaConfronto => ({
    campo,
    mio: mio[campo],
    inArrivo: inArrivo[campo],
    diverso: !valoreUguale(mio[campo], inArrivo[campo]),
  });
  return [
    ...CAMPI_SEMPRE.map(riga),
    ...CAMPI_SE_DIVERSI.map(riga).filter((r) => r.diverso),
  ];
}

export type ConfrontoInArrivo =
  | { tipo: "nuovo" }
  | { tipo: "uguale"; mio: Alimento }
  // `modificabile`: il proprio alimento si può aggiornare con "Usa questi
  // valori". Falso solo per un alimento verificato dell'utente (oggi non
  // ne esistono: la RLS non lo permette): lì resta solo "Tieni i miei".
  | { tipo: "diverso"; mio: Alimento; righe: RigaConfronto[]; modificabile: boolean };

export function confrontaInArrivo(
  catalogo: Alimento[],
  inArrivo: AlimentoCondiviso,
  userId: string
): ConfrontoInArrivo {
  const mio = trovaDoppione(catalogo, inArrivo, { userId });
  if (!mio) return { tipo: "nuovo" };
  if (valoriIdentici(mio, inArrivo)) return { tipo: "uguale", mio };
  return {
    tipo: "diverso",
    mio,
    righe: righeConfronto(mio, inArrivo),
    modificabile: eModificabile(mio, userId),
  };
}

// --- La selezione multipla nel foglio ---

// Un alimento in arrivo con il suo confronto, come lo mostra il foglio.
export interface VoceInArrivo {
  riga: AlimentoCondiviso;
  confronto: ConfrontoInArrivo;
}

// Si spuntano solo gli alimenti nuovi: doppioni e uguali hanno le loro
// scelte, una per una.
export function eSelezionabile(voce: VoceInArrivo): boolean {
  return voce.confronto.tipo === "nuovo";
}

// Spunta o toglie la spunta a una voce. Se un'altra voce con lo stesso
// nome e la stessa marca è già spuntata, la spunta passa a questa: mai due
// uguali nella stessa selezione. Una voce non selezionabile non cambia
// niente. Restituisce un insieme nuovo (React vuole un oggetto nuovo per
// ridisegnare).
export function spunta(selezione: Set<string>, voci: VoceInArrivo[], id: string): Set<string> {
  const voce = voci.find((v) => v.riga.id === id);
  if (!voce || !eSelezionabile(voce)) return selezione;
  const nuova = new Set(selezione);
  if (nuova.has(id)) {
    nuova.delete(id);
    return nuova;
  }
  const chiave = chiaveAlimento(voce.riga);
  for (const v of voci) {
    if (v.riga.id !== id && nuova.has(v.riga.id) && chiaveAlimento(v.riga) === chiave) {
      nuova.delete(v.riga.id);
    }
  }
  nuova.add(id);
  return nuova;
}

// "Seleziona tutti": tutte le voci selezionabili, ma per ogni nome e marca
// solo la prima nell'ordine dell'elenco (la più recente).
export function selezionaTutti(voci: VoceInArrivo[]): Set<string> {
  const chiavi = new Set<string>();
  const scelte = new Set<string>();
  for (const v of voci) {
    if (!eSelezionabile(v)) continue;
    const chiave = chiaveAlimento(v.riga);
    if (chiavi.has(chiave)) continue;
    chiavi.add(chiave);
    scelte.add(v.riga.id);
  }
  return scelte;
}

// Gli id ancora validi di una selezione dopo una rilettura: spariti gli
// alimenti che non sono più in arrivo e quelli diventati doppioni (per
// esempio dopo la discesa di una copia appena aggiunta).
export function selezioneValida(selezione: Set<string>, voci: VoceInArrivo[]): Set<string> {
  const ammessi = new Set(voci.filter(eSelezionabile).map((v) => v.riga.id));
  return new Set([...selezione].filter((id) => ammessi.has(id)));
}
