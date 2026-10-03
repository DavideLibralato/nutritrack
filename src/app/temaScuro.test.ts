import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Tema scuro (PUNTO_DI_PARTENZA.md sezione 7): ogni token di colore definito
// per il chiaro deve avere anche il suo valore scuro. Un token nuovo aggiunto
// solo al blocco chiaro non dà errori: al buio resterebbe col valore chiaro
// (uno sheet bianco, un testo scuro su fondo scuro) e lo si scoprirebbe solo
// guardando quella schermata col telefono in modalità scura.
//
// offline.html non carica il CSS dell'app e ha i colori ricopiati: qui si
// controlla anche che la copia sia uguale all'originale, in chiaro e in scuro.

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

// Le custom property dichiarate in un blocco: { "--background": "#faf7f2", ... }
function token(corpo: string): Map<string, string> {
  const senzaCommenti = corpo.replace(/\/\*[\s\S]*?\*\//g, "");
  const mappa = new Map<string, string>();
  for (const [, nome, valore] of senzaCommenti.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    mappa.set(nome, valore.trim().replace(/\s+/g, " "));
  }
  return mappa;
}

// Blocco chiaro: il :root (fuori da ogni @media) che definisce --background.
// Blocco scuro: il :root dentro @media (prefers-color-scheme: dark).
function paletta(testo: string) {
  const senzaCommenti = testo.replace(/\/\*[\s\S]*?\*\//g, "");
  const media = senzaCommenti.indexOf("@media (prefers-color-scheme: dark)");
  expect(media, "manca il blocco @media (prefers-color-scheme: dark)").toBeGreaterThan(-1);
  const corpoMedia = corpoBlocco(senzaCommenti, media);
  const scuro = token(corpoBlocco(corpoMedia, corpoMedia.indexOf(":root")));

  // Tolto il blocco @media, restano solo i :root del chiaro.
  const fuoriMedia = senzaCommenti.replace(corpoMedia, "");
  let chiaro: Map<string, string> | undefined;
  for (const m of fuoriMedia.matchAll(/:root\s*\{/g)) {
    const blocco = token(corpoBlocco(fuoriMedia, m.index));
    if (blocco.has("--background")) chiaro = blocco;
  }
  expect(chiaro, "manca il :root con i colori chiari").toBeDefined();
  return { chiaro: chiaro!, scuro };
}

describe("tema scuro", () => {
  const app = paletta(globalsCss);

  it("in globals.css ogni token chiaro ha il suo valore scuro", () => {
    const mancanti = [...app.chiaro.keys()].filter((nome) => !app.scuro.has(nome));
    expect(mancanti).toEqual([]);
  });

  it("in globals.css il blocco scuro non definisce token che il chiaro non ha", () => {
    const inPiu = [...app.scuro.keys()].filter((nome) => !app.chiaro.has(nome));
    expect(inPiu).toEqual([]);
  });

  it("offline.html ha gli stessi valori di globals.css, in chiaro e in scuro", () => {
    const offline = paletta(offlineHtml);
    expect(offline.chiaro.size).toBeGreaterThan(0);
    for (const [nome, valore] of offline.chiaro) {
      expect(valore, `${nome} chiaro`).toBe(app.chiaro.get(nome));
    }
    expect([...offline.scuro.keys()].sort()).toEqual([...offline.chiaro.keys()].sort());
    for (const [nome, valore] of offline.scuro) {
      expect(valore, `${nome} scuro`).toBe(app.scuro.get(nome));
    }
  });
});
