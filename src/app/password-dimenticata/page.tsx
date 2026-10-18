"use client";

import { useState } from "react";
import { chiediLinkRipristino } from "@/lib/supabase/clientRichiestaReset";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { emailValida } from "@/lib/validazione";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { CLASSE_TITOLO_ACCESSO } from "@/lib/classiAccesso";
import PaginaAccesso from "@/components/PaginaAccesso";

export default function PasswordDimenticataPage() {
  const [email, setEmail] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);
  const [inviato, setInviato] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    const emailPulita = email.trim();
    if (!emailPulita) {
      setErrore("Inserisci la tua email.");
      return;
    }
    if (!emailValida(emailPulita)) {
      setErrore("Inserisci un indirizzo email valido.");
      return;
    }

    setCaricamento(true);

    // Flusso implicito: il link funziona da qualunque browser
    // (clientRichiestaReset.ts).
    const { error } = await chiediLinkRipristino(
      emailPulita,
      `${window.location.origin}/reimposta-password`
    );

    setCaricamento(false);

    if (error) {
      setErrore(traduciErroreAuth(error.message));
      return;
    }

    setInviato(true);
  }

  if (inviato) {
    return (
      <PaginaAccesso marchioInCima>
        <div className="w-full max-w-sm space-y-4">
          <h1 className={CLASSE_TITOLO_ACCESSO}>Controlla la tua email</h1>
          <p className="text-sm text-muted">
            Se esiste un account con questa email, ti abbiamo inviato un link per
            reimpostare la password.
          </p>
          <a href="/login" className={`underline rounded text-foreground ${CLASSE_FOCUS}`}>
            Torna al login
          </a>
        </div>
      </PaginaAccesso>
    );
  }

  return (
    <PaginaAccesso marchioInCima>
      <form noValidate onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className={CLASSE_TITOLO_ACCESSO}>Password dimenticata</h1>
        <p className="text-sm text-muted">
          Inserisci la tua email: ti mandiamo un link per sceglierne una nuova.
        </p>

        <div>
          <label htmlFor="recupero-email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="recupero-email"
            type="email"
            autoComplete="email"
            placeholder="tuonome@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        {errore && <p className="text-sm text-warning">{errore}</p>}

        <button
          type="submit"
          disabled={caricamento}
          className={`w-full rounded-lg bg-accent-strong p-2 text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {caricamento ? "Invio..." : "Invia link"}
        </button>

        <p className="text-sm text-muted">
          <a href="/login" className={`underline rounded text-foreground ${CLASSE_FOCUS}`}>
            Torna al login
          </a>
        </p>
      </form>
    </PaginaAccesso>
  );
}
