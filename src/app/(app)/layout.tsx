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
//
// Con la tastiera aperta (iOS) tab bar e barre in fondo restano coperte e il
// campo attivo sale sopra la tastiera: lo fa AreaContenuto, vedi
// src/lib/campoSopraTastiera.ts.

import type { ReactNode } from "react";
import BarraNavigazione from "@/components/BarraNavigazione";
import AreaContenuto from "@/components/AreaContenuto";

export default function LayoutApp({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <AreaContenuto>{children}</AreaContenuto>
      <BarraNavigazione />
    </div>
  );
}
