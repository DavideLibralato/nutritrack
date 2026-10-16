"use client";

// "Scegli il tuo username" (PUNTO_DI_PARTENZA.md §3, "Amici"; mockup
// docs/mockups/amici.html, schermata 3): al posto della pagina Amici per chi
// non ha ancora una riga in nomi_utente. Campo con la "@" ed esito mentre si
// scrive, come in Registrati e in SheetUsername; "Continua" chiama
// imposta_username.
//
// `suggerito`: lo username dei metadati dell'account (scritto in
// Registrati), se c'è. Il campo parte già scritto e mostra subito il suo
// esito. Il suggerimento può arrivare un attimo dopo il primo disegno
// (si legge dalla sessione): riempie il campo solo se l'utente non ha
// ancora scritto niente, mai sopra quello che ha scritto lui.

import { useState } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useOnline } from "@/lib/useOnline";
import { createClient } from "@/lib/supabase/client";
import { normalizzaUsername } from "@/lib/validazione";
import { useDisponibilitaUsername } from "@/lib/amici/useDisponibilitaUsername";
import { impostaUsername } from "@/lib/amici/nomiUtente";
import { puoSalvareUsername } from "@/lib/amici/foglioUsername";
import {
  TESTO_USERNAME_IN_USO,
  TESTO_USERNAME_NON_SALVATO,
  TESTO_USERNAME_NON_VALIDO,
  TESTO_USERNAME_SENZA_RETE,
  testoStatoUsername,
} from "@/lib/amici/testiUsername";

export default function SceltaUsername({
  suggerito,
  onScelto,
}: {
  suggerito: string | null;
  onScelto: (username: string) => void;
}) {
  const [valore, setValore] = useState((suggerito ?? "").toLowerCase());
  const [scritto, setScritto] = useState(false);
  const [suggeritoVisto, setSuggeritoVisto] = useState(suggerito);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const online = useOnline();

  // Il suggerimento arrivato dopo: si aggiorna il campo durante il disegno,
  // non in un effetto (lo stesso schema di Registrati, "You Might Not Need
  // an Effect"), solo se l'utente non ha ancora scritto.
  if (suggerito !== suggeritoVisto) {
    setSuggeritoVisto(suggerito);
    if (!scritto && suggerito) setValore(suggerito.toLowerCase());
  }

  const stato = useDisponibilitaUsername(valore);
  const salvabile = puoSalvareUsername(stato, online) && !inCorso;
  const daCorreggere = stato === "non_valido" || stato === "in_uso";

  async function continua() {
    if (!salvabile) return;
    setInCorso(true);
    setErrore(null);
    const esito = await impostaUsername(createClient(), valore);
    setInCorso(false);
    if (esito === "ok") onScelto(normalizzaUsername(valore));
    else if (esito === "occupato") setErrore(TESTO_USERNAME_IN_USO);
    else if (esito === "non_valido") setErrore(TESTO_USERNAME_NON_VALIDO);
    else setErrore(TESTO_USERNAME_NON_SALVATO);
  }

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4">
      <h2 className="font-display text-lg font-bold">Scegli il tuo username</h2>
      <p className="text-sm text-muted">
        Gli amici ti trovano solo con il nome esatto. Potrai cambiarlo da Profilo.
      </p>

      <div>
        <label htmlFor="scelta-nome-utente" className="mb-1 block text-sm font-medium">
          Username
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted"
          >
            @
          </span>
          {/* autoComplete="nickname" e niente "username" nell'id: iPhone
              non deve scambiarlo per il campo di accesso (commento sul
              campo in src/app/register/page.tsx). */}
          <input
            id="scelta-nome-utente"
            type="text"
            value={valore}
            onChange={(e) => {
              setScritto(true);
              setValore(e.target.value.toLowerCase());
              setErrore(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void continua();
            }}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="nickname"
            spellCheck={false}
            aria-describedby="scelta-username-esito"
            aria-invalid={daCorreggere}
            className={`w-full rounded-lg border border-border bg-background p-2 pl-7 text-base ${CLASSE_FOCUS}`}
          />
        </div>
        <p
          id="scelta-username-esito"
          role="status"
          className={`mt-1 min-h-5 text-sm ${
            errore || daCorreggere
              ? "text-warning"
              : stato === "disponibile"
                ? "text-accent"
                : "text-muted"
          }`}
        >
          {errore ??
            (online ? testoStatoUsername(stato, "quando continui") : TESTO_USERNAME_SENZA_RETE)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void continua()}
        disabled={!salvabile}
        className={`w-full rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        {inCorso ? "Salvo..." : "Continua"}
      </button>
    </section>
  );
}
