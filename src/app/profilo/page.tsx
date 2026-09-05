"use client";

// Dexie vive solo nel browser (IndexedDB), quindi questa pagina è client.
//
// useLiveQuery (dexie-react-hooks) esegue la query e ridisegna da solo il
// componente ogni volta che i dati in Dexie cambiano — non serve un
// useEffect che rilegge a mano dopo ogni salvataggio, come si farebbe con
// una fetch normale.

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { repositoryProfili } from "@/lib/repository";
import type { LivelloAttivita, Sesso } from "@/lib/db/tipi";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const OPZIONI_SESSO: { valore: Sesso; etichetta: string }[] = [
  { valore: "maschio", etichetta: "Uomo" },
  { valore: "femmina", etichetta: "Donna" },
  { valore: "non_indicato", etichetta: "Preferisco non indicarlo" },
];

const OPZIONI_ATTIVITA: { valore: LivelloAttivita; etichetta: string }[] = [
  { valore: "sedentario", etichetta: "Sedentario" },
  { valore: "leggero", etichetta: "Leggero (1-3 allenamenti a settimana)" },
  { valore: "moderato", etichetta: "Moderato (3-5 allenamenti a settimana)" },
  { valore: "attivo", etichetta: "Attivo (6-7 allenamenti a settimana)" },
  { valore: "molto_attivo", etichetta: "Molto attivo (lavoro fisico o due allenamenti al giorno)" },
];

export default function ProfiloPage() {
  const userId = useUtenteId();

  const profilo = useLiveQuery(async () => {
    if (!userId) return null;
    const righe = await repositoryProfili.ottieniTutti(userId);
    return righe[0] ?? null;
  }, [userId]);

  const [inizializzato, setInizializzato] = useState(false);
  const [sesso, setSesso] = useState<Sesso>("non_indicato");
  const [dataNascita, setDataNascita] = useState("");
  const [altezzaCm, setAltezzaCm] = useState("");
  const [livelloAttivita, setLivelloAttivita] = useState<LivelloAttivita | "">("");
  const [salvataggio, setSalvataggio] = useState<"inattivo" | "in-corso" | "salvato" | "errore">(
    "inattivo"
  );

  // Popola il form una sola volta, quando il profilo esistente (se c'è)
  // arriva da Dexie. Dopo, i campi seguono solo quello che digita l'utente:
  // non vogliamo che un futuro ri-render sovrascriva a metà digitazione.
  useEffect(() => {
    if (profilo === undefined || inizializzato) return;

    if (profilo) {
      setSesso(profilo.sesso);
      setDataNascita(profilo.data_nascita ?? "");
      setAltezzaCm(profilo.altezza_cm != null ? String(profilo.altezza_cm) : "");
      setLivelloAttivita(profilo.livello_attivita ?? "");
    }

    setInizializzato(true);
  }, [profilo, inizializzato]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSalvataggio("in-corso");

    const campi = {
      sesso,
      data_nascita: dataNascita || null,
      altezza_cm: altezzaCm ? Number(altezzaCm) : null,
      livello_attivita: livelloAttivita || null,
    };

    try {
      if (profilo) {
        await repositoryProfili.aggiorna(profilo.id, campi);
      } else {
        await repositoryProfili.crea({ user_id: userId, ...campi });
      }
      setSalvataggio("salvato");
    } catch {
      setSalvataggio("errore");
    }
  }

  if (userId === undefined || profilo === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 py-8">
        <h1 className="text-2xl font-display font-bold">Profilo</h1>

        <div>
          <span className="block text-sm font-medium mb-1">Sesso</span>
          <div className="flex gap-2">
            {OPZIONI_SESSO.map((opzione) => (
              <button
                key={opzione.valore}
                type="button"
                onClick={() => setSesso(opzione.valore)}
                aria-pressed={sesso === opzione.valore}
                className={`flex-1 rounded-lg border p-2 text-sm ${CLASSE_FOCUS} ${
                  sesso === opzione.valore
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground"
                }`}
              >
                {opzione.etichetta}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="profilo-data-nascita" className="block text-sm font-medium mb-1">
            Data di nascita
          </label>
          <input
            id="profilo-data-nascita"
            type="date"
            value={dataNascita}
            onChange={(e) => setDataNascita(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="profilo-altezza" className="block text-sm font-medium mb-1">
            Altezza (cm)
          </label>
          <input
            id="profilo-altezza"
            type="number"
            inputMode="numeric"
            min={0}
            max={280}
            value={altezzaCm}
            onChange={(e) => setAltezzaCm(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="profilo-attivita" className="block text-sm font-medium mb-1">
            Livello di attività
          </label>
          <select
            id="profilo-attivita"
            value={livelloAttivita}
            onChange={(e) => setLivelloAttivita(e.target.value as LivelloAttivita)}
            className={`w-full rounded-lg border border-border p-2 bg-background ${CLASSE_FOCUS}`}
          >
            <option value="">Non impostato</option>
            {OPZIONI_ATTIVITA.map((opzione) => (
              <option key={opzione.valore} value={opzione.valore}>
                {opzione.etichetta}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={salvataggio === "in-corso"}
          className={`w-full rounded-lg bg-accent p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {salvataggio === "in-corso" ? "Salvataggio..." : "Salva"}
        </button>

        {salvataggio === "salvato" && (
          <p className="text-sm text-accent">Salvato.</p>
        )}
        {salvataggio === "errore" && (
          <p className="text-sm text-warning">Salvataggio non riuscito. Riprova.</p>
        )}
      </form>
    </main>
  );
}
