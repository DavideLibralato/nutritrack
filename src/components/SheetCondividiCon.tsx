"use client";

// Il foglio "Condividi con" (PUNTO_DI_PARTENZA.md §3 "Amici", "Condividere
// un alimento"; mockup docs/mockups/amici.html, schermata 6). Si apre
// dall'icona condividi nella barra di selezione di Impostazioni >
// Alimenti: gli amici da spuntare e "Manda a N amici".
//
// - Gli amici si leggono all'apertura (useAmicizie, solo online). Senza
//   amici il foglio lo dice, con il collegamento ad Amici.
// - "Manda" rilegge gli alimenti da Dexie in quel momento (quello che
//   l'utente vede, anche se non ancora arrivato al server) e chiama
//   manda_alimenti una volta sola: tutti gli alimenti a tutti gli amici
//   spuntati, oppure niente.
// - L'id dell'invio nasce al primo tocco su "Manda" e resta lo stesso nei
//   tentativi successivi, finché il foglio è aperto: se la risposta si
//   perde e si ripreme, il database riconosce le righe già fatte e non le
//   raddoppia.
// - Con `non_amici` (uno degli amici non lo è più) il foglio resta aperto,
//   dice cosa è successo e rilegge gli amici: le spunte su chi non c'è più
//   cadono da sole.

import { useEffect, useRef, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useOnline } from "@/lib/useOnline";
import { createClient } from "@/lib/supabase/client";
import { useAmicizie } from "@/lib/amici/useAmicizie";
import { mandaAlimenti } from "@/lib/amici/alimentiCondivisi";
import { repositoryAlimenti } from "@/lib/repository";
import { eModificabile } from "@/lib/catalogo/alimentiModificabili";
import {
  etichettaManda,
  messaggioInviati,
  TESTO_AMICI_NON_LETTI,
  TESTO_CONDIVIDI,
  TESTO_CONDIVIDI_SENZA_RETE,
  TESTO_SENZA_AMICI,
  testoEsitoInvio,
  titoloCondividi,
} from "@/lib/catalogo/testiAlimentiInArrivo";
import type { MessaggioBarra } from "@/lib/inserimento/testiBarra";
import type { Alimento } from "@/lib/db/tipi";
import LinkProtetto from "./LinkProtetto";

interface Props {
  userId: string;
  // Gli id degli alimenti selezionati, fissati all'apertura.
  idAlimenti: string[];
  onChiudi: () => void;
  // Invio riuscito: la pagina chiude il foglio, esce dalla selezione e
  // mostra la barra.
  onInviato: (messaggio: MessaggioBarra) => void;
}

export default function SheetCondividiCon({ userId, idAlimenti, onChiudi, onInviato }: Props) {
  const { stato, ricarica } = useAmicizie();
  const online = useOnline();
  const areaVisibile = useAreaVisibile();
  const [scelti, setScelti] = useState<Set<string>>(new Set());
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const idInvio = useRef<string | null>(null);

  const amici = stato.esito === "ok" ? stato.divise.amici : [];
  // Solo chi è ancora fra gli amici: dopo una rilettura, una spunta su chi
  // non c'è più non conta e non parte.
  const sceltiValidi = amici.filter((a) => scelti.has(a.altroId));
  const inviabile = online && !inCorso && sceltiValidi.length > 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onChiudi();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onChiudi, inCorso]);

  function chiudi() {
    if (!inCorso) onChiudi();
  }

  function cambiaSpunta(altroId: string) {
    setErrore(null);
    setScelti((prima) => {
      const nuova = new Set(prima);
      if (nuova.has(altroId)) nuova.delete(altroId);
      else nuova.add(altroId);
      return nuova;
    });
  }

  async function manda() {
    if (!inviabile) return;
    setInCorso(true);
    setErrore(null);
    // I valori di adesso, da Dexie: un alimento eliminato nel frattempo
    // (anche da un altro telefono, con la sync) non parte.
    const letti = await Promise.all(idAlimenti.map((id) => repositoryAlimenti.ottieniPerId(id)));
    const alimenti = letti.filter(
      (a): a is Alimento => a !== undefined && a.deleted_at === null && eModificabile(a, userId)
    );
    if (alimenti.length === 0) {
      setInCorso(false);
      onChiudi();
      return;
    }
    idInvio.current ??= crypto.randomUUID();
    const esito = await mandaAlimenti(
      createClient(),
      idInvio.current,
      sceltiValidi.map((a) => a.altroId),
      alimenti
    );
    setInCorso(false);
    if (esito === "ok") {
      onInviato(messaggioInviati(alimenti.length, sceltiValidi.map((a) => a.username)));
      return;
    }
    setErrore(testoEsitoInvio(esito));
    if (esito === "non_amici") void ricarica();
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
          aria-labelledby="sheet-condividi-titolo"
          className="flex max-h-full w-full max-w-md flex-col rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="sheet-condividi-titolo" className="font-display text-xl font-bold">
            {titoloCondividi(idAlimenti.length)}
          </h2>
          <p className="mt-2 text-sm text-muted">{TESTO_CONDIVIDI}</p>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {stato.esito === "caricamento" && <p className="text-sm text-muted">Caricamento...</p>}

            {stato.esito === "errore" && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-warning">{TESTO_AMICI_NON_LETTI}</p>
                <button
                  type="button"
                  onClick={() => void ricarica()}
                  className={`shrink-0 rounded-lg border border-border px-3 py-2 text-sm ${CLASSE_FOCUS}`}
                >
                  Riprova
                </button>
              </div>
            )}

            {stato.esito === "ok" && amici.length === 0 && (
              <div className="rounded-[20px] border border-border p-4">
                <p className="text-sm text-muted">{TESTO_SENZA_AMICI}</p>
                <LinkProtetto
                  href="/impostazioni/amici"
                  className={`mt-2 inline-block rounded font-semibold text-accent ${CLASSE_FOCUS}`}
                >
                  Vai ad Amici
                </LinkProtetto>
              </div>
            )}

            {amici.length > 0 && (
              <ul className="rounded-[20px] border border-border" aria-label="I tuoi amici">
                {amici.map((a) => {
                  const spuntato = scelti.has(a.altroId);
                  return (
                    <li key={a.altroId} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={spuntato}
                        disabled={inCorso}
                        onClick={() => cambiaSpunta(a.altroId)}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-[20px] px-4 py-2.5 text-left disabled:opacity-50 ${CLASSE_FOCUS}`}
                      >
                        <Spunta piena={spuntato} />
                        <span className={a.username ? "font-semibold" : "text-muted"}>
                          {a.username ? `@${a.username}` : "Nome non disponibile"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p role="status" className="mt-3 min-h-5 text-sm text-warning">
            {!online ? TESTO_CONDIVIDI_SENZA_RETE : (errore ?? "")}
          </p>

          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={chiudi}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => void manda()}
              disabled={!inviabile}
              className={`flex-1 rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Invio..." : etichettaManda(sceltiValidi.length)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Il quadratino della spunta, come nel mockup: vuoto, o pieno nel colore
// principale con il segno.
function Spunta({ piena }: { piena: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 ${
        piena ? "border-accent-strong bg-accent-strong text-on-strong" : "border-border"
      }`}
    >
      {piena && (
        <svg
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      )}
    </span>
  );
}
