// Animazione di apertura: decide SE mostrarla (PUNTO_DI_PARTENZA.md,
// sezione 7, "Animazione di apertura"). Come si vede sta nel componente
// AnimazioneApertura e in globals.css; qui c'è solo la decisione.
//
// Si mostra solo alla prima apertura della scheda o dell'app (nessun segno
// in sessionStorage) su Oggi o su Accedi (PERCORSI_APERTURA): non a una
// ricarica (dal 24/10, commit 6) e mai tornando su Oggi da un'altra
// scheda. Accedi perché chi apre l'app senza aver fatto l'accesso parte da
// / ma il middleware lo manda su /login, e Accedi → Oggi poi è una
// navigazione interna: senza /login al primo utilizzo l'animazione non si
// vedrebbe mai. Il segno è lo stesso: vista su Accedi, dopo l'accesso non
// ricompare su Oggi. Due livelli:
//
// 1. SCRIPT_APERTURA, in <head> (layout.tsx, accanto a quello del tema):
//    gira prima che la pagina venga disegnata, quindi decide prima che la
//    bilancia possa comparire. Se la mostra scrive data-apertura="mostra"
//    su <html>; il CSS nasconde lo strato in ogni altro caso, quindi se lo
//    script non parte o sessionStorage non funziona l'animazione
//    semplicemente non c'è. Il segno resta per tutta la vita della scheda:
//    lo trovano le ricariche e le navigazioni complete che non sono
//    aperture (offline il cambio scheda di Next fallisce e diventa una
//    navigazione completa, location.assign/replace).
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

// Le pagine dove l'animazione può comparire. Registrati, Password
// dimenticata e Reimposta password restano fuori.
export const PERCORSI_APERTURA = ["/", "/login"] as const;

// La parte di sessionStorage che serve: così i test passano un finto.
type MemoriaSessione = Pick<Storage, "getItem" | "setItem">;

// REGOLA: autonoma (vedi sopra). Chiave e percorsi arrivano come
// parametri.
//
// percorso: location.pathname. memoria: sessionStorage, o null se il
// solo accesso ha lanciato un errore.
//
// Restituisce "mostra", "salta", oppure null fuori dai percorsi (non
// tocca niente: aprire Registrati non deve consumare l'animazione).
export function decidiApertura(
  percorso: string,
  memoria: MemoriaSessione | null,
  chiave: string,
  percorsi: readonly string[]
): "mostra" | "salta" | null {
  if (percorsi.indexOf(percorso) === -1) return null;
  try {
    // memoria null: l'errore finisce nel catch, come uno storage rotto.
    const giaMostrata = memoria!.getItem(chiave) !== null;
    // Il segno si scrive prima di decidere: se la scrittura fallisce,
    // niente animazione (senza segno ogni ricarica sembrerebbe
    // un'apertura).
    memoria!.setItem(chiave, "1");
    return giaMostrata ? "salta" : "mostra";
  } catch {
    return "salta";
  }
}

// REGOLA: autonoma come decidiApertura. decidiApertura arriva come
// parametro (`decidi`).
//
// Il lavoro sulla pagina: raccoglie percorso e sessionStorage (l'accesso
// in try/catch: Safari privato o dati del sito bloccati lanciano al solo
// accesso), decide e, se è "mostra", scrive l'attributo su <html>.
export function avviaApertura(
  decidi: typeof decidiApertura,
  opzioni: { chiave: string; attributo: string; percorsi: readonly string[] }
): void {
  let memoria: Storage | null = null;
  try {
    memoria = window.sessionStorage;
  } catch {
    memoria = null;
  }
  if (decidi(location.pathname, memoria, opzioni.chiave, opzioni.percorsi) === "mostra") {
    document.documentElement.setAttribute(opzioni.attributo, "mostra");
  }
}

// Il testo dello script in <head>: le due funzioni qui sopra, chiamate
// subito con i loro valori.
export const SCRIPT_APERTURA = `(${avviaApertura.toString()})(${decidiApertura.toString()}, ${JSON.stringify(
  { chiave: CHIAVE_APERTURA, attributo: ATTRIBUTO_APERTURA, percorsi: PERCORSI_APERTURA }
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

// --- Quando se ne va lo strato --------------------------------------
//
// Regola A (dal 24/10): alle aperture la pesata si vede SEMPRE intera
// (fino al piano, 1200 ms: apertura-minimo in globals.css, anche con riduci
// movimento), poi lo strato sfuma. Se Oggi è pronta dopo, sfuma quando è
// pronta: al più tardi fra le due. Dopo 3 s sfuma comunque (solo CSS).
//
// mostrata: lo script in <head> ha scritto data-apertura="mostra".
// minimoFinito: l'animazione apertura-minimo è finita.
// oggiPronta: OggiContenuto ha i dati.
//
// "togli": via subito, senza dissolvenza: lo strato è nascosto dal CSS e
// non c'è niente da sfumare (né un'animazione da aspettare: un elemento
// nascosto non ne fa partire nessuna).
// "sfuma": dissolvenza di 250 ms, poi via.
// "aspetta": manca ancora una delle due condizioni.
export function uscitaApertura(
  mostrata: boolean,
  minimoFinito: boolean,
  oggiPronta: boolean
): "togli" | "sfuma" | "aspetta" {
  if (!mostrata) return "togli";
  if (minimoFinito && oggiPronta) return "sfuma";
  return "aspetta";
}
