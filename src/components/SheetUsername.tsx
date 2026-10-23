"use client";

// Il foglio "Cambia il tuo nome su Libra" di Impostazioni > Profilo (PUNTO_DI_PARTENZA.md
// §3, "Amici"; mockup docs/mockups/amici.html, schermata 5). Ha il SUO
// Salva, solo online, fuori dal Salva unico di Profilo: scrive con
// imposta_username, che può rispondere "occupato", mentre il Salva di
// Profilo scrive in locale.
//
// Stessa struttura visiva di SheetNome (sfondo scurito, pannello in basso
// ancorato all'area visibile, riga Annulla / Salva). Sotto il campo, come
// in "Scegli il tuo nome su Libra", l'esito mentre si scrive
// (useDisponibilitaUsername), con
// un caso in più: il proprio nome attuale (foglioUsername.ts).

import { useEffect, useRef, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useOnline } from "@/lib/useOnline";
import { createClient } from "@/lib/supabase/client";
import { normalizzaUsername } from "@/lib/validazione";
import { useDisponibilitaUsername } from "@/lib/amici/useDisponibilitaUsername";
import { impostaUsername } from "@/lib/amici/nomiUtente";
import { puoSalvareUsername, statoNelFoglio } from "@/lib/amici/foglioUsername";
import {
  TESTO_USERNAME_AMICI_RESTANO,
  TESTO_NOME_IN_USO,
  TESTO_USERNAME_NON_SALVATO,
  TESTO_USERNAME_NON_VALIDO,
  TESTO_USERNAME_REGOLE,
  TESTO_USERNAME_SENZA_RETE,
  testoStatoUsername,
} from "@/lib/amici/testiUsername";

interface Props {
  // Il nome di adesso; null se non è ancora stato scelto.
  attuale: string | null;
  onAnnulla: () => void;
  // Il nome salvato, già normalizzato.
  onSalvato: (username: string) => void;
}

export default function SheetUsername({ attuale, onAnnulla, onSalvato }: Props) {
  const [valore, setValore] = useState(attuale ?? "");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const rifInput = useRef<HTMLInputElement>(null);
  const areaVisibile = useAreaVisibile();
  const online = useOnline();

  const stato = statoNelFoglio(useDisponibilitaUsername(valore), valore, attuale);
  const salvabile = puoSalvareUsername(stato, online) && !inCorso;
  const daCorreggere = stato === "non_valido" || stato === "in_uso";
  // "nome su Libra" e non "username", in tutti i testi vicino al campo:
  // vedi il commento sul campo.
  const titolo = attuale ? "Cambia il tuo nome su Libra" : "Scegli il tuo nome su Libra";

  // All'apertura: fuoco sul campo e testo selezionato, come SheetNome: un
  // nome diverso si scrive senza prima cancellare.
  useEffect(() => {
    const el = rifInput.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla, inCorso]);

  async function salva() {
    if (!salvabile) return;
    setInCorso(true);
    setErrore(null);
    const esito = await impostaUsername(createClient(), valore);
    setInCorso(false);
    if (esito === "ok") onSalvato(normalizzaUsername(valore));
    else if (esito === "occupato") setErrore(TESTO_NOME_IN_USO);
    else if (esito === "non_valido") setErrore(TESTO_USERNAME_NON_VALIDO);
    else setErrore(TESTO_USERNAME_NON_SALVATO);
  }

  function chiudi() {
    if (!inCorso) onAnnulla();
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
          aria-labelledby="sheet-username-titolo"
          className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="sheet-username-titolo" className="font-display text-xl font-bold">
            {titolo}
          </h2>

          <div className="relative mt-4">
            {/* La "@" sta dentro il campo ma non fa parte del valore. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-muted"
            >
              @
            </span>
            {/* Niente parola "username" nei testi vicino al campo (titolo,
                aria-label, esito che compare all'apertura): iPhone legge il
                testo intorno a un campo che sta da solo e, con quella
                parola, lo prende per un accesso e propone la password
                salvata. Né type né autocomplete bastavano: lo ha mostrato
                la prova su iPhone del 16/10 in Aggiungi un amico (§3 "Lo
                username"). type="search" ed enterKeyHint restano: non
                danno fastidio e aiutano; la "×" nativa la toglie
                globals.css. Lo stesso in CampoUsername (Amici e
                onboarding) e SheetAggiungiAmico. */}
            <input
              ref={rifInput}
              type="search"
              enterKeyHint="done"
              aria-label="Il tuo nome su Libra"
              value={valore}
              onChange={(e) => {
                setValore(e.target.value.toLowerCase());
                setErrore(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void salva();
              }}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="nickname"
              spellCheck={false}
              aria-describedby="sheet-username-esito"
              aria-invalid={daCorreggere}
              className={`w-full rounded-lg border border-border p-3 pl-8 text-lg ${CLASSE_FOCUS}`}
            />
          </div>

          {/* L'esito del salvataggio, se c'è, prende il posto di quello del
              controllo: è l'ultima cosa successa. */}
          <p
            id="sheet-username-esito"
            role="status"
            className={`mt-2 min-h-5 text-sm ${
              errore || daCorreggere
                ? "text-warning"
                : stato === "disponibile"
                  ? "text-accent"
                  : "text-muted"
            }`}
          >
            {errore ?? (online ? testoStatoUsername(stato, "quando salvi") : TESTO_USERNAME_SENZA_RETE)}
          </p>

          <p className="mt-2 text-sm text-muted">
            {attuale ? TESTO_USERNAME_AMICI_RESTANO : TESTO_USERNAME_REGOLE}
          </p>

          <div className="mt-5 flex gap-3">
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
              onClick={() => void salva()}
              disabled={!salvabile}
              className={`flex-1 rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Salvo..." : "Salva"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
