// Validazione dei numeri di un alimento del catalogo: kcal e macro per 100 g
// e porzione predefinita. La usa CreaAlimentoForm, sia per "Nuovo alimento"
// sia per "Modifica alimento".
//
// Due livelli di limiti:
// 1. quelli dello schema: tutte queste colonne di `alimenti` sono
//    numeric(7,2) su Supabase — massimo 99999,99 e arrotondamento a due
//    decimali prima di scrivere (leggiNumeroDecimale, src/lib/numeriDecimali.ts);
// 2. quelli fisici dei valori per 100 g, che nessun alimento reale supera
//    e quindi sono sempre errori di battitura: ogni macro al massimo 100 g,
//    kcal al massimo 900 (il grasso puro, 9 kcal/g), zuccheri non più dei
//    carboidrati (ne sono una parte), saturi non più dei grassi (idem),
//    grassi + carboidrati + proteine non oltre 100 g più la tolleranza degli
//    arrotondamenti in etichetta (TOLLERANZA_SOMMA_MACRO, qui sotto).
//
// Funzione pura, senza React: i test sono in valoriAlimento.test.ts.

import { leggiNumeroDecimale, type ErroreDecimale } from "../numeriDecimali";

// Stringhe, come nei campi. I quattro facoltativi (oggi il form non li
// mostra: si scrivono null) valgono null se assenti o vuoti.
export interface CampiAlimento {
  kcal: string;
  grassi: string;
  carboidrati: string;
  proteine: string;
  porzione: string;
  zuccheri?: string;
  fibre?: string;
  saturi?: string;
  sale?: string;
}

export type CampoAlimento = keyof CampiAlimento;

// I valori pronti da scrivere, già arrotondati.
export interface ValoriAlimento {
  kcal_100g: number;
  grassi_100g: number;
  carboidrati_100g: number;
  proteine_100g: number;
  porzione_default_g: number;
  zuccheri_100g: number | null;
  fibre_100g: number | null;
  saturi_100g: number | null;
  sale_100g: number | null;
}

export interface EsitoValidazioneAlimento {
  // null finché c'è un errore o manca un campo obbligatorio.
  valori: ValoriAlimento | null;
  // Campo → messaggio da scrivere accanto a quel campo.
  errori: Partial<Record<CampoAlimento, string>>;
  // Campi obbligatori ancora vuoti. Non sono "errori" (un form nuovo parte
  // vuoto, non sbagliato): bloccano il salvataggio, ma il form li elenca
  // una volta sola invece di segnare in rosso ogni campo.
  mancanti: CampoAlimento[];
  // Errore che non appartiene a un campo solo (la somma dei macro): il form
  // lo mostra sotto il gruppo "Valori per 100 g".
  erroreSomma: string | null;
}

export const MASSIMO_KCAL_100G = 900;
export const MASSIMO_MACRO_100G = 100;

// Grassi + carboidrati + proteine non possono superare 100 g per 100 g, ma
// le etichette arrotondano (linee guida UE del 2012 sul Reg. 1169/2011: al
// grammo da 10 g in su, al decimo sotto). Ogni valore stampato può essere
// più alto del vero di 0,5 g al massimo, quindi tre valori insieme di 1,5 g:
// oltre 101,5 g non è più arrotondamento, è un errore di battitura. In
// etichetta UE la fibra è fuori dai carboidrati, quindi la somma vera sta
// sotto 100 anche per i prodotti "puri" (olio, zucchero). Deciso il
// 2026-09-26.
export const TOLLERANZA_SOMMA_MACRO = 1.5;
export const MASSIMO_SOMMA_MACRO = MASSIMO_MACRO_100G + TOLLERANZA_SOMMA_MACRO;

const OBBLIGATORI: CampoAlimento[] = ["kcal", "grassi", "carboidrati", "proteine", "porzione"];

// Messaggi per campo. La porzione è una quantità (come i grammi dello
// sheet); gli altri sono valori per 100 g, dove zero è ammesso e il limite
// vero è quello fisico, molto sotto 99999,99.
function messaggio(campo: CampoAlimento, errore: ErroreDecimale): string {
  if (errore === "non-numero") return "Scrivi un numero";
  if (campo === "porzione") {
    return errore === "oltre-massimo" ? "Al massimo 99999,99 g" : "Deve essere maggiore di zero";
  }
  if (errore === "sotto-minimo") return "Non può essere negativo";
  return campo === "kcal" ? "Al massimo 900 kcal per 100 g" : "Al massimo 100 g per 100 g";
}

function formatta(n: number): string {
  return String(n).replace(".", ",");
}

export function validaValoriAlimento(campi: CampiAlimento): EsitoValidazioneAlimento {
  const errori: Partial<Record<CampoAlimento, string>> = {};
  const mancanti: CampoAlimento[] = [];
  const letti: Partial<Record<CampoAlimento, number | null>> = {};

  for (const campo of Object.keys(campi) as CampoAlimento[]) {
    const testo = campi[campo] ?? "";
    if (testo.trim() === "") {
      if (OBBLIGATORI.includes(campo)) mancanti.push(campo);
      else letti[campo] = null;
      continue;
    }
    const lettura = leggiNumeroDecimale(testo, { zeroAmmesso: campo !== "porzione" });
    if (lettura.errore !== null) {
      errori[campo] = messaggio(campo, lettura.errore);
      continue;
    }
    const limite =
      campo === "kcal" ? MASSIMO_KCAL_100G : campo === "porzione" ? null : MASSIMO_MACRO_100G;
    if (limite !== null && lettura.valore > limite) {
      errori[campo] = messaggio(campo, "oltre-massimo");
      continue;
    }
    letti[campo] = lettura.valore;
  }

  // Una parte non può superare il tutto. Si confrontano i valori già
  // arrotondati (quelli che si scriveranno); l'errore va sul campo della
  // parte, perché di solito è quello scritto per ultimo.
  const { zuccheri, carboidrati, saturi, grassi } = letti;
  if (zuccheri != null && carboidrati != null && zuccheri > carboidrati) {
    errori.zuccheri = `Non più dei carboidrati (${formatta(carboidrati)} g)`;
  }
  if (saturi != null && grassi != null && saturi > grassi) {
    errori.saturi = `Non più dei grassi (${formatta(grassi)} g)`;
  }

  // Somma dei tre macro, solo se tutti e tre sono validi (altrimenti c'è già
  // un messaggio sul campo). Arrotondata ai centesimi: sono valori a due
  // decimali, ma la loro somma in virgola mobile può uscire "sporca"
  // (50.1 + 32.2 + 19.2 = 101.50000000000001, che non deve superare 101,5).
  let erroreSomma: string | null = null;
  if (grassi != null && carboidrati != null && letti.proteine != null) {
    const somma = Math.round((grassi + carboidrati + letti.proteine) * 100) / 100;
    if (somma > MASSIMO_SOMMA_MACRO) {
      erroreSomma = `Grassi, carboidrati e proteine insieme fanno ${formatta(somma)} g: più di 100 g per 100 g`;
    }
  }

  if (Object.keys(errori).length > 0 || mancanti.length > 0 || erroreSomma !== null) {
    return { valori: null, errori, mancanti, erroreSomma };
  }
  return {
    valori: {
      kcal_100g: letti.kcal!,
      grassi_100g: letti.grassi!,
      carboidrati_100g: letti.carboidrati!,
      proteine_100g: letti.proteine!,
      porzione_default_g: letti.porzione!,
      zuccheri_100g: letti.zuccheri ?? null,
      fibre_100g: letti.fibre ?? null,
      saturi_100g: letti.saturi ?? null,
      sale_100g: letti.sale ?? null,
    },
    errori,
    mancanti,
    erroreSomma,
  };
}
