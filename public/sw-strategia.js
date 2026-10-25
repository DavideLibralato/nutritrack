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
  // Le pagine dell'app che si salvano per l'uso offline: le schermate
  // principali e le sotto-pagine di Impostazioni. Ogni sotto-pagina nuova va
  // aggiunta qui nello stesso passo in cui nasce: offline il cambio di
  // pagina interno di Next non riesce e diventa una navigazione completa,
  // che trova la copia salvata solo se la pagina è in questo elenco.
  // Login, registrazione e password NON si salvano: offline non servono
  // (per entrare serve la rete) e mostrano "Sei offline".
  const PAGINE_APP = [
    "/",
    "/aggiungi",
    "/statistiche",
    "/impostazioni",
    "/impostazioni/profilo",
    "/impostazioni/obiettivi",
    "/impostazioni/pasti",
    "/impostazioni/peso",
    "/impostazioni/aspetto",
    "/impostazioni/preferiti",
    "/impostazioni/alimenti",
    "/impostazioni/amici",
    "/impostazioni/sincronizzazione",
    "/impostazioni/informazioni",
    "/impostazioni/elimina-account",
    "/impostazioni/password",
    // Fuori dalla tab bar, come /aggiungi: deve riaprirsi anche offline
    // per chi chiude l'app a metà onboarding.
    "/onboarding",
  ];

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

  // Le pagine salvate da cancellare: quelle il cui percorso non è più in
  // PAGINE_APP (per esempio /profilo, diventata /impostazioni). Una copia
  // rimasta in cache non verrebbe più mostrata, ma la pulizia dei file
  // statici (pulisciStatici in sw.js) terrebbe per sempre i file che cita,
  // e la cache crescerebbe a ogni deploy.
  // chiaviSalvate: gli URL delle pagine in cache (forma di chiavePagina).
  // Restituisce le chiavi da cancellare.
  function pagineDaTogliere(chiaviSalvate, pagineApp) {
    return chiaviSalvate.filter((chiave) => !pagineApp.includes(new URL(chiave).pathname));
  }

  // Quanto si aspetta la rete prima di mostrare la copia salvata di una
  // pagina (dal 25/10/2026, branch `proxy-rete-lenta`). Con una rete
  // normale l'HTML arriva in meno di un secondo, anche con l'avvio a
  // freddo del proxy: 3 s lasciano margine a una rete mediocre senza
  // mostrare la copia per niente. Più corto: si vedrebbe spesso una copia
  // vecchia dopo un deploy. Più lungo: si allunga l'attesa davanti allo
  // schermo bianco con una rete che c'è ma non passa niente.
  const TEMPO_MASSIMO_PAGINA_MS = 3000;

  // Una navigazione verso una pagina con copia (strategia "pagina"): la
  // gara fra la rete e il tempo massimo. Niente cache né fetch qui dentro:
  // li passa sw.js, così la gara si testa con l'orologio finto.
  //
  // o.rete          la richiesta di rete, già partita (Promise<Response>)
  // o.leggiCopia    () => Promise<Response | undefined>, la copia salvata
  // o.paginaOffline () => Promise<Response>, "Sei offline"
  // o.salvabile     (Response) => boolean, rispostaPaginaSalvabile
  // o.epocaAttuale  () => number, cresce a ogni "Esci" (sw.js)
  // o.salva         (copiaDellaRisposta, epocaInizio) => Promise
  // o.tempoMassimo  facoltativo, per i test; di solito la costante sopra
  //
  // Restituisce { risposta, salvataggio }:
  // - risposta: quella da dare al browser. La rete se arriva entro il
  //   tempo massimo; dopo, la copia se c'è, altrimenti si continua ad
  //   aspettare la rete. Se la rete fallisce: la copia, o "Sei offline";
  // - salvataggio: la risposta di rete si salva quando arriva, anche se
  //   intanto è stata mostrata la copia (la volta dopo la copia è quella
  //   nuova), ma solo se è una pagina vera e se nel frattempo non c'è
  //   stato un "Esci" (l'epoca è quella di quando la navigazione è
  //   partita). La pagina a schermo non cambia.
  function navigazioneConTempoMassimo(o) {
    const tempoMassimo = o.tempoMassimo === undefined ? TEMPO_MASSIMO_PAGINA_MS : o.tempoMassimo;
    const epocaInizio = o.epocaAttuale();

    // Registrato per primo: la copia per il salvataggio si fa prima che il
    // browser cominci a leggere la risposta (il corpo si legge una volta).
    const salvataggio = o.rete
      .then((r) => {
        if (!o.salvabile(r) || o.epocaAttuale() !== epocaInizio) return;
        return o.salva(r.clone(), epocaInizio);
      })
      .catch(() => {});

    const risposta = new Promise((risolvi) => {
      let decisa = false;
      async function copiaSalvata() {
        try {
          return await o.leggiCopia();
        } catch {
          return undefined;
        }
      }

      const timer = setTimeout(async () => {
        if (decisa) return;
        const copia = await copiaSalvata();
        if (decisa || !copia) return; // senza copia si aspetta la rete
        decisa = true;
        risolvi(copia);
      }, tempoMassimo);

      o.rete.then(
        (r) => {
          if (decisa) return;
          decisa = true;
          clearTimeout(timer);
          risolvi(r);
        },
        async () => {
          if (decisa) return;
          decisa = true;
          clearTimeout(timer);
          risolvi((await copiaSalvata()) || o.paginaOffline());
        }
      );
    });

    return { risposta, salvataggio };
  }

  const api = {
    TEMPO_MASSIMO_PAGINA_MS,
    navigazioneConTempoMassimo,
    PAGINE_APP,
    pagineDaTogliere,
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
