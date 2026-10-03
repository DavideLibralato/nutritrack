import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACCENTI } from "@/lib/tema";
import { leggiPaletta, meta, type Paletta } from "./palettaCss";

// Contrasti del testo (PUNTO_DI_PARTENZA.md sezione 7): per ogni colore
// principale, in chiaro e in scuro, almeno 4,5:1 (WCAG AA, testo normale).
// I colori si calcolano da globals.css così com'è: si seguono var() e
// color-mix() e si sovrappongono gli strati trasparenti (vetro, capsula).
// Un colore principale nuovo, o un grigio, una percentuale, uno sfondo
// cambiati, non possono scendere sotto la soglia senza che un caso diventi
// rosso.

const SOGLIA = 4.5;

const radice = path.resolve(import.meta.dirname, "../..");
const paletta = leggiPaletta(readFileSync(path.join(radice, "src/app/globals.css"), "utf8"));

// Un colore: rosso, verde, blu da 0 a 255 e opacità da 0 a 1.
type Rgba = [number, number, number, number];
type Tema = "chiaro" | "scuro";

function esadecimale(testo: string): Rgba {
  const h = testo.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as Rgba;
}

// Divide "a, b, c" alle virgole fuori dalle parentesi.
function argomenti(testo: string): string[] {
  const parti: string[] = [];
  let profondita = 0;
  let inizio = 0;
  for (let i = 0; i < testo.length; i++) {
    if (testo[i] === "(") profondita++;
    if (testo[i] === ")") profondita--;
    if (testo[i] === "," && profondita === 0) {
      parti.push(testo.slice(inizio, i).trim());
      inizio = i + 1;
    }
  }
  parti.push(testo.slice(inizio).trim());
  return parti;
}

// Il valore di una variabile per un tema e un colore principale.
function variabile(p: Paletta, nome: string, tema: Tema, accento: string): Rgba {
  const perAccento = p.accenti.get(accento)?.get(nome);
  if (perAccento) return valuta(p, perAccento, tema, accento);
  const valore = p.colori.get(nome);
  if (!valore) throw new Error(`variabile sconosciuta ${nome}`);
  const meta_ = meta(valore, tema === "chiaro" ? "--se-chiaro" : "--se-scuro");
  return valuta(p, meta_ ?? valore, tema, accento);
}

function valuta(p: Paletta, espressione: string, tema: Tema, accento: string): Rgba {
  const e = espressione.trim();
  if (/^#[0-9a-f]{6}$/i.test(e)) return esadecimale(e);
  if (e === "transparent") return [0, 0, 0, 0];
  const v = e.match(/^var\((--[\w-]+)\)$/);
  if (v) return variabile(p, v[1], tema, accento);
  const mix = e.match(/^color-mix\(in srgb,(.*)\)$/);
  if (mix) {
    const [a, b] = argomenti(mix[1]).map((arg) => {
      const conPercento = arg.match(/^(.*?)\s+([\d.]+)%$/);
      return conPercento
        ? { colore: valuta(p, conPercento[1], tema, accento), quota: Number(conPercento[2]) / 100 }
        : { colore: valuta(p, arg, tema, accento), quota: undefined };
    });
    const qa = a.quota ?? 1 - (b.quota ?? 0.5);
    const qb = b.quota ?? 1 - qa;
    // Miscela in sRGB con l'opacità "premoltiplicata", come fa il browser:
    // mescolare con transparent abbassa l'opacità, non scurisce il colore.
    const alfa = a.colore[3] * qa + b.colore[3] * qb;
    const canale = (i: number) =>
      alfa === 0 ? 0 : (a.colore[i] * a.colore[3] * qa + b.colore[i] * b.colore[3] * qb) / alfa;
    return [canale(0), canale(1), canale(2), alfa];
  }
  throw new Error(`espressione non gestita: ${e}`);
}

// Un colore (anche trasparente) disegnato sopra uno sfondo pieno.
function sopra(colore: Rgba, sfondo: Rgba): Rgba {
  const a = colore[3];
  return [0, 1, 2].map((i) => colore[i] * a + sfondo[i] * (1 - a)).concat(1) as Rgba;
}

function luminanza([r, g, b]: Rgba): number {
  const lineare = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lineare(r) + 0.7152 * lineare(g) + 0.0722 * lineare(b);
}

function contrasto(a: Rgba, b: Rgba): number {
  const [chiaro, scuro] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (chiaro + 0.05) / (scuro + 0.05);
}

// Le coppie testo / sfondo da controllare per un tema e un colore.
function coppie(p: Paletta, tema: Tema, accento: string): [string, number][] {
  const c = (nome: string) => variabile(p, nome, tema, accento);
  const sfondo = c("--background");
  const superficie = c("--superficie");
  // Caso peggiore della capsula: la pillola è vetro (superficie
  // semitrasparente) sopra lo sfondo, e la capsula sta sopra il vetro.
  const vetro = sopra(c("--vetro"), sfondo);
  const capsula = sopra(c("--capsula-attiva"), vetro);
  return [
    ["--accento su sfondo", contrasto(c("--accento"), sfondo)],
    ["--accento su superficie", contrasto(c("--accento"), superficie)],
    ["--su-pieno su --accento-pieno", contrasto(sopra(c("--su-pieno"), c("--accento-pieno")), c("--accento-pieno"))],
    ["--testo-capsula sulla capsula sopra il vetro", contrasto(sopra(c("--testo-capsula"), capsula), capsula)],
    ["--tenue su sfondo", contrasto(c("--tenue"), sfondo)],
    ["--tenue su superficie", contrasto(c("--tenue"), superficie)],
  ];
}

describe("contrasti del testo, almeno 4,5:1", () => {
  it("in CSS ci sono tutti i colori principali di ACCENTI", () => {
    expect([...paletta.accenti.keys()]).toEqual([...ACCENTI]);
  });

  for (const accento of ACCENTI) {
    for (const tema of ["chiaro", "scuro"] as const) {
      it(`${accento}, ${tema}`, () => {
        for (const [dove, valore] of coppie(paletta, tema, accento)) {
          expect(valore, `${accento} ${tema}: ${dove} = ${valore.toFixed(2)}:1`).toBeGreaterThanOrEqual(SOGLIA);
        }
      });
    }
  }

  it("il calcolo torna con un caso noto: --tenue scuro su sfondo scuro, 6,4:1", () => {
    const [, valore] = coppie(paletta, "scuro", "verde").find(([dove]) => dove === "--tenue su sfondo")!;
    expect(valore).toBeCloseTo(6.4, 1);
  });
});
