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
//
// Selezione multipla (passo 6): "Seleziona" in alto, oppure tieni premuto
// su un alimento (lo stesso gesto del catalogo, useTieniPremuto). Si
// spuntano solo gli alimenti nuovi, e mai due con lo stesso nome e la
// stessa marca (spunta, selezionaTutti in alimentiInArrivo.ts). In fondo
// la barra con Rifiuta e Aggiungi; con più di un alimento si chiede
// conferma, con uno solo no. Una chiamata sola, tutto o niente.

import { useEffect, useState } from "react";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { createClient } from "@/lib/supabase/client";
import { useTieniPremuto, type RigaPremuta } from "@/lib/tieniPremuto";
import {
  rispondiAlimentiCondivisi,
  type RispostaAlimento,
} from "@/lib/amici/alimentiCondivisi";
import {
  confrontaInArrivo,
  eSelezionabile,
  selezionaTutti,
  selezioneValida,
  spunta,
  valoriDi,
  type VoceInArrivo,
} from "@/lib/catalogo/alimentiInArrivo";
import {
  messaggioAlimentiAggiunti,
  messaggioValoriAggiornati,
  NOTA_FOGLIO_IN_ARRIVO,
  NOTA_SELEZIONE_IN_ARRIVO,
  TESTO_MIO_ALIMENTO_SPARITO,
  testiConfermaAggiungi,
  testiConfermaRifiuta,
  testoNonPiuInArrivo,
  TITOLO_FOGLIO_IN_ARRIVO,
  type TestiConferma,
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
import SheetConferma from "./SheetConferma";

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

// Il solo tipo di riga che si tiene premuto qui (useTieniPremuto).
const TIPI_RIGA: readonly "alimentoInArrivo"[] = ["alimentoInArrivo"];

type AzioneInBlocco = "aggiungi" | "rifiuta";

// La conferma della selezione, con gli id fissati quando si apre: è su
// quell'elenco che l'utente conferma.
type Conferma = TestiConferma & { azione: AzioneInBlocco; ids: string[] };

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
  // null = fuori dalla selezione; un insieme (anche vuoto) = in selezione.
  const [selezione, setSelezione] = useState<Set<string> | null>(null);
  const [conferma, setConferma] = useState<Conferma | null>(null);

  // Solo gli id ancora selezionabili: dopo una rilettura un alimento
  // sparito, o diventato doppione, non conta più.
  const scelti = selezione ? [...selezioneValida(selezione, voci)] : [];
  const ciSonoSelezionabili = voci.some(eSelezionabile);

  // Il tieni premuto entra in selezione con quella riga spuntata, o la
  // aggiunge se si è già in selezione. Tutti e due i rami del gesto, come
  // nel catalogo: qui non c'è niente da trascinare.
  function tieniPremuto(riga: RigaPremuta<"alimentoInArrivo">) {
    setSelezione((prima) => {
      const base = prima ?? new Set<string>();
      return base.has(riga.id) ? base : spunta(base, voci, riga.id);
    });
  }
  const { rif: rifLista } = useTieniPremuto({
    tipi: TIPI_RIGA,
    attivo: !inCorso && conferma === null,
    onMenu: tieniPremuto,
    onTrascinamento: { inizio: tieniPremuto, movimento: () => {}, fine: () => {} },
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inCorso && conferma === null) onChiudi();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onChiudi, inCorso, conferma]);

  function chiudi() {
    if (!inCorso) onChiudi();
  }

  // Una risposta al server per una o più righe. true se è andata (chi
  // chiama rilegge); con non_trovata o errore la barra lo dice.
  async function rispondi(ids: string[], risposta: RispostaAlimento): Promise<boolean> {
    const esito = await rispondiAlimentiCondivisi(createClient(), ids, risposta);
    if (esito === "ok") return true;
    if (esito === "non_trovata") {
      mostra({ testo: testoNonPiuInArrivo(ids.length) });
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

  // Aggiungi, per una riga o per la selezione. Prima il ricontrollo su
  // Dexie: se nel frattempo qualcuno è diventato un doppione non si chiama
  // il server. Una riga sola non fa niente (la riga mostra già le sue
  // scelte); in selezione si tolgono le spunte che non valgono più e
  // l'utente vede cosa resta prima di ripremere.
  async function aggiungi(ids: string[]) {
    const catalogo = await catalogoLocale(userId);
    const fresche = voci.map((v) => ({ riga: v.riga, confronto: confrontaInArrivo(catalogo, v.riga, userId) }));
    const valide = selezioneValida(new Set(ids), fresche);
    if (valide.size !== ids.length) {
      if (selezione) setSelezione(valide);
      return;
    }
    if (!(await rispondi(ids, "aggiungi"))) return;
    setSelezione(null);
    await sincronizzaBidirezionale(userId).catch(() => {});
    await ricarica();
    const perId = new Map(voci.map((v) => [v.riga.id, v.riga]));
    mostra(messaggioAlimentiAggiunti(ids.map((id) => etichettaAlimento(perId.get(id)!))));
  }

  async function rifiuta(ids: string[]) {
    if (!(await rispondi(ids, "rifiuta"))) return;
    setSelezione(null);
    await ricarica();
  }

  function rispondiSenzaBarra(voce: VoceInArrivo, risposta: "rifiuta" | "uguale") {
    void esegui(async () => {
      if (await rispondi([voce.riga.id], risposta)) await ricarica();
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

  // La barra della selezione: con un alimento solo subito, con di più la
  // conferma.
  function inBlocco(azione: AzioneInBlocco) {
    if (scelti.length === 0 || inCorso) return;
    if (scelti.length === 1) {
      void esegui(() => (azione === "aggiungi" ? aggiungi(scelti) : rifiuta(scelti)));
      return;
    }
    const testi =
      azione === "aggiungi"
        ? testiConfermaAggiungi(scelti.length, voci.some((v) => !eSelezionabile(v)))
        : testiConfermaRifiuta(scelti.length);
    setConferma({ ...testi, azione, ids: scelti });
  }

  function confermato() {
    if (!conferma) return;
    const { azione, ids } = conferma;
    setConferma(null);
    void esegui(() => (azione === "aggiungi" ? aggiungi(ids) : rifiuta(ids)));
  }

  const etichettaSelezionati = scelti.length === 1 ? "1 selezionato" : `${scelti.length} selezionati`;

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
          <div className="flex items-center justify-between gap-3">
            <h2 id="sheet-in-arrivo-titolo" className="font-display text-xl font-bold">
              {TITOLO_FOGLIO_IN_ARRIVO}
            </h2>
            {ciSonoSelezionabili && (
              <button
                type="button"
                onClick={() => setSelezione((s) => (s ? null : new Set()))}
                disabled={inCorso}
                className={`min-h-9 rounded px-1 font-semibold text-accent disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                {selezione ? "Annulla" : "Seleziona"}
              </button>
            )}
          </div>

          {selezione && (
            <div className="mt-1 flex justify-between">
              <button
                type="button"
                onClick={() => setSelezione(selezionaTutti(voci))}
                disabled={inCorso}
                className={`min-h-9 rounded px-1 text-sm font-semibold text-accent disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                Seleziona tutti
              </button>
              <button
                type="button"
                onClick={() => setSelezione(new Set())}
                disabled={inCorso}
                className={`min-h-9 rounded px-1 text-sm font-semibold text-accent disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                Deseleziona tutti
              </button>
            </div>
          )}

          <p className="mt-2 text-sm text-muted">
            {selezione ? NOTA_SELEZIONE_IN_ARRIVO : NOTA_FOGLIO_IN_ARRIVO}
          </p>

          <ul
            ref={rifLista}
            className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[18px] border border-border"
          >
            {voci.map((voce) => (
              <RigaAlimentoInArrivo
                key={voce.riga.id}
                voce={voce}
                username={nomi[voce.riga.user_id] ?? null}
                bloccata={inCorso}
                onAggiungi={() => void esegui(() => aggiungi([voce.riga.id]))}
                onRifiuta={() => rispondiSenzaBarra(voce, "rifiuta")}
                onOk={() => rispondiSenzaBarra(voce, "uguale")}
                onUsaValori={() => usaValori(voce)}
                selezione={
                  selezione
                    ? {
                        spuntata: scelti.includes(voce.riga.id),
                        onSpunta: () => setSelezione((s) => spunta(s ?? new Set(), voci, voce.riga.id)),
                      }
                    : null
                }
              />
            ))}
          </ul>

          {selezione ? (
            <div className="mt-4 flex items-center gap-2" role="toolbar" aria-label="Alimenti selezionati">
              <p className="flex-1 font-semibold" aria-live="polite">
                {etichettaSelezionati}
              </p>
              <button
                type="button"
                onClick={() => inBlocco("rifiuta")}
                disabled={inCorso || scelti.length === 0}
                className={`min-h-11 rounded-lg bg-warning-strong px-4 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                Rifiuta
              </button>
              <button
                type="button"
                onClick={() => inBlocco("aggiungi")}
                disabled={inCorso || scelti.length === 0}
                className={`min-h-11 rounded-lg bg-accent-strong px-4 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
              >
                Aggiungi
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={chiudi}
              disabled={inCorso}
              className={`mt-4 w-full rounded-lg border border-border p-3 disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Chiudi
            </button>
          )}
        </div>
      </div>

      {conferma && (
        <SheetConferma
          titolo={conferma.titolo}
          testo={conferma.testo}
          etichettaNo="Annulla"
          etichettaSi={conferma.etichettaSi}
          distruttiva={conferma.azione === "rifiuta"}
          inCorso={false}
          errore={null}
          onNo={() => setConferma(null)}
          onSi={confermato}
        />
      )}
    </>
  );
}
