import { describe, expect, it } from "vitest";
import {
  creaBloccoClick,
  decidiDirezione,
  DISTANZA_CAMBIO_PX,
  DISTANZA_MINIMA_FLICK_PX,
  esitoRilascio,
  MARGINE_BORDO_PX,
  partenzaValida,
  RESISTENZA_ELASTICO,
  SCADENZA_BLOCCO_CLICK_MS,
  SOGLIA_DIREZIONE_PX,
  spostamentoMostrato,
  VELOCITA_CAMBIO,
  velocitaRecente,
} from "./decisioneSwipe";

describe("partenzaValida", () => {
  it("ignora le partenze vicino ai due bordi", () => {
    expect(partenzaValida(MARGINE_BORDO_PX - 1, 390)).toBe(false);
    expect(partenzaValida(390 - MARGINE_BORDO_PX + 1, 390)).toBe(false);
  });

  it("accetta il centro e il limite esatto", () => {
    expect(partenzaValida(195, 390)).toBe(true);
    expect(partenzaValida(MARGINE_BORDO_PX, 390)).toBe(true);
    expect(partenzaValida(390 - MARGINE_BORDO_PX, 390)).toBe(true);
  });
});

describe("decidiDirezione", () => {
  it("sotto la soglia non decide: è ancora un tocco", () => {
    expect(decidiDirezione(SOGLIA_DIREZIONE_PX - 1, 0)).toBeNull();
    expect(decidiDirezione(5, 5)).toBeNull();
  });

  it("orizzontale nei due versi", () => {
    expect(decidiDirezione(-20, 3)).toBe("orizzontale");
    expect(decidiDirezione(20, -3)).toBe("orizzontale");
  });

  it("uno scroll diagonale resta verticale", () => {
    // 45°: |dx| = |dy|, non supera il rapporto
    expect(decidiDirezione(20, 20)).toBe("verticale");
    // ~37°: ancora troppo inclinato
    expect(decidiDirezione(20, 15)).toBe("verticale");
    expect(decidiDirezione(2, -30)).toBe("verticale");
  });
});

describe("esitoRilascio", () => {
  it("swipe lento oltre la soglia: dito a sinistra = giorno dopo", () => {
    expect(
      esitoRilascio({ dx: -DISTANZA_CAMBIO_PX, velocita: 0, puoAvanti: true })
    ).toBe("successivo");
  });

  it("swipe lento oltre la soglia: dito a destra = giorno prima", () => {
    expect(
      esitoRilascio({ dx: DISTANZA_CAMBIO_PX, velocita: 0, puoAvanti: true })
    ).toBe("precedente");
  });

  it("sotto soglia e lento: torna al suo posto", () => {
    expect(
      esitoRilascio({ dx: DISTANZA_CAMBIO_PX - 1, velocita: 0.1, puoAvanti: true })
    ).toBe("ritorno");
  });

  it("flick veloce anche sotto la distanza", () => {
    expect(
      esitoRilascio({ dx: 40, velocita: VELOCITA_CAMBIO, puoAvanti: true })
    ).toBe("precedente");
    expect(
      esitoRilascio({ dx: -40, velocita: -VELOCITA_CAMBIO, puoAvanti: true })
    ).toBe("successivo");
  });

  it("flick troppo corto non cambia giorno", () => {
    expect(
      esitoRilascio({ dx: DISTANZA_MINIMA_FLICK_PX - 1, velocita: 2, puoAvanti: true })
    ).toBe("ritorno");
  });

  it("flick in verso opposto allo spostamento non conferma", () => {
    expect(esitoRilascio({ dx: 50, velocita: -1, puoAvanti: true })).toBe("ritorno");
  });

  it("oltre oggi non si va: torna al suo posto", () => {
    expect(esitoRilascio({ dx: -200, velocita: -2, puoAvanti: false })).toBe("ritorno");
  });

  it("da oggi verso ieri si va", () => {
    expect(esitoRilascio({ dx: 200, velocita: 0, puoAvanti: false })).toBe("precedente");
  });
});

describe("spostamentoMostrato", () => {
  it("segue il dito quando il giorno si può cambiare", () => {
    expect(spostamentoMostrato(-100, true)).toBe(-100);
    expect(spostamentoMostrato(100, false)).toBe(100);
  });

  it("oltre oggi è elastico, ridotto", () => {
    expect(spostamentoMostrato(-100, false)).toBeCloseTo(-100 * RESISTENZA_ELASTICO);
  });
});

describe("velocitaRecente", () => {
  it("misura solo gli ultimi 100 ms", () => {
    const campioni = [
      { t: 0, x: 0 }, // fuori finestra: partenza lenta
      { t: 200, x: 10 },
      { t: 250, x: 40 },
      { t: 300, x: 70 },
    ];
    expect(velocitaRecente(campioni)).toBeCloseTo(60 / 100);
  });

  it("con un solo campione è zero", () => {
    expect(velocitaRecente([{ t: 0, x: 0 }])).toBe(0);
  });
});

describe("creaBloccoClick", () => {
  it("blocca un click solo dopo un trascinamento, e uno solo", () => {
    const blocco = creaBloccoClick();
    blocco.inizioGesto();
    blocco.trascinamentoConcluso(1000);
    expect(blocco.consumaClick(1010)).toBe(true);
    // Il tocco successivo funziona
    blocco.inizioGesto();
    expect(blocco.consumaClick(2000)).toBe(false);
  });

  it("due click di fila dopo un trascinamento: solo il primo è bloccato", () => {
    const blocco = creaBloccoClick();
    blocco.trascinamentoConcluso(1000);
    expect(blocco.consumaClick(1010)).toBe(true);
    expect(blocco.consumaClick(1020)).toBe(false);
  });

  it("se dopo il trascinamento il click non arriva (iPhone), il tocco dopo passa", () => {
    const blocco = creaBloccoClick();
    blocco.inizioGesto();
    blocco.trascinamentoConcluso(1000);
    // nessun click qui
    blocco.inizioGesto(); // tocco nuovo
    expect(blocco.consumaClick(1100)).toBe(false);
  });

  it("scade da solo: un click arrivato tardi (es. Invio da tastiera) passa", () => {
    const blocco = creaBloccoClick();
    blocco.trascinamentoConcluso(1000);
    expect(blocco.consumaClick(1000 + SCADENZA_BLOCCO_CLICK_MS + 1)).toBe(false);
  });

  it("un tocco normale non è mai bloccato", () => {
    const blocco = creaBloccoClick();
    blocco.inizioGesto();
    expect(blocco.consumaClick(1000)).toBe(false);
  });
});
