// Logica pura del service worker: nessuna cache, nessuna rete, solo
// decisioni su URL e testo. Sta in un file a parte perché così si testa con
// Vitest (src/lib/swStrategia.test.ts) senza un service worker vero.
//
// Caricato in due modi:
//   - da sw.js con importScripts("/sw-strategia.js"): le funzioni finiscono
//     in self.StrategiaSW;
//   - dai test con require(): le funzioni finiscono in module.exports.
// È JavaScript semplice (non TypeScript) perché i file in /public vengono
// serviti così come sono, senza passare dalla build di Next.

(function (globale) {
  // Le pagine dell'app che si salvano per l'uso offline: le quattro
  // schermate principali. Login, registrazione e password NON si salvano:
  // offline non servono (per entrare serve la rete) e mostrano "Sei offline".
  const PAGINE_APP = ["/", "/aggiungi", "/statistiche", "/profilo"];

  // Decide come trattare una richiesta. Restituisce:
  //   "statico" — file con nome versionato (cambia nome a ogni modifica):
  //               prima la cache, per sempre
  //   "pagina"  — una delle PAGINE_APP: prima la rete, copia salvata se
  //               offline
  //   "pagina-senza-copia" — altra navigazione (login...): solo rete, se
  //               offline la pagina "Sei offline"
  //   "rete"    — tutto il resto: il service worker non interviene
  //               (Supabase e altri domini, richieste RSC di Next, POST,
  //               manifest.json, favicon...)
  //
  // richiesta: { url, method, mode, rsc } — rsc = header "RSC: 1".
  // origine: l'origine del service worker (es. "https://app.vercel.app").
  function scegliStrategia(richiesta, origine) {
    const url = new URL(richiesta.url);
    if (richiesta.method !== "GET" || url.origin !== origine) return "rete";

    // Richieste RSC: i dati con cui Next cambia pagina dalla tab bar.
    // Solo rete: se falliscono (offline) Next ripiega da solo su una
    // navigazione completa, che qui sotto trova la copia della pagina.
    // Metterle in cache era il bug della v1: dopo un deploy un'app rimasta
    // aperta riceveva sempre le pagine vecchie.
    if (richiesta.rsc || url.searchParams.has("_rsc")) return "rete";

    if (richiesta.mode === "navigate") {
      return PAGINE_APP.includes(url.pathname) ? "pagina" : "pagina-senza-copia";
    }

    if (
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/apple-touch-icon.png"
    ) {
      return "statico";
    }

    return "rete";
  }

  // La chiave con cui una pagina si salva: solo il percorso, senza query.
  // "/aggiungi?giorno=2026-09-20" e "/aggiungi" sono lo stesso file HTML
  // (il parametro lo legge il codice nel browser), quindi una copia sola.
  function chiavePagina(url) {
    const u = new URL(url);
    return u.origin + u.pathname;
  }

  // Elenca i file /_next/static/ citati in un testo (HTML di una pagina o
  // CSS). urlBase: l'indirizzo del testo, serve per i percorsi relativi del
  // CSS — i font sono scritti come url(../media/xxx.woff2).
  // Restituisce URL assoluti, senza doppioni.
  function estraiRisorseStatiche(testo, urlBase) {
    const trovate = new Set();
    // Percorsi assoluti. Nell'HTML compaiono anche dentro JSON con le
    // virgolette escapate (\"), quindi ci si ferma anche a "\".
    for (const m of testo.matchAll(/\/_next\/static\/[^"'\s\\)<>]+/g)) {
      trovate.add(new URL(m[0], urlBase).href);
    }
    // url(...) relativi nel CSS.
    for (const m of testo.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) {
      const assoluto = new URL(m[1], urlBase);
      if (assoluto.pathname.startsWith("/_next/static/")) trovate.add(assoluto.href);
    }
    return [...trovate];
  }

  // Una risposta di pagina si può salvare solo se è la pagina vera: niente
  // errori, niente redirect (il middleware rimanda a /login chi non è
  // entrato — salvarla vorrebbe dire mostrare il login al posto di Oggi).
  // `tipo` = response.type: "opaqueredirect" è un redirect non seguito.
  function rispostaPaginaSalvabile(risposta) {
    return (
      risposta.ok &&
      !risposta.redirected &&
      risposta.type === "basic" &&
      (risposta.contentType || "").includes("text/html")
    );
  }

  const api = {
    PAGINE_APP,
    scegliStrategia,
    chiavePagina,
    estraiRisorseStatiche,
    rispostaPaginaSalvabile,
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    globale.StrategiaSW = api;
  }
})(typeof self !== "undefined" ? self : globalThis);
