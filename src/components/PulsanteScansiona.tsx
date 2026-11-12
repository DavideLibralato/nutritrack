// Il pulsante Scansiona accanto alla ricerca (PUNTO_DI_PARTENZA.md §3,
// "Codice a barre"; mockup A): tondo da 48 px come il campo, pieno
// d'accento. Senza rete spento, grigio con il bordo tratteggiato e con la
// sua etichetta, come nel mockup "Senza rete"; la riga che dice perché la
// mette la pagina. Spostato da src/app/aggiungi/page.tsx con le stesse
// classi (12/11); dal commit 5 di `alimenti-aspetto` lo usa anche
// Impostazioni > Alimenti.
//
// `onClick` lo passa la pagina e deve chiedere la fotocamera
// (richiediFotocamera) come PRIMA cosa del tocco: nell'app installata iOS
// non chiedeva il permesso quando la richiesta partiva dopo il ridisegno
// (07/11).

import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IconaCodiceBarre from "@/components/IconaCodiceBarre";

const CLASSE_SCANSIONA = `flex size-12 shrink-0 items-center justify-center rounded-full ${CLASSE_FOCUS}`;
const CLASSE_SCANSIONA_ATTIVO = "bg-accent-strong text-on-strong";
const CLASSE_SCANSIONA_SPENTO = "border border-dashed border-border bg-surface text-muted";

export default function PulsanteScansiona({
  online,
  onClick,
}: {
  online: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!online}
      aria-label={
        online ? "Scansiona il codice a barre" : "Scansione non disponibile senza connessione"
      }
      className={`${CLASSE_SCANSIONA} ${online ? CLASSE_SCANSIONA_ATTIVO : CLASSE_SCANSIONA_SPENTO}`}
    >
      <IconaCodiceBarre />
    </button>
  );
}
