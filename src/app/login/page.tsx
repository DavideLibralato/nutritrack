"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { emailValida } from "@/lib/validazione";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// useSearchParams() (sotto, in LoginForm) puo' andare in stallo durante il
// primo render sul server se non e' avvolto in una <Suspense>: Next.js lo
// richiede esplicitamente, altrimenti la build da' errore.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    // Validazione in italiano: senza noValidate sul form, il browser
    // mostrerebbe qui i suoi messaggi nativi, che sono nella lingua del
    // browser (spesso inglese) e non in quella dell'app.
    if (!email.trim()) {
      setErrore("Inserisci la tua email.");
      return;
    }
    if (!emailValida(email)) {
      setErrore("Inserisci un indirizzo email valido.");
      return;
    }
    if (!password) {
      setErrore("Inserisci la tua password.");
      return;
    }

    setCaricamento(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setCaricamento(false);

    if (error) {
      setErrore(traduciErroreAuth(error.message));
      return;
    }

    // Se il middleware ci ha mandato qui perche' l'utente ha provato ad
    // aprire una pagina protetta senza essere loggato, dopo il login lo
    // riportiamo li' invece che sempre alla home.
    const redirectTo = searchParams.get("redirectTo");
    router.push(redirectTo && redirectTo.startsWith("/") ? redirectTo : "/");
    router.refresh(); // aggiorna i Server Components con la nuova sessione
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form noValidate onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-display font-bold">Accedi</h1>

        <div>
          <label htmlFor="login-email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="tuonome@esempio.it"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-sm font-medium mb-1">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="La tua password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        {errore && <p className="text-sm text-warning">{errore}</p>}

        <button
          type="submit"
          disabled={caricamento}
          className={`w-full rounded-lg bg-accent p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {caricamento ? "Attendere..." : "Accedi"}
        </button>

        <p className="text-sm text-muted flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span>
            Non hai un account?{" "}
            <a href="/register" className={`underline rounded text-foreground ${CLASSE_FOCUS}`}>
              Registrati
            </a>
          </span>
          <a href="/password-dimenticata" className={`underline rounded ${CLASSE_FOCUS}`}>
            Password dimenticata?
          </a>
        </p>
      </form>
    </main>
  );
}
