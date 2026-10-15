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
//   "Annulla" (ripristinaAlimentoEliminato), come in Aggiungi.
//
// La selezione multipla col tieni premuto arriva in un passo a sé.

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { repositoryVociDiario } from "@/lib/repository";
import { catalogoLocale, filtraPerNome } from "@/lib/repository/alimenti";
import {
  ripristinaAlimentoEliminato,
  type TracciaRimozione,
} from "@/lib/repository/composizioni";
import { alimentiModificabili } from "@/lib/catalogo/alimentiModificabili";
import {
  contaUsi,
  ordinaCatalogo,
  type OrdineCatalogo,
} from "@/lib/catalogo/ordinamentoCatalogo";
import {
  elencoNomi,
  messaggioDopoRipristino,
  testoRipristinoNonRiuscito,
} from "@/lib/inserimento/testiAlimentiCancellati";
import {
  messaggioAlimentoCreato,
  messaggioEliminato,
  type MessaggioBarra,
} from "@/lib/inserimento/testiBarra";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import type { Alimento } from "@/lib/db/tipi";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import RigaAlimentoCatalogo from "@/components/RigaAlimentoCatalogo";
import CreaAlimentoForm from "@/components/CreaAlimentoForm";
import BarraAnnulla from "@/components/BarraAnnulla";

const ORDINI: { valore: OrdineCatalogo; etichetta: string }[] = [
  { valore: "piu-usati", etichetta: "Più usati" },
  { valore: "a-z", etichetta: "A → Z" },
  { valore: "z-a", etichetta: "Z → A" },
  { valore: "meno-usati", etichetta: "Meno usati" },
];

// Spazio in fondo all'elenco: l'ultima riga deve poter salire sopra il "+"
// e la tab bar (lo stesso ingombro di Oggi, che ha "+ Aggiungi" alla stessa
// altezza).
const CLASSE_PAGINA =
  "mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 pb-[calc(var(--ingombro-oggi)+1.5rem)]";

type Modulo = { tipo: "nuovo" } | { tipo: "modifica"; alimento: Alimento };

type Barra = MessaggioBarra & {
  // Cambia a ogni messaggio: è la `key` della barra, così il timer riparte.
  id: string;
  // Presente solo dopo "Eliminato": cosa rimettere con "Annulla".
  annullabile?: { alimento: Alimento; traccia: TracciaRimozione };
};

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

  const [query, setQuery] = useState("");
  const [ordine, setOrdine] = useState<OrdineCatalogo>("piu-usati");
  const [modulo, setModulo] = useState<Modulo | null>(null);
  const [barra, setBarra] = useState<Barra | null>(null);

  // Dove era arrivato lo scorrimento quando si è aperto il form: alla
  // chiusura l'elenco ricompare e si torna lì. Come in Preferiti.
  const scorrimentoElenco = useRef<number | null>(null);
  useEffect(() => {
    if (modulo !== null || scorrimentoElenco.current === null) return;
    window.scrollTo(0, scorrimentoElenco.current);
    scorrimentoElenco.current = null;
  }, [modulo]);

  if (!userId || catalogo === undefined || voci === undefined) {
    return (
      <main className={CLASSE_PAGINA}>
        <IntestazioneSottopagina titolo="Alimenti" />
      </main>
    );
  }

  const miei = alimentiModificabili(catalogo, userId);
  const elenco = ordinaCatalogo(filtraPerNome(miei, query), contaUsi(voci), ordine);

  function mostra(messaggio: MessaggioBarra, annullabile?: Barra["annullabile"]) {
    setBarra({ id: crypto.randomUUID(), ...messaggio, annullabile });
  }

  function apri(m: Modulo) {
    scorrimentoElenco.current = window.scrollY;
    setBarra(null);
    setModulo(m);
  }

  // "Annulla" nella barra: come in Aggiungi. La barra si toglie PRIMA di
  // scrivere, così un secondo tocco ravvicinato non lancia un secondo
  // ripristino.
  async function annullaEliminazione() {
    const annullabile = barra?.annullabile;
    if (!userId || !annullabile) return;
    setBarra(null);
    try {
      const { pastiNonRipristinati } = await ripristinaAlimentoEliminato(
        userId,
        annullabile.alimento.id,
        annullabile.traccia
      );
      mostra(messaggioDopoRipristino(annullabile.alimento.nome, pastiNonRipristinati));
    } catch {
      mostra(
        { testo: testoRipristinoNonRiuscito(elencoNomi([annullabile.alimento.nome])) },
        annullabile
      );
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
        onCreato={(a) => {
          setModulo(null);
          mostra(messaggioAlimentoCreato(a.nome));
        }}
        onEliminato={(a, traccia) => {
          setModulo(null);
          mostra(messaggioEliminato(a.nome), { alimento: a, traccia });
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

          {elenco.length > 0 ? (
            <ul className="-mt-2">
              {elenco.map((a) => (
                <RigaAlimentoCatalogo
                  key={a.id}
                  alimento={a}
                  onApri={() => apri({ tipo: "modifica", alimento: a })}
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
          nasconde mentre un campo ha il fuoco. */}
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
      </div>
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
  onCreato,
  onEliminato,
}: {
  userId: string;
  modulo: Modulo;
  onChiudi: () => void;
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
        <CreaAlimentoForm
          userId={userId}
          nomeIniziale=""
          etichettaIndietro="Torna al catalogo"
          etichettaCrea="Salva"
          alimentoDaModificare={modulo.tipo === "modifica" ? modulo.alimento : undefined}
          onAnnulla={onChiudi}
          onCreato={onCreato}
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
