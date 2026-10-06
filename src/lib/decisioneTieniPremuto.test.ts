import { describe, expect, it } from "vitest";
import {
  aggiornaMovimento,
  aggiornaRilascio,
  aggiornaTempo,
  avviaTieniPremuto,
  contextmenuApreMenu,
  DURATA_PRESSIONE_MS,
  eSollevato,
  FINESTRA_DECISIONE_MS,
  prossimaScadenza,
  TOLLERANZA_MOVIMENTO_PX,
  type StatoTieniPremuto,
} from "./decisioneTieniPremuto";
import { SCADENZA_BLOCCO_CLICK_MS, SOGLIA_DIREZIONE_PX } from "./decisioneSwipe";

const T0 = 1000;
const SOLLEVA = T0 + DURATA_PRESSIONE_MS;

function sollevato(): StatoTieniPremuto {
  return aggiornaTempo(avviaTieniPremuto(100, 200, T0), SOLLEVA);
}

describe("sollevamento", () => {
  it("un millisecondo prima della soglia è ancora attesa", () => {
    expect(aggiornaTempo(avviaTieniPremuto(100, 200, T0), SOLLEVA - 1).fase).toBe("attesa");
  });

  it("alla soglia esatta la riga si solleva", () => {
    const s = sollevato();
    expect(s.fase).toBe("sollevato");
    expect(eSollevato(s)).toBe(true);
  });

  it("un movimento entro la tolleranza non annulla", () => {
    const s = aggiornaMovimento(avviaTieniPremuto(100, 200, T0), 100 + TOLLERANZA_MOVIMENTO_PX, 200, T0 + 100);
    expect(s.fase).toBe("attesa");
  });

  it("un movimento oltre la tolleranza prima della soglia annulla (scroll o swipe)", () => {
    const s = aggiornaMovimento(avviaTieniPremuto(100, 200, T0), 100, 200 + TOLLERANZA_MOVIMENTO_PX + 1, T0 + 100);
    expect(s.fase).toBe("annullato");
    expect(eSollevato(s)).toBe(false);
  });

  it("la tolleranza conta in diagonale (distanza, non i due assi separati)", () => {
    // 6 e 6: ciascuno sotto 8, insieme ~8,5
    const s = aggiornaMovimento(avviaTieniPremuto(100, 200, T0), 106, 206, T0 + 100);
    expect(s.fase).toBe("annullato");
  });

  it("annullato resta annullato anche se poi passa il tempo", () => {
    const s = aggiornaMovimento(avviaTieniPremuto(100, 200, T0), 120, 200, T0 + 100);
    expect(aggiornaTempo(s, SOLLEVA + 500).fase).toBe("annullato");
  });

  it("la tolleranza resta sotto la soglia di direzione dello swipe", () => {
    expect(TOLLERANZA_MOVIMENTO_PX).toBeLessThan(SOGLIA_DIREZIONE_PX);
  });

  it("rilascio prima della soglia: è un tap, il gesto non c'entra", () => {
    const s = aggiornaRilascio(avviaTieniPremuto(100, 200, T0), SOLLEVA - 1);
    expect(s.fase).toBe("annullato");
  });
});

describe("dopo il sollevamento: trascina o menu", () => {
  it("il dito si muove dentro la finestra: trascinamento", () => {
    const s = aggiornaMovimento(sollevato(), 100, 200 + TOLLERANZA_MOVIMENTO_PX + 1, SOLLEVA + 50);
    expect(s.fase).toBe("trascina");
  });

  it("la tolleranza si misura da dove era il dito al sollevamento", () => {
    // Prima del sollevamento il dito scivola di 7 px (ancora valido)...
    let s = aggiornaMovimento(avviaTieniPremuto(100, 200, T0), 107, 200, T0 + 200);
    s = aggiornaTempo(s, SOLLEVA);
    // ...poi di altri 2: 9 dall'inizio, ma solo 2 dal sollevamento.
    s = aggiornaMovimento(s, 109, 200, SOLLEVA + 50);
    expect(s.fase).toBe("sollevato");
  });

  it("fermo per tutta la finestra: menu", () => {
    const s = aggiornaTempo(sollevato(), SOLLEVA + FINESTRA_DECISIONE_MS);
    expect(s.fase).toBe("menu");
  });

  it("un millisecondo prima della fine della finestra non è ancora menu", () => {
    const s = aggiornaTempo(sollevato(), SOLLEVA + FINESTRA_DECISIONE_MS - 1);
    expect(s.fase).toBe("sollevato");
  });

  it("si alza senza essersi mosso, prima della fine della finestra: menu", () => {
    const s = aggiornaRilascio(sollevato(), SOLLEVA + 20);
    expect(s.fase).toBe("menu");
  });

  it("un movimento dopo che il menu è deciso non diventa trascinamento", () => {
    const menu = aggiornaTempo(sollevato(), SOLLEVA + FINESTRA_DECISIONE_MS);
    const s = aggiornaMovimento(menu, 100, 300, SOLLEVA + FINESTRA_DECISIONE_MS + 10);
    expect(s.fase).toBe("menu");
  });

  it("un movimento in ritardo rispetto al timer conta col tempo vero", () => {
    // Il timer della finestra non è ancora scattato, ma il movimento arriva
    // dopo la fine: il menu era già deciso.
    const s = aggiornaMovimento(sollevato(), 100, 300, SOLLEVA + FINESTRA_DECISIONE_MS + 5);
    expect(s.fase).toBe("menu");
  });

  it("rilascio durante il trascinamento: lasciato", () => {
    const trascina = aggiornaMovimento(sollevato(), 100, 260, SOLLEVA + 50);
    const s = aggiornaRilascio(trascina, SOLLEVA + 900);
    expect(s.fase).toBe("lasciato");
  });
});

describe("prossimaScadenza", () => {
  it("in attesa: il sollevamento; sollevato: la fine della finestra; poi niente", () => {
    expect(prossimaScadenza(avviaTieniPremuto(0, 0, T0))).toBe(SOLLEVA);
    expect(prossimaScadenza(sollevato())).toBe(SOLLEVA + FINESTRA_DECISIONE_MS);
    expect(prossimaScadenza(aggiornaTempo(sollevato(), SOLLEVA + FINESTRA_DECISIONE_MS))).toBeNull();
  });
});

describe("contextmenuApreMenu", () => {
  it("col dito ancora giù no (Android: il nostro gesto e quello nativo insieme)", () => {
    expect(contextmenuApreMenu(true, null)).toBe(false);
  });

  it("subito dopo un gesto sollevato no (Chrome che lo manda a dito alzato)", () => {
    expect(contextmenuApreMenu(false, 0)).toBe(false);
    expect(contextmenuApreMenu(false, SCADENZA_BLOCCO_CLICK_MS)).toBe(false);
  });

  it("senza gesto in corso né recente sì (tasto destro, tastiera)", () => {
    expect(contextmenuApreMenu(false, null)).toBe(true);
    expect(contextmenuApreMenu(false, SCADENZA_BLOCCO_CLICK_MS + 1)).toBe(true);
  });
});
