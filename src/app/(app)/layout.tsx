// Layout condiviso delle schermate con la tab bar (Oggi, Statistiche,
// Impostazioni e le sue sotto-pagine). Le parentesi in "(app)" fanno di
// questa cartella un *route group*: raggruppa più pagine sotto un layout
// comune senza aggiungere nulla all'URL — "/" resta "/" e "/impostazioni"
// resta "/impostazioni".
//
// Login e registrazione stanno fuori da questo gruppo, quindi non ereditano
// la tab bar.
//
// Struttura: la tab bar è una pillola `position: fixed` che galleggia sopra
// il fondo (BarraNavigazione). Lo spazio in fondo lo lascia ogni pagina, non
// questo layout, perché le pagine non scorrono allo stesso modo:
// - Profilo e Statistiche: scorre il DOCUMENTO; in fondo lasciano
//   --ingombro-tab-bar (globals.css), così l'ultima riga non finisce dietro
//   la pillola;
// - Oggi: alta esattamente lo schermo, scorre solo la sua lista, che arriva
//   fino in fondo passando sotto "+ Aggiungi" e la pillola, con il suo
//   spazio in fondo (--ingombro-oggi). Se lo lasciasse anche il layout, il
//   documento scorrerebbe di quello spazio.
//
// Tastiera di iPhone: a volte iOS fa scorrere il documento e le barre fisse
// restano sotto la tastiera, altre volte sposta la finestra e le barre
// salgono sopra la tastiera. Il layout non basta a impedirlo, quindi mentre
// un campo ha il fuoco la tab bar e la barra Salva si nascondono (regola in
// globals.css; PUNTO_DI_PARTENZA.md, sezione 3, "Layout delle pagine con la
// tab bar").
//
// `flex-1 flex-col`: il <body> è già una colonna alta almeno lo schermo, e
// questo contenitore la riempie, così una pagina corta (Statistiche) può
// centrarsi con `flex-1` nello spazio sopra la pillola.

//
// GuardianoModifiche avvolge sia le pagine sia la tab bar: è il contesto
// delle modifiche non salvate, e la tab bar deve poterlo leggere per non
// lasciar uscire da una pagina con modifiche senza chiedere. Per questo sta
// qui e non in impostazioni/layout.tsx, che non contiene la tab bar.
// Questo file resta un componente server: GuardianoModifiche è un
// componente client e le pagine gli passano attraverso come `children`.

import type { ReactNode } from "react";
import BarraNavigazione from "@/components/BarraNavigazione";
import GuardianoModifiche from "@/components/GuardianoModifiche";

export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <GuardianoModifiche>
      <div className="flex flex-1 flex-col">{children}</div>
      <BarraNavigazione />
    </GuardianoModifiche>
  );
}
