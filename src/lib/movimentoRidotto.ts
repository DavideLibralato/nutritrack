// prefers-reduced-motion ("Riduci movimento" su iPhone): con questa
// preferenza i gesti valgono lo stesso, ma niente si anima. Condiviso dallo
// swipe del giorno (swipeGiorno.ts) e dal trascinamento (trascinaInPasto.ts).
export function movimentoRidotto(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
