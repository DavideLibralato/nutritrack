"use client";

// Il foglio dei doppioni (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto"):
// si apre quando uno o più alimenti che si stanno spostando (o duplicando,
// passo E) ci sono già nel pasto di destinazione — stesso alimento del
// catalogo, mai lo stesso nome.
//
// Com'è fatto (mockup approvato il 5/10, "Opzione A, completa: quattro
// scelte per alimento"): ogni alimento in comune ha il suo blocco, con
// - il nome e sotto le quantità ("Pranzo 100 g · Cena 50 g": prima quella
//   che c'è nel pasto di destinazione, poi quella che arriva);
// - la sua griglia 2×2, con Somma già scelta. Il pulsante Somma mostra il
//   totale ("Somma (150 g)"); la quarta scelta ha l'etichetta passata da
//   fuori ("Non spostarlo" qui, "Non duplicarlo" per Duplica) e, quando è
//   scelta, il colore d'avviso;
// - con "Scrivi quantità", sotto il blocco il campo "Quantità __ g";
// - una riga con l'esito ("→ Una riga da 150 g"…, testoEsitoDoppione),
//   nel colore d'avviso per la quarta scelta.
// Con più di un alimento, sotto il titolo: "Scegli cosa fare per
// ciascuno." Le regole di cosa si scrive sono in pianoSpostamento.ts: qui si
// raccolgono solo le scelte. Annulla, tocco fuori o Esc annullano TUTTA
// l'operazione: il foglio non ha scritto niente.
//
// Un campo di "Scrivi quantità" vuoto spegne il bottone di conferma, e sotto
// il bottone compare "Per salvare mancano: …" con il nome dell'alimento
// (lo stesso linguaggio di Crea alimento). Un valore scritto ma non valido
// mostra il motivo sotto il campo.
//
// Tastiera aperta (iPhone): il pannello è ancorato al visual viewport
// (useAreaVisibile, come SheetQuantita) e alto al massimo quanto l'area
// visibile. Se non ci sta, scorre solo l'elenco dei blocchi: titolo e
// bottoni restano sempre visibili sopra la tastiera.

import { useEffect, useRef, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { leggiGrammi } from "@/lib/inserimento/grammi";
import { testoEsitoDoppione } from "@/lib/diario/testiSpostamento";
import type { Doppione, SceltaDoppione } from "@/lib/diario/pianoSpostamento";

type TipoScelta = SceltaDoppione["tipo"];

interface Props {
  titolo: string;
  doppioni: Doppione[];
  // I nomi dei due pasti, per le quantità di ogni blocco.
  nomeDestinazione: string;
  nomePartenza: string;
  // La quarta scelta: "Non spostarlo" / "Non duplicarlo"...
  etichettaEscludi: string;
  // ...e la sua riga di esito: "Resta in Cena, non si sposta".
  esitoEscludi: string;
  // Il bottone di conferma: "Sposta" / "Duplica".
  etichettaConferma: string;
  // Testo informativo sotto il titolo (es. "nel frattempo l'elenco è
  // cambiato"), non un errore.
  avviso?: string | null;
  inCorso?: boolean;
  errore?: string | null;
  onAnnulla: () => void;
  onConferma: (scelte: Record<string, SceltaDoppione>) => void;
}

function grammi(g: number): string {
  return `${g.toLocaleString("it-IT", { maximumFractionDigits: 2 })} g`;
}

export default function SheetDoppioni({
  titolo,
  doppioni,
  nomeDestinazione,
  nomePartenza,
  etichettaEscludi,
  esitoEscludi,
  etichettaConferma,
  avviso = null,
  inCorso = false,
  errore = null,
  onAnnulla,
  onConferma,
}: Props) {
  const areaVisibile = useAreaVisibile();
  // Una scelta per alimento (Somma se non toccata) e i valori scritti.
  const [tipi, setTipi] = useState<Record<string, TipoScelta>>({});
  const [valori, setValori] = useState<Record<string, string>>({});
  // L'alimento appena passato a "Scrivi quantità": il fuoco va al suo campo.
  const [daFocalizzare, setDaFocalizzare] = useState<string | null>(null);
  const rifCampi = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso) onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla, inCorso]);

  useEffect(() => {
    if (daFocalizzare) rifCampi.current[daFocalizzare]?.focus({ preventScroll: true });
  }, [daFocalizzare]);

  const tipoDi = (id: string): TipoScelta => tipi[id] ?? "somma";
  const letture = Object.fromEntries(
    doppioni.map((d) => [d.alimentoId, leggiGrammi(valori[d.alimentoId] ?? "")])
  );
  const conScrivi = doppioni.filter((d) => tipoDi(d.alimentoId) === "scrivi");
  const mancanti = conScrivi
    .filter((d) => (valori[d.alimentoId] ?? "").trim() === "")
    .map((d) => d.nome);
  const nonValidi = conScrivi.some((d) => letture[d.alimentoId].errore !== null);
  const puoConfermare = !inCorso && !nonValidi;

  function scegli(id: string, tipo: TipoScelta) {
    setTipi((t) => ({ ...t, [id]: tipo }));
    setDaFocalizzare(tipo === "scrivi" ? id : null);
  }

  function conferma() {
    if (!puoConfermare) return;
    const scelte: Record<string, SceltaDoppione> = {};
    for (const d of doppioni) {
      const tipo = tipoDi(d.alimentoId);
      scelte[d.alimentoId] =
        tipo === "scrivi" ? { tipo, grammi: letture[d.alimentoId].grammi! } : { tipo };
    }
    onConferma(scelte);
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
          aria-label={titolo}
          className="flex max-h-full w-full max-w-md flex-col rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="shrink-0 font-display text-xl font-bold">{titolo}</h2>
          {doppioni.length > 1 && (
            <p className="mt-1 shrink-0 text-sm text-muted">Scegli cosa fare per ciascuno.</p>
          )}
          {avviso && <p className="mt-2 shrink-0 text-sm leading-relaxed">{avviso}</p>}

          {/* I blocchi sono l'unica parte che scorre. */}
          <ul className="mt-3 min-h-0 overflow-y-auto">
            {doppioni.map((d) => {
              const tipo = tipoDi(d.alimentoId);
              const lettura = letture[d.alimentoId];
              const valore = valori[d.alimentoId] ?? "";
              const idCampo = `doppione-${d.alimentoId}`;
              const totale = Math.round((d.grammiEsistenti + d.grammiInArrivo) * 100) / 100;
              const opzioni: { tipo: TipoScelta; etichetta: string }[] = [
                { tipo: "somma", etichetta: `Somma (${grammi(totale)})` },
                { tipo: "separati", etichetta: "Tieni separati" },
                { tipo: "scrivi", etichetta: "Scrivi quantità" },
                { tipo: "escludi", etichetta: etichettaEscludi },
              ];
              return (
                <li
                  key={d.alimentoId}
                  role="group"
                  aria-label={d.nome}
                  className="border-b border-border py-3 first:pt-0 last:border-b-0"
                >
                  <p className="truncate font-medium">{d.nome}</p>
                  <p className="text-sm text-muted">
                    {nomeDestinazione} {grammi(d.grammiEsistenti)} · {nomePartenza}{" "}
                    {grammi(d.grammiInArrivo)}
                  </p>

                  <div
                    role="radiogroup"
                    aria-label={`Cosa fare con ${d.nome}`}
                    className="mt-2 grid grid-cols-2 gap-2"
                  >
                    {opzioni.map((o) => {
                      const scelto = tipo === o.tipo;
                      const avvisoScelto = scelto && o.tipo === "escludi";
                      return (
                        <button
                          key={o.tipo}
                          type="button"
                          role="radio"
                          aria-checked={scelto}
                          onClick={() => scegli(d.alimentoId, o.tipo)}
                          disabled={inCorso}
                          className={`min-h-11 rounded-lg border p-2 text-sm disabled:opacity-50 ${
                            avvisoScelto
                              ? "border-warning font-medium text-warning"
                              : scelto
                                ? "border-accent bg-[var(--capsula-attiva)] font-medium text-[var(--testo-capsula)]"
                                : "border-border"
                          } ${CLASSE_FOCUS}`}
                        >
                          {o.etichetta}
                        </button>
                      );
                    })}
                  </div>

                  {tipo === "scrivi" && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <label htmlFor={idCampo} className="text-sm">
                          Quantità
                        </label>
                        <input
                          id={idCampo}
                          ref={(el) => {
                            rifCampi.current[d.alimentoId] = el;
                          }}
                          type="text"
                          inputMode="decimal"
                          value={valore}
                          onChange={(e) =>
                            setValori((v) => ({ ...v, [d.alimentoId]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") conferma();
                          }}
                          className={`w-28 rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
                        />
                        <span className="text-sm">g</span>
                      </div>
                      {valore.trim() !== "" && lettura.errore && (
                        <p className="mt-1 text-sm text-warning">{lettura.errore}</p>
                      )}
                    </div>
                  )}

                  <p className={`mt-2 text-sm ${tipo === "escludi" ? "text-warning" : "text-muted"}`}>
                    {testoEsitoDoppione(d, tipo, lettura.grammi, esitoEscludi)}
                  </p>
                </li>
              );
            })}
          </ul>

          {errore && <p className="mt-2 shrink-0 text-sm text-warning">{errore}</p>}

          <div className="mt-4 flex shrink-0 gap-3">
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
              onClick={conferma}
              disabled={!puoConfermare}
              className={`flex-1 rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Attendi..." : etichettaConferma}
            </button>
          </div>
          {mancanti.length > 0 && (
            <p className="mt-2 shrink-0 text-sm text-muted">Per salvare mancano: {mancanti.join(", ")}.</p>
          )}
        </div>
      </div>
    </>
  );
}
