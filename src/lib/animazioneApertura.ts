// Animazione di apertura: decide SE mostrarla (PUNTO_DI_PARTENZA.md,
// sezione 7, "Animazione di apertura"). Come si vede sta nel componente
// AnimazioneApertura e in globals.css; qui c'è solo la decisione.
//
// Si mostra solo al primo caricamento della pagina Oggi (apertura a
// freddo o ricarica), mai tornando su Oggi da un'altra scheda. Due livelli:
//
// 1. SCRIPT_APERTURA, in <head> (layout.tsx, accanto a quello del tema):
//    gira prima che la pagina venga disegnata, quindi decide prima che la
//    bilancia possa comparire. Se la mostra scrive data-apertura="mostra"
//    su <html>; il CSS nasconde lo strato in ogni altro caso, quindi se lo
//    script non parte o sessionStorage non funziona l'animazione
//    semplicemente non c'è. Serve per le ricariche complete che NON sono
//    aperture: offline il cambio scheda di Next fallisce e diventa una
//    navigazione completa (location.assign/replace, tipo "navigate"), che
//    trova il segno in sessionStorage e salta l'animazione.
//
// 2. aperturaGiaPassata / segnaAperturaPassata, una variabile del modulo:
//    cambiando scheda online Next non ricarica il JavaScript, la variabile
//    resta vera e il componente non disegna lo strato. Lo script in <head>
//    in quel caso non rigira, e data-apertura resta quello di prima.
//
// Una sola copia della logica: SCRIPT_APERTURA è il testo di decidiApertura
// e avviaApertura (toString()), come SCRIPT_TEMA in tema.ts. Per questo
// devono bastare a sé stesse: niente import, niente costanti o funzioni
// del modulo. Lo controlla animazioneApertura.test.ts, che esegue la
// stringa vera in una pagina finta.

export const CHIAVE_APERTURA = "nutritrack:apertura-mostrata";
export const ATTRIBUTO_APERTURA = "data-apertura";

// La parte di sessionStorage che serve: così i test passano un finto.
type MemoriaSessione = Pick<Storage, "getItem" | "setItem">;

// REGOLA: autonoma (vedi sopra). La chiave arriva come parametro.
//
// percorso: location.pathname. tipoNavigazione: il `type` della voce
// "navigation" di performance ("navigate", "reload", "back_forward"), o
// null se il browser non lo dice. memoria: sessionStorage, o null se il
// solo accesso ha lanciato un errore.
//
// Restituisce "mostra", "salta", oppure null fuori da Oggi (non tocca
// niente: aprire il login non deve consumare l'animazione di Oggi).
export function decidiApertura(
  percorso: string,
  tipoNavigazione: string | null,
  memoria: MemoriaSessione | null,
  chiave: string
): "mostra" | "salta" | null {
  if (percorso !== "/") return null;
  try {
    // memoria null: l'errore finisce nel catch, come uno storage rotto.
    const giaMostrata = memoria!.getItem(chiave) !== null;
    // Il segno si scrive prima di decidere: se la scrittura fallisce,
    // niente animazione (senza segno non si saprebbe distinguere il
    // prossimo cambio scheda offline da un'apertura).
    memoria!.setItem(chiave, "1");
    // Una ricarica la mostra sempre, anche col segno già scritto da
    // un'apertura precedente nella stessa scheda.
    if (tipoNavigazione === "reload") return "mostra";
    return giaMostrata ? "salta" : "mostra";
  } catch {
    return "salta";
  }
}

// REGOLA: autonoma come decidiApertura. decidiApertura arriva come
// parametro (`decidi`).
//
// Il lavoro sulla pagina: raccoglie percorso, tipo di navigazione e
// sessionStorage (ogni accesso in try/catch: Safari privato o dati del
// sito bloccati lanciano al solo accesso), decide e, se è "mostra", scrive
// l'attributo su <html>.
export function avviaApertura(
  decidi: typeof decidiApertura,
  opzioni: { chiave: string; attributo: string }
): void {
  let memoria: Storage | null = null;
  try {
    memoria = window.sessionStorage;
  } catch {
    memoria = null;
  }
  let tipo: string | null = null;
  try {
    const voce = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    tipo = voce ? voce.type : null;
  } catch {
    tipo = null;
  }
  if (decidi(location.pathname, tipo, memoria, opzioni.chiave) === "mostra") {
    document.documentElement.setAttribute(opzioni.attributo, "mostra");
  }
}

// Il testo dello script in <head>: le due funzioni qui sopra, chiamate
// subito con i loro valori.
export const SCRIPT_APERTURA = `(${avviaApertura.toString()})(${decidiApertura.toString()}, ${JSON.stringify(
  { chiave: CHIAVE_APERTURA, attributo: ATTRIBUTO_APERTURA }
)});`;

// --- Secondo livello: cambio scheda senza ricaricare --------------------

// Vera dopo il primo montaggio dello strato. Si azzera solo quando il
// JavaScript si ricarica da capo (apertura, ricarica, navigazione completa).
let giaPassata = false;

// Letta dallo strato al primo disegno. Non scrive: nel modo sviluppo React
// esegue due volte i primi disegni, e una lettura che cambiasse il valore
// darebbe al secondo un risultato diverso dal primo (e dall'HTML del
// server).
export function aperturaGiaPassata(): boolean {
  return giaPassata;
}

// Chiamata dallo strato dopo il montaggio (useEffect).
export function segnaAperturaPassata(): void {
  giaPassata = true;
}

// --- Il segnale "Oggi è pronta" ----------------------------------------
//
// OggiContenuto lo manda quando ha tutti i dati; lo strato lo ascolta e
// se ne va. È un valore, non solo un evento: chi si mette in ascolto
// dopo che Oggi è già pronta viene chiamato subito, quindi non conta chi
// dei due arriva per primo.

let oggiPronta = false;
const inAttesa = new Set<() => void>();

export function segnalaOggiPronta(): void {
  if (oggiPronta) return;
  oggiPronta = true;
  for (const avvisa of inAttesa) avvisa();
  inAttesa.clear();
}

// Restituisce la funzione per smettere di ascoltare (pulizia di useEffect).
export function quandoOggiPronta(avvisa: () => void): () => void {
  if (oggiPronta) {
    avvisa();
    return () => {};
  }
  inAttesa.add(avvisa);
  return () => {
    inAttesa.delete(avvisa);
  };
}

// --- Come se ne va lo strato quando Oggi è pronta ----------------------

// Quanto dura la comparsa della bilancia (keyframes apertura-comparsa in
// globals.css): prima di questo istante la bilancia non si è ancora vista.
export const COMPARSA_MS = 120;

// mostrata: lo script in <head> ha scritto data-apertura="mostra".
// tempoComparsa: a che punto è la comparsa della bilancia, in ms
// (Animation.currentTime), o null se non lo si sa (riduci movimento, che
// non ha la comparsa, o un browser senza getAnimations).
//
// "togli": via subito, senza dissolvenza. Lo strato è nascosto, oppure la
// bilancia non si è ancora vista: Oggi compare come oggi, senza una
// dissolvenza su qualcosa che non c'era.
// "sfuma": dissolvenza di 150 ms.
export function uscitaApertura(
  mostrata: boolean,
  tempoComparsa: number | null
): "togli" | "sfuma" {
  if (!mostrata) return "togli";
  if (tempoComparsa !== null && tempoComparsa < COMPARSA_MS) return "togli";
  return "sfuma";
}
