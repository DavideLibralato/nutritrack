// In cima all'elenco Impostazioni: la scheda dell'account, che porta a
// Impostazioni > Profilo. Iniziali in un cerchio pieno d'accento, nome, e
// sotto in grigio "78,4 kg · 180 cm" come l'intestazione del Profilo
// (ultima pesata e altezza SALVATE).
//
// Il nome viene dai metadati dell'account (useNomeUtente). Se manca, niente
// cerchio e al posto del nome "Profilo"; se mancano anche peso e altezza, il
// sottotitolo dice cosa c'è dentro.

import Link from "next/link";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

// Le iniziali delle prime due parole del nome: "Davide" → "D",
// "Davide Libralato" → "DL".
export function iniziali(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parola) => parola.charAt(0).toUpperCase())
    .join("");
}

function formattaNumero(n: number): string {
  return n.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

export default function SchedaAccount({
  nome,
  pesoKg,
  altezzaCm,
}: {
  nome: string | null;
  pesoKg: number | null;
  altezzaCm: number | null;
}) {
  const dettagli = [
    pesoKg != null ? `${formattaNumero(pesoKg)} kg` : null,
    altezzaCm != null ? `${formattaNumero(altezzaCm)} cm` : null,
  ].filter((parte) => parte !== null);

  return (
    <Link
      href="/impostazioni/profilo"
      className={`flex w-full items-center gap-3.5 rounded-[20px] border border-border bg-surface px-4 py-3.5 ${CLASSE_FOCUS}`}
    >
      {nome && (
        <span
          aria-hidden
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-accent-strong font-display text-[19px] font-bold text-on-strong"
        >
          {iniziali(nome)}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[19px] font-medium">{nome ?? "Profilo"}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">
          {dettagli.length > 0 ? dettagli.join(" · ") : "Dati personali e obiettivi"}
        </span>
      </span>
      <svg
        aria-hidden
        width="9"
        height="15"
        viewBox="0 0 9 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-muted opacity-70"
      >
        <path d="M1.5 1.5l6 6-6 6" />
      </svg>
    </Link>
  );
}
