"use client";

// La tabella "Confronta i valori" di un doppione in arrivo
// (PUNTO_DI_PARTENZA.md §3 "Amici", "Condividere un alimento"; mockup
// docs/mockups/alimenti-in-arrivo.html, proposta B): il tuo e quello in
// arrivo, le cinque righe fisse più zuccheri, fibre, saturi e sale solo se
// diversi (righeConfronto), i valori diversi in arancio. Sotto, la nota su
// cosa fa "Usa questi valori".

import type { RigaConfronto } from "@/lib/catalogo/alimentiInArrivo";
import {
  ETICHETTE_CAMPI,
  NOTA_CONFRONTO,
  testoValoreConfronto,
} from "@/lib/catalogo/testiAlimentiInArrivo";

export default function TabellaConfronto({ righe, id }: { righe: RigaConfronto[]; id: string }) {
  return (
    <div id={id} className="mt-2">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="pb-1.5 text-left font-medium">
              Per 100 g
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              Il tuo
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              In arrivo
            </th>
          </tr>
        </thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.campo} className="border-t border-border">
              <th scope="row" className="py-1.5 text-left font-normal text-muted">
                {ETICHETTE_CAMPI[r.campo]}
              </th>
              <td className="py-1.5 text-right">{testoValoreConfronto(r.campo, r.mio)}</td>
              <td className={`py-1.5 text-right ${r.diverso ? "font-semibold text-warning" : ""}`}>
                {testoValoreConfronto(r.campo, r.inArrivo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{NOTA_CONFRONTO}</p>
    </div>
  );
}
