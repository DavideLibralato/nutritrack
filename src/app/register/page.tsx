"use client";

// useActionState (React 19) collega un form direttamente a una Server
// Action: niente onSubmit/fetch manuale, il form chiama registrati() da
// solo. `stato` è quello che l'ultima chiamata ha restituito, `inCorso`
// diventa true mentre la Server Action sta girando sul server.
import { useActionState } from "react";
import { registrati, type StatoRegistrazione } from "@/lib/actions/auth";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const STATO_INIZIALE: StatoRegistrazione = { errore: null, messaggio: null };

export default function RegisterPage() {
  const [stato, azioneForm, inCorso] = useActionState(registrati, STATO_INIZIALE);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={azioneForm} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-display font-bold">Registrati</h1>
        <p className="text-sm text-muted">
          Beta chiusa: serve il codice di invito che ti hanno dato.
        </p>

        <div>
          <label htmlFor="register-nome" className="block text-sm font-medium mb-1">
            Nome
          </label>
          <input
            id="register-nome"
            name="nome"
            type="text"
            autoComplete="name"
            placeholder="Come ti chiami"
            required
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="register-email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tuonome@esempio.it"
            required
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="register-password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Almeno 6 caratteri"
            required
            minLength={6}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="register-codice-invito" className="block text-sm font-medium mb-1">
            Codice di invito
          </label>
          <input
            id="register-codice-invito"
            name="codiceInvito"
            type="text"
            autoComplete="off"
            placeholder="Il codice che ti hanno dato"
            required
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        {stato.errore && <p className="text-sm text-warning">{stato.errore}</p>}
        {stato.messaggio && <p className="text-sm text-accent">{stato.messaggio}</p>}

        <button
          type="submit"
          disabled={inCorso}
          className={`w-full rounded-lg bg-accent p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {inCorso ? "Attendere..." : "Crea account"}
        </button>

        <p className="text-sm text-muted">
          Hai già un account?{" "}
          <a href="/login" className={`underline rounded text-foreground ${CLASSE_FOCUS}`}>
            Accedi
          </a>
        </p>
      </form>
    </main>
  );
}
