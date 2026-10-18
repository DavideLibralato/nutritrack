"use client";

// Il contenuto di Impostazioni > Profilo > Cambia password (mockup
// docs/mockups/cambia-password.html): l'account, password attuale e nuova
// con l'occhio, un pulsante, e sotto il rimando a Password dimenticata. Il
// lavoro lo fa cambiaPassword (src/lib/account/cambiaPassword.ts); qui solo
// stati e testi. Niente "Conferma password": c'è l'occhio per controllare.
//
// Senza rete (useOnline, come Elimina account) il riquadro "Serve la
// connessione" in cima e il pulsante spento; il modulo resta compilabile.
// Dopo il salvataggio si torna a Profilo con "?password=aggiornata": lì
// compare "Password aggiornata".

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEmailUtente } from "@/lib/supabase/useUtente";
import { useOnline } from "@/lib/useOnline";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import {
  cambiaPassword,
  controllaPrimaDellInvio,
  testoEsitoCambio,
  type EsitoCambio,
} from "@/lib/account/cambiaPassword";
import { PROFILO_CON_PASSWORD_AGGIORNATA } from "@/lib/account/passwordAggiornata";
import { AVVISO_ALTRI_DISPOSITIVI, SENZA_RETE_CAMBIO_PASSWORD } from "@/lib/erroriAuth";
import CampoPassword from "./CampoPassword";

export default function CambiaPassword() {
  const router = useRouter();
  const email = useEmailUtente();
  const online = useOnline();
  const [attuale, setAttuale] = useState("");
  const [nuova, setNuova] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // L'esito dell'ultima risposta del server, per il testo di "attuale
  // sbagliata" dopo una risposta persa. I controlli sul dispositivo non lo
  // cambiano: non hanno parlato col server.
  const [esitoServer, setEsitoServer] = useState<EsitoCambio | null>(null);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    if (inCorso || !online) return;

    const primaDellInvio = controllaPrimaDellInvio(attuale, nuova);
    if (primaDellInvio) {
      setErrore(testoEsitoCambio(primaDellInvio, esitoServer));
      return;
    }

    setInCorso(true);
    setErrore(null);
    const esito = await cambiaPassword(attuale, nuova).catch((): EsitoCambio => "risposta-persa");
    if (esito === "ok") {
      // replace: "indietro" da Profilo non deve riportare qui.
      router.replace(PROFILO_CON_PASSWORD_AGGIORNATA);
      return;
    }
    setErrore(testoEsitoCambio(esito, esitoServer));
    setEsitoServer(esito);
    setInCorso(false);
  }

  return (
    <>
      {!online && (
        <div role="status" className="rounded-xl border border-border bg-surface px-4 py-3">
          <p className="text-[15px] font-semibold">{SENZA_RETE_CAMBIO_PASSWORD.titolo}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted">{SENZA_RETE_CAMBIO_PASSWORD.testo}</p>
        </div>
      )}

      <p className="mx-1 text-sm text-muted">
        Account <strong className="font-semibold text-foreground">{email ?? "…"}</strong>
      </p>

      <form noValidate onSubmit={salva} className="w-full space-y-4">
        {/* Per il gestore delle password (Portachiavi iCloud...): l'email
            con autoComplete="username" gli dice a quale account salvare la
            password nuova, come in Reimposta. Fuori schermo (sr-only) e non
            type="hidden", che iOS ignora; aria-hidden e tabIndex -1: lo
            screen reader e il tasto Tab la saltano, l'email è già scritta
            sopra. */}
        <input
          type="email"
          name="email"
          autoComplete="username"
          readOnly
          value={email ?? ""}
          aria-hidden
          tabIndex={-1}
          className="sr-only"
        />

        <CampoPassword
          id="cambio-attuale"
          etichetta="Password attuale"
          autoComplete="current-password"
          placeholder="Quella che usi oggi"
          value={attuale}
          onChange={setAttuale}
        />

        <CampoPassword
          id="cambio-nuova"
          etichetta="Nuova password"
          autoComplete="new-password"
          placeholder="Almeno 6 caratteri"
          value={nuova}
          onChange={setNuova}
        />

        {errore && (
          <p role="alert" className="text-sm text-warning">
            {errore}
          </p>
        )}

        <div className="space-y-2">
          <button
            type="submit"
            disabled={!online || inCorso}
            className={`min-h-11 w-full rounded-lg bg-accent-strong p-2 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            {inCorso ? "Salvataggio…" : "Salva nuova password"}
          </button>
          <p className="mx-1 text-[13px] leading-snug text-muted">{AVVISO_ALTRI_DISPOSITIVI}</p>
        </div>

        {/* Senza rete non si manda nemmeno l'email: il rimando si toglie. */}
        {online && (
          <p className="mx-1 text-sm text-muted">
            Non la ricordi?{" "}
            <Link href="/password-dimenticata" className={`rounded text-foreground underline ${CLASSE_FOCUS}`}>
              Reimpostala via email
            </Link>
          </p>
        )}
      </form>
    </>
  );
}
