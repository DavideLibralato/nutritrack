"use client";

// Un alimento in arrivo nel foglio (PUNTO_DI_PARTENZA.md §3 "Amici",
// "Condividere un alimento"; mockup docs/mockups/alimenti-in-arrivo.html,
// proposta B). "Nome · Marca", chi lo manda, i quattro valori per 100 g, e
// le scelte secondo il confronto con il proprio catalogo:
// - nuovo: Aggiungi / Rifiuta;
// - uguale: "Hai già questo alimento, con gli stessi valori." e solo Ok;
// - diverso: "Hai già «…», con valori diversi.", "Confronta i valori"
//   (chiuso all'inizio) e "Usa questi valori" / "Tieni i miei". Senza
//   "Usa questi valori" se il proprio alimento non si può modificare.
// Durante un'azione del foglio tutti i pulsanti sono spenti (niente doppio
// tocco).
//
// In selezione (passo 6) a sinistra c'è il quadratino. Le righe nuove si
// spuntano con un tocco, e i loro pulsanti spariscono: si decide con la
// barra in fondo al foglio. Doppioni e uguali hanno il quadratino spento e
// tengono le loro scelte, come nel mockup. Solo le righe selezionabili
// partecipano al tieni premuto (data-tieni-premuto="alimentoInArrivo").

import { useState } from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import type { VoceInArrivo } from "@/lib/catalogo/alimentiInArrivo";
import {
  TESTO_VALORI_IDENTICI,
  testoDoppioneDiverso,
  testoValoriBrevi,
} from "@/lib/catalogo/testiAlimentiInArrivo";
import { etichettaAlimento } from "@/lib/repository/alimenti";
import TabellaConfronto from "./TabellaConfronto";

interface Props {
  voce: VoceInArrivo;
  username: string | null;
  // Un'azione del foglio è in corso (su questa riga o su un'altra).
  bloccata: boolean;
  onAggiungi: () => void;
  onRifiuta: () => void;
  onOk: () => void;
  onUsaValori: () => void;
  // null fuori dalla selezione.
  selezione: { spuntata: boolean; onSpunta: () => void } | null;
}

const PULSANTE = `min-h-9 rounded-[10px] border px-3 py-1.5 text-sm font-semibold disabled:opacity-50 ${CLASSE_FOCUS}`;
const PIENO = `${PULSANTE} border-accent-strong bg-accent-strong text-on-strong`;
const VUOTO = `${PULSANTE} border-border`;

export default function RigaAlimentoInArrivo({
  voce,
  username,
  bloccata,
  onAggiungi,
  onRifiuta,
  onOk,
  onUsaValori,
  selezione,
}: Props) {
  const [confrontoAperto, setConfrontoAperto] = useState(false);
  const { riga, confronto } = voce;
  const idConfronto = `confronto-${riga.id}`;
  const selezionabile = confronto.tipo === "nuovo";
  // In selezione, una riga nuova non mostra i suoi pulsanti.
  const pulsanti = !(selezione && selezionabile);

  const testi = (
    <>
      <p className="font-semibold leading-snug">{etichettaAlimento(riga)}</p>
          {confronto.tipo === "diverso" && (
            <p className="mt-0.5 text-sm text-warning">{testoDoppioneDiverso(confronto.mio)}</p>
          )}
          {confronto.tipo === "uguale" && (
            <p className="mt-0.5 text-sm text-muted">{TESTO_VALORI_IDENTICI}</p>
          )}
          <p className="mt-0.5 text-sm text-muted">{username ? `Da @${username}` : "Da un amico"}</p>
          <p className="mt-0.5 text-sm tabular-nums text-muted">{testoValoriBrevi(riga)}</p>
    </>
  );

  return (
    <li
      data-tieni-premuto={selezionabile ? "alimentoInArrivo" : undefined}
      data-id={riga.id}
      className={`border-b border-border px-3.5 py-3 last:border-b-0 ${
        selezionabile ? "riga-tieni-premuto" : ""
      } ${selezione?.spuntata ? "bg-[var(--capsula-attiva)]" : ""}`}
    >
      <div className="flex items-start gap-3">
        {selezione && <Spunta piena={selezione.spuntata} spenta={!selezionabile} />}
        <div className="min-w-0 flex-1">
          {selezione && selezionabile ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={selezione.spuntata}
              onClick={selezione.onSpunta}
              disabled={bloccata}
              className={`block w-full rounded text-left ${CLASSE_FOCUS}`}
            >
              {testi}
            </button>
          ) : (
            testi
          )}
          {confronto.tipo === "diverso" && (
            <button
              type="button"
              onClick={() => setConfrontoAperto((a) => !a)}
              aria-expanded={confrontoAperto}
              aria-controls={idConfronto}
              className={`mt-1 rounded py-1 text-sm font-semibold text-accent ${CLASSE_FOCUS}`}
            >
              {confrontoAperto ? "Nascondi il confronto ▴" : "Confronta i valori ▾"}
            </button>
          )}
        </div>

        {pulsanti && (
        <div className="flex w-[8.5rem] shrink-0 flex-col gap-2">
          {confronto.tipo === "nuovo" && (
            <>
              <button type="button" onClick={onAggiungi} disabled={bloccata} className={PIENO}>
                Aggiungi
              </button>
              <button type="button" onClick={onRifiuta} disabled={bloccata} className={VUOTO}>
                Rifiuta
              </button>
            </>
          )}
          {confronto.tipo === "uguale" && (
            <button type="button" onClick={onOk} disabled={bloccata} className={VUOTO}>
              Ok
            </button>
          )}
          {confronto.tipo === "diverso" && (
            <>
              {confronto.modificabile && (
                <button type="button" onClick={onUsaValori} disabled={bloccata} className={PIENO}>
                  Usa questi valori
                </button>
              )}
              <button type="button" onClick={onRifiuta} disabled={bloccata} className={VUOTO}>
                Tieni i miei
              </button>
            </>
          )}
        </div>
        )}
      </div>

      {confronto.tipo === "diverso" && confrontoAperto && (
        <TabellaConfronto righe={confronto.righe} id={idConfronto} />
      )}
    </li>
  );
}

// Il quadratino della selezione, come nel mockup: vuoto, pieno nel colore
// principale con il segno, o spento (un doppione, che non si seleziona).
function Spunta({ piena, spenta }: { piena: boolean; spenta: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-2 ${
        piena ? "border-accent-strong bg-accent-strong text-on-strong" : "border-border"
      } ${spenta ? "opacity-35" : ""}`}
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
