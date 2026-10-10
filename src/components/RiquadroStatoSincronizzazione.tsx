// Il riquadro in cima a Impostazioni > Sincronizzazione (mockup approvato
// il 10/10, docs/mockups/sincronizzazione.html, pagina "A · Riquadro"):
// icona in un cerchio colorato, titolo, testo e, sotto, "da quando" o
// "controllato alle". I testi arrivano già pronti (testiStato, in
// src/lib/sync/testiSincronizzazione.ts); qui solo l'aspetto.
//
// Colori dai token del tema (sezione 7), mai scritti a mano: verde
// (accent) per tutto a posto e in corso, ocra (pending) per in attesa,
// arancio (warning) per sessione scaduta, server che rifiuta e accantonate.
//
// role="status": uno screen reader legge il cambio di stato quando avviene,
// senza spostare il fuoco.

import type { IconaStato, TestiStato, Tono } from "@/lib/sync/testiSincronizzazione";

// Classi scritte per intero: Tailwind genera solo quelle che trova nel
// codice così come sono.
const CERCHIO: Record<Tono, string> = {
  accento: "bg-accent/15 text-accent",
  attesa: "bg-pending/15 text-pending",
  avviso: "bg-warning/15 text-warning",
};

export default function RiquadroStatoSincronizzazione({ testi }: { testi: TestiStato }) {
  return (
    <section
      role="status"
      className="flex w-full flex-col items-center gap-1.5 rounded-[20px] border border-border bg-surface px-4 py-5 text-center"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${CERCHIO[testi.tono]}`}
        aria-hidden="true"
      >
        <Icona icona={testi.icona} />
      </div>
      <h2 className="mt-1.5 text-balance text-lg font-bold">{testi.titolo}</h2>
      <p className="max-w-[34ch] text-sm leading-snug text-muted">{testi.testo}</p>
      {testi.quando && <p className="text-xs tabular-nums text-muted">{testi.quando}</p>}
    </section>
  );
}

const TRATTO = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icona({ icona }: { icona: IconaStato }) {
  switch (icona) {
    case "in-corso":
      // Il cerchio che gira; fermo per chi ha chiesto meno movimento.
      return (
        <span className="h-[22px] w-[22px] animate-spin rounded-full border-[2.5px] border-accent/25 border-t-accent motion-reduce:animate-none" />
      );
    case "fatto":
      return (
        <svg {...TRATTO}>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      );
    case "senza-rete":
      return (
        <svg {...TRATTO}>
          <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z" />
          <path d="M3 3l18 18" />
        </svg>
      );
    case "avviso":
      return (
        <svg {...TRATTO}>
          <path d="M12 8v5M12 16.5v.5" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "chiave":
      return (
        <svg {...TRATTO}>
          <circle cx="8" cy="12" r="3.5" />
          <path d="M11.5 12H21M17 12v3M20 12v2" />
        </svg>
      );
  }
}
