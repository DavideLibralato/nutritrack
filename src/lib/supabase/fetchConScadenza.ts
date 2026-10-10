// La fetch che il client Supabase usa per ogni richiesta (client.ts), con
// una scadenza: dopo SCADENZA_FETCH_MS la richiesta viene ANNULLATA, non
// solo abbandonata. Dal 10/10/2026.
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

// `fetchBase` serve ai test. Senza, si chiama la fetch globale al momento
// della richiesta: un riferimento salvato prima e chiamato da solo
// ("fetchBase(...)" invece di "window.fetch(...)") in alcuni browser dà
// "Illegal invocation".
export function creaFetchConScadenza(
  ms: number = SCADENZA_FETCH_MS,
  fetchBase?: typeof fetch
): typeof fetch {
  return (input, init) => {
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
    return fetchBase ? fetchBase(input, opzioni) : fetch(input, opzioni);
  };
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
