import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COLORI_BARRA } from "@/lib/tema";

// Tema scuro (PUNTO_DI_PARTENZA.md sezione 7). In globals.css ogni colore è
// scritto una volta sola con i suoi due valori:
//     --background: var(--se-chiaro, #faf7f2) var(--se-scuro, #1b1815);
// e gli "interruttori" --se-chiaro / --se-scuro decidono quale vale.
//
// Un colore scritto per esteso senza i due interruttori non dà errori: al
// buio resterebbe col valore chiaro (uno sheet bianco, un testo scuro su
// fondo scuro) e lo si scoprirebbe solo guardando quella schermata in scuro.
// Qui si controlla che non succeda, che gli interruttori coprano i tre casi
// (scelta chiaro, scelta scuro, nessuna scelta con il telefono al buio) e
// che il colore della barra (theme-color) sia lo sfondo.
//
// offline.html non carica il CSS dell'app e ha colori e interruttori
// ricopiati: qui si controlla anche che la copia sia uguale all'originale.

const radice = path.resolve(import.meta.dirname, "../..");
const globalsCss = readFileSync(path.join(radice, "src/app/globals.css"), "utf8");
const offlineHtml = readFileSync(path.join(radice, "public/offline.html"), "utf8");

// Il contenuto fra la graffa che segue `inizio` e quella che la chiude.
function corpoBlocco(testo: string, inizio: number): string {
  const apertura = testo.indexOf("{", inizio);
  let profondita = 0;
  for (let i = apertura; i < testo.length; i++) {
    if (testo[i] === "{") profondita++;
    if (testo[i] === "}") profondita--;
    if (profondita === 0) return testo.slice(apertura + 1, i);
  }
  throw new Error("graffa non chiusa");
}

// Le dichiarazioni di un blocco: { "--background": "var(--se-chiaro, ...", "color-scheme": "light" }
function dichiarazioni(corpo: string): Map<string, string> {
  const mappa = new Map<string, string>();
  for (const [, nome, valore] of corpo.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]*);/g)) {
    mappa.set(nome, valore.trim().replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")"));
  }
  return mappa;
}

// Il corpo della regola con questo selettore (spazi e a capo ignorati). Il
// selettore è il testo prima della graffa, dopo la regola precedente (o dopo
// un @import, che finisce con ";").
function regola(css: string, selettore: string): Map<string, string> {
  const compatto = selettore.replace(/\s+/g, "");
  for (const m of css.matchAll(/([^{};]+)\{/g)) {
    if (m[1].replace(/\s+/g, "") === compatto) return dichiarazioni(corpoBlocco(css, m.index));
  }
  throw new Error(`manca la regola ${selettore}`);
}

// Da offline.html conta solo il CSS dentro <style>.
function leggi(testo: string) {
  const stile = testo.match(/<style>([\s\S]*?)<\/style>/);
  const css = (stile ? stile[1] : testo).replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
  const media = css.indexOf("@media (prefers-color-scheme: dark)");
  expect(media, "manca il blocco @media (prefers-color-scheme: dark)").toBeGreaterThan(-1);
  return {
    colori: regola(css, ":root, [data-tema]"),
    chiaro: regola(css, ':root, [data-tema="chiaro"]'),
    scuro: regola(css, '[data-tema="scuro"]'),
    telefonoScuro: regola(corpoBlocco(css, media), ":root:not([data-tema])"),
  };
}

// Il valore dopo la virgola in var(--se-chiaro, ...) o var(--se-scuro, ...),
// parentesi annidate comprese. undefined se l'interruttore non c'è.
function meta(valore: string, interruttore: "--se-chiaro" | "--se-scuro"): string | undefined {
  const inizio = valore.indexOf(`var(${interruttore},`);
  if (inizio === -1) return undefined;
  let profondita = 0;
  for (let i = inizio + 3; i < valore.length; i++) {
    if (valore[i] === "(") profondita++;
    if (valore[i] === ")") profondita--;
    if (profondita === 0) return valore.slice(inizio + `var(${interruttore},`.length, i).trim();
  }
  throw new Error("parentesi non chiusa");
}

const COLORE_PER_ESTESO = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/i;

describe("tema scuro", () => {
  const app = leggi(globalsCss);

  it("in globals.css ogni colore ha il valore chiaro e quello scuro, o deriva da altri token", () => {
    expect(app.colori.size).toBeGreaterThan(0);
    for (const [nome, valore] of app.colori) {
      const chiaro = meta(valore, "--se-chiaro");
      const scuro = meta(valore, "--se-scuro");
      expect(chiaro === undefined, `${nome}: c'è un interruttore solo`).toBe(scuro === undefined);
      if (chiaro === undefined) {
        expect(valore, `${nome}: colore scritto senza i due valori`).not.toMatch(COLORE_PER_ESTESO);
      } else {
        expect(chiaro, `${nome} chiaro`).not.toBe("");
        expect(scuro, `${nome} scuro`).not.toBe("");
      }
    }
  });

  it("gli interruttori coprono scelta chiaro, scelta scuro e telefono al buio senza scelta", () => {
    const acceso = { "--se-chiaro": "initial", "--se-scuro": "", "color-scheme": "light" };
    const spento = { "--se-chiaro": "", "--se-scuro": "initial", "color-scheme": "dark" };
    expect(Object.fromEntries(app.chiaro)).toEqual(acceso);
    expect(Object.fromEntries(app.scuro)).toEqual(spento);
    expect(Object.fromEntries(app.telefonoScuro)).toEqual(spento);
  });

  it("il colore della barra (theme-color) è lo sfondo, in chiaro e in scuro", () => {
    const sfondo = app.colori.get("--background")!;
    expect(COLORI_BARRA.chiaro).toBe(meta(sfondo, "--se-chiaro"));
    expect(COLORI_BARRA.scuro).toBe(meta(sfondo, "--se-scuro"));
  });

  it("offline.html ha gli stessi colori e gli stessi interruttori di globals.css", () => {
    const offline = leggi(offlineHtml);
    expect(offline.colori.size).toBeGreaterThan(0);
    for (const [nome, valore] of offline.colori) {
      expect(valore, nome).toBe(app.colori.get(nome));
    }
    expect(offline.chiaro).toEqual(app.chiaro);
    expect(offline.scuro).toEqual(app.scuro);
    expect(offline.telefonoScuro).toEqual(app.telefonoScuro);
  });
});
