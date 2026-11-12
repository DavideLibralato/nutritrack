// Le classi delle righe nei riquadri (PUNTO_DI_PARTENZA.md §3, "Aggiungi
// alimento", "Aspetto"; mockup docs/mockups/aggiungi.html, proposta A).
// Una sola definizione per Aggiungi (Recenti, Preferiti, risultati della
// ricerca) e, dal commit 5 di `alimenti-aspetto`, per Impostazioni >
// Alimenti, così le liste non possono divergere. Spostate da
// src/app/aggiungi/page.tsx con il testo identico (12/11).

import { CLASSE_FOCUS } from "@/lib/classeFocus";

// Le righe stanno in riquadri come i gruppi di Impostazioni
// (GruppoImpostazioni: bg-surface, bordo, angoli da 20 px), separate da
// una linea.
export const CLASSE_RIQUADRO =
  "overflow-hidden rounded-[20px] border border-border bg-surface divide-y divide-border";
// Riga alta almeno 60 px; a destra 6 px di margine per i pulsanti tondi.
export const CLASSE_RIGA = "flex min-h-[60px] items-center gap-1.5 py-1.5 pr-1.5 pl-3.5";
// Il nome occupa tutta l'altezza della riga: il tocco arriva anche sopra e
// sotto il testo.
export const CLASSE_NOME_RIGA = `flex min-w-0 flex-1 flex-col justify-center self-stretch rounded-lg text-left ${CLASSE_FOCUS}`;
export const CLASSE_SOTTOTITOLO_RIGA = "mt-0.5 text-[13px] text-muted tabular-nums";
// La matita da 44 pt (size-11), il minimo di Apple per un tocco sicuro.
export const CLASSE_MATITA = `flex size-11 shrink-0 items-center justify-center rounded-full text-muted ${CLASSE_FOCUS}`;
