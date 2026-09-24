"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

// useSearchParams() richiede una <Suspense> attorno (stesso motivo di /login).
export default function ReimpostaPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ReimpostaPasswordForm />
    </Suspense>
  );
}

function ReimpostaPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [statoSessione, setStatoSessione] = useState<"verifica" | "pronto" | "errore">(
    "verifica"
  );
  const [erroreSessione, setErroreSessione] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  // Il link dell'email porta qui con ?code=..., che va scambiato con una
  // sessione vera prima di poter cambiare la password (flusso PKCE, lo
  // stesso che usa il resto dell'app tramite @supabase/ssr).
  useEffect(() => {
    const code = searchParams.get("code");
    const supabase = createClient();

    if (!code) {
      // Nessun codice nell'URL: forse la pagina è stata solo ricaricata
      // dopo che lo scambio è già avvenuto. Controlliamo se c'è già una
      // sessione prima di arrenderci.
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          setStatoSessione("pronto");
        } else {
          setStatoSessione("errore");
          setErroreSessione("Link non valido o scaduto. Richiedine uno nuovo.");
        }
      });
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setStatoSessione("errore");
        setErroreSessione(traduciErroreAuth(error.message));
        return;
      }
      setStatoSessione("pronto");
    });
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);

    if (!password) {
      setErrore("Inserisci la nuova password.");
      return;
    }
    if (password.length < 6) {
      setErrore("La password deve avere almeno 6 caratteri.");
      return;
    }
    if (password !== confermaPassword) {
      setErrore("Le due password non coincidono.");
      return;
    }

    setCaricamento(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    setCaricamento(false);

    if (error) {
      setErrore(traduciErroreAuth(error.message));
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (statoSessione === "verifica") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-muted">Verifica del link in corso...</p>
      </main>
    );
  }

  if (statoSessione === "errore") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-display font-bold">Link non valido</h1>
          <p className="text-sm text-warning">{erroreSessione}</p>
          <a
            href="/password-dimenticata"
            className={`underline rounded text-foreground ${CLASSE_FOCUS}`}
          >
            Richiedi un nuovo link
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form noValidate onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-display font-bold">Imposta una nuova password</h1>

        <div>
          <label htmlFor="reset-password" className="block text-sm font-medium mb-1">
            Nuova password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            placeholder="Almeno 6 caratteri"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="reset-conferma" className="block text-sm font-medium mb-1">
            Conferma password
          </label>
          <input
            id="reset-conferma"
            type="password"
            autoComplete="new-password"
            placeholder="Ripetila"
            value={confermaPassword}
            onChange={(e) => setConfermaPassword(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        {errore && <p className="text-sm text-warning">{errore}</p>}

        <button
          type="submit"
          disabled={caricamento}
          className={`w-full rounded-lg bg-accent p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {caricamento ? "Salvataggio..." : "Salva nuova password"}
        </button>
      </form>
    </main>
  );
}
