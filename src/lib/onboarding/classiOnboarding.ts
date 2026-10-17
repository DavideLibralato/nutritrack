// Le classi comuni ai passi dell'onboarding, dallo stile B del mockup
// (docs/mockups/onboarding.html, "Di benvenuto"): una domanda per
// schermata, campi grandi. Misure del mockup, colori solo dalle variabili
// di globals.css (PUNTO_DI_PARTENZA.md, sezione 7).

import { CLASSE_FOCUS } from "../classeFocus";

// La domanda del passo (.B .domanda).
export const CLASSE_DOMANDA =
  "mt-[22px] mb-2.5 font-display text-[36px] leading-[1.08] font-bold tracking-[-0.01em] text-balance";

// La riga sotto la domanda (.B .sotto).
export const CLASSE_SOTTO = "mb-6 text-[15.5px] leading-[1.45] text-muted";

// L'etichetta di un campo (.B .etich).
export const CLASSE_ETICHETTA = "mx-0.5 mb-2 block text-[13px] font-semibold text-muted";

// Il riquadro bianco di un campo (.B .campo) e il campo dentro, a 17 px:
// mai sotto i 16 px, sotto Safari ingrandisce la pagina quando lo si tocca.
export const CLASSE_RIQUADRO_CAMPO =
  "flex min-h-[54px] items-center justify-between gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3";
export const CLASSE_CAMPO = `w-full min-w-0 rounded bg-transparent text-[17px] tabular-nums ${CLASSE_FOCUS}`;

// Una nota piccola (.nota).
export const CLASSE_NOTA = "text-[13.5px] leading-[1.45] text-muted";
