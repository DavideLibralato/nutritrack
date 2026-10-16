"use client";

// Il foglio "In arrivo dagli amici" (PUNTO_DI_PARTENZA.md §3 "Amici",
// "Condividere un alimento"; mockup docs/mockups/alimenti-in-arrivo.html,
// proposta B). Si apre dalla riga "N alimenti in arrivo" in cima a
// Impostazioni > Alimenti. Ogni alimento ha le sue scelte
// (RigaAlimentoInArrivo); ogni risposta è una chiamata al server, poi
// l'elenco si rilegge. La pagina chiude il foglio quando non resta niente.
//
// - Aggiungi: prima si ricontrolla il doppione su Dexie (un alimento
//   uguale può essere arrivato con la sync dopo l'ultimo ridisegno); se
//   ora è un doppione non si chiama niente, e la riga mostra già le sue
//   scelte. Poi la risposta, la sincronizzazione (la copia nasce sul
//   server e arriva con la discesa) e solo dopo la rilettura: fino ad
//   allora l'app non saprebbe che la copia è un doppione degli altri in
//   arrivo. Barra "Aggiunto: …", senza Annulla.
// - Rifiuta, Tieni i miei, Ok: la risposta e la rilettura, senza barra.
// - Usa questi valori: usaValoriInArrivo (prima Dexie, poi il server) e
//   la barra con Annulla, che sta nella pagina (l'Annulla deve restare
//   anche se il foglio si chiude perché era l'ultimo).
// - Una risposta su un alimento che non è più in arrivo (non_trovata):
//   barra "Questo alimento non è più in arrivo." e rilettura.

import { useEffect, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { createClient } from "@/lib/supabase/client";
import {
  rispondiAlimentiCondivisi,
  type RispostaAlimento,
} from "@/lib/amici/alimentiCondivisi";
import { confrontaInArrivo, valoriDi, type VoceInArrivo } from "@/lib/catalogo/alimentiInArrivo";
import {
  messaggioAlimentiAggiunti,
  messaggioValoriAggiornati,
  NOTA_FOGLIO_IN_ARRIVO,
  TESTO_MIO_ALIMENTO_SPARITO,
  testoNonPiuInArrivo,
  TITOLO_FOGLIO_IN_ARRIVO,
} from "@/lib/catalogo/testiAlimentiInArrivo";
import { TESTO_AZIONE_NON_RIUSCITA } from "@/lib/amici/testiAmici";
import {
  catalogoLocale,
  etichettaAlimento,
  usaValoriInArrivo,
  type TracciaValoriInArrivo,
} from "@/lib/repository/alimenti";
import { sincronizzaBidirezionale } from "@/lib/sync/orchestratore";
import type { MessaggioBarra } from "@/lib/inserimento/testiBarra";
import RigaAlimentoInArrivo from "./RigaAlimentoInArrivo";

// Cosa serve alla pagina per l'Annulla di "Usa questi valori".
export interface AnnullaValori {
  traccia: TracciaValoriInArrivo;
  idCondivisione: string;
  nome: string;
}

interface Props {
  userId: string;
  voci: VoceInArrivo[];
  nomi: Record<string, string>;
  onChiudi: () => void;
  ricarica: () => Promise<void>;
  mostra: (messaggio: MessaggioBarra, annullaValori?: AnnullaValori) => void;
}

export default function SheetAlimentiInArrivo({
  userId,
  voci,
  nomi,
  onChiudi,
  ricarica,
  mostra,
}: Props) {
  const areaVisibile = useAreaVisibile();
  const [inCorso, setInCorso] = useState(false);

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

  // Una risposta al server per una riga. true se è andata (la pagina
  // rilegge); con non_trovata o errore la barra lo dice.
  async function rispondi(voce: VoceInArrivo, risposta: RispostaAlimento): Promise<boolean> {
    const esito = await rispondiAlimentiCondivisi(createClient(), [voce.riga.id], risposta);
    if (esito === "ok") return true;
    if (esito === "non_trovata") {
      mostra({ testo: testoNonPiuInArrivo(1) });
      await ricarica();
    } else {
      mostra({ testo: TESTO_AZIONE_NON_RIUSCITA });
    }
    return false;
  }

  // Un'azione alla volta, per tutto il foglio.
  async function esegui(azione: () => Promise<void>) {
    if (inCorso) return;
    setInCorso(true);
    try {
      await azione();
    } catch {
      mostra({ testo: TESTO_AZIONE_NON_RIUSCITA });
    } finally {
      setInCorso(false);
    }
  }

  function aggiungi(voce: VoceInArrivo) {
    void esegui(async () => {
      const catalogo = await catalogoLocale(userId);
      if (confrontaInArrivo(catalogo, voce.riga, userId).tipo !== "nuovo") return;
      if (!(await rispondi(voce, "aggiungi"))) return;
      await sincronizzaBidirezionale(userId).catch(() => {});
      await ricarica();
      mostra(messaggioAlimentiAggiunti([etichettaAlimento(voce.riga)]));
    });
  }

  function rispondiSenzaBarra(voce: VoceInArrivo, risposta: "rifiuta" | "uguale") {
    void esegui(async () => {
      if (await rispondi(voce, risposta)) await ricarica();
    });
  }

  function usaValori(voce: VoceInArrivo) {
    if (voce.confronto.tipo !== "diverso") return;
    const mio = voce.confronto.mio;
    void esegui(async () => {
      const esito = await usaValoriInArrivo(userId, mio.id, valoriDi(voce.riga), () =>
        rispondiAlimentiCondivisi(createClient(), [voce.riga.id], "valori_usati").then((e) =>
          e === "non_valido" ? "errore" : e
        )
      );
      await ricarica();
      if (esito.esito === "non_trovato") {
        mostra({ testo: TESTO_MIO_ALIMENTO_SPARITO });
        return;
      }
      const nome = etichettaAlimento(mio);
      mostra(messaggioValoriAggiornati(nome, esito.traccia.chiusura !== "errore"), {
        traccia: esito.traccia,
        idCondivisione: voce.riga.id,
        nome,
      });
    });
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
          aria-labelledby="sheet-in-arrivo-titolo"
          className="flex max-h-[88%] w-full max-w-md flex-col rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="sheet-in-arrivo-titolo" className="font-display text-xl font-bold">
            {TITOLO_FOGLIO_IN_ARRIVO}
          </h2>
          <p className="mt-2 text-sm text-muted">{NOTA_FOGLIO_IN_ARRIVO}</p>

          <ul className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[18px] border border-border">
            {voci.map((voce) => (
              <RigaAlimentoInArrivo
                key={voce.riga.id}
                voce={voce}
                username={nomi[voce.riga.user_id] ?? null}
                bloccata={inCorso}
                onAggiungi={() => aggiungi(voce)}
                onRifiuta={() => rispondiSenzaBarra(voce, "rifiuta")}
                onOk={() => rispondiSenzaBarra(voce, "uguale")}
                onUsaValori={() => usaValori(voce)}
              />
            ))}
          </ul>

          <button
            type="button"
            onClick={chiudi}
            disabled={inCorso}
            className={`mt-4 w-full rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            Chiudi
          </button>
        </div>
      </div>
    </>
  );
}
