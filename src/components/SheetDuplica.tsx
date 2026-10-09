"use client";

// "Duplica" dal menu contestuale di Oggi (PUNTO_DI_PARTENZA.md, sezione 3,
// "Tieni premuto", passo E): dove copiare un alimento o un pasto intero.
// Due campi:
// 1. Giorno: campo data con `max` = oggi, e parte dal giorno che si sta
//    guardando. Il `max` da solo non basta (alcuni browser lasciano
//    digitare una data oltre il massimo): la data si ricontrolla con
//    dataScrivibile, cioè contro oggiLocale (l'orologio locale, non UTC:
//    all'una di notte il giorno nuovo è già oggi).
// 2. Pasto: uno dei pasti che esistono nel GIORNO SCELTO (pastiValidiIl):
//    l'elenco cambia con la data. Parte da quello d'origine ("ripeti questo
//    pasto un altro giorno"), modificabile. Se quel giorno il pasto
//    d'origine non esiste, nessuna preselezione: "Scegli un pasto", e
//    Duplica spento finché non si sceglie (decisione del 2026-10-09:
//    copiare nel pasto sbagliato senza accorgersene è peggio di un tocco
//    in più). Tornando a un giorno in cui esiste, torna selezionato.
// "Duplica" resta spento finché uno dei due manca o la data non va bene.
// Annulla, tocco fuori o Esc: niente. Struttura come SheetScegliPasto.
// Largo al massimo quanto lo schermo: il campo data ha la classe
// .campo-data (globals.css, il motivo è lì) e il pannello non scorre mai in
// orizzontale, così niente può sporgere oltre il bordo.

import { useEffect, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { dataScrivibile, oggiLocale } from "@/lib/dataGiorno";
import { pastiValidiIl } from "@/lib/pasti/validitaPasti";
import type { Pasto } from "@/lib/db/tipi";

interface Props {
  titolo: string;
  giornoIniziale: string;
  // Tutte le righe di `pasti` dell'utente: quelle del giorno scelto le
  // sceglie lo sheet.
  pasti: Pasto[];
  pastoIniziale: string | null;
  inCorso?: boolean;
  errore?: string | null;
  onAnnulla: () => void;
  onConferma: (data: string, pastoId: string) => void;
}

export default function SheetDuplica({
  titolo,
  giornoIniziale,
  pasti,
  pastoIniziale,
  inCorso = false,
  errore = null,
  onAnnulla,
  onConferma,
}: Props) {
  const areaVisibile = useAreaVisibile();
  const [data, setData] = useState(giornoIniziale);
  const [pastoId, setPastoId] = useState(pastoIniziale ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla, inCorso]);

  const oggi = oggiLocale();
  const dataValida = dataScrivibile(data);
  // Senza una data valida non c'è un giorno di cui mostrare i pasti.
  const pastiDelGiorno = dataValida ? pastiValidiIl(pasti, data) : [];
  const pastoValido = pastiDelGiorno.some((p) => p.id === pastoId);
  const puoConfermare = dataValida && pastoValido && !inCorso;

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
          aria-label={titolo}
          className="flex max-h-full w-full max-w-md min-w-0 flex-col overflow-x-hidden overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-display text-xl font-bold">{titolo}</h2>

          <label htmlFor="duplica-giorno" className="mt-4 block text-sm font-medium">
            Giorno
          </label>
          <input
            id="duplica-giorno"
            type="date"
            max={oggi}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={`campo-data mt-1 w-full rounded-lg border border-border bg-background p-3 ${CLASSE_FOCUS}`}
          />
          {data !== "" && !dataValida && (
            <p className="mt-1 text-sm text-warning">Scegli oggi o un giorno passato.</p>
          )}

          <label htmlFor="duplica-pasto" className="mt-4 block text-sm font-medium">
            Pasto
          </label>
          <select
            id="duplica-pasto"
            // Il pasto d'origine resta in `pastoId` anche quando il giorno
            // scelto non ce l'ha: il menu mostra "Scegli un pasto" (un valore
            // che non è fra le opzioni mostrerebbe un menu vuoto), e tornando a
            // un giorno in cui esiste torna selezionato.
            value={pastoValido ? pastoId : ""}
            onChange={(e) => setPastoId(e.target.value)}
            className={`mt-1 w-full rounded-lg border border-border bg-background p-3 ${CLASSE_FOCUS}`}
          >
            {!pastoValido && <option value="">Scegli un pasto</option>}
            {pastiDelGiorno.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          {errore && <p className="mt-2 text-sm text-warning">{errore}</p>}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onAnnulla}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => puoConfermare && onConferma(data, pastoId)}
              disabled={!puoConfermare}
              className={`flex-1 rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Attendi..." : "Duplica"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
