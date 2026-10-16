"use client";

// Il foglio "Aggiungi un amico" della pagina Amici (PUNTO_DI_PARTENZA.md §3
// "Amici"; mockup docs/mockups/amici.html, schermata 4). Si scrive lo
// username esatto, "Invia richiesta" chiama chiedi_amicizia, e l'esito resta
// sotto il campo (testi in testiAmici.ts): il foglio non si chiude da solo,
// così si legge cosa è successo e si può scrivere un altro nome.
//
// Nessun controllo "esiste?" mentre si scrive: la ricerca è solo sul nome
// esatto, all'invio. Il formato invece si controlla prima, senza chiamare
// il server. Stessa struttura visiva di SheetUsername.

import { useEffect, useRef, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useOnline } from "@/lib/useOnline";
import { createClient } from "@/lib/supabase/client";
import { normalizzaUsername, usernameValido } from "@/lib/validazione";
import { chiediAmicizia } from "@/lib/amici/amicizie";
import { testoEsitoChiedi, type ToniEsito } from "@/lib/amici/testiAmici";
import { TESTO_USERNAME_NON_VALIDO } from "@/lib/amici/testiUsername";

interface Props {
  onChiudi: () => void;
  // Dopo "inviata" o "accettata": la pagina rilegge l'elenco.
  onCambiato: () => void;
}

export default function SheetAggiungiAmico({ onChiudi, onCambiato }: Props) {
  const [valore, setValore] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ testo: string; tono: ToniEsito } | null>(null);
  const rifInput = useRef<HTMLInputElement>(null);
  const areaVisibile = useAreaVisibile();
  const online = useOnline();

  const inviabile = online && !inCorso && normalizzaUsername(valore) !== "";

  useEffect(() => {
    rifInput.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onChiudi();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onChiudi, inCorso]);

  async function invia() {
    if (!inviabile) return;
    if (!usernameValido(valore)) {
      setEsito({ testo: TESTO_USERNAME_NON_VALIDO, tono: "avviso" });
      return;
    }
    setInCorso(true);
    setEsito(null);
    const risposta = await chiediAmicizia(createClient(), valore);
    setInCorso(false);
    setEsito(testoEsitoChiedi(risposta, valore));
    if (risposta === "inviata" || risposta === "accettata") onCambiato();
  }

  function chiudi() {
    if (!inCorso) onChiudi();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-veil" onClick={chiudi} aria-hidden />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        onClick={chiudi}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-aggiungi-amico-titolo"
          className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="sheet-aggiungi-amico-titolo" className="font-display text-xl font-bold">
            Aggiungi un amico
          </h2>
          <p className="mt-2 text-sm text-muted">
            Scrivi il suo username esatto. Gli arriverà una richiesta da accettare.
          </p>

          <div className="relative mt-4">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted"
            >
              @
            </span>
            {/* autoComplete="nickname" come gli altri campi username, anche
                se qui si scrive lo username di un altro: iPhone non deve
                scambiarlo per il campo di accesso (commento sul campo in
                src/app/register/page.tsx). Al massimo propone il proprio
                soprannome dalla scheda contatto, se c'è: si ignora. */}
            <input
              ref={rifInput}
              type="text"
              aria-label="Username"
              value={valore}
              onChange={(e) => {
                setValore(e.target.value.toLowerCase());
                setEsito(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void invia();
              }}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="nickname"
              spellCheck={false}
              aria-describedby="sheet-aggiungi-amico-esito"
              className={`w-full rounded-lg border border-border p-3 pl-8 text-lg ${CLASSE_FOCUS}`}
            />
          </div>

          <p
            id="sheet-aggiungi-amico-esito"
            role="status"
            className={`mt-2 min-h-5 text-sm ${
              !online || esito?.tono === "avviso"
                ? "text-warning"
                : esito?.tono === "ok"
                  ? "text-accent"
                  : "text-muted"
            }`}
          >
            {!online ? "Per aggiungere un amico serve la connessione." : (esito?.testo ?? "")}
          </p>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={chiudi}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Chiudi
            </button>
            <button
              type="button"
              onClick={() => void invia()}
              disabled={!inviabile}
              className={`flex-1 rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Invio..." : "Invia richiesta"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
