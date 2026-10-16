"use client";

// Impostazioni > Alimenti: il catalogo personale (PUNTO_DI_PARTENZA.md,
// sezione 3, "Alimenti"; mockup approvato docs/mockups/catalogo-alimenti.html).
//
// - L'elenco: solo gli alimenti che l'utente può modificare
//   (alimentiModificabili: i suoi, non verificati), con ricerca per nome e
//   ordinamento Più usati / A → Z / Z → A / Meno usati (ordinaCatalogo). Gli
//   usi si contano dalle voci di diario (contaUsi) e non si mostrano.
// - Un tocco su una riga apre "Modifica alimento", il "+" "Nuovo alimento":
//   lo stesso CreaAlimentoForm di Aggiungi, a pagina intera. Il form è uno
//   stato della pagina, non una rotta con l'id: una rotta
//   /impostazioni/alimenti/[id] non può stare fra le pagine salvate dal
//   service worker, quindi offline non si aprirebbe.
// - Elimina, dal form: la conferma nella riga del form, poi la barra con
//   "Annulla", come in Aggiungi.
// - Tieni premuto su una riga (lo stesso gesto di Oggi, useTieniPremuto):
//   selezione multipla. In selezione un tocco spunta o toglie la spunta, e
//   togliendo l'ultima si esce. La barra di selezione prende il posto della
//   tab bar: "N selezionati", Elimina, Annulla. Niente icona condividi
//   finché non esiste Amici. Elimina apre SheetConferma con cosa verrà
//   toccato oltre al catalogo (confermaEliminazione.ts), poi tutto o niente
//   in una transazione (eliminaAlimenti) e la barra con "Annulla"
//   (ripristinaAlimenti).

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  repositoryComposizioni,
  repositoryComposizioniVoci,
  repositoryPreferiti,
  repositoryVociDiario,
} from "@/lib/repository";
import { catalogoLocale, filtraPerNome } from "@/lib/repository/alimenti";
import {
  eliminaAlimenti,
  ripristinaAlimenti,
  type TracciaEliminazioneAlimenti,
  type TracciaRimozione,
} from "@/lib/repository/composizioni";
import { alimentiModificabili, eModificabile } from "@/lib/catalogo/alimentiModificabili";
import {
  contaUsi,
  ordinaCatalogo,
  type OrdineCatalogo,
} from "@/lib/catalogo/ordinamentoCatalogo";
import {
  conseguenzeEliminazione,
  testiConfermaEliminazione,
} from "@/lib/catalogo/confermaEliminazione";
import {
  messaggioDopoRipristino,
  testoRipristinoNonRiuscito,
} from "@/lib/inserimento/testiAlimentiCancellati";
import {
  messaggioAlimentiEliminati,
  messaggioAlimentoCreato,
  type MessaggioBarra,
} from "@/lib/inserimento/testiBarra";
import { useTieniPremuto, type RigaPremuta } from "@/lib/tieniPremuto";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import type { Alimento } from "@/lib/db/tipi";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import RigaAlimentoCatalogo from "@/components/RigaAlimentoCatalogo";
import CreaAlimentoForm from "@/components/CreaAlimentoForm";
import BarraAnnulla from "@/components/BarraAnnulla";
import SheetConferma from "@/components/SheetConferma";

const ORDINI: { valore: OrdineCatalogo; etichetta: string }[] = [
  { valore: "piu-usati", etichetta: "Più usati" },
  { valore: "a-z", etichetta: "A → Z" },
  { valore: "z-a", etichetta: "Z → A" },
  { valore: "meno-usati", etichetta: "Meno usati" },
];

// L'unico tipo di riga che si può tenere premuto qui (useTieniPremuto).
const TIPI_RIGA: readonly "alimento"[] = ["alimento"];

// Spazio in fondo all'elenco: l'ultima riga deve poter salire sopra il "+"
// e la tab bar (lo stesso ingombro di Oggi, che ha "+ Aggiungi" alla stessa
// altezza).
const CLASSE_PAGINA =
  "mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 pb-[calc(var(--ingombro-oggi)+1.5rem)]";

type Modulo = { tipo: "nuovo" } | { tipo: "modifica"; alimento: Alimento };

type Barra = MessaggioBarra & {
  // Cambia a ogni messaggio: è la `key` della barra, così il timer riparte.
  id: string;
  // Presente solo dopo un'eliminazione: cosa rimettere con "Annulla", e i
  // nomi per i messaggi.
  annullabile?: { nomi: string[]; traccia: TracciaEliminazioneAlimenti };
};

// Lo sheet di conferma dell'eliminazione dalla selezione. Gli id e i nomi
// sono fissati all'apertura: è su quell'elenco che l'utente conferma.
interface Conferma {
  ids: string[];
  nomi: string[];
  titolo: string;
  testo: string;
  inCorso: boolean;
  errore: string | null;
}

export default function AlimentiPage() {
  const userId = useUtenteId();

  const catalogo = useLiveQuery(async () => {
    if (!userId) return undefined;
    return catalogoLocale(userId);
  }, [userId]);
  // Lo storico del diario, solo per contare gli usi di ogni alimento.
  const voci = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryVociDiario.ottieniTutti(userId);
  }, [userId]);
  // Per i conteggi dello sheet di conferma (pasti salvati e preferiti
  // toccati dall'eliminazione).
  const composizioni = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryComposizioni.ottieniTutti(userId);
  }, [userId]);
  const composizioniVoci = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryComposizioniVoci.ottieniTutti(userId);
  }, [userId]);
  const preferiti = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryPreferiti.ottieniTutti(userId);
  }, [userId]);

  const [query, setQuery] = useState("");
  const [ordine, setOrdine] = useState<OrdineCatalogo>("piu-usati");
  const [modulo, setModulo] = useState<Modulo | null>(null);
  const [barra, setBarra] = useState<Barra | null>(null);
  // null = fuori dalla selezione; un insieme (mai vuoto) = in selezione.
  const [selezione, setSelezione] = useState<Set<string> | null>(null);
  const [conferma, setConferma] = useState<Conferma | null>(null);

  // Il tieni premuto entra in selezione con quella riga spuntata (o la
  // aggiunge, se si è già in selezione). Tutti e due i rami del gesto
  // portano qui: il "menu" (dito fermo) e il "trascina" (dito che si muove
  // dopo il sollevamento), perché in questa pagina non c'è niente da
  // trascinare. Il click che il browser manda dopo il gesto lo blocca
  // l'hook: non apre "Modifica alimento" né toglie la spunta appena messa.
  function seleziona(riga: RigaPremuta<"alimento">) {
    setBarra(null);
    setSelezione((prima) => new Set(prima ?? []).add(riga.id));
  }
  const { rif: rifLista } = useTieniPremuto({
    tipi: TIPI_RIGA,
    attivo: conferma === null,
    onMenu: seleziona,
    onTrascinamento: { inizio: seleziona, movimento: () => {}, fine: () => {} },
  });

  // Dove era arrivato lo scorrimento quando si è aperto il form: alla
  // chiusura l'elenco ricompare e si torna lì. Come in Preferiti.
  const scorrimentoElenco = useRef<number | null>(null);
  useEffect(() => {
    if (modulo !== null || scorrimentoElenco.current === null) return;
    window.scrollTo(0, scorrimentoElenco.current);
    scorrimentoElenco.current = null;
  }, [modulo]);

  if (
    !userId ||
    catalogo === undefined ||
    voci === undefined ||
    composizioni === undefined ||
    composizioniVoci === undefined ||
    preferiti === undefined
  ) {
    return (
      <main className={CLASSE_PAGINA}>
        <IntestazioneSottopagina titolo="Alimenti" />
      </main>
    );
  }

  const miei = alimentiModificabili(catalogo, userId);
  const elenco = ordinaCatalogo(filtraPerNome(miei, query), contaUsi(voci), ordine);
  // Solo gli id ancora nel catalogo: un alimento selezionato e intanto
  // cancellato altrove (sync) non si conta e non si elimina di nuovo.
  const perId = new Map(miei.map((a) => [a.id, a]));
  const selezionati = selezione ? [...selezione].filter((id) => perId.has(id)) : [];

  function mostra(messaggio: MessaggioBarra, annullabile?: Barra["annullabile"]) {
    setBarra({ id: crypto.randomUUID(), ...messaggio, annullabile });
  }

  function apri(m: Modulo) {
    scorrimentoElenco.current = window.scrollY;
    setBarra(null);
    setModulo(m);
  }

  function tocco(a: Alimento) {
    if (!selezione) {
      apri({ tipo: "modifica", alimento: a });
      return;
    }
    const nuova = new Set(selezione);
    if (nuova.has(a.id)) nuova.delete(a.id);
    else nuova.add(a.id);
    setSelezione(nuova.size > 0 ? nuova : null);
  }

  function apriConferma() {
    if (!userId || selezionati.length === 0) return;
    const nomi = selezionati.map((id) => perId.get(id)!.nome);
    const conseguenze = conseguenzeEliminazione(
      selezionati,
      catalogo!,
      composizioni!,
      composizioniVoci!,
      preferiti!
    );
    setConferma({
      ids: selezionati,
      nomi,
      ...testiConfermaEliminazione(nomi, conseguenze),
      inCorso: false,
      errore: null,
    });
  }

  async function eliminaSelezionati() {
    if (!userId || !conferma || conferma.inCorso) return;
    setConferma({ ...conferma, inCorso: true, errore: null });
    try {
      const traccia = await eliminaAlimenti(userId, conferma.ids);
      // I nomi di ciò che è stato eliminato DAVVERO: eliminaAlimenti salta
      // un alimento già cancellato altrove nel frattempo.
      const eliminati = new Set(traccia.idAlimenti);
      const nomi = conferma.ids
        .map((id, i) => (eliminati.has(id) ? conferma.nomi[i] : null))
        .filter((n): n is string => n !== null);
      setConferma(null);
      setSelezione(null);
      if (nomi.length > 0) mostra(messaggioAlimentiEliminati(nomi), { nomi, traccia });
    } catch {
      // Tutto o niente: non è cambiato niente, si può riprovare.
      setConferma({
        ...conferma,
        inCorso: false,
        errore: "Non è stato possibile eliminare. Riprova.",
      });
    }
  }

  // "Annulla" nella barra, dopo un'eliminazione dal form o dalla
  // selezione. La barra si toglie PRIMA di scrivere, così un secondo tocco
  // ravvicinato non lancia un secondo ripristino.
  async function annullaEliminazione() {
    const annullabile = barra?.annullabile;
    if (!userId || !annullabile) return;
    setBarra(null);
    try {
      const esito = await ripristinaAlimenti(userId, annullabile.traccia);
      mostra(messaggioDopoRipristino(annullabile.nomi, esito));
    } catch {
      mostra({ testo: testoRipristinoNonRiuscito(annullabile.nomi) }, annullabile);
    }
  }

  // Con il form aperto si disegna SOLO il form, a pagina intera, non
  // l'elenco sotto: con l'elenco nel documento, toccando un campo iOS fa
  // scorrere la pagina e sopra la tastiera ricompare l'elenco (provato su
  // iPhone l'11/10 in Preferiti, stessa soluzione).
  if (modulo) {
    return (
      <SchermataModulo
        userId={userId}
        modulo={modulo}
        onChiudi={() => setModulo(null)}
        onApri={(a) => setModulo({ tipo: "modifica", alimento: a })}
        puoAprire={(a) => eModificabile(a, userId)}
        onCreato={(a) => {
          setModulo(null);
          mostra(messaggioAlimentoCreato(a.nome));
        }}
        onEliminato={(a, traccia: TracciaRimozione) => {
          setModulo(null);
          mostra(messaggioAlimentiEliminati([a.nome]), {
            nomi: [a.nome],
            traccia: { ...traccia, idAlimenti: [a.id] },
          });
        }}
      />
    );
  }

  return (
    <main className={CLASSE_PAGINA}>
      <IntestazioneSottopagina titolo="Alimenti" />

      {miei.length === 0 ? (
        <div className="rounded-[20px] border border-border bg-surface px-[18px] py-[22px]">
          <h2 className="font-semibold">Ancora nessun alimento</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Crea il primo con il + qui sotto, oppure da Aggiungi quando la ricerca non trova
            quello che cerchi.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Lente className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca un alimento"
              aria-label="Cerca un alimento"
              enterKeyHint="search"
              className={`h-11 w-full rounded-full border border-border bg-background pl-11 pr-11 text-base ${CLASSE_FOCUS}`}
            />
            {query !== "" && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Svuota la ricerca"
                className={`absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted ${CLASSE_FOCUS}`}
              >
                <Croce />
              </button>
            )}
          </div>

          <div className="-mt-1 flex items-center justify-between px-1">
            <p className="text-sm text-muted">
              {elenco.length === 1 ? "1 alimento" : `${elenco.length} alimenti`}
            </p>
            {/* Un <select> nativo: sul telefono apre il selettore di
                sistema, come il titolo del pasto in Aggiungi. */}
            <div className="relative">
              <select
                value={ordine}
                onChange={(e) => setOrdine(e.target.value as OrdineCatalogo)}
                aria-label="Ordina"
                className={`min-h-11 appearance-none rounded bg-transparent pr-6 text-right text-sm font-semibold ${CLASSE_FOCUS}`}
              >
                {ORDINI.map((o) => (
                  <option key={o.valore} value={o.valore}>
                    {o.etichetta}
                  </option>
                ))}
              </select>
              <ChevronGiu className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted" />
            </div>
          </div>

          {/* Come nel mockup, sopra l'elenco; non in selezione, dove si sa
              già, e non con un alimento solo, dove non serve. */}
          {!selezione && miei.length > 1 && (
            <p className="-mt-2 px-1 text-sm text-muted">
              Tieni premuto su un alimento per selezionarne più di uno insieme.
            </p>
          )}

          {elenco.length > 0 ? (
            <ul ref={rifLista} className="-mt-2">
              {elenco.map((a) => (
                <RigaAlimentoCatalogo
                  key={a.id}
                  alimento={a}
                  selezionato={selezione ? selezione.has(a.id) : null}
                  onTocco={() => tocco(a)}
                />
              ))}
            </ul>
          ) : (
            <p className="px-6 pt-10 text-center text-sm leading-relaxed text-muted">
              Nessun alimento trovato.
              <br />
              Prova un altro termine di ricerca.
            </p>
          )}
        </>
      )}

      {/* Sopra la tab bar, alla stessa altezza di "+ Aggiungi" in Oggi: la
          barra sta appena sopra il "+" (`sopra`), senza coprirlo.
          `data-pulsante-aggiungi` alza la sfumatura dietro le barre fino a
          coprire anche il "+" (regola in globals.css); come la tab bar, si
          nasconde mentre un campo ha il fuoco. In selezione il "+" non c'è:
          creare un alimento a metà di una selezione la confonderebbe. */}
      <div
        data-pulsante-aggiungi
        data-nascondi-mentre-scrivi
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--ingombro-tab-bar)+var(--spazio-fra-barre))] z-30 mx-auto max-w-md"
      >
        {barra && (
          <BarraAnnulla
            key={barra.id}
            testo={barra.testo}
            nome={barra.nome}
            coda={barra.coda}
            icona={barra.icona}
            durataMs={barra.durataMs}
            azione={
              barra.annullabile
                ? { etichetta: "Annulla", onClick: () => void annullaEliminazione() }
                : undefined
            }
            sopra
            onChiudi={() => setBarra(null)}
          />
        )}
        {!selezione && (
          <div className="flex justify-end px-4">
            <button
              type="button"
              onClick={() => apri({ tipo: "nuovo" })}
              aria-label="Nuovo alimento"
              style={{ boxShadow: "var(--ombra-fluttuante)" }}
              className={`pointer-events-auto flex h-[var(--aggiungi-altezza)] w-[var(--aggiungi-altezza)] items-center justify-center rounded-full bg-accent-strong text-on-strong ${CLASSE_FOCUS}`}
            >
              <Piu />
            </button>
          </div>
        )}
      </div>

      {/* La barra di selezione prende il posto della tab bar: stessa forma
          e stessa posizione della pillola (BarraNavigazione), ma con fondo
          pieno, non "vetro", così la pillola sotto non si vede; z-40 la
          mette sopra (la pillola è z-30). Come la pillola, si nasconde
          mentre un campo ha il fuoco (una ricerca durante la selezione). */}
      {selezione && (
        <div
          role="toolbar"
          data-nascondi-mentre-scrivi
          aria-label="Alimenti selezionati"
          style={{ boxShadow: "var(--ombra-fluttuante)" }}
          className="fixed inset-x-4 bottom-[var(--tab-bar-distanza)] z-40 mx-auto flex h-[var(--tab-bar-altezza)] max-w-md items-center gap-2 rounded-full border border-border bg-surface pl-6 pr-2"
        >
          <p className="flex-1 font-semibold" aria-live="polite">
            {selezionati.length === 1 ? "1 selezionato" : `${selezionati.length} selezionati`}
          </p>
          <button
            type="button"
            onClick={apriConferma}
            aria-label="Elimina"
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-warning text-warning ${CLASSE_FOCUS}`}
          >
            <Cestino />
          </button>
          <button
            type="button"
            onClick={() => setSelezione(null)}
            className={`min-h-11 rounded-full px-4 text-muted ${CLASSE_FOCUS}`}
          >
            Annulla
          </button>
        </div>
      )}

      {conferma && (
        <SheetConferma
          titolo={conferma.titolo}
          testo={conferma.testo}
          etichettaNo="Annulla"
          etichettaSi="Elimina"
          distruttiva
          inCorso={conferma.inCorso}
          errore={conferma.errore}
          onNo={() => setConferma(null)}
          onSi={() => void eliminaSelezionati()}
        />
      )}
    </main>
  );
}

// "Modifica alimento" / "Nuovo alimento" a pagina intera: copre anche la tab
// bar, come ModificaPastoSalvato, ed è agganciata alla parte visibile della
// finestra (useAreaVisibile), così con la tastiera aperta i pulsanti restano
// raggiungibili scorrendo. Il "‹" in alto chiude il form e torna all'elenco,
// come "Torna al catalogo" nel form.
function SchermataModulo({
  userId,
  modulo,
  onChiudi,
  onApri,
  puoAprire,
  onCreato,
  onEliminato,
}: {
  userId: string;
  modulo: Modulo;
  onChiudi: () => void;
  onApri: (alimento: Alimento) => void;
  puoAprire: (alimento: Alimento) => boolean;
  onCreato: (alimento: Alimento) => void;
  onEliminato: (alimento: Alimento, traccia: TracciaRimozione) => void;
}) {
  const areaVisibile = useAreaVisibile();
  return (
    <div
      style={{ top: areaVisibile.top, height: areaVisibile.height }}
      className="fixed inset-x-0 z-40 mx-auto flex w-full max-w-md flex-col bg-background"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onChiudi}
          aria-label="Torna al catalogo"
          className={`rounded p-1 text-muted ${CLASSE_FOCUS}`}
        >
          <ChevronSinistra />
        </button>
        <h1 className="font-display text-2xl font-bold">Alimenti</h1>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-5">
        {/* La `key` fa ripartire il form da capo quando "Apri" passa a un
            altro alimento: senza, React terrebbe i campi già scritti. */}
        <CreaAlimentoForm
          key={modulo.tipo === "modifica" ? modulo.alimento.id : "nuovo"}
          userId={userId}
          nomeIniziale=""
          etichettaIndietro="Torna al catalogo"
          etichettaCrea="Salva"
          alimentoDaModificare={modulo.tipo === "modifica" ? modulo.alimento : undefined}
          onAnnulla={onChiudi}
          onCreato={onCreato}
          onApriEsistente={onApri}
          puoAprire={puoAprire}
          onModificato={onChiudi}
          onEliminato={onEliminato}
        />
      </div>
    </div>
  );
}

// Icone della stessa famiglia di quelle di Aggiungi (stroke currentColor).
function ChevronSinistra() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronGiu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Lente({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function Piu() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function Croce() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// Cestino, come quello di BarraAnnulla, alla misura dei pulsanti.
function Cestino() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4.5h11" />
      <path d="M6 4.5V3h4v1.5" />
      <path d="M4 4.5l.7 8.5h6.6l.7-8.5" />
    </svg>
  );
}
