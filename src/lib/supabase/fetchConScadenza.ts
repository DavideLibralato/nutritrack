// La fetch che il client Supabase usa per ogni richiesta (client.ts), con
// una scadenza: dopo SCADENZA_FETCH_MS la richiesta viene ANNULLATA, non
// solo abbandonata. Dal 10/10/2026. Dal 01/11/2026 ripete anche, una
// volta, un 401 PGRST303 di PostgREST (sezione più sotto).
//
// Perché annullarla davvero: una richiesta abbandonata può arrivare al
// server dopo. Esempio: un invio "100 g" resta appeso e scade, l'utente
// corregge in 150 g, il giro dopo manda 150 g, poi arriva il vecchio
// invio e riscrive 100 g. Sul server le tabelle hanno solo il trigger
// set_updated_at, nessuna difesa contro una scrittura più vecchia: vince
// l'ultima che arriva. Server a 100 g, telefono a 150 g, coda vuota:
// nessuno se ne accorge. Annullando, il browser chiude la connessione.
// Rischio che resta (PUNTO_DI_PARTENZA.md, sezione 11): una richiesta già
// partita del tutto prima di bloccarsi può ancora arrivare tardi.
//
// Una richiesta annullata, per la libreria Supabase, è una fetch fallita:
// risponde { error } con status 0, che la sincronizzazione tratta come
// rete assente (nessun tentativo contato, sincronizza.ts).
//
// Perché un AbortController e non AbortSignal.timeout(): quello annulla
// con un errore di nome "TimeoutError", e la libreria ripete da sola le
// letture (GET, la discesa) fallite con un errore che non si chiama
// "AbortError" — fino a tre volte, ognuna con altri 30 secondi. Con
// "AbortError" la libreria capisce che è un annullamento e si ferma.

// Trenta secondi: un invio della sincronizzazione è una riga sola, una
// pagina della discesa al massimo 500 righe (DIMENSIONE_PAGINA). Su una
// rete lenta ma viva bastano con margine; un limite troppo stretto farebbe
// fallire a ripetizione la prima discesa di un dispositivo nuovo.
export const SCADENZA_FETCH_MS = 30_000;

export const MESSAGGIO_ANNULLATA = "Nessuna risposta dal server entro il tempo massimo.";

// --- Un 401 PGRST303 si ripete una volta (dal 01/11/2026) -----------------
//
// PostgREST rifiuta ogni tanto un token appena emesso con 401, codice
// PGRST303 "JWT issued at future". La causa è un bug di PostgREST prima
// della 14.18 (issue #5196, "Fix sporadic PGRST303 JWT issued at future
// errors"): dopo un periodo senza richieste, la sua "ora corrente" in
// memoria può restare indietro di oltre i 30 s di tolleranza che concede
// sulle date del token. Non è l'orologio del telefono: le date del token
// le mette il server di Supabase Auth.
//
// I due casi del 01/11 (log di Supabase): alle 10:33:51 UTC su iPhone,
// token di un accesso emesso meno di un secondo prima, GET composizioni
// rifiutata mentre le altre 10 tabelle dello stesso scarico passavano; lo
// stesso token, 0,8 s dopo, ha avuto 200. Alle 10:59:15 su Chrome, dopo
// una registrazione, GET pasti. Senza la ripetizione basta una tabella su
// 11 per far mostrare "Accesso scaduto" (statoSincronizzazione.ts).
//
// Regola: solo per PostgREST (/rest/v1/), solo con un 401 il cui corpo JSON
// ha code "PGRST303", una volta sola, dopo RITARDO_RIPETIZIONE_MS, con lo
// stesso token. Il codice e non il testo: dalla 14.18 il messaggio porta
// anche i secondi. PGRST303 vale per tutti i rifiuti delle date del token,
// anche "JWT expired": ripeterlo una volta non fa danni, e se il token è
// davvero scaduto il secondo 401 arriva a chi chiama come prima.
// Ripetere anche un invio (upsert) è sicuro: PostgREST controlla il token
// prima di toccare il database, quindi la prima richiesta non ha scritto
// niente.
//
// Il corpo si legge da un clone(): l'originale resta intatto per la
// libreria Supabase. Le richieste HEAD (i conteggi) non hanno corpo e non
// si ripetono: un loro errore è già trattato come conteggio non fatto.
// La scadenza è una sola per le due prove: nessuna richiesta dura più di
// SCADENZA_FETCH_MS in tutto.
export const RITARDO_RIPETIZIONE_MS = 1000;
export const CODICE_DATE_TOKEN = "PGRST303";

// `fetchBase` serve ai test. Senza, si chiama la fetch globale al momento
// della richiesta: un riferimento salvato prima e chiamato da solo
// ("fetchBase(...)" invece di "window.fetch(...)") in alcuni browser dà
// "Illegal invocation".
export function creaFetchConScadenza(
  ms: number = SCADENZA_FETCH_MS,
  fetchBase?: typeof fetch
): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    // Il timer non si ferma quando arrivano le intestazioni: anche la
    // lettura del corpo della risposta può bloccarsi. Annullare una
    // richiesta già finita non fa niente.
    setTimeout(
      () => controller.abort(new DOMException(MESSAGGIO_ANNULLATA, "AbortError")),
      ms
    );
    const segnale = init?.signal ? unisciSegnali(init.signal, controller.signal) : controller.signal;
    const opzioni = { ...init, signal: segnale };
    let tentativo = 0;
    const chiama = () => {
      tentativo += 1;
      const finta = rispostaProva303(input, init, tentativo);
      if (finta) return Promise.resolve(finta);
      return fetchBase ? fetchBase(input, opzioni) : fetch(input, opzioni);
    };

    const risposta = await chiama();
    if (!(await daRipetere(input, init, risposta))) return risposta;
    console.warn(
      `PostgREST ha rifiutato le date del token (${CODICE_DATE_TOKEN}): ripeto una volta.`,
      indirizzo(input)
    );
    await attesa(RITARDO_RIPETIZIONE_MS, segnale);
    return chiama();
  };
}

// --- TEMPORANEO, commit 4 di accesso-scaduto: si toglie con il commit 5 prima del merge ---
//
// Difetto simulato per provare sull'anteprima la ripetizione su PGRST303 e
// la pagina Sincronizzazione nuova. Con la prova attiva, le GET su
// /rest/v1/composizioni ricevono un 401 PGRST303 finto, senza contattare
// Supabase:
// - "una": solo la prima chiamata di ogni richiesta; la ripetizione dopo
//   1 s va al server vero → deve finire "Tutto salvato";
// - "sempre": anche la ripetizione → "Accesso scaduto", con la riga nei
//   Dettagli tecnici.
// Si accende dall'indirizzo, così va anche su iPhone: ?prova303=una o
// ?prova303=sempre la salva in localStorage, ?prova303=no la toglie. Mai in
// produzione: su app-libra.vercel.app è spenta comunque.
const CHIAVE_PROVA_303 = "libra-prova-303";
const HOST_PRODUZIONE = "app-libra.vercel.app";
export type ModalitaProva303 = "una" | "sempre";

export function modalitaProva303(): ModalitaProva303 | null {
  if (typeof window === "undefined") return null;
  if (window.location.hostname === HOST_PRODUZIONE) return null;
  try {
    const dallIndirizzo = new URLSearchParams(window.location.search).get("prova303");
    if (dallIndirizzo === "una" || dallIndirizzo === "sempre") {
      window.localStorage.setItem(CHIAVE_PROVA_303, dallIndirizzo);
    } else if (dallIndirizzo === "no") {
      window.localStorage.removeItem(CHIAVE_PROVA_303);
    }
    const salvata = window.localStorage.getItem(CHIAVE_PROVA_303);
    return salvata === "una" || salvata === "sempre" ? salvata : null;
  } catch {
    return null;
  }
}

function rispostaProva303(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  tentativo: number
): Response | null {
  const modalita = modalitaProva303();
  if (!modalita) return null;
  if ((init?.method ?? "GET").toUpperCase() !== "GET") return null;
  const url = indirizzo(input);
  if (url === null) return null;
  try {
    if (!new URL(url).pathname.startsWith("/rest/v1/composizioni")) return null;
  } catch {
    return null;
  }
  if (modalita === "una" && tentativo > 1) return null;
  console.warn(`Prova 303 (${modalita}): risposta finta 401 PGRST303, tentativo ${tentativo}.`, url);
  return new Response(
    JSON.stringify({ code: "PGRST303", details: null, hint: null, message: "JWT issued at future" }),
    { status: 401, headers: { "content-type": "application/json; charset=utf-8" } }
  );
}

// --- Fine del blocco TEMPORANEO ---

function indirizzo(input: RequestInfo | URL): string | null {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return null; // una Request: il suo corpo potrebbe essere già consumato
}

async function daRipetere(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  risposta: Response
): Promise<boolean> {
  if (risposta.status !== 401) return false;
  const url = indirizzo(input);
  if (url === null) return false;
  try {
    if (!new URL(url).pathname.startsWith("/rest/v1/")) return false;
  } catch {
    return false;
  }
  // Il corpo dell'invio deve poter ripartire uguale: la libreria Supabase
  // manda sempre un testo (JSON) o niente.
  if (init?.body != null && typeof init.body !== "string") return false;
  try {
    const corpo: unknown = await risposta.clone().json();
    return (
      typeof corpo === "object" &&
      corpo !== null &&
      (corpo as { code?: unknown }).code === CODICE_DATE_TOKEN
    );
  } catch {
    return false; // corpo vuoto (HEAD) o non JSON
  }
}

// Aspetta `ms`, ma si ferma con lo stesso motivo se il segnale si annulla
// nel frattempo (la scadenza, o chi chiama).
function attesa(ms: number, segnale: AbortSignal): Promise<void> {
  return new Promise((risolvi, rifiuta) => {
    if (segnale.aborted) {
      rifiuta(segnale.reason);
      return;
    }
    const timer = setTimeout(() => {
      segnale.removeEventListener("abort", alAnnullamento);
      risolvi();
    }, ms);
    function alAnnullamento() {
      clearTimeout(timer);
      rifiuta(segnale.reason);
    }
    segnale.addEventListener("abort", alAnnullamento, { once: true });
  });
}

// Un segnale che si annulla quando si annulla uno dei due: la scadenza o
// quello già passato da chi chiama (per esempio .abortSignal() della
// libreria). AbortSignal.any c'è solo da iOS 17.4: prima, a mano.
function unisciSegnali(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === "function") return AbortSignal.any([a, b]);
  const unito = new AbortController();
  for (const segnale of [a, b]) {
    if (segnale.aborted) {
      unito.abort(segnale.reason);
      break;
    }
    segnale.addEventListener("abort", () => unito.abort(segnale.reason), { once: true });
  }
  return unito.signal;
}
