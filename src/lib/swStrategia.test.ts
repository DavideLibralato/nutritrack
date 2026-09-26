// Test della logica pura del service worker (public/sw-strategia.js).
// Il file sta in /public ed è JavaScript semplice (il browser lo carica
// così com'è): qui lo si carica con require(), che legge il suo
// module.exports.

import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  scegliStrategia,
  chiavePagina,
  estraiRisorseStatiche,
  rispostaPaginaSalvabile,
} = require(path.resolve(import.meta.dirname, "../../public/sw-strategia.js"));

const ORIGINE = "https://nutritrack.vercel.app";

function richiesta(url: string, altro: Partial<{ method: string; mode: string; rsc: boolean }> = {}) {
  return { url, method: "GET", mode: "cors", rsc: false, ...altro };
}

describe("scegliStrategia", () => {
  it("file con nome versionato: statico (prima la cache)", () => {
    expect(scegliStrategia(richiesta(`${ORIGINE}/_next/static/chunks/310vm2bl3xxpt.js`), ORIGINE)).toBe("statico");
    expect(scegliStrategia(richiesta(`${ORIGINE}/_next/static/media/033400d4-s.woff2`), ORIGINE)).toBe("statico");
    expect(scegliStrategia(richiesta(`${ORIGINE}/icons/icon-192.png`), ORIGINE)).toBe("statico");
    expect(scegliStrategia(richiesta(`${ORIGINE}/apple-touch-icon.png`), ORIGINE)).toBe("statico");
  });

  it("richieste RSC (cambio scheda): sempre rete, mai cache — era il bug della v1", () => {
    // Con l'header RSC: 1
    expect(scegliStrategia(richiesta(`${ORIGINE}/profilo`, { rsc: true }), ORIGINE)).toBe("rete");
    // Con il solo parametro _rsc
    expect(scegliStrategia(richiesta(`${ORIGINE}/profilo?_rsc=1a2b3`), ORIGINE)).toBe("rete");
    // Anche se per assurdo fosse una navigazione
    expect(scegliStrategia(richiesta(`${ORIGINE}/?_rsc=x`, { mode: "navigate" }), ORIGINE)).toBe("rete");
  });

  it("navigazioni alle quattro schermate: pagina con copia, anche con query", () => {
    for (const p of ["/", "/aggiungi", "/statistiche", "/profilo", "/aggiungi?giorno=2026-09-20"]) {
      expect(scegliStrategia(richiesta(`${ORIGINE}${p}`, { mode: "navigate" }), ORIGINE)).toBe("pagina");
    }
  });

  it("navigazioni a login e simili: nessuna copia salvata", () => {
    for (const p of ["/login", "/register", "/password-dimenticata", "/reimposta-password", "/pagina-che-non-esiste"]) {
      expect(scegliStrategia(richiesta(`${ORIGINE}${p}`, { mode: "navigate" }), ORIGINE)).toBe("pagina-senza-copia");
    }
  });

  it("Supabase e altri domini: il service worker non interviene", () => {
    expect(scegliStrategia(richiesta("https://ftpsepmneemrwgdbhlgo.supabase.co/rest/v1/alimenti"), ORIGINE)).toBe("rete");
    expect(scegliStrategia(richiesta("https://ftpsepmneemrwgdbhlgo.supabase.co/auth/v1/user"), ORIGINE)).toBe("rete");
    // Anche un percorso che sul nostro dominio sarebbe statico
    expect(scegliStrategia(richiesta("https://cdn.example.com/_next/static/x.js"), ORIGINE)).toBe("rete");
  });

  it("POST (server action del login, ecc.): rete", () => {
    expect(scegliStrategia(richiesta(`${ORIGINE}/login`, { method: "POST", mode: "navigate" }), ORIGINE)).toBe("rete");
    expect(scegliStrategia(richiesta(`${ORIGINE}/_next/static/x.js`, { method: "POST" }), ORIGINE)).toBe("rete");
  });

  it("file non versionati dello stesso dominio: rete", () => {
    for (const p of ["/manifest.json", "/favicon.ico", "/sw.js", "/offline.html", "/_next/image?url=x"]) {
      expect(scegliStrategia(richiesta(`${ORIGINE}${p}`), ORIGINE)).toBe("rete");
    }
  });
});

describe("chiavePagina", () => {
  it("toglie la query: una sola copia per pagina", () => {
    expect(chiavePagina(`${ORIGINE}/aggiungi?giorno=2026-09-20`)).toBe(`${ORIGINE}/aggiungi`);
    expect(chiavePagina(`${ORIGINE}/`)).toBe(`${ORIGINE}/`);
  });
});

describe("estraiRisorseStatiche", () => {
  it("trova i file nell'HTML, anche dentro JSON con virgolette escapate, senza doppioni", () => {
    const html = `
      <link rel="stylesheet" href="/_next/static/chunks/3odhs2ym4vuoj.css" data-precedence="next"/>
      <script src="/_next/static/chunks/310vm2bl3xxpt.js" async=""></script>
      <script src="/_next/static/chunks/310vm2bl3xxpt.js" async=""></script>
      <script>self.__next_f.push([1,"2:I[\\"/_next/static/chunks/2mmpezlrfmbu5.js\\",[]]"])</script>
      <link rel="icon" href="/favicon.ico"/>`;
    expect(estraiRisorseStatiche(html, `${ORIGINE}/`).sort()).toEqual(
      [
        `${ORIGINE}/_next/static/chunks/2mmpezlrfmbu5.js`,
        `${ORIGINE}/_next/static/chunks/310vm2bl3xxpt.js`,
        `${ORIGINE}/_next/static/chunks/3odhs2ym4vuoj.css`,
      ].sort()
    );
  });

  it("risolve i font relativi del CSS rispetto all'indirizzo del CSS", () => {
    const css = `@font-face{src:url(../media/033400d4-s.197tv.woff2) format("woff2")}
                 @font-face{src:url("../media/26daee03-s.2e11.woff2")}
                 .x{background:url(data:image/png;base64,AAAA)}`;
    expect(estraiRisorseStatiche(css, `${ORIGINE}/_next/static/chunks/3odhs2ym4vuoj.css`).sort()).toEqual([
      `${ORIGINE}/_next/static/media/033400d4-s.197tv.woff2`,
      `${ORIGINE}/_next/static/media/26daee03-s.2e11.woff2`,
    ]);
  });
});

describe("rispostaPaginaSalvabile", () => {
  const buona = { ok: true, redirected: false, type: "basic", contentType: "text/html; charset=utf-8" };

  it("salva solo la pagina vera", () => {
    expect(rispostaPaginaSalvabile(buona)).toBe(true);
  });

  it("non salva i redirect del middleware verso /login", () => {
    // Seguito (fetch del riscaldamento)
    expect(rispostaPaginaSalvabile({ ...buona, redirected: true })).toBe(false);
    // Non seguito (navigazione: redirect "manual")
    expect(rispostaPaginaSalvabile({ ok: false, redirected: false, type: "opaqueredirect", contentType: null })).toBe(false);
  });

  it("non salva errori né risposte che non sono HTML", () => {
    expect(rispostaPaginaSalvabile({ ...buona, ok: false })).toBe(false);
    expect(rispostaPaginaSalvabile({ ...buona, contentType: "text/x-component" })).toBe(false);
  });
});
