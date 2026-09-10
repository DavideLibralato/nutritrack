"use client";

// Pagina "Aggiungi alimento" (PUNTO_DI_PARTENZA.md, sezione 3 e mockup 2).
// Si apre a tutto schermo dal pulsante "+ Aggiungi" di Oggi — non è una tab,
// quindi sta fuori dal route group "(app)" e non ha la tab bar.
//
// Per ora: titolo = pasto proposto (toccabile per cambiarlo), ricerca nel
// catalogo locale (Dexie), creazione a mano se non si trova, e lo sheet
// quantità unico (sezione 5). Fuori da questo pezzo: "Scansiona etichetta"
// (fase 5), Recenti e Preferiti (fase 3).
//
// useSearchParams() legge ?giorno=YYYY-MM-DD passato da Oggi, così salvare
// riporta all'Oggi del giorno giusto (anche un giorno passato). Va avvolto
// in <Suspense>, come nella pagina di login.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { repositoryPasti, repositoryVociDiario } from "@/lib/repository";
import { garantisciPastiPredefiniti } from "@/lib/repository/pasti";
import {
  catalogoLocale,
  cercaPerNome,
  etichettaAlimento,
} from "@/lib/repository/alimenti";
import {
  pastoPerOrario,
  primoPastoVuoto,
  oraInizioPrimoPasto,
} from "@/lib/inserimento/propostaPasto";
import { daAlimento } from "@/lib/inserimento/alimentoPerSheet";
import { eFuturo, oraCorrente, giornoLogico } from "@/lib/dataGiorno";
import SheetQuantita from "@/components/SheetQuantita";
import CreaAlimentoForm from "@/components/CreaAlimentoForm";
import type { Alimento } from "@/lib/db/tipi";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function AggiungiPage() {
  return (
    <Suspense fallback={<SchermataCaricamento />}>
      <AggiungiContenuto />
    </Suspense>
  );
}

function SchermataCaricamento() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-4">
      <p className="text-sm text-muted">Caricamento...</p>
    </main>
  );
}

function AggiungiContenuto() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = useUtenteId();

  const pasti = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryPasti.ottieniTutti(userId);
    return [...righe].sort((a, b) => a.ordine - b.ordine);
  }, [userId]);

  // Il giorno logico "adesso": di norma l'oggi del calendario, ma fra la
  // mezzanotte e l'ora del primo pasto è ieri, perché la Cena scavalca la
  // mezzanotte (PUNTO_DI_PARTENZA.md, sezione "Il giorno logico"). Serve l'ora
  // del primo pasto, che arriva da Dexie: finché `pasti` è undefined vale
  // l'oggi del calendario, ma la pagina mostra comunque "Caricamento".
  const giornoLogicoOggi = giornoLogico(oraInizioPrimoPasto(pasti ?? []));

  // Il giorno a cui appartiene la voce arriva da Oggi come ?giorno=. Se manca,
  // o è oltre il giorno logico corrente, si ripiega su quest'ultimo.
  const giornoParam = searchParams.get("giorno");
  const giorno =
    giornoParam && !eFuturo(giornoParam) ? giornoParam : giornoLogicoOggi;

  // "Sto registrando adesso?" — vero quando il giorno mostrato è il giorno
  // logico corrente. Ne dipendono la proposta del pasto (per orario, non
  // "primo pasto ancora vuoto") e se precompilare `consumato_alle` con l'ora
  // attuale invece di lasciarlo null.
  const registroAdesso = giorno === giornoLogicoOggi;

  // Serve solo per la proposta del pasto sui giorni passati (primo pasto
  // ancora vuoto).
  const vociGiorno = useLiveQuery(async () => {
    if (!userId) return undefined;
    const tutte = await repositoryVociDiario.ottieniTutti(userId);
    return tutte.filter((v) => v.data === giorno);
  }, [userId, giorno]);

  const catalogo = useLiveQuery(async () => {
    if (!userId) return undefined;
    return catalogoLocale(userId);
  }, [userId]);

  // Rete di sicurezza: se per qualsiasi motivo l'utente non ha pasti, li crea
  // (idempotente, stessa funzione usata da Oggi).
  useEffect(() => {
    if (!userId || pasti === undefined) return;
    if (pasti.length === 0) {
      garantisciPastiPredefiniti(userId, pasti).catch(() => {});
    }
  }, [userId, pasti]);

  // Proposta del pasto: se stai registrando adesso, in base all'ora (con la
  // Cena che copre la fascia dopo mezzanotte); sui giorni passati il primo
  // pasto ancora vuoto (sezione "I pasti" / "Inserimento retroattivo").
  let pastoPropostoId: string | null = null;
  if (pasti && pasti.length > 0) {
    if (registroAdesso) {
      pastoPropostoId = pastoPerOrario(pasti, oraCorrente())?.id ?? null;
    } else if (vociGiorno !== undefined) {
      const conVoci = new Set(
        vociGiorno.map((v) => v.pasto_id).filter((x): x is string => x !== null)
      );
      pastoPropostoId = primoPastoVuoto(pasti, conVoci)?.id ?? null;
    }
  }

  // Il pasto scelto parte dalla proposta e poi segue il <select>. Impostato
  // durante il render (guardato da `=== null`), come nella pagina Profilo.
  const [pastoSelezionatoId, setPastoSelezionatoId] = useState<string | null>(null);
  if (pastoSelezionatoId === null && pastoPropostoId !== null) {
    setPastoSelezionatoId(pastoPropostoId);
  }

  const [query, setQuery] = useState("");
  const [creando, setCreando] = useState(false);
  // L'alimento del catalogo che si sta modificando (solo i propri e non
  // verificati — vedi il gate nella lista risultati). Diverso da
  // `alimentoScelto`, che è la voce da aggiungere al diario.
  const [alimentoInModifica, setAlimentoInModifica] = useState<Alimento | null>(null);

  // L'alimento scelto per lo sheet quantità. Si tiene solo l'oggetto
  // catturato al tap, ma si legge sempre la versione VIVA dal `catalogo`
  // (che è reattivo): così, se l'alimento è stato appena modificato con la
  // matita, lo sheet e la copia in `voci_diario` usano i valori nuovi, non
  // quelli del momento del tap. Il fallback all'oggetto catturato copre
  // l'istante in cui un alimento appena creato non è ancora nel catalogo.
  const [alimentoSceltoRaw, setAlimentoSceltoRaw] = useState<Alimento | null>(null);
  const [salvataggio, setSalvataggio] = useState<"inattivo" | "in-corso" | "errore">(
    "inattivo"
  );

  // `!userId` copre sia "non so ancora" (undefined) sia "nessuna sessione"
  // (null): su questa rotta il middleware garantisce comunque un utente
  // loggato, quindi il secondo caso è solo teorico. Si aspetta anche
  // `vociGiorno` così la proposta del pasto (che per i giorni passati ne ha
  // bisogno) è già pronta al primo render mostrato.
  if (
    !userId ||
    pasti === undefined ||
    catalogo === undefined ||
    vociGiorno === undefined
  ) {
    return <SchermataCaricamento />;
  }

  const risultati = cercaPerNome(catalogo, query);
  const nomePastoSelezionato =
    pasti.find((p) => p.id === pastoSelezionatoId)?.nome ?? "";

  // Versione viva dell'alimento scelto: se è nel catalogo (quasi sempre),
  // quella; altrimenti l'oggetto catturato al tap (alimento appena creato).
  const alimentoScelto = alimentoSceltoRaw
    ? catalogo.find((x) => x.id === alimentoSceltoRaw.id) ?? alimentoSceltoRaw
    : null;

  async function confermaQuantita(grammi: number) {
    if (!userId || !alimentoScelto || !pastoSelezionatoId) return;
    setSalvataggio("in-corso");
    try {
      await repositoryVociDiario.crea({
        user_id: userId,
        alimento_id: alimentoScelto.id,
        pasto_id: pastoSelezionatoId,
        gruppo_id: null,
        quantita_g: grammi,
        data: giorno,
        creato_il: new Date().toISOString(),
        // Precompilata con l'ora attuale solo se stai registrando adesso; su un
        // giorno passato meglio null che un orario inventato — l'editor di
        // consumato_alle nello sheet arriva in un pezzo successivo.
        consumato_alle: registroAdesso ? new Date().toISOString() : null,
        // Copia dei valori nutrizionali (mai un riferimento che possa
        // cambiare dopo): sezione 4.
        nome_alimento: alimentoScelto.nome,
        kcal_100g: alimentoScelto.kcal_100g,
        proteine_100g: alimentoScelto.proteine_100g,
        carboidrati_100g: alimentoScelto.carboidrati_100g,
        grassi_100g: alimentoScelto.grassi_100g,
      });
      router.replace(`/?giorno=${giorno}`);
    } catch {
      setSalvataggio("errore");
    }
  }

  function scegli(a: Alimento) {
    setAlimentoSceltoRaw(a);
    setSalvataggio("inattivo");
  }

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Indietro"
          className={`rounded p-1 text-muted ${CLASSE_FOCUS}`}
        >
          <ChevronSinistra />
        </button>

        {/* Titolo = nome del pasto, toccabile: apre l'elenco dei pasti della
            giornata (sezione "I pasti"). Un <select> nativo è già "l'elenco
            dei pasti" e sul telefono apre il selettore di sistema. */}
        <div className="relative">
          <select
            value={pastoSelezionatoId ?? ""}
            onChange={(e) => setPastoSelezionatoId(e.target.value)}
            aria-label="Pasto"
            className={`appearance-none rounded bg-transparent pr-7 font-display text-2xl font-bold ${CLASSE_FOCUS}`}
          >
            {pasti.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <ChevronGiu className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-muted" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-5">
        {creando || alimentoInModifica ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CreaAlimentoForm
              key={alimentoInModifica?.id ?? "nuovo"}
              userId={userId}
              nomeIniziale={query.trim()}
              alimentoDaModificare={alimentoInModifica ?? undefined}
              onAnnulla={() => {
                setCreando(false);
                setAlimentoInModifica(null);
              }}
              onCreato={(a) => {
                setCreando(false);
                scegli(a);
              }}
              onModificato={() => setAlimentoInModifica(null)}
              onEliminato={() => setAlimentoInModifica(null)}
            />
          </div>
        ) : (
          <>
            {/* Voce 2 punto 3: quando la ricerca non trova nulla, il tasto
                Invio / "Vai" della tastiera fa la stessa cosa del pulsante
                "Crea alimento manualmente" — un tap in meno, senza chiudere la
                tastiera. `enterKeyHint` cambia l'etichetta di quel tasto. */}
            <div className="relative shrink-0">
              <Lente className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca un alimento"
                enterKeyHint={
                  query.trim() !== "" && risultati.length === 0 ? "go" : "search"
                }
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    query.trim() !== "" &&
                    risultati.length === 0
                  ) {
                    e.preventDefault();
                    setCreando(true);
                  }
                }}
                className={`h-11 w-full rounded-full border border-border bg-background pl-11 pr-11 ${CLASSE_FOCUS}`}
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

            {/* Area scorrevole ancorata SUBITO SOTTO la barra di ricerca, non
                centrata sullo schermo: così lo stato corrente (vuoto /
                risultati / nessun risultato) resta visibile sopra la tastiera
                in ogni caso (voce 2 punto 1). */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {query.trim() === "" ? (
                <div className="flex flex-col items-center gap-3 px-6 pt-10 text-center">
                  <Posate className="text-muted" />
                  <p className="font-medium">Cerca il tuo alimento</p>
                  <p className="text-sm leading-relaxed text-muted">
                    Scrivi il nome per cercarlo nel catalogo, oppure creane uno
                    nuovo se non lo trovi.
                  </p>
                </div>
              ) : risultati.length > 0 ? (
                <ul className="mt-2">
                  {risultati.map((a) => {
                    // Modificabile solo se è tuo e non ancora verificato
                    // (sezione 10.8). Sugli alimenti condivisi (user_id null)
                    // o verificati la matita non compare — come la RLS che
                    // nega comunque update/delete.
                    const modificabile = a.user_id === userId && !a.verificato;
                    return (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 border-b border-border py-3.5"
                      >
                        <button
                          type="button"
                          onClick={() => scegli(a)}
                          className={`flex min-w-0 flex-1 flex-col text-left ${CLASSE_FOCUS}`}
                        >
                          {/* Con la marca valorizzata: "Nome · Marca", per
                              distinguere prodotti omonimi (voce 5). */}
                          <span className="truncate">{etichettaAlimento(a)}</span>
                          <span className="mt-0.5 text-sm text-muted">
                            {a.porzione_default_g} g ·{" "}
                            {Math.round((a.kcal_100g * a.porzione_default_g) / 100)} kcal
                          </span>
                        </button>

                        {modificabile && (
                          <button
                            type="button"
                            onClick={() => setAlimentoInModifica(a)}
                            aria-label={`Modifica ${etichettaAlimento(a)}`}
                            className={`shrink-0 rounded p-1.5 text-muted ${CLASSE_FOCUS}`}
                          >
                            <Matita />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => scegli(a)}
                          aria-label={`Aggiungi ${etichettaAlimento(a)}`}
                          className={`shrink-0 rounded p-1.5 text-accent ${CLASSE_FOCUS}`}
                        >
                          <Piu className="text-accent" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-3 px-4 pt-10 text-center">
                  <Lente className="text-muted" size={40} />
                  <p className="font-medium">Nessun risultato per «{query.trim()}»</p>
                  <p className="text-sm leading-relaxed text-muted">
                    Non è ancora nel catalogo. Puoi crearlo tu: resterà
                    disponibile anche le prossime volte.
                  </p>
                </div>
              )}
            </div>

            {/* Riga fissa, presente in ogni stato (voce 2 punto 2): creare a
                mano è sempre raggiungibile — anche con dei risultati che però
                non vanno bene — e resta sopra la tastiera perché è shrink-0 in
                fondo alla colonna, fuori dall'area scorrevole. */}
            <div className="shrink-0 pt-3">
              <button
                type="button"
                onClick={() => setCreando(true)}
                className={`flex w-full items-center justify-center gap-2 rounded-full border border-accent py-3 font-medium text-accent ${CLASSE_FOCUS}`}
              >
                <Piu size={18} />
                {query.trim() === ""
                  ? "Crea alimento manualmente"
                  : `Crea «${query.trim()}»`}
              </button>
            </div>
          </>
        )}
      </div>

      {alimentoScelto && pastoSelezionatoId && (
        <SheetQuantita
          alimento={daAlimento(alimentoScelto)}
          nomePasto={nomePastoSelezionato}
          inCorso={salvataggio === "in-corso"}
          errore={salvataggio === "errore" ? "Non è stato possibile aggiungere. Riprova." : null}
          onAnnulla={() => {
            setAlimentoSceltoRaw(null);
            setSalvataggio("inattivo");
          }}
          onConferma={confermaQuantita}
        />
      )}
    </main>
  );
}

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
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Lente({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size >= 32 ? 1.6 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function Piu({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
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

// "×" per svuotare il campo di ricerca — stessa famiglia delle altre icone
// (stroke currentColor, così eredita text-muted).
function Croce({ className }: { className?: string }) {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

// Matita: modifica un alimento del catalogo (solo i propri, non verificati).
function Matita({ className }: { className?: string }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// Icona posate (forchetta + cucchiaio) per lo stato vuoto della ricerca.
function Posate({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3v7a3 3 0 0 0 6 0V3M9 10v11M17 3c-1.5 1.7-2 3.4-2 5.5S15.5 12.5 17 14v7" />
    </svg>
  );
}
