"use client";

// Lo sheet quantità (PUNTO_DI_PARTENZA.md, sezione 5): UI di conferma
// quantità **unica**, identica per ogni sorgente di alimento. La usano la
// ricerca manuale e la creazione a mano da /aggiungi; domani, senza
// modifiche qui, anche Open Food Facts e la scansione etichetta.
//
// La stessa UI serve anche a **modificare una voce già inserita** (sezione
// 5: "una voce già inserita si tocca e riapre lo stesso sheet, con pasto e
// quantità modificabili, più un'azione di eliminazione"). In quel caso il
// chiamante passa `modifica`, la lista `pasti` con il selettore, e
// `onElimina`.
//
// Sezione 9.3: i grammi sono precompilati e già selezionati (basta
// confermare, o digitare subito il numero giusto senza cancellare).
// Tastierino numerico, nessun menu a tendina per la quantità.

import { useEffect, useRef, useState } from "react";
import type { AlimentoPerSheet } from "@/lib/inserimento/alimentoPerSheet";
import type { Pasto } from "@/lib/db/tipi";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { leggiGrammi } from "@/lib/inserimento/grammi";

interface Props {
  alimento: AlimentoPerSheet;
  nomePasto: string;
  // Grammi già nel campo all'apertura. In creazione si usa la porzione di
  // default dell'alimento; in modifica la quantità reale della voce.
  grammiIniziali?: number;
  inCorso?: boolean;
  errore?: string | null;
  onAnnulla: () => void;
  onConferma: (grammi: number) => void;
  // --- Preferito (facoltativo: solo se il chiamante gestisce i preferiti) ---
  // Stato e azione separati dal resto dello sheet: la stella scrive subito
  // nel repository, indipendentemente da Annulla/Conferma — se apri lo
  // sheet, la tocchi e poi annulli, il preferito resta comunque salvato.
  preferito?: boolean;
  onTogglePreferito?: () => void;
  // --- Solo in modifica di una voce esistente ---
  modifica?: boolean;
  // Se presenti tutti e tre, lo sheet mostra un selettore di pasto (spostare
  // la voce). In creazione non si passano: il pasto lo sceglie il titolo
  // della pagina /aggiungi, e lo sheet resta identico a com'era.
  pasti?: Pasto[];
  pastoSelezionatoId?: string;
  onCambiaPasto?: (pastoId: string) => void;
  onElimina?: () => void;
}

export default function SheetQuantita({
  alimento,
  nomePasto,
  grammiIniziali,
  inCorso = false,
  errore = null,
  onAnnulla,
  onConferma,
  preferito = false,
  onTogglePreferito,
  modifica = false,
  pasti,
  pastoSelezionatoId,
  onCambiaPasto,
  onElimina,
}: Props) {
  const [grammi, setGrammi] = useState(
    String(grammiIniziali ?? alimento.porzione_default_g)
  );
  const [confermaElim, setConfermaElim] = useState(false);
  const rifInput = useRef<HTMLInputElement>(null);
  // Ancorato al VISUAL viewport, non al layout viewport: su iOS la tastiera
  // riduce solo il primo, altrimenti lo sheet a volte finisce sotto la
  // tastiera invece che sopra (vedi il commento in src/lib/areaVisibile.ts).
  const areaVisibile = useAreaVisibile();

  const mostraSelettorePasto =
    !!pasti && pasti.length > 0 && pastoSelezionatoId != null && !!onCambiaPasto;

  // In modifica il pulsante di sinistra diventa "Elimina" (che poi chiede
  // conferma nella stessa riga). In creazione la voce non esiste ancora,
  // quindi resta "Annulla".
  const modificaConElimina = modifica && !!onElimina;

  // All'apertura: fuoco sul campo e testo selezionato, così un valore
  // diverso si digita senza prima cancellare.
  useEffect(() => {
    const el = rifInput.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  // Chiusura con Esc, come ci si aspetta da un pannello modale.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onAnnulla();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onAnnulla]);

  // Validazione condivisa (src/lib/inserimento/grammi.ts): limiti di
  // numeric(7,2) e arrotondamento a due decimali, così quello che si
  // conferma è esattamente quello che salverà anche il server.
  const lettura = leggiGrammi(grammi);
  const valido = lettura.errore === null;
  const grammiNum = lettura.grammi ?? 0;

  const fattore = grammiNum / 100;
  const kcal = Math.round(alimento.kcal_100g * fattore);
  const proteine = Math.round(alimento.proteine_100g * fattore);
  const carboidrati = Math.round(alimento.carboidrati_100g * fattore);
  const grassi = Math.round(alimento.grassi_100g * fattore);

  function conferma() {
    if (!valido || inCorso) return;
    onConferma(grammiNum);
  }

  return (
    <>
      {/* Due livelli separati, non un solo div che fa da sfondo scurito E da
          contenitore posizionato: lo sfondo copre tutto il LAYOUT viewport
          (fixed inset-0), così scurisce anche le zone che il visual viewport
          esclude (dietro la barra di Safari, dietro la tastiera) — altrimenti
          restava una striscia non scurita fra il pannello e la tastiera, con
          la pagina sotto a piena luminosità (bug: "si legge la stessa voce
          due volte"). Il contenitore del pannello resta ancorato al VISUAL
          viewport come prima, ma trasparente: lo scurimento lo fa solo lo
          sfondo sotto.
          Tap-per-chiudere su ENTRAMBI i livelli: chi tocca fuori dal pannello
          chiude comunque, che sia sopra o sotto l'area del visual viewport.
          Funziona per l'ordine nel DOM (non per z-index, uguale sui due):
          il contenitore viene dopo lo sfondo, quindi nella zona in cui i due
          si sovrappongono è lui a ricevere il tocco (chiude, propaga da
          `onClick` qui sotto); il pannello dentro ferma la propagazione
          (`stopPropagation`) così toccarlo non chiude nulla; fuori da quella
          zona non c'è il contenitore (è alto solo quanto l'area visibile),
          quindi il tocco arriva allo sfondo sottostante, che chiude anche
          lui. Verificato a mano: tocco sopra il pannello (zona scura normale)
          e tocco nella striscia sotto (fra pannello e tastiera) chiudono
          entrambi lo sheet. */}
      <div className="fixed inset-0 z-50 bg-foreground/40" onClick={onAnnulla} aria-hidden />
      <div
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 z-50 flex items-end justify-center"
        onClick={onAnnulla}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Quantità di ${alimento.nome}`}
          className="w-full max-w-md rounded-t-2xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
        {!mostraSelettorePasto && (
          <p className="text-xs uppercase tracking-wide text-muted">{nomePasto}</p>
        )}
        <div className="mt-1 flex items-start justify-between gap-2">
          <h2 className="font-display text-xl font-bold">{alimento.nome}</h2>
          {onTogglePreferito && (
            <button
              type="button"
              onClick={onTogglePreferito}
              aria-pressed={preferito}
              aria-label={
                preferito
                  ? `Togli ${alimento.nome} dai preferiti`
                  : `Aggiungi ${alimento.nome} ai preferiti`
              }
              className={`shrink-0 rounded p-1 ${preferito ? "text-accent" : "text-muted"} ${CLASSE_FOCUS}`}
            >
              <Stella piena={preferito} />
            </button>
          )}
        </div>

        {mostraSelettorePasto && (
          <>
            <label htmlFor="sheet-pasto" className="mt-4 block text-sm font-medium">
              Pasto
            </label>
            <select
              id="sheet-pasto"
              value={pastoSelezionatoId}
              onChange={(e) => onCambiaPasto!(e.target.value)}
              className={`mt-1 w-full rounded-lg border border-border bg-background p-3 ${CLASSE_FOCUS}`}
            >
              {pasti!.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </>
        )}

        <label htmlFor="sheet-grammi" className="mt-4 block text-sm font-medium">
          Quantità (g)
        </label>
        <input
          id="sheet-grammi"
          ref={rifInput}
          type="text"
          inputMode="decimal"
          value={grammi}
          onChange={(e) => setGrammi(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") conferma();
          }}
          className={`mt-1 w-full rounded-lg border border-border p-3 text-lg ${CLASSE_FOCUS}`}
        />

        {/* Ordine come sulle etichette dei prodotti: kcal, Grassi, Carboidrati,
            Proteine (PUNTO_DI_PARTENZA.md §7, "Le barre macro"). */}
        {/* Campo vuoto: l'invito neutro di sempre. Campo scritto ma non
            valido (zero, troppo grande...): il motivo, col colore d'avviso. */}
        <p
          className={`mt-3 text-sm ${!valido && grammi.trim() !== "" ? "text-warning" : "text-muted"}`}
        >
          {valido
            ? `${kcal} kcal · G ${grassi} g · C ${carboidrati} g · P ${proteine} g`
            : grammi.trim() === ""
              ? "Inserisci una quantità in grammi"
              : lettura.errore}
        </p>

        {errore && <p className="mt-2 text-sm text-warning">{errore}</p>}

        {/* Una sola riga di pulsanti, [sinistra] [destra], sempre stessa
            forma e posizione:
            - creazione:            [Annulla]      [Aggiungi]
            - modifica:             [Elimina]      [Salva]
            - modifica, conferma:   [No]           [Sì, elimina]
            In modifica "Annulla" è ridondante — per annullare si tocca fuori
            dallo sheet. */}
        <div className="mt-5 flex gap-3">
          {!modificaConElimina ? (
            <button
              type="button"
              onClick={onAnnulla}
              className={`flex-1 rounded-lg border border-border p-3 ${CLASSE_FOCUS}`}
            >
              Annulla
            </button>
          ) : confermaElim ? (
            <button
              type="button"
              onClick={() => setConfermaElim(false)}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              No
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfermaElim(true)}
              disabled={inCorso}
              className={`flex-1 rounded-lg border border-warning p-3 text-warning disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Elimina
            </button>
          )}

          {modificaConElimina && confermaElim ? (
            <button
              type="button"
              onClick={() => onElimina?.()}
              disabled={inCorso}
              className={`flex-1 rounded-lg bg-warning p-3 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {inCorso ? "Elimino..." : "Sì, elimina"}
            </button>
          ) : (
            <button
              type="button"
              onClick={conferma}
              disabled={!valido || inCorso}
              className={`flex-1 rounded-lg bg-accent p-3 font-medium text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {modifica
                ? inCorso
                  ? "Salvo..."
                  : "Salva"
                : inCorso
                  ? "Aggiungo..."
                  : "Aggiungi"}
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

// Stella dei preferiti: piena e colorata se l'alimento è già un preferito,
// solo contorno altrimenti.
function Stella({ piena }: { piena: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={piena ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3.5l2.3 4.9 5.3.7-3.9 3.8 1 5.3-4.7-2.5-4.7 2.5 1-5.3-3.9-3.8 5.3-.7Z" />
    </svg>
  );
}
