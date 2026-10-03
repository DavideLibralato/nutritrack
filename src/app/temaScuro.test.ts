import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACCENTI, COLORI_BARRA } from "@/lib/tema";
import { leggiPaletta, meta } from "./palettaCss";

// Tema scuro e colore principale (PUNTO_DI_PARTENZA.md sezione 7). In
// globals.css ogni colore è scritto una volta sola con i suoi due valori:
//     --background: var(--se-chiaro, #faf7f2) var(--se-scuro, #1b1815);
// e gli "interruttori" --se-chiaro / --se-scuro decidono quale vale.
// L'accento prende i suoi da --accento-chiaro / --accento-scuro, scritti
// una volta per ogni colore principale ([data-accento="blu"]...).
//
// Un colore scritto per esteso senza i due interruttori non dà errori: al
// buio resterebbe col valore chiaro (uno sheet bianco, un testo scuro su
// fondo scuro) e lo si scoprirebbe solo guardando quella schermata in scuro.
// Qui si controlla che non succeda, che gli interruttori coprano i tre casi
// (scelta chiaro, scelta scuro, nessuna scelta con il telefono al buio),
// che i colori principali in CSS siano quelli di ACCENTI e che il colore
// della barra (theme-color) sia lo sfondo.
//
// offline.html non carica il CSS dell'app e ha colori, interruttori e
// colori principali ricopiati: qui si controlla anche che la copia sia
// uguale all'originale. I contrasti stanno in contrasti.test.ts.

const radice = path.resolve(import.meta.dirname, "../..");
const globalsCss = readFileSync(path.join(radice, "src/app/globals.css"), "utf8");
const offlineHtml = readFileSync(path.join(radice, "public/offline.html"), "utf8");

const COLORE_PER_ESTESO = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/i;

describe("tema scuro e colore principale", () => {
  const app = leggiPaletta(globalsCss);

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

  it("i colori principali in CSS sono quelli di ACCENTI, ognuno con il valore chiaro e scuro", () => {
    expect([...app.accenti.keys()]).toEqual([...ACCENTI]);
    for (const [accento, valori] of app.accenti) {
      expect([...valori.keys()].sort(), accento).toEqual(["--accento-chiaro", "--accento-scuro"]);
      for (const valore of valori.values()) expect(valore, accento).toMatch(/^#[0-9a-f]{6}$/i);
    }
    // Senza data-accento (script non partito) vale il verde: la sua regola
    // è anche quella di :root.
    expect(globalsCss).toMatch(/:root,\s*\[data-accento="verde"\]\s*\{/);
  });

  it("il colore della barra (theme-color) è lo sfondo, in chiaro e in scuro", () => {
    const sfondo = app.colori.get("--background")!;
    expect(COLORI_BARRA.chiaro).toBe(meta(sfondo, "--se-chiaro"));
    expect(COLORI_BARRA.scuro).toBe(meta(sfondo, "--se-scuro"));
  });

  it("offline.html ha gli stessi colori, interruttori e colori principali di globals.css", () => {
    const offline = leggiPaletta(offlineHtml);
    expect(offline.colori.size).toBeGreaterThan(0);
    for (const [nome, valore] of offline.colori) {
      expect(valore, nome).toBe(app.colori.get(nome));
    }
    expect(offline.chiaro).toEqual(app.chiaro);
    expect(offline.scuro).toEqual(app.scuro);
    expect(offline.telefonoScuro).toEqual(app.telefonoScuro);
    expect(offline.accenti).toEqual(app.accenti);
    expect(offlineHtml).toMatch(/:root,\s*\[data-accento="verde"\]\s*\{/);
  });
});
