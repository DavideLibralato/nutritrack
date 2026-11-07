// Il lettore dei codici a barre (PUNTO_DI_PARTENZA.md §3, "Codice a
// barre", "La libreria"): `barcode-detector`, che dà a tutti i browser
// (anche Safari su iPhone, che non ce l'ha) l'API standard BarcodeDetector,
// facendo il lavoro con ZXing compilato in WebAssembly.
//
// - Si carica con import() solo quando serve, cioè al tocco su Scansiona:
//   la libreria e il suo WebAssembly (circa 950 KB) non pesano sul
//   caricamento dell'app. Senza import() Next la metterebbe nel codice
//   della pagina Aggiungi, scaricata a ogni apertura.
// - Il WebAssembly è servito da Libra (`public/zxing/<versione>/`), non dal
//   CDN jsDelivr che la libreria usa di suo: nessun servizio esterno in più,
//   e niente rotture se un giorno il CDN cambiasse. La versione nel
//   percorso fa sì che un file vecchio non venga mai preso per quello nuovo
//   (next.config.ts lo mette in cache come immutabile).
// - Si usa il "ponyfill" (barcode-detector/ponyfill): la classe si importa,
//   non si installa su `window`. Anche dove il browser ha un BarcodeDetector
//   suo (Chrome su Android) si usa ZXing: stesso comportamento ovunque.
//
// Il file .wasm si copia a mano da node_modules quando si aggiorna la
// libreria (PUNTO §3). Se ci si dimentica, lettoreCodice.test.ts fallisce:
// confronta l'impronta del file in /public con quella dichiarata dalla
// libreria installata.

import { leggiCodice } from "./codiceEan";

// La versione di zxing-wasm che barcode-detector 3.2.3 usa. Scritta qui e
// non letta dalla libreria: leggerla vorrebbe dire importarla subito, cioè
// proprio quello che import() evita. Il test controlla che coincida.
export const VERSIONE_ZXING = "3.1.6";
export const PERCORSO_WASM = `/zxing/${VERSIONE_ZXING}/zxing_reader.wasm`;

// EAN-13 (prodotti europei), EAN-8 (confezioni piccole), UPC-A (prodotti
// americani, 12 cifre: diventano 13 con leggiCodice). Solo questi: meno
// formati = lettura più veloce, e nessun QR code scambiato per un prodotto.
export const FORMATI = ["ean_13", "ean_8", "upc_a"] as const;
type Formato = (typeof FORMATI)[number];

// Quello che serve di un risultato di BarcodeDetector.detect().
export interface RisultatoLettura {
  rawValue: string;
  format: string;
}

// Il primo codice valido fra quelli letti in un fotogramma, già nella forma
// che si salva (leggiCodice), oppure null. Una lettura con la cifra di
// controllo sbagliata (una barra letta male) si scarta: al fotogramma dopo
// si riprova. Funzione pura: i test sono in lettoreCodice.test.ts.
export function primoCodiceValido(risultati: readonly RisultatoLettura[]): string | null {
  for (const r of risultati) {
    if (!(FORMATI as readonly string[]).includes(r.format)) continue;
    const { codice } = leggiCodice(r.rawValue);
    if (codice) return codice;
  }
  return null;
}

// Un lettore pronto: legge un fotogramma del video, o una foto.
export interface Lettore {
  leggi(sorgente: ImageBitmapSource): Promise<string | null>;
}

let preparazione: Promise<Lettore> | null = null;

// Carica la libreria e il WebAssembly, una volta sola per tutta la vita
// della pagina; le volte dopo restituisce lo stesso lettore. Se il
// caricamento fallisce (rete caduta proprio adesso), la prossima chiamata
// riprova da capo invece di restituire per sempre lo stesso errore.
export function preparaLettore(): Promise<Lettore> {
  preparazione ??= carica().catch((errore: unknown) => {
    preparazione = null;
    throw errore;
  });
  return preparazione;
}

async function carica(): Promise<Lettore> {
  const { BarcodeDetector, prepareZXingModule } = await import("barcode-detector/ponyfill");
  // fireImmediately: scarica e avvia il WebAssembly adesso, e lo si
  // aspetta. Così un file che non arriva si scopre qui, non al primo
  // fotogramma, e il primo fotogramma non aspetta il download.
  await prepareZXingModule({
    overrides: {
      locateFile: (percorso: string, prefisso: string) =>
        percorso.endsWith(".wasm") ? PERCORSO_WASM : prefisso + percorso,
    },
    fireImmediately: true,
  });
  const rilevatore = new BarcodeDetector({ formats: [...FORMATI] as Formato[] });
  return {
    async leggi(sorgente) {
      return primoCodiceValido(await rilevatore.detect(sorgente));
    },
  };
}
