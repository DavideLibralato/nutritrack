"use client";

import { useState } from "react";
import { aggiornaObiettivi, cambiaPassword, esci } from "@/lib/actions/profilo";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";
const CLASSE_INPUT = `w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`;
const CLASSE_BOTTONE = `rounded-lg bg-foreground px-4 py-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`;

type Obiettivi = {
  obiettivo_kcal: number;
  obiettivo_proteine: number;
  obiettivo_carboidrati: number;
  obiettivo_grassi: number;
};

// Componente "client" (gira nel browser, non sul server) perche' deve
// reagire ai click e agli input dell'utente in tempo reale (useState).
// Riceve dal componente server (la pagina) solo i valori iniziali gia'
// letti da Supabase, cosi' evitiamo un'altra chiamata al database qui.
export default function FormProfilo({ obiettiviIniziali }: { obiettiviIniziali: Obiettivi }) {
  return (
    <div className="flex flex-col gap-8 max-w-sm">
      <FormObiettivi obiettiviIniziali={obiettiviIniziali} />
      <FormPassword />
      <FormLogout />
    </div>
  );
}

function FormObiettivi({ obiettiviIniziali }: { obiettiviIniziali: Obiettivi }) {
  const [kcal, setKcal] = useState(String(obiettiviIniziali.obiettivo_kcal));
  const [proteine, setProteine] = useState(String(obiettiviIniziali.obiettivo_proteine));
  const [carboidrati, setCarboidrati] = useState(String(obiettiviIniziali.obiettivo_carboidrati));
  const [grassi, setGrassi] = useState(String(obiettiviIniziali.obiettivo_grassi));
  const [errore, setErrore] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setMessaggio(null);
    setSalvataggio(true);

    const risultato = await aggiornaObiettivi({
      obiettivoKcal: Number(kcal),
      obiettivoProteine: Number(proteine),
      obiettivoCarboidrati: Number(carboidrati),
      obiettivoGrassi: Number(grassi),
    });

    setSalvataggio(false);

    if (risultato?.errore) {
      setErrore(risultato.errore);
      return;
    }
    setMessaggio("Obiettivi aggiornati.");
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display font-medium">Obiettivi giornalieri</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <CampoNumero id="obiettivo-kcal" etichetta="Kcal" valore={kcal} onChange={setKcal} />
        <CampoNumero id="obiettivo-proteine" etichetta="Proteine (g)" valore={proteine} onChange={setProteine} />
        <CampoNumero id="obiettivo-carboidrati" etichetta="Carboidrati (g)" valore={carboidrati} onChange={setCarboidrati} />
        <CampoNumero id="obiettivo-grassi" etichetta="Grassi (g)" valore={grassi} onChange={setGrassi} />

        {errore && <p className="text-sm text-red-600">{errore}</p>}
        {messaggio && <p className="text-sm text-muted">{messaggio}</p>}

        <button type="submit" disabled={salvataggio} className={CLASSE_BOTTONE}>
          {salvataggio ? "Salvataggio..." : "Salva obiettivi"}
        </button>
      </form>
    </section>
  );
}

function CampoNumero({
  id,
  etichetta,
  valore,
  onChange,
}: {
  id: string;
  etichetta: string;
  valore: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {etichetta}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={valore}
        onChange={(e) => onChange(e.target.value)}
        required
        className={CLASSE_INPUT}
      />
    </div>
  );
}

function FormPassword() {
  const [nuovaPassword, setNuovaPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setMessaggio(null);

    if (nuovaPassword !== confermaPassword) {
      setErrore("Le due password non coincidono.");
      return;
    }

    setSalvataggio(true);
    const risultato = await cambiaPassword(nuovaPassword);
    setSalvataggio(false);

    if (risultato?.errore) {
      setErrore(risultato.errore);
      return;
    }
    setNuovaPassword("");
    setConfermaPassword("");
    setMessaggio("Password aggiornata.");
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display font-medium">Cambia password</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="nuova-password" className="block text-sm font-medium mb-1">
            Nuova password
          </label>
          <input
            id="nuova-password"
            type="password"
            minLength={6}
            placeholder="Almeno 6 caratteri"
            value={nuovaPassword}
            onChange={(e) => setNuovaPassword(e.target.value)}
            required
            className={CLASSE_INPUT}
          />
        </div>
        <div>
          <label htmlFor="conferma-password" className="block text-sm font-medium mb-1">
            Conferma nuova password
          </label>
          <input
            id="conferma-password"
            type="password"
            minLength={6}
            value={confermaPassword}
            onChange={(e) => setConfermaPassword(e.target.value)}
            required
            className={CLASSE_INPUT}
          />
        </div>

        {errore && <p className="text-sm text-red-600">{errore}</p>}
        {messaggio && <p className="text-sm text-muted">{messaggio}</p>}

        <button type="submit" disabled={salvataggio} className={CLASSE_BOTTONE}>
          {salvataggio ? "Salvataggio..." : "Aggiorna password"}
        </button>
      </form>
    </section>
  );
}

function FormLogout() {
  // Questo form non ha bisogno di useState: chiama direttamente la server
  // action "esci" quando viene inviato (action={esci} invece di onSubmit).
  return (
    <section className="flex flex-col gap-3 pt-2 border-t border-border">
      <form action={esci}>
        <button
          type="submit"
          className={`rounded-lg border border-border px-4 py-2 ${CLASSE_FOCUS}`}
        >
          Esci
        </button>
      </form>
    </section>
  );
}
