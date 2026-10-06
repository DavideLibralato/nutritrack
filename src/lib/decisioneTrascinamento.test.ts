import { describe, expect, it } from "vitest";
import {
  bersaglioSotto,
  PASSO_MASSIMO_MS,
  pastiDopoScorrimento,
  prossimoScrollTop,
  VELOCITA_MASSIMA_PX_S,
  velocitaScorrimento,
  ZONA_SCORRIMENTO_PX,
  zonaBersagli,
  type PastoSulloSchermo,
} from "./decisioneTrascinamento";

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

describe("scorrimento automatico", () => {
  // Zona dei bersagli da 200 a 700: fascia alta 200–264, bassa 636–700.
  it("fuori dalle fasce sensibili la lista non scorre", () => {
    expect(velocitaScorrimento(400, ZONA)).toBe(0);
    expect(velocitaScorrimento(200 + ZONA_SCORRIMENTO_PX, ZONA)).toBe(0);
    expect(velocitaScorrimento(700 - ZONA_SCORRIMENTO_PX, ZONA)).toBe(0);
  });

  it("più vicino al bordo, più veloce; verso l'alto negativa, verso il basso positiva", () => {
    const meta = ZONA_SCORRIMENTO_PX / 2;
    expect(velocitaScorrimento(700 - meta, ZONA)).toBeCloseTo(VELOCITA_MASSIMA_PX_S / 2);
    expect(velocitaScorrimento(700, ZONA)).toBe(VELOCITA_MASSIMA_PX_S);
    expect(velocitaScorrimento(200 + meta, ZONA)).toBeCloseTo(-VELOCITA_MASSIMA_PX_S / 2);
    expect(velocitaScorrimento(200, ZONA)).toBe(-VELOCITA_MASSIMA_PX_S);
    expect(velocitaScorrimento(690, ZONA)).toBeGreaterThan(velocitaScorrimento(650, ZONA));
  });

  it("oltre il bordo (sopra le barre, sopra la testata) resta alla massima", () => {
    expect(velocitaScorrimento(760, ZONA)).toBe(VELOCITA_MASSIMA_PX_S);
    expect(velocitaScorrimento(120, ZONA)).toBe(-VELOCITA_MASSIMA_PX_S);
  });

  it("la fascia in basso sta sopra le barre: comincia 64 px prima di + Aggiungi", () => {
    // La lista arriva a 800, ma la zona finisce a 700 dove cominciano le barre.
    expect(velocitaScorrimento(640, ZONA)).toBeGreaterThan(0);
  });

  it("il passo si ferma a fine corsa, e un fotogramma lento non fa saltare la lista", () => {
    expect(prossimoScrollTop(100, 800, 16, 1000)).toBeCloseTo(112.8);
    expect(prossimoScrollTop(995, 800, 16, 1000)).toBe(1000);
    expect(prossimoScrollTop(5, -800, 16, 1000)).toBe(0);
    expect(prossimoScrollTop(100, 800, 2000, 1000)).toBe(100 + (800 * PASSO_MASSIMO_MS) / 1000);
  });

  it("dito fermo nella fascia bassa: mentre la lista scorre il bersaglio cambia", () => {
    // Il dito resta su y = 690. All'inizio sotto c'è Pranzo (esteso fino a
    // 700); dopo abbastanza scorrimento sale Cena, che era sotto le barre.
    const pasti: PastoSulloSchermo[] = [
      { id: "pranzo", rettangolo: { top: 400, bottom: 700, left: 16, right: 374 } },
      { id: "cena", rettangolo: { top: 700, bottom: 900, left: 16, right: 374 } },
    ];
    let scrollTop = 0;
    const visti: (string | null)[] = [];
    // A y = 690 la velocità è ~675 px/s: ~11 px a fotogramma. 10 fotogrammi
    // portano Cena sotto il dito senza superarla.
    for (let fotogramma = 0; fotogramma < 10; fotogramma++) {
      const b = bersaglioSotto(100, 690, pastiDopoScorrimento(pasti, scrollTop), "colazione", ZONA);
      if (visti[visti.length - 1] !== b) visti.push(b);
      scrollTop = prossimoScrollTop(scrollTop, velocitaScorrimento(690, ZONA), 16, 2000);
    }
    expect(visti).toEqual(["pranzo", "cena"]);
    expect(scrollTop).toBeGreaterThan(0);
  });
});
