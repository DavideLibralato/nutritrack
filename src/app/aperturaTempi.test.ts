import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// I tempi dell'animazione di apertura (globals.css da .animazione-apertura
// in giù; PUNTO_DI_PARTENZA.md §7). Solo i tre errori che non si vedono
// provando l'animazione una volta: una durata cambiata da sola fa uscire
// lo strato a metà pesata o la lascia finire dopo; una rete di sicurezza
// troppo corta taglia l'animazione solo quando Oggi carica lenta; un pezzo
// dimenticato in riduci movimento si muove solo a chi l'ha chiesto.
// L'aspetto (curve, spostamenti, fili) si controlla guardandolo.

const radice = path.resolve(import.meta.dirname, "../..");
const css = readFileSync(path.join(radice, "src/app/globals.css"), "utf8");

// Il corpo di una regola: dalla graffa dopo `selettore` a quella che la
// chiude.
function regola(selettore: string): string {
  const inizio = css.indexOf(selettore + " {");
  expect(inizio, `manca "${selettore}" in globals.css`).toBeGreaterThanOrEqual(0);
  const apre = css.indexOf("{", inizio);
  return css.slice(apre + 1, css.indexOf("}", apre));
}

function ms(valore: string, unita: string): number {
  return Number(valore) * (unita === "s" ? 1000 : 1);
}

// Durata in ms dell'animazione `nome` dentro una regola.
function durata(selettore: string, nome: string): number {
  const m = regola(selettore).match(new RegExp(`\\b${nome}\\s+([\\d.]+)(ms|s)\\b`));
  expect(m, `${selettore}: manca l'animazione ${nome}`).not.toBeNull();
  return ms(m![1], m![2]);
}

describe("animazione di apertura: tempi", () => {
  const minimo = durata(".animazione-apertura", "apertura-minimo");

  it("giogo e piatti che lo seguono durano quanto apertura-minimo", () => {
    expect(durata(".apertura-giogo", "apertura-giogo")).toBe(minimo);
    expect(durata(".apertura-segue-sinistra", "apertura-segue-sinistra")).toBe(minimo);
    expect(durata(".apertura-segue-destra", "apertura-segue-destra")).toBe(minimo);
  });

  it("la rete di sicurezza parte dopo minimo + uscita", () => {
    const m = regola(".animazione-apertura").match(
      /apertura-sicurezza\s+[\d.]+m?s\s+cubic-bezier\([^)]*\)\s+([\d.]+)(ms|s)/
    );
    expect(m, "apertura-sicurezza senza ritardo").not.toBeNull();
    const uscita = durata(
      ".animazione-apertura[data-esce] .animazione-apertura-fondo",
      "apertura-uscita"
    );
    expect(ms(m![1], m![2])).toBeGreaterThan(minimo + uscita);
  });

  it("riduci movimento ferma tutto ciò che si muove nella bilancia", () => {
    // Il blocco "riduci movimento" dell'apertura: quello con .apertura-giogo.
    const elenco = [
      ...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([^{]*)\{\s*animation:\s*none;/g),
    ]
      .map((m) => m[1])
      .find((selettori) => selettori.includes(".apertura-giogo"));
    expect(elenco, "manca il blocco riduci movimento dell'apertura").toBeDefined();
    for (const classe of [
      ".animazione-apertura-bilancia",
      ".apertura-giogo",
      ".apertura-segue-sinistra",
      ".apertura-segue-destra",
      ".apertura-piatto",
      ".apertura-piatto-calato",
      ".apertura-filo",
    ]) {
      expect(elenco).toMatch(new RegExp(`${classe.replace(".", "\\.")}[,\\s]`));
    }
  });
});
