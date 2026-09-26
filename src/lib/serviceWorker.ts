// Messaggi dall'app al service worker (public/sw.js). postMessage è il modo
// in cui una pagina "parla" con il suo service worker: gli manda un oggetto,
// lui lo riceve nell'evento "message".

// Chiede al service worker di scaricare e salvare le quattro pagine
// principali con i loro file, così offline si può cambiare scheda anche su
// una pagina mai aperta. Da chiamare solo con un utente entrato e la rete.
// `ready` aspetta che il service worker sia attivo (alla prima visita si
// sta ancora installando).
export async function chiediRiscaldamento(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registrazione = await navigator.serviceWorker.ready;
  registrazione.active?.postMessage({ tipo: "riscalda" });
}

// Dopo "Esci": cancella le pagine salvate, altrimenti offline l'app si
// aprirebbe come se si fosse ancora dentro. I file statici (JS, CSS, font)
// restano: non contengono niente dell'utente.
// La cache si cancella da qui (funziona anche se in questo momento nessun
// service worker controlla la pagina) e si avvisa il service worker, che
// così non rimette in cache una pagina che stava salvando.
export async function svuotaPagineSalvate(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const registrazione = await navigator.serviceWorker.getRegistration();
    registrazione?.active?.postMessage({ tipo: "esci" });
  }
  if ("caches" in window) {
    // Per prefisso, non per nome esatto: vale anche per le versioni future
    // (nutritrack-pagine-v3...), il nome esatto sta in sw.js.
    for (const nome of await caches.keys()) {
      if (nome.startsWith("nutritrack-pagine-")) await caches.delete(nome);
    }
  }
}
