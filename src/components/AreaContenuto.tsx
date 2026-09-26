"use client";

// L'area che scorre sopra la tab bar, nel layout "(app)". Componente client
// a parte perché il layout è un componente server, e qui servono un ref e
// un hook del browser: useCampoSopraTastiera (src/lib/campoSopraTastiera.ts)
// tiene la tab bar e le barre in fondo sotto la tastiera, e porta in vista
// il campo attivo scorrendo quest'area.

import { useRef, type ReactNode } from "react";
import { useCampoSopraTastiera } from "@/lib/campoSopraTastiera";

export default function AreaContenuto({ children }: { children: ReactNode }) {
  const rifArea = useRef<HTMLDivElement>(null);
  const spazioTastiera = useCampoSopraTastiera(rifArea);

  return (
    <div ref={rifArea} className="min-h-0 flex-1 overflow-y-auto">
      {children}
      {/* Spazio alto quanto la tastiera, solo mentre è aperta su un campo di
          quest'area: anche l'ultimo campo della pagina può salire sopra di
          lei. */}
      {spazioTastiera > 0 && <div aria-hidden style={{ height: spazioTastiera }} />}
    </div>
  );
}
