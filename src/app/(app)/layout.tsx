// Layout condiviso delle schermate con la tab bar (Oggi, Statistiche,
// Profilo). Le parentesi in "(app)" fanno di questa cartella un *route
// group*: raggruppa più pagine sotto un layout comune senza aggiungere
// nulla all'URL — "/" resta "/" e "/profilo" resta "/profilo".
//
// Login e registrazione stanno fuori da questo gruppo, quindi non ereditano
// la tab bar.
//
// Struttura: una colonna alta quanto lo schermo, con l'area contenuto che
// scorre e la tab bar fissa sotto. La pagina Oggi, al suo interno, si
// riprende questa altezza per fare le sue tre fasce (solo quella centrale
// scorre); una pagina lunga come Profilo scorre invece qui dentro.

import type { ReactNode } from "react";
import BarraNavigazione from "@/components/BarraNavigazione";

export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <BarraNavigazione />
    </div>
  );
}
