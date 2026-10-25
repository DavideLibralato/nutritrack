"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  ERRORE_CONNESSIONE,
  LINK_NON_VALIDO,
  traduciErroreAuth,
  traduciErroreLinkRipristino,
} from "@/lib/erroriAuth";
import {
  leggiSegnoRipristino,
  scriviSegnoRipristino,
  togliSegnoRipristino,
} from "@/lib/segnoRipristinoPassword";
import { leggiFrammentoRipristino, togliFrammento } from "@/lib/frammentoRipristino";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import CampoPassword from "@/components/CampoPassword";
import PaginaAccesso from "@/components/PaginaAccesso";
import { CLASSE_TITOLO_ACCESSO } from "@/lib/classiAccesso";

// L'esito della raccolta della sessione dal frammento (link chiesti con il
// flusso implicito, dal 18/10/2026: frammentoRipristino.ts).
type EsitoFrammento =
  | { tipo: "nessuno" } // nessuna sessione nel frammento: si va avanti come prima
  | { tipo: "riuscito"; idUtente: string; email: string }
  | { tipo: "errore"; testo: string };

// Legge il frammento e lo toglie SUBITO, prima di qualunque attesa: i
// token non restano nell'indirizzo nemmeno se poi qualcosa fallisce. Poi
// setSession sul client dell'app: verifica il token con il server e salva
// la sessione nei cookie, dove la vedono il middleware e il resto
// dell'app. Infine il rinnovo (refreshSession), che rende inutile il
// refresh token passato dall'indirizzo.
function raccogliSessioneDalFrammento(): Promise<EsitoFrammento> {
  const sessione = leggiFrammentoRipristino(window.location.hash);
  if (!sessione) return Promise.resolve({ tipo: "nessuno" });
  togliFrammento();

  return (async (): Promise<EsitoFrammento> => {
    const supabase = createClient();
    const { error } = await supabase.auth.setSession(sessione);
    if (error) {
      // Rete assente o richiesta scaduta: il link può essere ancora buono,
      // ma i token sono già stati tolti dall'indirizzo, quindi serve
      // comunque un link nuovo. Qualunque altro errore: il server ha
      // rifiutato i token.
      return { tipo: "errore", testo: testoErrore(error) };
    }

    // Il rinforzo: un rinnovo subito, prima del modulo. Il server dà un
    // refresh token nuovo e quello passato dall'indirizzo diventa "già
    // usato": se qualcuno lo ritrovasse più tardi (cronologia di Safari,
    // sincronizzata su iCloud) non varrebbe più, e il server, vedendolo
    // riusato, chiuderebbe anche questa sessione.
    const rinnovo = await supabase.auth.refreshSession({ refresh_token: sessione.refresh_token });
    if (rinnovo.error || !rinnovo.data.session) {
      // Rinnovo non riuscito: niente modulo e niente sessione. Il token
      // dell'indirizzo non si è potuto rendere inutile, e se il server lo
      // rifiuta come già usato può averlo usato qualcun altro. La libreria
      // in questo caso CONSERVA la sessione (l'access token vale ancora),
      // quindi la si toglie qui: signOut "local" la cancella sempre da
      // questo browser, anche senza rete, e con la rete chiede al server
      // di chiudere proprio questa sessione. Costa un link nuovo.
      await supabase.auth.signOut({ scope: "local" });
      return { tipo: "errore", testo: rinnovo.error ? testoErrore(rinnovo.error) : LINK_NON_VALIDO };
    }

    const utente = rinnovo.data.session.user;
    if (!utente?.email) return { tipo: "errore", testo: LINK_NON_VALIDO };
    return { tipo: "riuscito", idUtente: utente.id, email: utente.email };
  })();
}

function testoErrore(errore: Error): string {
  return isAuthRetryableFetchError(errore) ? ERRORE_CONNESSIONE : LINK_NON_VALIDO;
}

export default function ReimpostaPasswordPage() {
  const router = useRouter();

  const [statoSessione, setStatoSessione] = useState<"verifica" | "pronto" | "errore">(
    "verifica"
  );
  const [erroreSessione, setErroreSessione] = useState<string | null>(null);
  // L'account a cui si cambia la password, mostrato nel modulo.
  const [emailAccount, setEmailAccount] = useState("");

  const [password, setPassword] = useState("");
  const [confermaPassword, setConfermaPassword] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  // La raccolta dal frammento parte una volta sola per caricamento della
  // pagina. In sviluppo (StrictMode) React fa girare l'effect due volte:
  // la seconda volta troverebbe l'indirizzo già pulito, e un secondo
  // setSession sarebbe una chiamata inutile. Una ref (useRef) è una scatola che sopravvive ai
  // nuovi giri del componente senza farlo ridisegnare: tiene la stessa
  // promessa per tutti.
  const raccolta = useRef<Promise<EsitoFrammento> | null>(null);

  // Il link dell'email porta qui con la sessione nel frammento (link
  // chiesti dal 18/10/2026, sopra). Il modulo compare SOLO se la sessione
  // è nata da quel frammento (o, dopo un ricaricamento, dal frammento
  // raccolto in questa scheda: il segno). Una sessione già aperta nel
  // browser può essere di un altro account: cambiarle la password sarebbe
  // cambiarla all'account sbagliato.
  //
  // Un indirizzo con ?code= e senza frammento (i vecchi link PKCE, tolti
  // dal 25/10/2026) finisce sempre sull'errore. Se nel browser è rimasto
  // un "code verifier", il client Supabase scambia il codice da solo
  // appena nasce e la sessione si apre: ma nessuno scrive il segno, quindi
  // il passo 2 mostra l'errore, non il modulo.
  useEffect(() => {
    // Il frammento si legge prima di creare il client e prima di guardare
    // l'esito di initialize().
    raccolta.current ??= raccogliSessioneDalFrammento();
    const esitoFrammento = raccolta.current;
    const supabase = createClient();

    function mostraErrore(testo: string) {
      setStatoSessione("errore");
      setErroreSessione(testo);
    }

    // initialize() non rifà il lavoro: restituisce l'esito dell'avvio già
    // partito (il client può essere nato prima, con useUtenteId nel layout
    // radice).
    supabase.auth.initialize().then(async ({ error }) => {
      // 0. Sessione nel frammento (flusso implicito). Se il client è nato
      // prima che la pagina togliesse il frammento (useUtenteId nel layout
      // radice), ha visto i token e ha rinunciato con "Not a valid PKCE
      // flow url": quell'errore, e solo quello, qui è atteso e si ignora.
      const frammento = await esitoFrammento;
      if (frammento.tipo !== "nessuno") {
        if (error && error.name !== "AuthPKCEGrantCodeExchangeError") {
          mostraErrore(traduciErroreLinkRipristino(error));
          return;
        }
        if (frammento.tipo === "errore") {
          mostraErrore(frammento.testo);
          return;
        }
        // Il segno per un eventuale ricaricamento.
        scriviSegnoRipristino(frammento.idUtente);
        setEmailAccount(frammento.email);
        setStatoSessione("pronto");
        return;
      }

      // 1. Errore: il server ha rimandato qui con l'errore nell'indirizzo
      // (link già usato o scaduto, otp_expired), o la rete. Prima di tutto
      // il resto, anche con una sessione aperta.
      if (error) {
        mostraErrore(traduciErroreLinkRipristino(error));
        return;
      }

      // 2. Senza frammento né errore: ci si arriva ricaricando dopo aver
      // raccolto il frammento. Il modulo solo se la sessione è dello
      // stesso utente del segno scritto in questa scheda
      // (segnoRipristinoPassword.ts). getSession legge la sessione salvata
      // sul dispositivo, senza rete.
      const { data } = await supabase.auth.getSession();
      const utente = data.session?.user;
      if (!utente?.email || leggiSegnoRipristino() !== utente.id) {
        mostraErrore(LINK_NON_VALIDO);
        return;
      }

      setEmailAccount(utente.email);
      setStatoSessione("pronto");
    });
  }, []);

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

    // replace e non push: la pagina del reset esce dalla cronologia, così
    // "indietro" da Oggi non ci riporta qui. Il segno tolto è la seconda
    // difesa: un ricaricamento in questa scheda non riapre il modulo.
    togliSegnoRipristino();
    router.replace("/");
    router.refresh();
  }

  if (statoSessione === "verifica") {
    return (
      <PaginaAccesso marchioInCima>
        <p className="text-sm text-muted">Verifica del link in corso...</p>
      </PaginaAccesso>
    );
  }

  if (statoSessione === "errore") {
    return (
      <PaginaAccesso marchioInCima>
        <div className="w-full max-w-sm space-y-4">
          <h1 className={CLASSE_TITOLO_ACCESSO}>Link non valido</h1>
          <p className="text-sm text-warning">{erroreSessione}</p>
          <a
            href="/password-dimenticata"
            className={`underline rounded text-foreground ${CLASSE_FOCUS}`}
          >
            Richiedi un nuovo link
          </a>
        </div>
      </PaginaAccesso>
    );
  }

  return (
    <PaginaAccesso marchioInCima>
      <form noValidate onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className={CLASSE_TITOLO_ACCESSO}>Imposta una nuova password</h1>

        {/* L'account a cui cambia la password: si vede subito se è quello
            sbagliato. autoComplete="username" fa salvare al gestore delle
            password (Portachiavi iCloud...) la password nuova su questa
            email. Sola lettura: non si sceglie qui l'account. */}
        <div>
          <label htmlFor="reset-account" className="block text-sm font-medium mb-1">
            Account
          </label>
          <input
            id="reset-account"
            type="email"
            autoComplete="username"
            readOnly
            value={emailAccount}
            className={`w-full rounded-lg border border-border bg-surface p-2 text-muted ${CLASSE_FOCUS}`}
          />
        </div>

        {/* Un occhio per campo: ognuno mostra solo la sua password. */}
        <CampoPassword
          id="reset-password"
          etichetta="Nuova password"
          autoComplete="new-password"
          placeholder="Almeno 6 caratteri"
          value={password}
          onChange={setPassword}
        />

        <CampoPassword
          id="reset-conferma"
          etichetta="Conferma password"
          autoComplete="new-password"
          placeholder="Ripetila"
          value={confermaPassword}
          onChange={setConfermaPassword}
        />

        {errore && <p className="text-sm text-warning">{errore}</p>}

        <button
          type="submit"
          disabled={caricamento}
          className={`w-full rounded-lg bg-accent-strong p-2 text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {caricamento ? "Salvataggio..." : "Salva nuova password"}
        </button>
      </form>
    </PaginaAccesso>
  );
}
