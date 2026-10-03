// Un gruppo dell'elenco Impostazioni (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni"; mockup in docs/mockups/impostazioni.html): un riquadro
// arrotondato con le righe dentro, e sopra un titolo facoltativo piccolo,
// grigio e in maiuscolo ("ALIMENTAZIONE", "APP"). Sotto, una nota
// facoltativa in grigio (come le spiegazioni sotto i gruppi dell'iPhone).
//
// Lo sfondo è --superficie (bg-surface): in chiaro oggi è uguale allo
// sfondo della pagina, quindi il gruppo si vede dal bordo; il passo
// "superficie" lo renderà bianco.

import type { ReactNode } from "react";

export default function GruppoImpostazioni({
  titolo,
  nota,
  children,
}: {
  titolo?: string;
  nota?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="w-full">
      {titolo && (
        <h2 className="mb-2 ml-4 text-xs font-medium uppercase tracking-[0.1em] text-muted">
          {titolo}
        </h2>
      )}
      <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
        {children}
      </div>
      {nota && <div className="mx-4 mt-2 text-sm leading-snug text-muted">{nota}</div>}
    </section>
  );
}
