import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// I bordi dei pasti bersaglio durante il trascinamento (globals.css,
// .pasto-trascinamento). Bug del 6/10, visto su iPhone: erano un outline
// disegnato appena FUORI dal riquadro di ogni pasto, e fra due pasti vicini
// (Colazione e Spuntino mattina) si sovrapponevano. Ora sono un riquadro
// disegnato da ::before che in verticale sta DENTRO il pasto: con un
// rientro di almeno 1 px, due pasti uno sopra l'altro non si toccano.
// jsdom non disegna niente, quindi si controlla il CSS.

const css = readFileSync(path.resolve(import.meta.dirname, "globals.css"), "utf8");

// Tutte le regole il cui selettore riguarda i pasti bersaglio.
function regoleBersaglio(): { selettore: string; corpo: string }[] {
  const regole: { selettore: string; corpo: string }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selettore = m[1].trim();
    if (selettore.includes(".pasto-trascinamento[data-bersaglio")) {
      regole.push({ selettore, corpo: m[2] });
    }
  }
  return regole;
}

describe("bordi dei pasti bersaglio", () => {
  it("nessun outline: verrebbe disegnato fuori dal riquadro, sopra il pasto vicino", () => {
    const regole = regoleBersaglio();
    expect(regole.length).toBeGreaterThan(0);
    for (const r of regole) expect(r.corpo, r.selettore).not.toMatch(/\boutline\b/);
  });

  it("il riquadro rientra dal bordo in verticale, quindi due pasti vicini non si toccano", () => {
    const prima = regoleBersaglio().find((r) => r.selettore === ".pasto-trascinamento[data-bersaglio]::before");
    expect(prima).toBeDefined();
    const inset = prima!.corpo.match(/\binset:\s*(-?[\d.]+)px\s+(-?[\d.]+)px\s*;/);
    expect(inset, "inset: <verticale>px <orizzontale>px").not.toBeNull();
    expect(Number(inset![1])).toBeGreaterThanOrEqual(1);
  });
});
