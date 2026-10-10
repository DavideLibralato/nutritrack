"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LINK_ALTRO_BROWSER,
  traduciErroreAuth,
  traduciErroreLinkRipristino,
} from "@/lib/erroriAuth";
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
  // sessione vera prima di poter cambiare la password (flusso PKCE).
  //
  // Lo scambio NON lo facciamo noi: lo fa da solo il client Supabase appena
  // nasce (detectSessionInUrl, acceso da @supabase/ssr), se nel browser c'è
  // il "code verifier" salvato quando è stato chiesto il link. Il client è
  // uno solo per tutta la pagina e può nascere prima di questo componente
  // (useUtenteId nel layout radice). Fino al 10/10/2026 lo scambiavamo una
  // seconda volta qui: il verifier era già stato usato e cancellato, e la
  // pagina mostrava "Link non valido" anche se l'accesso era riuscito.
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

    // initialize() non rifà il lavoro: restituisce l'esito dell'avvio già
    // partito, scambio compreso.
    supabase.auth.initialize().then(({ error }) => {
      if (error) {
        // Il server ha rifiutato il codice (scaduto o già usato), o la rete.
        setStatoSessione("errore");
        setErroreSessione(traduciErroreLinkRipristino(error));
        return;
      }
      // Il modulo compare SOLO se la sessione è nata da questo link. Il
      // segno: la libreria toglie ?code= dall'indirizzo solo dopo averlo
      // scambiato con successo. Se è ancora lì lo scambio non è avvenuto
      // (verifier assente: link aperto in un altro browser, o chiesto
      // dall'app installata su iPhone e aperto in Safari). Una sessione già
      // aperta in questo browser può essere di un altro account: cambiarle
      // la password sarebbe cambiarla all'account sbagliato.
      // searchParams non aiuta: Next non si accorge della modifica della
      // libreria e continua a vedere il codice.
      if (new URL(window.location.href).searchParams.has("code")) {
        setStatoSessione("errore");
        setErroreSessione(LINK_ALTRO_BROWSER);
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
          className={`w-full rounded-lg bg-accent-strong p-2 text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {caricamento ? "Salvataggio..." : "Salva nuova password"}
        </button>
      </form>
    </main>
  );
}
