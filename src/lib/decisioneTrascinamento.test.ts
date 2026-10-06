import { describe, expect, it } from "vitest";
import { bersaglioSotto, zonaBersagli, type PastoSulloSchermo } from "./decisioneTrascinamento";

// Lista visibile da y = 200 a 800; "+ Aggiungi" e la pillola da y = 700.
// Tre pasti alti 150, il primo in parte sotto la testata (scorso in su).
const LISTA = { top: 200, bottom: 800, left: 16, right: 374 };
const ZONA = zonaBersagli(LISTA, 700);
const PASTI: PastoSulloSchermo[] = [
  { id: "colazione", rettangolo: { top: 100, bottom: 250, left: 16, right: 374 } },
  { id: "pranzo", rettangolo: { top: 250, bottom: 400, left: 16, right: 374 } },
  { id: "cena", rettangolo: { top: 400, bottom: 550, left: 16, right: 374 } },
];

describe("bersaglioSotto", () => {
  it("il pasto sotto il dito", () => {
    expect(bersaglioSotto(100, 300, PASTI, "colazione", ZONA)).toBe("pranzo");
    expect(bersaglioSotto(100, 450, PASTI, "colazione", ZONA)).toBe("cena");
  });

  it("il pasto di partenza non è un bersaglio", () => {
    expect(bersaglioSotto(100, 300, PASTI, "pranzo", ZONA)).toBeNull();
  });

  it("fuori dai pasti: nessuno", () => {
    expect(bersaglioSotto(100, 600, PASTI, "colazione", ZONA)).toBeNull(); // sotto l'ultimo
    expect(bersaglioSotto(5, 300, PASTI, "colazione", ZONA)).toBeNull(); // a sinistra della lista
  });

  it("sopra le barre in basso: nessuno, anche se lì sotto c'è un pasto", () => {
    const lungo = [{ id: "cena", rettangolo: { top: 400, bottom: 780, left: 16, right: 374 } }];
    expect(bersaglioSotto(100, 699, lungo, "colazione", ZONA)).toBe("cena");
    expect(bersaglioSotto(100, 700, lungo, "colazione", ZONA)).toBeNull();
    expect(bersaglioSotto(100, 750, lungo, "colazione", ZONA)).toBeNull();
  });

  it("la parte di un pasto scorsa sotto la testata non conta", () => {
    expect(bersaglioSotto(100, 150, PASTI, "pranzo", ZONA)).toBeNull();
    expect(bersaglioSotto(100, 220, PASTI, "pranzo", ZONA)).toBe("colazione");
  });

  it("al confine fra due pasti vince quello sotto: un pixel, un pasto solo", () => {
    expect(bersaglioSotto(100, 250, PASTI, "cena", ZONA)).toBe("pranzo");
    expect(bersaglioSotto(100, 249.5, PASTI, "cena", ZONA)).toBe("colazione");
  });
});
