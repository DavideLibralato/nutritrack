"use client";

// useActionState (React 19) collega un form direttamente a una Server
// Action: niente onSubmit/fetch manuale, il form chiama registrati() da
// solo. `stato` è quello che l'ultima chiamata ha restituito, `inCorso`
// diventa true mentre la Server Action sta girando sul server.
import { useActionState, useEffect, useState } from "react";
import { registrati, type StatoRegistrazione } from "@/lib/actions/auth";
import { caricaPaginaDaCapo } from "@/lib/caricamentoCompleto";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import CampoPassword from "@/components/CampoPassword";
import MarchioLibra from "@/components/MarchioLibra";
import PaginaAccesso from "@/components/PaginaAccesso";
import { CLASSE_TITOLO_ACCESSO } from "@/lib/classiAccesso";

// Niente username (dal branch username-dopo-accesso, PUNTO_DI_PARTENZA.md
// §3, "Lo username dopo l'accesso"): lo si sceglie nell'onboarding, dopo
// l'accesso.
const STATO_INIZIALE: StatoRegistrazione = {
  errore: null,
  messaggio: null,
  valori: { nome: "", email: "" },
};

export default function RegisterPage() {
  const [stato, azioneForm, inCorso] = useActionState(registrati, STATO_INIZIALE);

  // Contatore di tentativi: cambia ogni volta che la Server Action
  // risponde. Usato come key sul campo codice invito per farlo rimontare
  // vuoto a ogni tentativo, indipendentemente da come React/Next
  // ridisegnano il resto della pagina dopo l'azione.
  //
  // Aggiornato durante il render, non in un useEffect: è il pattern che
  // React stesso consiglia per "un valore che cambia quando cambia
  // un altro" (react.dev, "You Might Not Need an Effect"). Confrontare
  // stato con l'ultimo visto e aggiornare subito evita un giro di render
  // in più rispetto a un useEffect equivalente.
  const [statoVisto, setStatoVisto] = useState(stato);
  const [tentativo, setTentativo] = useState(0);
  if (stato !== statoVisto) {
    setStatoVisto(stato);
    setTentativo((n) => n + 1);
  }

  // Registrato e con la sessione: un caricamento completo di /onboarding,
  // non una navigazione interna di Next.js. La sessione è nata sul server,
  // nei cookie, e i componenti del layout radice montati qui senza utente
  // (la sincronizzazione, le riprese) non lo saprebbero mai: con la
  // navigazione interna /onboarding restava su "Caricamento..." (prove del
  // 17/10). Ricaricando, nascono già con la sessione. In un effetto, non
  // durante il disegno: cambiare pagina è un'azione verso il browser.
  const registrato = stato.registrato === true;
  useEffect(() => {
    if (registrato) caricaPaginaDaCapo("/onboarding");
  }, [registrato]);

  return (
    <PaginaAccesso>
      <form noValidate action={azioneForm} className="w-full max-w-sm space-y-4">
        <h1 className={CLASSE_TITOLO_ACCESSO}>
          Crea il tuo account <MarchioLibra variante="titolo" />
        </h1>
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
            // defaultValue, non value: il campo resta scrivibile liberamente,
            // e dopo un errore si ripopola con quello che avevi già scritto
            // (torna dalla Server Action in stato.valori) invece di
            // svuotarsi.
            defaultValue={stato.valori.nome}
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
            defaultValue={stato.valori.email}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        {/* Non controllato, come prima: solo name, niente value. */}
        <CampoPassword
          id="register-password"
          name="password"
          etichetta="Password"
          autoComplete="new-password"
          placeholder="Almeno 6 caratteri"
        />

        <div>
          <label htmlFor="register-codice-invito" className="block text-sm font-medium mb-1">
            Codice di invito
          </label>
          <input
            key={tentativo}
            id="register-codice-invito"
            name="codiceInvito"
            type="text"
            autoComplete="off"
            placeholder="Il codice che ti hanno dato"
            // key={tentativo}: questo campo si svuota sempre dopo un
            // tentativo, riuscito o no — è l'unico che va digitato di nuovo.
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        {stato.errore && <p className="text-sm text-warning">{stato.errore}</p>}
        {stato.messaggio && <p className="text-sm text-accent">{stato.messaggio}</p>}

        <button
          type="submit"
          // Spento anche da registrato, mentre la pagina si ricarica: un
          // secondo invio proverebbe a creare lo stesso account.
          disabled={inCorso || registrato}
          className={`w-full rounded-lg bg-accent-strong p-2 text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {inCorso || registrato ? "Attendere..." : "Crea account"}
        </button>

        <p className="text-sm text-muted">
          Hai già un account?{" "}
          <a href="/login" className={`underline rounded text-foreground ${CLASSE_FOCUS}`}>
            Accedi
          </a>
        </p>
      </form>
    </PaginaAccesso>
  );
}
