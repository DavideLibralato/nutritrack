"use client";

// Pagina "Aggiungi alimento" (PUNTO_DI_PARTENZA.md, sezione 3 e mockup 2).
// Si apre a tutto schermo dal pulsante "+ Aggiungi" di Oggi — non è una tab,
// quindi sta fuori dal route group "(app)" e non ha la tab bar.
//
// Per ora: titolo = pasto proposto (toccabile per cambiarlo), ricerca nel
// catalogo locale (Dexie) con "Recenti" e "Preferiti" nello stato vuoto
// della ricerca (alimenti singoli e pasti salvati mescolati — sono dati
// diversi ma la sezione UI è una sola), creazione a mano se non si trova, e
// lo sheet quantità unico (sezione 5) — con la stella per aggiungere/togliere
// un preferito. Fuori da questo pezzo: "Scansiona etichetta" (fase 5).
//
// useSearchParams() legge ?giorno=YYYY-MM-DD passato da Oggi, così salvare
// riporta all'Oggi del giorno giusto (anche un giorno passato). Va avvolto
// in <Suspense>, come nella pagina di login.

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  repositoryPasti,
  repositoryVociDiario,
  repositoryPreferiti,
  repositoryComposizioni,
  repositoryComposizioniVoci,
} from "@/lib/repository";
import { garantisciPastiPredefiniti } from "@/lib/repository/pasti";
import {
  catalogoLocale,
  cercaPerNome,
  etichettaAlimento,
} from "@/lib/repository/alimenti";
import { ePreferito, togglePreferito } from "@/lib/repository/preferiti";
import {
  pastoPerOrario,
  primoPastoVuoto,
  oraInizioPrimoPasto,
} from "@/lib/inserimento/propostaPasto";
import { daAlimento } from "@/lib/inserimento/alimentoPerSheet";
import { alimentiRecenti } from "@/lib/inserimento/recenti";
import { alimentiPreferiti } from "@/lib/inserimento/preferiti";
import { pastiSalvati, type PastoSalvato } from "@/lib/inserimento/pastiSalvati";
import {
  esisteComposizioneConNome,
  rinominaComposizione,
  eliminaComposizione,
} from "@/lib/repository/composizioni";
import { eFuturo, oraCorrente, giornoLogico } from "@/lib/dataGiorno";
import SheetQuantita from "@/components/SheetQuantita";
import SheetNome from "@/components/SheetNome";
import CreaAlimentoForm from "@/components/CreaAlimentoForm";
import type { Alimento } from "@/lib/db/tipi";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Quanti alimenti mostrare in "Recenti": abbastanza da coprire la rotazione
// tipica di pasti abituali, senza uno scroll lungo nell'area sotto la
// ricerca (la stessa, stretta, dei risultati di ricerca).
const NUMERO_RECENTI = 10;

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

// Posizione e altezza della parte VISIBILE della finestra. Su mobile —
// iOS Safari in particolare — quando si apre la tastiera `100dvh` NON si
// accorcia: la tastiera copre il contenuto senza ridurre il layout, così la
// riga "Crea alimento manualmente" ancorata in fondo finisce dietro la
// tastiera. `visualViewport` riporta l'area davvero visibile: `.height` è
// quanto resta sopra la tastiera, `.offsetTop` di quanto iOS ha fatto
// scorrere il contenuto per tenere a fuoco il campo. Usati per inchiodare il
// <main> a quell'area con `position: fixed`. Fallback a tutta la finestra
// dove l'API non c'è (render sul server, browser vecchi).
interface AreaVisibile {
  top: number;
  height: string;
}

function useAreaVisibile(): AreaVisibile {
  const [area, setArea] = useState<AreaVisibile>({ top: 0, height: "100dvh" });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const aggiorna = () =>
      setArea({
        top: Math.round(vv.offsetTop),
        height: `${Math.round(vv.height)}px`,
      });
    aggiorna();
    vv.addEventListener("resize", aggiorna);
    vv.addEventListener("scroll", aggiorna);
    window.addEventListener("orientationchange", aggiorna);
    return () => {
      vv.removeEventListener("resize", aggiorna);
      vv.removeEventListener("scroll", aggiorna);
      window.removeEventListener("orientationchange", aggiorna);
    };
  }, []);

  return area;
}

function AggiungiContenuto() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = useUtenteId();
  const areaVisibile = useAreaVisibile();

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

  // Tutto lo storico delle voci diario dell'utente: serve sia alla proposta
  // del pasto sui giorni passati (primo pasto ancora vuoto, filtrato sul solo
  // giorno più sotto) sia ai Recenti, che guardano l'intera storia.
  const vociTutte = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryVociDiario.ottieniTutti(userId);
  }, [userId]);
  const vociGiorno = vociTutte?.filter((v) => v.data === giorno);

  const catalogo = useLiveQuery(async () => {
    if (!userId) return undefined;
    return catalogoLocale(userId);
  }, [userId]);

  const preferiti = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryPreferiti.ottieniTutti(userId);
  }, [userId]);

  // Pasti salvati: composizioni (solo tipo "pasto_salvato", le ricette sono
  // un perimetro diverso) + le loro righe. Compaiono mescolati agli alimenti
  // singoli nella sezione Preferiti (sezione 4: "sono dati diversi" ma la
  // sezione UI è una sola).
  const composizioni = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryComposizioni.ottieniTutti(userId);
  }, [userId]);
  const composizioniVoci = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryComposizioniVoci.ottieniTutti(userId);
  }, [userId]);

  // Rete di sicurezza: se per qualsiasi motivo l'utente non ha pasti, li crea
  // (idempotente, stessa funzione usata da Oggi). Una volta sola per utente
  // per montaggio (rifTentatoSeed, non `pasti` nelle dipendenze) — vedi il
  // commento gemello in src/app/(app)/page.tsx per il bug che questo evita:
  // `pasti` è stato React reattivo, può restare "non ancora arrivato" più a
  // lungo del previsto dopo un refresh, garantisciPastiPredefiniti rilegge
  // Dexie per conto suo.
  const rifTentatoSeed = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || rifTentatoSeed.current === userId) return;
    rifTentatoSeed.current = userId;
    garantisciPastiPredefiniti(userId).catch(() => {});
  }, [userId]);

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
  // Errore del "+" su Recenti/Preferiti: quello scrive subito, senza sheet,
  // quindi non ha il messaggio d'errore di SheetQuantita a disposizione.
  const [erroreRapido, setErroreRapido] = useState<string | null>(null);

  // Rinomina/elimina un pasto salvato (NOTE_MODIFICHE.md): la matita in
  // RigaPastoSalvato apre SheetNome in modalità modifica, separato dal tap
  // sulla riga che invece aggiunge subito al diario.
  const [pastoInModifica, setPastoInModifica] = useState<PastoSalvato | null>(null);
  const [salvataggioModificaPasto, setSalvataggioModificaPasto] = useState<
    "inattivo" | "in-corso" | "errore" | "duplicato"
  >("inattivo");

  // `!userId` copre sia "non so ancora" (undefined) sia "nessuna sessione"
  // (null): su questa rotta il middleware garantisce comunque un utente
  // loggato, quindi il secondo caso è solo teorico. Si aspetta anche
  // `vociGiorno` così la proposta del pasto (che per i giorni passati ne ha
  // bisogno) è già pronta al primo render mostrato.
  if (
    !userId ||
    pasti === undefined ||
    catalogo === undefined ||
    vociGiorno === undefined ||
    preferiti === undefined ||
    composizioni === undefined ||
    composizioniVoci === undefined
  ) {
    return <SchermataCaricamento />;
  }

  const risultati = cercaPerNome(catalogo, query);
  const recenti = alimentiRecenti(catalogo, vociTutte ?? [], NUMERO_RECENTI);
  const preferitiAlimenti = alimentiPreferiti(catalogo, preferiti, vociTutte ?? []);
  const preferitiPastiSalvati = pastiSalvati(catalogo, composizioni, composizioniVoci);
  const nomePastoSelezionato =
    pasti.find((p) => p.id === pastoSelezionatoId)?.nome ?? "";

  // Versione viva dell'alimento scelto: se è nel catalogo (quasi sempre),
  // quella; altrimenti l'oggetto catturato al tap (alimento appena creato).
  const alimentoScelto = alimentoSceltoRaw
    ? catalogo.find((x) => x.id === alimentoSceltoRaw.id) ?? alimentoSceltoRaw
    : null;

  // Scrittura condivisa fra lo sheet quantità (confermaQuantita), il "+" di
  // Recenti/Preferiti (aggiungiRapido) e l'inserimento di un pasto salvato
  // (aggiungiPastoSalvatoRapido, una chiamata per alimento con lo stesso
  // gruppoId). Non naviga da sola: i chiamanti che inseriscono più righe in
  // una volta sola devono farlo solo dopo che tutte sono scritte.
  async function creaVoce(
    alimento: Alimento,
    grammi: number,
    gruppoId: string | null = null
  ) {
    if (!userId || !pastoSelezionatoId) return;
    await repositoryVociDiario.crea({
      user_id: userId,
      alimento_id: alimento.id,
      pasto_id: pastoSelezionatoId,
      gruppo_id: gruppoId,
      quantita_g: grammi,
      data: giorno,
      creato_il: new Date().toISOString(),
      // Precompilata con l'ora attuale solo se stai registrando adesso; su un
      // giorno passato meglio null che un orario inventato — l'editor di
      // consumato_alle nello sheet arriva in un pezzo successivo.
      consumato_alle: registroAdesso ? new Date().toISOString() : null,
      // Copia dei valori nutrizionali (mai un riferimento che possa
      // cambiare dopo): sezione 4.
      nome_alimento: alimento.nome,
      kcal_100g: alimento.kcal_100g,
      proteine_100g: alimento.proteine_100g,
      carboidrati_100g: alimento.carboidrati_100g,
      grassi_100g: alimento.grassi_100g,
    });
  }

  async function confermaQuantita(grammi: number) {
    if (!alimentoScelto) return;
    setSalvataggio("in-corso");
    try {
      await creaVoce(alimentoScelto, grammi);
      router.replace(`/?giorno=${giorno}`);
    } catch {
      setSalvataggio("errore");
    }
  }

  // "+" su Recenti/Preferiti (PUNTO_DI_PARTENZA.md, sezione 3: "aggiunge
  // subito con la quantità dell'ultima volta, senza aprire nulla. Un tap."):
  // stessa scrittura dello sheet, ma con la quantità passata dalla riga
  // invece di quella confermata dall'utente.
  async function aggiungiRapido(alimento: Alimento, grammi: number) {
    setErroreRapido(null);
    try {
      await creaVoce(alimento, grammi);
      router.replace(`/?giorno=${giorno}`);
    } catch {
      setErroreRapido("Non è stato possibile aggiungere. Riprova.");
    }
  }

  // "+" su un pasto salvato (sezione 3, punto 5): tutte le sue righe insieme,
  // stesso gruppo_id, nessuno sheet — la quantità di ciascun alimento è già
  // quella salvata nella composizione, non c'è niente da confermare.
  async function aggiungiPastoSalvatoRapido(pasto: PastoSalvato) {
    setErroreRapido(null);
    const gruppoId = crypto.randomUUID();
    try {
      await Promise.all(
        pasto.voci.map(({ alimento, quantitaG }) => creaVoce(alimento, quantitaG, gruppoId))
      );
      router.replace(`/?giorno=${giorno}`);
    } catch {
      setErroreRapido("Non è stato possibile aggiungere. Riprova.");
    }
  }

  function scegli(a: Alimento) {
    setAlimentoSceltoRaw(a);
    setSalvataggio("inattivo");
  }

  // Stella nello sheet: scrive subito nel repository (sezione 3), non solo
  // stato locale — indipendente da Annulla/Conferma.
  function toggleStellaAlimentoScelto() {
    if (!userId || !alimentoScelto || !preferiti) return;
    togglePreferito(userId, preferiti, alimentoScelto.id).catch(() => {});
  }

  // Matita su un pasto salvato: rinomina o elimina la composizione. Non
  // tocca gli alimenti/quantità — per cambiarli si rifà da capo dal pasto di
  // oggi (fuori perimetro per ora, NOTE_MODIFICHE.md).
  function apriModificaPasto(pasto: PastoSalvato) {
    setPastoInModifica(pasto);
    setSalvataggioModificaPasto("inattivo");
  }

  function chiudiModificaPasto() {
    setPastoInModifica(null);
    setSalvataggioModificaPasto("inattivo");
  }

  async function confermaRinominaPasto(nome: string) {
    if (!pastoInModifica || !composizioni) return;

    if (esisteComposizioneConNome(nome, composizioni, pastoInModifica.composizioneId)) {
      setSalvataggioModificaPasto("duplicato");
      return;
    }

    setSalvataggioModificaPasto("in-corso");
    try {
      await rinominaComposizione(pastoInModifica.composizioneId, nome);
      chiudiModificaPasto();
    } catch {
      setSalvataggioModificaPasto("errore");
    }
  }

  async function eliminaPastoInModifica() {
    if (!pastoInModifica || !composizioniVoci) return;
    setSalvataggioModificaPasto("in-corso");
    try {
      await eliminaComposizione(pastoInModifica.composizioneId, composizioniVoci);
      chiudiModificaPasto();
    } catch {
      setSalvataggioModificaPasto("errore");
    }
  }

  return (
    <main
      style={{ top: areaVisibile.top, height: areaVisibile.height }}
      className="fixed inset-x-0 mx-auto flex w-full max-w-md flex-col overflow-hidden bg-background"
    >
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
                recenti.length > 0 ||
                preferitiAlimenti.length > 0 ||
                preferitiPastiSalvati.length > 0 ? (
                  <div className="pt-3">
                    {erroreRapido && (
                      <p className="px-1 pb-2 text-sm text-warning">{erroreRapido}</p>
                    )}
                    {recenti.length > 0 && (
                      <>
                        <p className="px-1 pb-1 text-xs uppercase tracking-wide text-muted">
                          Recenti
                        </p>
                        <ul>
                          {recenti.map(({ alimento, quantitaG }) => (
                            <RigaRapida
                              key={alimento.id}
                              alimento={alimento}
                              quantitaG={quantitaG}
                              userId={userId}
                              onScegli={scegli}
                              onAggiungiRapido={aggiungiRapido}
                              onModifica={setAlimentoInModifica}
                            />
                          ))}
                        </ul>
                      </>
                    )}

                    {/* Preferiti: un'unica sezione, ma due sottogruppi
                        ordinati alfabeticamente ciascuno per conto suo —
                        alimenti singoli e pasti salvati sono dati diversi
                        (sezione 4), una lista sola li mescolerebbe senza
                        criterio. */}
                    {(preferitiAlimenti.length > 0 || preferitiPastiSalvati.length > 0) && (
                      <>
                        <p
                          className={`px-1 pb-1 text-xs uppercase tracking-wide text-muted ${recenti.length > 0 ? "mt-4" : ""}`}
                        >
                          Preferiti
                        </p>

                        {preferitiAlimenti.length > 0 && (
                          <>
                            <p className="px-1 pb-1 text-xs text-muted">Alimenti</p>
                            <ul>
                              {preferitiAlimenti.map(({ alimento, quantitaG }) => (
                                <RigaRapida
                                  key={alimento.id}
                                  alimento={alimento}
                                  quantitaG={quantitaG}
                                  userId={userId}
                                  onScegli={scegli}
                                  onAggiungiRapido={aggiungiRapido}
                                  onModifica={setAlimentoInModifica}
                                />
                              ))}
                            </ul>
                          </>
                        )}

                        {preferitiPastiSalvati.length > 0 && (
                          <>
                            <p
                              className={`px-1 pb-1 text-xs text-muted ${preferitiAlimenti.length > 0 ? "mt-3" : ""}`}
                            >
                              Pasti salvati
                            </p>
                            <ul>
                              {preferitiPastiSalvati.map((pasto) => (
                                <RigaPastoSalvato
                                  key={pasto.composizioneId}
                                  pasto={pasto}
                                  onAggiungi={aggiungiPastoSalvatoRapido}
                                  onModifica={apriModificaPasto}
                                />
                              ))}
                            </ul>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 px-6 pt-10 text-center">
                    <Posate className="text-muted" />
                    <p className="font-medium">Cerca il tuo alimento</p>
                    <p className="text-sm leading-relaxed text-muted">
                      Scrivi il nome per cercarlo nel catalogo, oppure creane uno
                      nuovo se non lo trovi.
                    </p>
                  </div>
                )
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
          preferito={ePreferito(preferiti, alimentoScelto.id)}
          onTogglePreferito={toggleStellaAlimentoScelto}
          onAnnulla={() => {
            setAlimentoSceltoRaw(null);
            setSalvataggio("inattivo");
          }}
          onConferma={confermaQuantita}
        />
      )}

      {pastoInModifica && (
        <SheetNome
          titolo={`Modifica "${pastoInModifica.nome}"`}
          valoreIniziale={pastoInModifica.nome}
          modifica
          inCorso={salvataggioModificaPasto === "in-corso"}
          errore={
            salvataggioModificaPasto === "errore"
              ? "Operazione non riuscita. Riprova."
              : salvataggioModificaPasto === "duplicato"
                ? "Esiste già un pasto salvato con questo nome. Scegline un altro."
                : null
          }
          onAnnulla={chiudiModificaPasto}
          onConferma={confermaRinominaPasto}
          onElimina={eliminaPastoInModifica}
        />
      )}
    </main>
  );
}

// Riga condivisa fra Recenti e Preferiti (sezione 3): stessa struttura e
// stessa interazione in entrambe le liste, nome+quantità+kcal e un "+" che
// aggiunge subito. Nella ricerca la riga resta separata perché ha in più la
// matita di modifica, solo condizionale.
function RigaRapida({
  alimento,
  quantitaG,
  userId,
  onScegli,
  onAggiungiRapido,
  onModifica,
}: {
  alimento: Alimento;
  quantitaG: number;
  userId: string;
  onScegli: (a: Alimento) => void;
  onAggiungiRapido: (a: Alimento, grammi: number) => void;
  onModifica: (a: Alimento) => void;
}) {
  // Stesso criterio della matita nei risultati di ricerca (sezione 10.8):
  // modificabile solo se è tuo e non ancora verificato. Recenti e Preferiti
  // possono mostrare lo stesso identico alimento che compare in ricerca — il
  // bug segnalato era proprio che qui mancava, mentre in ricerca c'era.
  const modificabile = alimento.user_id === userId && !alimento.verificato;

  return (
    <li className="flex items-center gap-2 border-b border-border py-3.5">
      {/* Tap sul nome: stesso percorso della ricerca, sheet precompilato con
          porzione_default_g (sezione 3: "come già succede oggi per i
          risultati di ricerca"). */}
      <button
        type="button"
        onClick={() => onScegli(alimento)}
        className={`flex min-w-0 flex-1 flex-col text-left ${CLASSE_FOCUS}`}
      >
        <span className="truncate">{etichettaAlimento(alimento)}</span>
        <span className="mt-0.5 text-sm text-muted">
          {quantitaG} g · {Math.round((alimento.kcal_100g * quantitaG) / 100)} kcal
        </span>
      </button>

      {modificabile && (
        <button
          type="button"
          onClick={() => onModifica(alimento)}
          aria-label={`Modifica ${etichettaAlimento(alimento)}`}
          className={`shrink-0 rounded p-1.5 text-muted ${CLASSE_FOCUS}`}
        >
          <Matita />
        </button>
      )}

      {/* "+": aggiunge subito con la quantità passata, un tap, senza aprire
          lo sheet (sezione 3). */}
      <button
        type="button"
        onClick={() => onAggiungiRapido(alimento, quantitaG)}
        aria-label={`Aggiungi ${etichettaAlimento(alimento)}, ${quantitaG} g`}
        className={`shrink-0 rounded p-1.5 text-accent ${CLASSE_FOCUS}`}
      >
        <Piu className="text-accent" />
      </button>
    </li>
  );
}

// Pasto salvato nella sezione Preferiti (sezione 3, punto 5): stessa
// struttura a tre bersagli della riga dei risultati di ricerca — nome
// (aggiunge), matita (rinomina/elimina la composizione), "+" (aggiunge). Nome
// e "+" fanno la stessa cosa: non c'è uno sheet quantità da aprire, le
// quantità sono già tutte decise nella composizione. La matita non è
// condizionale come nei risultati di ricerca: un pasto salvato è sempre tuo,
// non esiste un equivalente di "condiviso/verificato".
function RigaPastoSalvato({
  pasto,
  onAggiungi,
  onModifica,
}: {
  pasto: PastoSalvato;
  onAggiungi: (p: PastoSalvato) => void;
  onModifica: (p: PastoSalvato) => void;
}) {
  const kcalTotali = Math.round(
    pasto.voci.reduce((somma, { alimento, quantitaG }) => somma + (alimento.kcal_100g * quantitaG) / 100, 0)
  );
  const numeroAlimenti = pasto.voci.length;
  const sottotitolo = `${numeroAlimenti} ${numeroAlimenti === 1 ? "alimento" : "alimenti"} · ${kcalTotali} kcal`;

  return (
    <li className="flex items-center gap-2 border-b border-border py-3.5">
      <button
        type="button"
        onClick={() => onAggiungi(pasto)}
        className={`flex min-w-0 flex-1 flex-col text-left ${CLASSE_FOCUS}`}
      >
        <span className="truncate">{pasto.nome}</span>
        <span className="mt-0.5 text-sm text-muted">{sottotitolo}</span>
      </button>

      <button
        type="button"
        onClick={() => onModifica(pasto)}
        aria-label={`Modifica ${pasto.nome}`}
        className={`shrink-0 rounded p-1.5 text-muted ${CLASSE_FOCUS}`}
      >
        <Matita />
      </button>

      <button
        type="button"
        onClick={() => onAggiungi(pasto)}
        aria-label={`Aggiungi ${pasto.nome}, ${sottotitolo}`}
        className={`shrink-0 rounded p-1.5 text-accent ${CLASSE_FOCUS}`}
      >
        <Piu className="text-accent" />
      </button>
    </li>
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
