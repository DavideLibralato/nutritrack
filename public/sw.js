// Service worker minimale per NutriTrack.
// Obiettivo: rendere l'app installabile (PWA) e resiliente quando la
// connessione va e viene (es. mentre sei fuori a mangiare).
// Non cachiamo dati di Supabase: quelli restano sempre freschi dalla rete.

const NOME_CACHE = "nutritrack-v1";

// Risorse statiche che possiamo mettere in cache subito all'installazione.
const RISORSE_PRECACHE = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(NOME_CACHE).then((cache) => cache.addAll(RISORSE_PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomi) =>
        Promise.all(
          nomi
            .filter((nome) => nome !== NOME_CACHE)
            .map((nome) => caches.delete(nome))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Interveniamo solo su richieste GET dello stesso dominio.
  // Le chiamate a Supabase (auth, dati) restano sempre e solo di rete.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Navigazione tra pagine: prova la rete, se non risponde usa la cache
  // (evita l'errore "Nessuna connessione" di Chrome/Safari).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((risposta) => risposta || caches.match("/manifest.json"))
      )
    );
    return;
  }

  // Asset statici (icone, css, js, font): cache-first per velocita e uso offline.
  event.respondWith(
    caches.match(request).then((risposta) => {
      if (risposta) return risposta;
      return fetch(request).then((rispostaRete) => {
        if (rispostaRete.ok) {
          const copia = rispostaRete.clone();
          caches.open(NOME_CACHE).then((cache) => cache.put(request, copia));
        }
        return rispostaRete;
      });
    })
  );
});
