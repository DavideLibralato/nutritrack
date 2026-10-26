"use client";

// Il contenuto di Impostazioni > Elimina account (PUNTO_DI_PARTENZA.md §9.6,
// mockup docs/mockups/elimina-account.html): cosa viene cancellato, la
// parola da scrivere, un solo pulsante rosso e sotto la riga di stato. Il
// lavoro lo fa eliminaAccount (src/lib/account/eliminaAccount.ts); qui solo
// stati e testi.
//
// Rosso (--pericolo) e non arancio: è l'unica azione dell'app che non si
// può annullare (sezione 7).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { useOnline } from "@/lib/useOnline";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import {
  eliminaAccount,
  parolaDiConfermaGiusta,
  PAROLA_DI_CONFERMA,
  type EsitoEliminazione,
} from "@/lib/account/eliminaAccount";
import GruppoImpostazioni from "./GruppoImpostazioni";

const COSA_SI_CANCELLA: { testo: string; dettaglio?: string }[] = [
  { testo: "Il diario e i tuoi pasti" },
  { testo: "Gli alimenti che hai creato" },
  { testo: "Obiettivi e peso" },
  { testo: "Preferiti e pasti salvati" },
  // Mai la parola "username": la pagina ha un campo da solo (scrivi
  // ELIMINA) e iPhone la prenderebbe per un accesso (PUNTO §3, "Lo
  // username"). Deciso il 16/10, branch condivisione-alimenti.
  {
    testo: "I tuoi amici e il tuo nome su Libra",
    dettaglio:
      "Gli alimenti mandati e non ancora accettati spariscono; le copie già aggiunte dagli amici restano.",
  },
  { testo: "L'account", dettaglio: "Email e password: per rientrare dovrai registrarti di nuovo" },
];

// I testi degli esiti che lasciano l'utente sulla pagina. "eliminato" non
// c'è: si va al login.
const TESTI_ESITO: Record<Exclude<EsitoEliminazione, "eliminato">, string> = {
  rete: "Non riuscito: il server non risponde. Il tuo account non è stato toccato. Riprova.",
  "risposta-persa":
    "Non so se è andata: la connessione si è interrotta prima della risposta. Riprova: se l'account è già eliminato, l'app lo vede e finisce il lavoro.",
  rifiutato: "Non riuscito: il server ha rifiutato la richiesta. Il tuo account non è stato toccato.",
  sessione: "Il server non riconosce più la tua sessione. Esci e rientra, poi riprova.",
  // Dal branch foto-profilo: la foto è stata tolta in questo tentativo,
  // l'account no (testo di Davide, 25/10).
  "foto-tolta":
    "Non è stato possibile eliminare l'account. La tua foto è già stata tolta; i tuoi dati sono intatti. Riprova.",
};

export default function EliminaAccount() {
  const router = useRouter();
  const userId = useUtenteId();
  const online = useOnline();
  const [parola, setParola] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const pronto = !!userId && online && !inCorso && parolaDiConfermaGiusta(parola);

  async function elimina() {
    if (!userId || inCorso) return;
    setInCorso(true);
    setErrore(null);
    const esito = await eliminaAccount(userId).catch((): EsitoEliminazione => "rete");
    if (esito === "eliminato") {
      // replace: "indietro" dal login non deve riportare qui.
      router.replace("/login?eliminato=1");
      router.refresh();
      return;
    }
    setErrore(TESTI_ESITO[esito]);
    setInCorso(false);
  }

  return (
    <>
      <GruppoImpostazioni
        titolo="Cosa viene cancellato"
        nota="Dal server e da questo telefono, comprese le modifiche non ancora inviate. Per sempre: non si può annullare né recuperare."
      >
        <ul className="py-1">
          {COSA_SI_CANCELLA.map(({ testo, dettaglio }) => (
            <li
              key={testo}
              style={{ "--rientro-linea": "40px" } as React.CSSProperties}
              className="riga-impostazioni relative py-[11px] pr-4 pl-10 text-[15px] leading-snug"
            >
              <span aria-hidden className="absolute top-[18px] left-[18px] size-2 rounded-full bg-danger" />
              {testo}
              {dettaglio && <span className="mt-0.5 block text-[13px] text-muted">{dettaglio}</span>}
            </li>
          ))}
        </ul>
      </GruppoImpostazioni>

      <section className="w-full">
        <GruppoImpostazioni>
          <div className="space-y-3 p-4">
            <div>
              <label htmlFor="elimina-parola" className="mb-1.5 block text-sm font-medium">
                Per confermare scrivi {PAROLA_DI_CONFERMA}
              </label>
              <input
                id="elimina-parola"
                value={parola}
                onChange={(e) => setParola(e.target.value)}
                disabled={inCorso}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className={`w-full rounded-lg border border-border bg-background p-2 text-base tracking-[0.06em] disabled:opacity-60 ${CLASSE_FOCUS}`}
              />
            </div>
            <button
              type="button"
              onClick={elimina}
              disabled={!pronto}
              className={`min-h-11 w-full rounded-lg bg-danger-strong p-2 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Eliminazione…" : "Elimina il mio account"}
            </button>
          </div>
        </GruppoImpostazioni>

        {/* role="status": gli screen reader leggono i messaggi quando
            cambiano, senza spostare il fuoco. Sempre nella pagina (vuoto =
            nascosto), come in EsciAccount. */}
        <div role="status" className="mx-4 mt-2 text-sm leading-snug empty:hidden">
          {errore ? (
            <p className="text-warning">{errore}</p>
          ) : (
            !online && <p className="text-muted">Per eliminare l&apos;account serve la connessione.</p>
          )}
        </div>
      </section>
    </>
  );
}
