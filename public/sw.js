// Service worker di NutriTrack (PUNTO_DI_PARTENZA.md §9.2 e §10.7).
//
// Un service worker è uno script che il browser tiene in esecuzione accanto
// all'app e che si mette in mezzo a ogni richiesta di rete della pagina:
// può rispondere dalla rete, da una cache sua, o da tutte e due.
//
// Obiettivi:
//   - online: sempre la versione più recente, mai una pagina vecchia dopo
//     un deploy
//   - offline, app già aperta almeno una volta online: le quattro schermate
//     si aprono e si cambia scheda; registrare un pasto lo fanno già Dexie
//     e l'outbox, che non passano di qui
//   - offline senza copia: la pagina "Sei offline" (/offline.html)
//
// Chi fa cosa lo decide scegliStrategia() in sw-strategia.js (con test).
// Supabase resta fuori: è un altro dominio, qui non si tocca.

importScripts("/sw-strategia.js");

const { PAGINE_APP, scegliStrategia, chiavePagina, estraiRisorseStatiche, rispostaPaginaSalvabile } =
  self.StrategiaSW;

// Nomi nuovi rispetto a "nutritrack-v1": activate cancella ogni cache con un
// nome diverso da questi, compresa la v1 "avvelenata" dalle richieste RSC.
// Si cambia il numero SOLO se cambia la forma di ciò che è salvato (o
// offline.html): i file statici hanno già il nome versionato, e le pagine
// si riscrivono da sole a ogni visita online.
const CACHE_STATICI = "nutritrack-statici-v2";
const CACHE_PAGINE = "nutritrack-pagine-v2";
const PAGINA_OFFLINE = "/offline.html";

// File salvati subito all'installazione: la pagina offline e le icone.
const PRECACHE = [PAGINA_OFFLINE, "/icons/icon-192.png", "/icons/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATICI)
      // cache: "reload" = scaricali dal server, non dalla cache HTTP del
      // browser, così offline.html è quella di questo deploy.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
  );
  // Il service worker nuovo prende il posto del vecchio subito, senza
  // aspettare che tutte le schede dell'app vengano chiuse.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomi) =>
        Promise.all(
          nomi
            .filter((nome) => nome !== CACHE_STATICI && nome !== CACHE_PAGINE)
            .map((nome) => caches.delete(nome))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const strategia = scegliStrategia(
    {
      url: request.url,
      method: request.method,
      mode: request.mode,
      rsc: request.headers.get("RSC") === "1",
    },
    self.location.origin
  );

  if (strategia === "statico") {
    event.respondWith(ottieniStatico(request.url));
  } else if (strategia === "pagina" || strategia === "pagina-senza-copia") {
    event.respondWith(gestisciNavigazione(event, strategia === "pagina"));
  }
  // "rete": nessun respondWith, il browser fa la richiesta come se il
  // service worker non ci fosse.
});

// --- File statici: prima la cache ---------------------------------------

// Lo stesso file chiesto due volte insieme (dal browser e dal salvataggio
// di una pagina) si scarica una volta sola.
const staticiInArrivo = new Map();

// Restituisce il file dalla cache; se manca lo scarica e lo salva.
// Rifiuta (errore) se la rete non c'è o risponde con un errore: chi salva
// una pagina deve saperlo, per non salvarla a metà.
async function ottieniStatico(url) {
  const cache = await caches.open(CACHE_STATICI);
  const inCache = await cache.match(url);
  if (inCache) return inCache;

  if (!staticiInArrivo.has(url)) {
    const scaricamento = fetch(url)
      .then(async (risposta) => {
        if (!risposta.ok) throw new Error(`${url}: ${risposta.status}`);
        await cache.put(url, risposta.clone());
        return risposta;
      })
      .finally(() => staticiInArrivo.delete(url));
    staticiInArrivo.set(url, scaricamento);
  }
  // Ogni chiamante riceve la sua copia: il corpo di una risposta si può
  // leggere una volta sola.
  return (await staticiInArrivo.get(url)).clone();
}

// --- Pagine: prima la rete ---------------------------------------------

async function gestisciNavigazione(event, conCopia) {
  const chiave = chiavePagina(event.request.url);
  try {
    const risposta = await fetch(event.request);
    if (conCopia && salvabile(risposta)) {
      // La pagina va al browser subito; il salvataggio continua dietro
      // (waitUntil tiene vivo il service worker finché non finisce).
      const copia = risposta.clone();
      event.waitUntil(
        copia.text().then((html) => salvaPagina(chiave, html)).catch(() => {})
      );
    }
    return risposta;
  } catch {
    // Offline (o server irraggiungibile).
    if (conCopia) {
      const salvata = await caches.open(CACHE_PAGINE).then((c) => c.match(chiave));
      if (salvata) return salvata;
    }
    return paginaOffline();
  }
}

function salvabile(risposta) {
  return rispostaPaginaSalvabile({
    ok: risposta.ok,
    redirected: risposta.redirected,
    type: risposta.type,
    contentType: risposta.headers.get("Content-Type"),
  });
}

async function paginaOffline() {
  const cache = await caches.open(CACHE_STATICI);
  return (
    (await cache.match(PAGINA_OFFLINE)) ||
    new Response("Sei offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  );
}

// --- Salvataggio di una pagina e dei suoi file ---------------------------

// Cresce a ogni "Esci": un salvataggio partito prima dell'uscita non deve
// rimettere in cache una pagina dopo che l'uscita l'ha svuotata.
let epoca = 0;

// Salvataggi e pulizia uno alla volta: la pulizia non deve togliere un file
// che un salvataggio in corso ha appena messo in cache.
let coda = Promise.resolve();
function inCoda(lavoro) {
  const risultato = coda.then(lavoro);
  coda = risultato.catch(() => {});
  return risultato;
}

// Salva la pagina SOLO dopo che tutti i file che cita (JS, CSS e i font
// citati dal CSS) sono in cache: se uno manca, la pagina non si salva, così
// non resta mai una copia offline che cerca file assenti.
function salvaPagina(chiave, html) {
  const epocaInizio = epoca;
  return inCoda(async () => {
    const risorse = estraiRisorseStatiche(html, chiave);
    const risposte = await Promise.all(risorse.map((url) => ottieniStatico(url)));

    // I font stanno nel CSS, non nell'HTML.
    const fontDelCss = [];
    for (let i = 0; i < risorse.length; i++) {
      if (new URL(risorse[i]).pathname.endsWith(".css")) {
        fontDelCss.push(...estraiRisorseStatiche(await risposte[i].text(), risorse[i]));
      }
    }
    await Promise.all(fontDelCss.map((url) => ottieniStatico(url)));

    if (epoca !== epocaInizio) return;
    const cache = await caches.open(CACHE_PAGINE);
    await cache.put(
      chiave,
      new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    );
  });
}

// --- Riscaldamento ------------------------------------------------------

// Chiesto dall'app (RegistraServiceWorker) quando c'è un utente entrato e
// la rete: scarica le quattro pagine anche se non sono mai state visitate,
// così offline si può cambiare scheda subito. Una pagina che risponde con
// un redirect (sessione non valida) si salta.
async function riscalda() {
  for (const percorso of PAGINE_APP) {
    try {
      const url = new URL(percorso, self.location.origin).href;
      const risposta = await fetch(url, { cache: "no-cache" });
      if (!salvabile(risposta)) continue;
      await salvaPagina(chiavePagina(url), await risposta.text());
    } catch {
      // Rete caduta a metà: le pagine già salvate restano, le altre al
      // prossimo giro.
    }
  }
  await inCoda(pulisciStatici);
}

// Toglie i file /_next/static/ che nessuna pagina salvata cita più (quelli
// dei deploy precedenti), così la cache non cresce a ogni rilascio.
async function pulisciStatici() {
  const cachePagine = await caches.open(CACHE_PAGINE);
  const cacheStatici = await caches.open(CACHE_STATICI);

  const usati = new Set();
  for (const richiesta of await cachePagine.keys()) {
    const risposta = await cachePagine.match(richiesta);
    for (const url of estraiRisorseStatiche(await risposta.text(), richiesta.url)) {
      usati.add(url);
      if (new URL(url).pathname.endsWith(".css")) {
        const css = await cacheStatici.match(url);
        if (css) estraiRisorseStatiche(await css.text(), url).forEach((f) => usati.add(f));
      }
    }
  }
  // Senza pagine salvate non si sa cosa serve: meglio non togliere niente.
  if (usati.size === 0) return;

  for (const richiesta of await cacheStatici.keys()) {
    const percorso = new URL(richiesta.url).pathname;
    if (percorso.startsWith("/_next/static/") && !usati.has(richiesta.url)) {
      await cacheStatici.delete(richiesta);
    }
  }
}

// --- Messaggi dall'app ---------------------------------------------------

self.addEventListener("message", (event) => {
  const tipo = event.data && event.data.tipo;
  if (tipo === "riscalda") {
    event.waitUntil(riscalda());
  } else if (tipo === "esci") {
    // L'app svuota già la cache delle pagine da sola (lib/serviceWorker.ts);
    // qui si ferma un eventuale salvataggio in corso.
    epoca++;
    event.waitUntil(caches.delete(CACHE_PAGINE));
  }
});
