// La barra del Salva unico, in fondo alla pagina Profilo: una scheda
// staccata dai bordi, come la pillola della tab bar. `sticky` con `bottom`
// pari a --ingombro-tab-bar più --spazio-fra-barre (globals.css): a
// scorrere è il documento e la pillola è fissa, quindi la barra resta
// appena sopra la pillola finché la pagina continua sotto, e si ferma al
// suo posto quando si arriva in fondo.
//
// Compare SOLO quando ci sono modifiche da salvare (PUNTO_DI_PARTENZA.md,
// sezione 3, "Un solo Salva"): due elementi fluttuanti fissi sono troppi.
// Quando non serve è `invisible` ma occupa sempre il suo spazio, così quando
// compare non copre gli ultimi elementi (Ricarica, Esci) e la pagina non
// salta. Compare con una dissolvenza di 150 ms, niente con
// prefers-reduced-motion. Come la pillola, su telefono si nasconde anche
// mentre un campo ha il fuoco (`data-nascondi-mentre-scrivi`, regola in
// globals.css). Quando c'è, dice quali sezioni verranno aggiornate e offre
// "Annulla modifiche" per tornare ai valori salvati.

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
      data-visibile={daSalvare}
      style={{ boxShadow: "var(--ombra-fluttuante)" }}
      className={`sticky bottom-[calc(var(--ingombro-tab-bar)+var(--spazio-fra-barre))] z-30 order-last w-full max-w-md rounded-2xl border border-border bg-background px-4 py-3 transition-[opacity,visibility] duration-150 motion-reduce:transition-none ${
        daSalvare ? "visible opacity-100" : "invisible opacity-0"
      }`}
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
