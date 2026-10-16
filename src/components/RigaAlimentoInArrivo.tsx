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
// tocco); quelli della riga che lavora dicono cosa sta facendo.

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
}: Props) {
  const [confrontoAperto, setConfrontoAperto] = useState(false);
  const { riga, confronto } = voce;
  const idConfronto = `confronto-${riga.id}`;

  return (
    <li className="border-b border-border px-3.5 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{etichettaAlimento(riga)}</p>
          {confronto.tipo === "diverso" && (
            <p className="mt-0.5 text-sm text-warning">{testoDoppioneDiverso(confronto.mio)}</p>
          )}
          {confronto.tipo === "uguale" && (
            <p className="mt-0.5 text-sm text-muted">{TESTO_VALORI_IDENTICI}</p>
          )}
          <p className="mt-0.5 text-sm text-muted">{username ? `Da @${username}` : "Da un amico"}</p>
          <p className="mt-0.5 text-sm tabular-nums text-muted">{testoValoriBrevi(riga)}</p>
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
      </div>

      {confronto.tipo === "diverso" && confrontoAperto && (
        <TabellaConfronto righe={confronto.righe} id={idConfronto} />
      )}
    </li>
  );
}
