// Test permanenti per rettangoloRitaglio: il passaggio dal quadrato di
// react-easy-crop (decimali, a volte mezzo pixel fuori dai bordi) al
// quadrato da disegnare. Un errore qui non fa rumore: la foto esce
// spostata, schiacciata o con una riga nera sul bordo, e lo si nota solo
// guardandola. La parte con canvas (preparaFotoProfilo) non gira in jsdom:
// si prova su iPhone.

import { describe, it, expect } from "vitest";
import { LATO_FOTO_PX, rettangoloRitaglio } from "./ritaglioFoto";

// Una foto dell'iPhone in verticale, già raddrizzata: 3024 × 4032.
const IPHONE = { larghezza: 3024, altezza: 4032 };

describe("rettangoloRitaglio: casi normali", () => {
  it("un quadrato intero dentro la foto resta com'è", () => {
    expect(rettangoloRitaglio({ x: 500, y: 800, width: 1500, height: 1500 }, IPHONE)).toEqual({
      sx: 500,
      sy: 800,
      lato: 1500,
      latoUscita: LATO_FOTO_PX,
    });
  });

  it("i decimali della libreria si arrotondano tenendo il centro", () => {
    // Centro (1250.5, 1550.25), lato 1000.4 → 1000: parte da 750.5 → 751
    // e da 1050.25 → 1050.
    expect(
      rettangoloRitaglio({ x: 750.3, y: 1050.05, width: 1000.4, height: 1000.4 }, IPHONE)
    ).toEqual({ sx: 751, sy: 1050, lato: 1000, latoUscita: 400 });
  });

  it("larghezza e altezza un po' diverse: vale il lato più piccolo, centrato", () => {
    // Centro (1500.5, 1999.5); lato 999 (non 1001): il quadrato resta
    // dentro l'area scelta. Parte da 1001 e da 1500.
    expect(rettangoloRitaglio({ x: 1000, y: 1500, width: 1001, height: 999 }, IPHONE)).toEqual({
      sx: 1001,
      sy: 1500,
      lato: 999,
      latoUscita: 400,
    });
  });

  it("tutta la larghezza della foto (zoom al minimo)", () => {
    expect(rettangoloRitaglio({ x: 0, y: 504, width: 3024, height: 3024 }, IPHONE)).toEqual({
      sx: 0,
      sy: 504,
      lato: 3024,
      latoUscita: 400,
    });
  });
});

describe("rettangoloRitaglio: bordi", () => {
  it("mezzo pixel fuori a sinistra e in alto: si sposta dentro, il lato resta", () => {
    expect(rettangoloRitaglio({ x: -0.4, y: -0.6, width: 1000, height: 1000 }, IPHONE)).toEqual({
      sx: 0,
      sy: 0,
      lato: 1000,
      latoUscita: 400,
    });
  });

  it("mezzo pixel fuori a destra e in basso: si sposta dentro", () => {
    // Da 2024.6 a 3024.6 in larghezza, da 3032.7 a 4032.7 in altezza.
    expect(rettangoloRitaglio({ x: 2024.6, y: 3032.7, width: 1000, height: 1000 }, IPHONE)).toEqual(
      { sx: 2024, sy: 3032, lato: 1000, latoUscita: 400 }
    );
  });

  it("molto fuori dalla foto: si appoggia al bordo", () => {
    expect(rettangoloRitaglio({ x: -800, y: 9000, width: 500, height: 500 }, IPHONE)).toEqual({
      sx: 0,
      sy: 3532,
      lato: 500,
      latoUscita: 400,
    });
  });

  it("un lato più grande della foto si riduce al lato corto", () => {
    // Area 3100 su una foto larga 3024: lato 3024, centrato sul centro
    // dell'area (1512, 2016) → parte da (0, 504).
    expect(rettangoloRitaglio({ x: -38, y: 466, width: 3100, height: 3100 }, IPHONE)).toEqual({
      sx: 0,
      sy: 504,
      lato: 3024,
      latoUscita: 400,
    });
  });

  it("il quadrato finisce sempre dentro la foto, anche con misure con decimali", () => {
    const foto = { larghezza: 801.7, altezza: 600.2 };
    const r = rettangoloRitaglio({ x: 300.9, y: 0.4, width: 600.8, height: 600.8 }, foto);
    expect(r).not.toBeNull();
    expect(r!.lato).toBe(600);
    expect(r!.sx).toBeGreaterThanOrEqual(0);
    expect(r!.sy).toBeGreaterThanOrEqual(0);
    expect(r!.sx + r!.lato).toBeLessThanOrEqual(801);
    expect(r!.sy + r!.lato).toBeLessThanOrEqual(600);
  });
});

describe("rettangoloRitaglio: foto piccole", () => {
  it("un quadrato sotto i 400 px non si ingrandisce", () => {
    expect(
      rettangoloRitaglio(
        { x: 10, y: 20, width: 250, height: 250 },
        { larghezza: 300, altezza: 300 }
      )
    ).toEqual({ sx: 10, sy: 20, lato: 250, latoUscita: 250 });
  });

  it("esattamente 400 px: esce a 400", () => {
    expect(
      rettangoloRitaglio({ x: 0, y: 0, width: 400, height: 400 }, { larghezza: 400, altezza: 600 })
    ).toEqual({ sx: 0, sy: 0, lato: 400, latoUscita: 400 });
  });

  it("una foto da 1 pixel dà un quadrato da 1 pixel", () => {
    expect(
      rettangoloRitaglio({ x: 0, y: 0, width: 1, height: 1 }, { larghezza: 1, altezza: 1 })
    ).toEqual({ sx: 0, sy: 0, lato: 1, latoUscita: 1 });
  });
});

describe("rettangoloRitaglio: valori strani", () => {
  it("un valore dell'area non numerico → null, non un ritaglio a caso", () => {
    const buona = { x: 0, y: 0, width: 100, height: 100 };
    for (const campo of ["x", "y", "width", "height"] as const) {
      for (const strano of [NaN, Infinity, -Infinity]) {
        expect(rettangoloRitaglio({ ...buona, [campo]: strano }, IPHONE)).toBeNull();
      }
    }
  });

  it("lato zero o negativo → null", () => {
    expect(rettangoloRitaglio({ x: 10, y: 10, width: 0, height: 0 }, IPHONE)).toBeNull();
    expect(rettangoloRitaglio({ x: 10, y: 10, width: -200, height: -200 }, IPHONE)).toBeNull();
    expect(rettangoloRitaglio({ x: 10, y: 10, width: 300, height: -1 }, IPHONE)).toBeNull();
    // Sotto il mezzo pixel l'arrotondamento dà 0.
    expect(rettangoloRitaglio({ x: 10, y: 10, width: 0.4, height: 0.4 }, IPHONE)).toBeNull();
  });

  it("foto senza misure valide → null", () => {
    const area = { x: 0, y: 0, width: 100, height: 100 };
    expect(rettangoloRitaglio(area, { larghezza: 0, altezza: 4032 })).toBeNull();
    expect(rettangoloRitaglio(area, { larghezza: 3024, altezza: -1 })).toBeNull();
    expect(rettangoloRitaglio(area, { larghezza: NaN, altezza: 4032 })).toBeNull();
    expect(rettangoloRitaglio(area, { larghezza: 3024, altezza: Infinity })).toBeNull();
    // Meno di un pixel intero.
    expect(rettangoloRitaglio(area, { larghezza: 0.9, altezza: 0.9 })).toBeNull();
  });

  it("i valori restituiti sono sempre interi", () => {
    const r = rettangoloRitaglio({ x: 123.456, y: 789.012, width: 987.65, height: 987.66 }, IPHONE);
    expect(r).not.toBeNull();
    for (const v of Object.values(r!)) expect(Number.isInteger(v)).toBe(true);
  });
});
