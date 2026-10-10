import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Campi data (<input type="date">): Safari su iPhone dà al campo una
// larghezza minima sua, che ignora width: 100%. Bug del 6/10: nel foglio
// Duplica il campo Giorno usciva a destra e allargava il foglio oltre lo
// schermo. jsdom non disegna, quindi si controllano le regole in
// globals.css e che i campi a tutta larghezza usino .campo-data.

const radice = path.resolve(import.meta.dirname, "../..");
// Senza i commenti: altrimenti il commento sopra una regola finirebbe nel
// suo selettore.
const css = readFileSync(path.join(radice, "src/app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const leggi = (file: string) => readFileSync(path.join(radice, file), "utf8");

function regola(selettore: string): string {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim() === selettore) return m[2];
  }
  throw new Error(`regola mancante: ${selettore}`);
}

describe("campi data", () => {
  it("nessun campo data ha una larghezza minima propria né esce dal contenitore", () => {
    const corpo = regola('input[type="date"]');
    expect(corpo).toMatch(/min-width:\s*0\s*;/);
    expect(corpo).toMatch(/max-width:\s*100%\s*;/);
  });

  it("i campi a tutta larghezza tolgono il controllo nativo di Safari", () => {
    const corpo = regola('input[type="date"].campo-data');
    expect(corpo).toMatch(/-webkit-appearance:\s*none\s*;/);
    expect(corpo).toMatch(/width:\s*100%\s*;/);
  });

  it("i campi data a tutta larghezza dell'app usano .campo-data", () => {
    for (const file of ["src/components/SheetDuplica.tsx", "src/components/SheetCambioObiettivo.tsx", "src/components/SheetDaQuando.tsx"]) {
      const campo = leggi(file).match(/type="date"[\s\S]*?className=\{?[`"]([^`"]*)/);
      expect(campo?.[1], file).toMatch(/\bcampo-data\b/);
    }
  });

  it("i fogli con un campo data (Duplica, «da quando») non scorrono mai in orizzontale", () => {
    for (const file of ["src/components/SheetDuplica.tsx", "src/components/SheetDaQuando.tsx"]) {
      expect(leggi(file), file).toMatch(/role="dialog"[\s\S]*?overflow-x-hidden/);
    }
  });
});

// Lo stesso per i campi ora (Pasti e orari, dal 9/10): Safari dà anche a
// loro la sua larghezza minima.
describe("campi ora", () => {
  it("nessun campo ora ha una larghezza minima propria, e quelli a tutta larghezza tolgono il controllo nativo", () => {
    expect(regola('input[type="time"]')).toMatch(/min-width:\s*0\s*;/);
    const corpo = regola('input[type="time"].campo-data');
    expect(corpo).toMatch(/-webkit-appearance:\s*none\s*;/);
    expect(corpo).toMatch(/width:\s*100%\s*;/);
  });

  it("il campo 'Inizia alle' di SheetPasto usa .campo-data", () => {
    const campo = leggi("src/components/SheetPasto.tsx").match(/type="time"[\s\S]*?className=\{?[`"]([^`"]*)/);
    expect(campo?.[1]).toMatch(/\bcampo-data\b/);
  });
});
