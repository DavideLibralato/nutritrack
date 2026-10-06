// Tieni premuto su un alimento o sul nome di un pasto in Oggi
// (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto: sposta, duplica,
// elimina"): le decisioni del gesto, senza browser e senza React. Stesso
// approccio di decisioneSwipe.ts: posizioni e tempi dentro, fase fuori, così
// ogni soglia si testa senza simulare un dito. L'hook che le usa è in
// tieniPremuto.ts.
//
// Il gesto ha due tempi:
// 1. "attesa": il dito è giù. Se resta fermo per DURATA_PRESSIONE_MS la riga
//    si "solleva". Se si muove oltre TOLLERANZA_MOVIMENTO_PX prima, il gesto
//    si annulla e il dito torna allo scroll o allo swipe del giorno — la
//    tolleranza è più piccola della soglia con cui lo swipe decide la
//    direzione (SOGLIA_DIREZIONE_PX), quindi i due gesti non si contendono
//    mai lo stesso movimento. Un rilascio in attesa è un tap normale.
// 2. "sollevato": per FINESTRA_DECISIONE_MS si guarda cosa fa il dito. Si
//    muove oltre la tolleranza (misurata da dove era al sollevamento) →
//    "trascina". Resta fermo per tutta la finestra, o si alza → "menu".
//
// Fasi finali: "menu", "lasciato" (fine di un trascinamento) e "annullato".
// Da "menu" il dito che si muove non conta più: il menu è già deciso.

import { SCADENZA_BLOCCO_CLICK_MS } from "./decisioneSwipe";

// Pressione ferma che solleva la riga.
export const DURATA_PRESSIONE_MS = 450;
// Movimento oltre il quale il dito "si è mosso" (distanza, in px). Deve
// restare sotto SOGLIA_DIREZIONE_PX dello swipe, altrimenti i due gesti
// tornano ambigui: lo controlla un test in decisioneTieniPremuto.test.ts.
export const TOLLERANZA_MOVIMENTO_PX = 8;
// Dopo il sollevamento, il tempo per decidere fra trascinamento e menu.
export const FINESTRA_DECISIONE_MS = 160;

export type FaseTieniPremuto =
  | "attesa"
  | "sollevato"
  | "trascina"
  | "menu"
  | "lasciato"
  | "annullato";

export interface StatoTieniPremuto {
  fase: FaseTieniPremuto;
  // Dove e quando il dito è sceso (ms, px).
  t0: number;
  x0: number;
  y0: number;
  // Dove e quando la riga si è sollevata; null prima.
  tSollevato: number | null;
  xSollevato: number;
  ySollevato: number;
  // Ultima posizione nota del dito: serve al sollevamento, che arriva da un
  // timer e non da un movimento.
  x: number;
  y: number;
}

export function avviaTieniPremuto(x: number, y: number, t: number): StatoTieniPremuto {
  return {
    fase: "attesa",
    t0: t,
    x0: x,
    y0: y,
    tSollevato: null,
    xSollevato: x,
    ySollevato: y,
    x,
    y,
  };
}

function oltreTolleranza(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > TOLLERANZA_MOVIMENTO_PX;
}

// Il tempo che passa, senza movimento (lo chiama un timer). Porta da
// "attesa" a "sollevato" e da "sollevato" a "menu" quando scadono le soglie.
export function aggiornaTempo(s: StatoTieniPremuto, t: number): StatoTieniPremuto {
  if (s.fase === "attesa" && t - s.t0 >= DURATA_PRESSIONE_MS) {
    return { ...s, fase: "sollevato", tSollevato: t, xSollevato: s.x, ySollevato: s.y };
  }
  if (s.fase === "sollevato" && s.tSollevato !== null && t - s.tSollevato >= FINESTRA_DECISIONE_MS) {
    return { ...s, fase: "menu" };
  }
  return s;
}

// Il dito si è mosso. Prima si fa avanzare il tempo: un movimento che arriva
// dopo la soglia (il timer non è ancora scattato) conta come dopo.
export function aggiornaMovimento(
  stato: StatoTieniPremuto,
  x: number,
  y: number,
  t: number
): StatoTieniPremuto {
  const s = { ...aggiornaTempo(stato, t), x, y };
  if (s.fase === "attesa" && oltreTolleranza(x - s.x0, y - s.y0)) {
    return { ...s, fase: "annullato" };
  }
  if (s.fase === "sollevato" && oltreTolleranza(x - s.xSollevato, y - s.ySollevato)) {
    return { ...s, fase: "trascina" };
  }
  return s;
}

// Il dito si è alzato.
export function aggiornaRilascio(stato: StatoTieniPremuto, t: number): StatoTieniPremuto {
  const s = aggiornaTempo(stato, t);
  switch (s.fase) {
    case "attesa":
      return { ...s, fase: "annullato" }; // un tap: ci pensa il click normale
    case "sollevato":
      return { ...s, fase: "menu" }; // alzato senza essersi mosso
    case "trascina":
      return { ...s, fase: "lasciato" };
    default:
      return s;
  }
}

// La riga si è staccata: da qui il dito appartiene al gesto (niente scroll,
// niente swipe del giorno, niente click dopo).
export function eSollevato(s: StatoTieniPremuto): boolean {
  return s.fase !== "attesa" && s.fase !== "annullato";
}

// Fra quanto il timer deve richiamare aggiornaTempo; null se non serve più.
export function prossimaScadenza(s: StatoTieniPremuto): number | null {
  if (s.fase === "attesa") return s.t0 + DURATA_PRESSIONE_MS;
  if (s.fase === "sollevato" && s.tSollevato !== null) return s.tSollevato + FINESTRA_DECISIONE_MS;
  return null;
}

// L'evento `contextmenu` (tasto destro, Maiusc+F10, tasto Menu, e il
// tieni-premuto nativo di Android) apre il nostro menu direttamente — ma non
// se c'è un gesto col dito ancora in corso: su Android il tieni-premuto
// nativo arriva mentre il nostro sta già decidendo, e aprirebbe il menu una
// seconda volta. Né subito dopo la fine di un gesto sollevato: alcune
// versioni di Chrome lo mandano quando il dito si è già alzato. La finestra
// è la stessa del click bloccato dopo un trascinamento. Il menu nativo del
// browser va comunque soppresso.
// `msDaUltimoSollevato`: ms dalla fine dell'ultimo gesto che ha sollevato
// una riga, null se non ce n'è stato uno.
export function contextmenuApreMenu(
  gestoInCorso: boolean,
  msDaUltimoSollevato: number | null
): boolean {
  if (gestoInCorso) return false;
  return msDaUltimoSollevato === null || msDaUltimoSollevato > SCADENZA_BLOCCO_CLICK_MS;
}
