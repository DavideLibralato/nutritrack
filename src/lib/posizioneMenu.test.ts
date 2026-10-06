import { describe, expect, it } from "vitest";
import {
  DISTANZA_DALLA_RIGA_PX,
  MARGINE_ALTO_PX,
  MARGINE_LATERALE_PX,
  posizioneMenu,
} from "./posizioneMenu";

// Schermo da iPhone: 390 di larghezza, la fascia di "+ Aggiungi" e della
// pillola comincia a y = 700.
const BASE = { larghezzaMenu: 200, altezzaMenu: 52, larghezzaSchermo: 390, limiteBasso: 700 };

describe("posizioneMenu", () => {
  it("riga in alto: il menu si apre sotto, senza coprirla", () => {
    const p = posizioneMenu({ ...BASE, riga: { top: 300, bottom: 330, left: 16 } });
    expect(p).toEqual({ top: 330 + DISTANZA_DALLA_RIGA_PX, left: 16, verso: "sotto" });
  });

  it("riga in basso: si apre sopra, mai dentro la fascia di Aggiungi e della pillola", () => {
    const riga = { top: 620, bottom: 650, left: 16 };
    const p = posizioneMenu({ ...BASE, riga });
    expect(p.verso).toBe("sopra");
    expect(p.top + BASE.altezzaMenu).toBeLessThanOrEqual(riga.top - DISTANZA_DALLA_RIGA_PX);
  });

  it("il limite è esatto: se il menu tocca il margine sopra la fascia, sta ancora sotto", () => {
    const fondo = BASE.limiteBasso - DISTANZA_DALLA_RIGA_PX;
    const bottom = fondo - BASE.altezzaMenu - DISTANZA_DALLA_RIGA_PX;
    expect(posizioneMenu({ ...BASE, riga: { top: bottom - 30, bottom, left: 16 } }).verso).toBe("sotto");
    expect(posizioneMenu({ ...BASE, riga: { top: bottom - 29, bottom: bottom + 1, left: 16 } }).verso).toBe(
      "sopra"
    );
  });

  it("non esce a destra né a sinistra dello schermo", () => {
    const destra = posizioneMenu({ ...BASE, riga: { top: 300, bottom: 330, left: 300 } });
    expect(destra.left + BASE.larghezzaMenu).toBe(BASE.larghezzaSchermo - MARGINE_LATERALE_PX);
    const sinistra = posizioneMenu({ ...BASE, riga: { top: 300, bottom: 330, left: 2 } });
    expect(sinistra.left).toBe(MARGINE_LATERALE_PX);
  });

  it("menu più alto di ogni spazio libero: resta comunque dentro lo schermo e sopra la fascia", () => {
    const p = posizioneMenu({ ...BASE, altezzaMenu: 400, riga: { top: 300, bottom: 330, left: 16 } });
    expect(p.top).toBeGreaterThanOrEqual(MARGINE_ALTO_PX);
    expect(p.top + 400).toBeLessThanOrEqual(BASE.limiteBasso - DISTANZA_DALLA_RIGA_PX);
  });
});
