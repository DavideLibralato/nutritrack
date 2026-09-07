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
import { catalogoLocale, cercaPerNome } from "@/lib/repository/alimenti";
import { pastoPerOrario, primoPastoVuoto } from "@/lib/inserimento/propostaPasto";
import { daAlimento, type AlimentoPerSheet } from "@/lib/inserimento/alimentoPerSheet";
import { oggiLocale, eOggi, eFuturo, oraCorrente } from "@/lib/dataGiorno";
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

  // Il giorno a cui appartiene la voce arriva da Oggi. Un ?giorno futuro (non
  // dovrebbe succedere) viene ignorato: si ripiega su oggi.
  const giornoParam = searchParams.get("giorno");
  const giorno = giornoParam && !eFuturo(giornoParam) ? giornoParam : oggiLocale();
  const oggiSelezionato = eOggi(giorno);

  const pasti = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryPasti.ottieniTutti(userId);
    return [...righe].sort((a, b) => a.ordine - b.ordine);
  }, [userId]);

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

  // Proposta del pasto: sull'oggi in base all'ora, sui giorni passati il
  // primo pasto ancora vuoto (sezione "I pasti" / "Inserimento retroattivo").
  let pastoPropostoId: string | null = null;
  if (pasti && pasti.length > 0) {
    if (oggiSelezionato) {
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
  const [alimentoScelto, setAlimentoScelto] = useState<AlimentoPerSheet | null>(null);
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

  async function confermaQuantita(grammi: number) {
    if (!userId || !alimentoScelto || !pastoSelezionatoId) return;
    setSalvataggio("in-corso");
    try {
      await repositoryVociDiario.crea({
        user_id: userId,
        alimento_id: alimentoScelto.alimento_id,
        pasto_id: pastoSelezionatoId,
        gruppo_id: null,
        quantita_g: grammi,
        data: giorno,
        creato_il: new Date().toISOString(),
        // Precompilata con l'ora attuale solo se stai registrando oggi; su un
        // giorno passato meglio null che un orario inventato — l'editor di
        // consumato_alle nello sheet arriva in un pezzo successivo.
        consumato_alle: oggiSelezionato ? new Date().toISOString() : null,
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
    setAlimentoScelto(daAlimento(a));
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
        {creando ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CreaAlimentoForm
              userId={userId}
              nomeIniziale={query.trim()}
              onAnnulla={() => setCreando(false)}
              onCreato={(a) => {
                setCreando(false);
                scegli(a);
              }}
            />
          </div>
        ) : (
          <>
            <div className="relative shrink-0">
              <Lente className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca un alimento"
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

            {query.trim() === "" ? (
              /* Stato vuoto: icona + titolo + sottotitolo, centrati nello
                 spazio sotto la ricerca. */
              <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                <Posate className="text-muted" />
                <p className="font-medium">Cerca il tuo alimento</p>
                <p className="text-sm leading-relaxed text-muted">
                  Scrivi il nome per cercarlo nel catalogo, oppure creane uno
                  nuovo se non lo trovi.
                </p>
              </div>
            ) : risultati.length > 0 ? (
              /* Risultati: lista scorrevole con nome e «grammi · kcal». */
              <div className="min-h-0 flex-1 overflow-y-auto">
                <ul className="mt-4">
                  {risultati.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => scegli(a)}
                        className={`flex w-full items-center justify-between gap-3 border-b border-border py-3.5 text-left ${CLASSE_FOCUS}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{a.nome}</span>
                          <span className="mt-0.5 block text-sm text-muted">
                            {a.porzione_default_g} g ·{" "}
                            {Math.round((a.kcal_100g * a.porzione_default_g) / 100)} kcal
                          </span>
                        </span>
                        <Piu className="shrink-0 text-accent" />
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Anche con dei risultati si può creare l'alimento cercato:
                    qui è un link discreto; diventa il pulsante pieno quando
                    non c'è nessun risultato. */}
                <button
                  type="button"
                  onClick={() => setCreando(true)}
                  className={`mt-4 rounded text-sm text-muted ${CLASSE_FOCUS}`}
                >
                  Non lo trovi?{" "}
                  <span className="font-medium text-accent">Crea «{query.trim()}»</span>
                </button>
              </div>
            ) : (
              /* Nessun risultato: messaggio centrato + pulsante pieno in
                 basso, stesso stile del "+ Aggiungi" di Oggi. */
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
                  <Lente className="text-muted" size={40} />
                  <p className="font-medium">Nessun risultato per «{query.trim()}»</p>
                  <p className="text-sm leading-relaxed text-muted">
                    Non è ancora nel catalogo. Puoi crearlo tu: resterà
                    disponibile anche le prossime volte.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCreando(true)}
                  className={`flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-accent py-3.5 font-medium text-background ${CLASSE_FOCUS}`}
                >
                  <Piu size={18} />
                  Crea alimento manualmente
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {alimentoScelto && pastoSelezionatoId && (
        <SheetQuantita
          alimento={alimentoScelto}
          nomePasto={nomePastoSelezionato}
          inCorso={salvataggio === "in-corso"}
          errore={salvataggio === "errore" ? "Non è stato possibile aggiungere. Riprova." : null}
          onAnnulla={() => {
            setAlimentoScelto(null);
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
