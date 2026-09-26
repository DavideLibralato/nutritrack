// La barra del Salva unico, in fondo alla pagina Profilo. `sticky` con
// `bottom` pari a --altezza-tab-bar (globals.css): a scorrere è il documento
// e la tab bar è fissa in fondo, quindi la barra resta attaccata appena sopra
// la tab bar finché la pagina continua sotto, e si ferma al suo posto quando
// si arriva in fondo. Come la tab bar, su telefono si nasconde mentre un
// campo ha il fuoco (`data-nascondi-mentre-scrivi`, regola in globals.css):
// resta invisibile ma occupa il suo spazio, così la pagina non salta.
//
// Inerte quando non c'è niente da salvare; altrimenti dice quali sezioni
// verranno aggiornate, e offre "Annulla modifiche" per tornare ai valori
// salvati senza dover ricaricare niente.

import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { ETICHETTE_SEZIONI, type Sezione } from "@/lib/profilo/salvataggioProfilo";

export default function BarraSalvaProfilo({
  sezioni,
  inCorso,
  messaggio,
  onAnnulla,
  onSalva,
}: {
  sezioni: Sezione[];
  inCorso: boolean;
  // Esito dell'ultimo tentativo (salvato, errore, campi da correggere).
  messaggio: { testo: string; avviso: boolean } | null;
  onAnnulla: () => void;
  onSalva: () => void;
}) {
  const daSalvare = sezioni.length > 0;

  return (
    <div
      data-nascondi-mentre-scrivi
      className="sticky bottom-[var(--altezza-tab-bar)] z-10 order-last -mx-4 w-[calc(100%+2rem)] border-t border-border bg-background px-4 py-3"
    >
      <div className="mx-auto w-full max-w-sm space-y-2">
        {/* role="status": lo screen reader legge quali sezioni verranno
            aggiornate e l'esito, quando cambiano. */}
        <div role="status" className="text-sm">
          {messaggio ? (
            <p className={messaggio.avviso ? "text-warning" : "text-accent"}>{messaggio.testo}</p>
          ) : daSalvare ? (
            <p>
              Verranno aggiornati:{" "}
              <span className="font-medium">
                {sezioni.map((s) => ETICHETTE_SEZIONI[s]).join(", ")}
              </span>
            </p>
          ) : (
            <p className="text-muted">Nessuna modifica da salvare.</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onAnnulla}
            disabled={!daSalvare || inCorso}
            className={`flex-1 rounded-lg border border-border p-2 disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            Annulla modifiche
          </button>
          <button
            type="button"
            onClick={onSalva}
            disabled={!daSalvare || inCorso}
            className={`flex-1 rounded-lg bg-accent p-2 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            {inCorso ? "Salvataggio..." : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
