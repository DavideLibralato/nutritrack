"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { emailValida } from "@/lib/validazione";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import CampoPassword from "@/components/CampoPassword";
import MarchioLibra from "@/components/MarchioLibra";
import PaginaAccesso from "@/components/PaginaAccesso";
import { CLASSE_TITOLO_ACCESSO } from "@/lib/classiAccesso";

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
    //
    // Il campo email toglie già gli spazi ai bordi (lo standard HTML per
    // type="email"); qui si ripulisce per coerenza con gli altri moduli
    // (Registrati, Password dimenticata), e la stessa email pulita va a
    // signInWithPassword. Le maiuscole le porta in minuscolo Supabase Auth.
    const emailPulita = email.trim();
    if (!emailPulita) {
      setErrore("Inserisci la tua email.");
      return;
    }
    if (!emailValida(emailPulita)) {
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
      email: emailPulita,
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
    <PaginaAccesso>
      <form noValidate onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {/* Dopo "Elimina il mio account" (EliminaAccount.tsx porta qui con
            ?eliminato=1). role="status": letto dagli screen reader. */}
        {searchParams.get("eliminato") === "1" && (
          <div role="status" className="rounded-xl border border-border bg-surface px-3.5 py-3">
            <p className="text-[15px] font-medium">Account eliminato</p>
            <p className="text-sm leading-snug text-muted">
              I tuoi dati sono stati cancellati dal server e da questo telefono.
            </p>
          </div>
        )}
        {/* Il marchio è parte del titolo: si legge "Accedi a Libra". */}
        <h1 className={CLASSE_TITOLO_ACCESSO}>
          Accedi a <MarchioLibra variante="titolo" />
        </h1>

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

        <CampoPassword
          id="login-password"
          etichetta="Password"
          autoComplete="current-password"
          placeholder="La tua password"
          value={password}
          onChange={setPassword}
        />

        {errore && <p className="text-sm text-warning">{errore}</p>}

        <button
          type="submit"
          disabled={caricamento}
          className={`w-full rounded-lg bg-accent-strong p-2 text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
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
    </PaginaAccesso>
  );
}
