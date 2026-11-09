"use client";

// La schermata di scansione del codice a barre (PUNTO_DI_PARTENZA.md §3,
// "Codice a barre"; mockup docs/mockups/aggiungi.html, "Scansione", e
// docs/mockups/catalogo-alimenti.html). Copre la pagina. Il titolo lo
// dà chi la apre («Aggiungi a <pasto>», «Catalogo alimenti», «Codice per
// «Nome»»).
//
// Due usi (`uso`):
// - "cerca": il codice letto si cerca (sotto). Da Scansiona, in Aggiungi
//   e nel catalogo;
// - "solo-codice": il codice letto torna a chi ha aperto la schermata,
//   senza cercarlo, né nel catalogo né su Open Food Facts. Da «Aggiungi
//   codice a barre» in "Modifica alimento" (§3, "Il codice in modifica"):
//   non ha bisogno della rete, solo del lettore (o di "Scrivi il codice").
//
// Tre modi di dare il codice, tutti verso la stessa ricerca:
// - il video dal vivo della fotocamera posteriore, letto ogni ~200 ms
//   (useFotocamera accende e spegne, lettoreCodice legge);
// - "Usa una foto": la fotocamera di sistema o una foto della libreria;
//   non chiede il permesso della pagina, quindi va anche se è stato negato;
// - "Scrivi il codice": le cifre sotto le barre, controllate da leggiCodice.
//
// Nell'uso "cerca", poi cercaCodice: prima il catalogo locale, poi Open Food Facts. Cosa
// succede dopo lo decide la pagina (onNelCatalogo → sheet quantità,
// onModulo → "Nuovo alimento"); qui restano solo l'attesa e gli errori di
// rete, sempre con "Crea a mano" e il codice già compilato.
//
// Scura in tutti e due i temi (classi bg-scan, text-on-scan... da
// globals.css): sta intorno a un video, come la fotocamera di sistema.

import { useEffect, useRef, useState } from "react";
import type { Alimento } from "@/lib/db/tipi";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { leggiCodice } from "@/lib/barcode/codiceEan";
import { preparaLettore, type Lettore } from "@/lib/barcode/lettoreCodice";
import { cercaCodice, prodottoDaCatalogo } from "@/lib/barcode/ricercaCodice";
import { useFotocamera } from "@/lib/barcode/useFotocamera";
import {
  TESTI_CODICE_SBAGLIATO,
  TESTI_ERRORE_RICERCA,
  TESTO_CERCO,
  TESTO_DA_SOLO,
  TESTO_FOTO_SENZA_CODICE,
  TESTO_INQUADRA,
  TESTO_LETTORE_NON_CARICATO,
  TESTO_TORNA_NEL_MODULO,
  testoFotocamera,
  type ErroreRicerca,
  TITOLO_NEL_CATALOGO,
  TESTO_NON_ANCORA_TUO,
  ETICHETTA_AGGIUNGI_DAL_CATALOGO,
  ERRORE_AGGIUNTA_DAL_CATALOGO,
} from "@/lib/barcode/testiScansione";
import type { AlimentoCatalogo } from "@/lib/catalogo/catalogoPrecaricato";
import type { DatiCodice } from "./CreaAlimentoForm";
import IconaCroce from "./IconaCroce";
import IconaTorcia from "./IconaTorcia";
import IconaFoto from "./IconaFoto";
import IconaCancelletto from "./IconaCancelletto";

// Ogni quanto si legge un fotogramma. Più spesso consuma batteria senza
// leggere prima: ZXing su un telefono ci mette qualche decina di ms.
const INTERVALLO_LETTURA_MS = 200;

const CLASSE_TONDO = `flex size-11 shrink-0 items-center justify-center rounded-full bg-scan-key text-on-scan ${CLASSE_FOCUS}`;
const CLASSE_AZIONE = `flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-scan-line bg-scan-key px-3 text-[15px] font-semibold text-on-scan disabled:opacity-50 ${CLASSE_FOCUS}`;

type Fase =
  | { tipo: "fotocamera" }
  | { tipo: "scrivi" }
  | { tipo: "ricerca"; codice: string }
  | { tipo: "errore"; codice: string; errore: ErroreRicerca }
  // Il prodotto è nel catalogo, ma chi ha aperto la schermata non può
  // usarlo (nel catalogo alimenti: non modificabile) e lo dice.
  | { tipo: "avviso"; codice: string; testo: string }
  // Il codice è nel catalogo precaricato e non è ancora tuo: il pannello
  // «Nel catalogo» (solo in Aggiungi).
  | { tipo: "catalogo"; codice: string; voce: AlimentoCatalogo; inCorso: boolean; errore: boolean };

// Cosa fare con il codice letto (vedi in cima).
export type UsoScansione =
  | {
      tipo: "cerca";
      // Il prodotto è già nel catalogo: in Aggiungi lo sheet quantità, nel
      // catalogo alimenti "Modifica alimento". Se restituisce un testo, la
      // schermata resta aperta e lo mostra, con "Scansiona un altro
      // codice" (nel catalogo: un alimento che non si può modificare).
      onNelCatalogo: (alimento: Alimento) => string | void;
      // "Nuovo alimento": precompilato (trovato su OFF) o con il solo codice.
      onModulo: (daCodice: DatiCodice) => void;
      // Il codice è nel catalogo precaricato e hai già lo stesso prodotto
      // per nome e marca, senza codice: la pagina apre la sua modifica con
      // il codice pronto. Se restituisce un testo (non si può
      // modificare), la schermata resta aperta e lo mostra, come
      // onNelCatalogo.
      onPortaCodice: (alimento: Alimento, codice: string) => string | void;
      // Il codice non è fra i tuoi ma è nel catalogo precaricato (PUNTO
      // §10.1). "pannello" (Aggiungi): la schermata mostra «Nel catalogo»
      // con «Aggiungi ai miei e scegli i grammi», che chiama `onAggiungi`
      // (crea la copia e apre lo sheet; se la promessa fallisce, il
      // pannello lo dice e si può riprovare); se è già tuo per nome e
      // marca, come un codice già nel catalogo (onNelCatalogo). "apri"
      // (Impostazioni > Alimenti): la pagina apre la sua scheda.
      catalogo:
        | { tipo: "pannello"; onAggiungi: (voce: AlimentoCatalogo) => Promise<void> }
        | { tipo: "apri"; onApri: (voce: AlimentoCatalogo) => void };
    }
  | {
      tipo: "solo-codice";
      // Il codice, già nella forma di leggiCodice (UPC-A a 13 cifre).
      onCodice: (codice: string) => void;
    };

interface Props {
  userId: string;
  // La getUserMedia già partita nel gestore del tocco che apre la
  // schermata (richiediFotocamera in useFotocamera.ts), o null se il
  // browser non ha la fotocamera. Non la chiede la schermata all'apertura:
  // sarebbe dopo il ridisegno, fuori dal tocco (difetto del 07/11 nell'app
  // installata).
  richiestaFotocamera: Promise<MediaStream> | null;
  titolo: string;
  onChiudi: () => void;
  uso: UsoScansione;
}

export default function SchermataScansione({
  userId,
  richiestaFotocamera,
  titolo,
  onChiudi,
  uso,
}: Props) {
  const soloCodice = uso.tipo === "solo-codice";
  // Il pannello «Nel catalogo» (Aggiungi), se chi apre la schermata lo vuole.
  const pannello = uso.tipo === "cerca" && uso.catalogo.tipo === "pannello" ? uso.catalogo : null;
  const areaVisibile = useAreaVisibile();

  const inputFoto = useRef<HTMLInputElement>(null);
  // I campi presi uno per uno: `collegaVideo` va in ref={...}, e il React
  // Compiler tratterebbe da ref tutto l'oggetto che lo contiene.
  const {
    collegaVideo,
    fotogramma,
    stato,
    erroreTecnico,
    avvia,
    ferma,
    torciaDisponibile,
    torciaAccesa,
    cambiaTorcia,
  } = useFotocamera();
  const [fase, setFase] = useState<Fase>({ tipo: "fotocamera" });
  const [lettore, setLettore] = useState<Lettore | null>(null);
  const [lettoreFallito, setLettoreFallito] = useState(false);
  const [avvisoFoto, setAvvisoFoto] = useState(false);
  const [scritto, setScritto] = useState("");
  const [erroreScritto, setErroreScritto] = useState<string | null>(null);
  // La ricerca in corso, per annullarla se la schermata si chiude.
  const ricerca = useRef<AbortController | null>(null);
  // Un codice trovato ferma le letture: due fotogrammi di fila non devono
  // far partire due ricerche.
  const trovato = useRef(false);


  // All'apertura la fotocamera prende in mano la richiesta partita al
  // tocco su Scansiona; il lettore si carica in parallelo (effetto sotto),
  // mai prima. La richiesta si usa una volta sola: in sviluppo React monta
  // gli effetti due volte (Strict Mode), e il secondo giro ne chiede una
  // nuova. Alla chiusura la ricerca in corso si annulla; la fotocamera la
  // spegne useFotocamera da sé.
  const richiestaIniziale = useRef<Promise<MediaStream> | null | undefined>(richiestaFotocamera);
  useEffect(() => {
    const richiesta = richiestaIniziale.current;
    richiestaIniziale.current = undefined;
    avvia(richiesta);
    return () => ricerca.current?.abort();
  }, [avvia]);

  useEffect(() => {
    let attivo = true;
    preparaLettore()
      .then((l) => attivo && setLettore(l))
      .catch(() => attivo && setLettoreFallito(true));
    return () => {
      attivo = false;
    };
  }, []);

  function riprovaLettore() {
    setLettoreFallito(false);
    preparaLettore()
      .then(setLettore)
      .catch(() => setLettoreFallito(true));
  }

  // Il codice è letto (dal video, da una foto o scritto): si spegne la
  // fotocamera e si cerca. Nell'uso "solo-codice" non si cerca: il codice
  // torna a chi ha aperto la schermata.
  async function cerca(codice: string) {
    trovato.current = true;
    ferma();
    if (uso.tipo === "solo-codice") {
      uso.onCodice(codice);
      return;
    }
    const { onNelCatalogo, onModulo, onPortaCodice, catalogo } = uso;
    ricerca.current?.abort();
    const controller = new AbortController();
    ricerca.current = controller;
    setFase({ tipo: "ricerca", codice });
    let esito;
    try {
      esito = await cercaCodice(userId, codice, { segnale: controller.signal });
    } catch {
      // Una lettura di Dexie fallita: come una risposta che non si sa usare.
      esito = { esito: "errore" as const };
    }
    if (controller.signal.aborted) return;
    switch (esito.esito) {
      case "nel-catalogo": {
        const testo = onNelCatalogo(esito.alimento);
        if (typeof testo === "string") setFase({ tipo: "avviso", codice, testo });
        return;
      }
      case "catalogo-precaricato": {
        // Hai già lo stesso prodotto per nome e marca (il codice non ti
        // ha portato a lui, quindi ne ha un altro o nessuno). Come con
        // Open Food Facts, in Aggiungi e nel catalogo:
        // - senza codice: la modifica del tuo con il codice letto pronto,
        //   per salvarlo (onPortaCodice, la strada «Apri porta il codice»
        //   del 07/11); la scansione dopo lo trova fra i tuoi;
        // - con un altro codice: "Nuovo alimento" precompilato dal
        //   catalogo, con il messaggio del doppione e «Apri» (il codice di
        //   un alimento non si cambia).
        if (esito.stato.stato === "nei-tuoi") {
          const mio = esito.stato.alimento;
          if (!mio.barcode) {
            const testo = onPortaCodice(mio, codice);
            if (typeof testo === "string") setFase({ tipo: "avviso", codice, testo });
          } else {
            onModulo({ barcode: codice, prodotto: prodottoDaCatalogo(esito.voce) });
          }
          return;
        }
        if (catalogo.tipo === "apri") {
          catalogo.onApri(esito.voce);
          return;
        }
        setFase({ tipo: "catalogo", codice, voce: esito.voce, inCorso: false, errore: false });
        return;
      }
      case "open-food-facts":
        onModulo({ barcode: codice, prodotto: esito.prodotto });
        return;
      case "non-trovato":
        onModulo({ barcode: codice, prodotto: null });
        return;
      case "annullata":
        return;
      default:
        setFase({ tipo: "errore", codice, errore: esito.esito });
    }
  }

  // Le letture dal video: una alla volta, ogni INTERVALLO_LETTURA_MS,
  // finché la fotocamera è accesa e non c'è ancora un codice.
  useEffect(() => {
    if (stato !== "attiva" || !lettore || fase.tipo !== "fotocamera") return;
    trovato.current = false;
    let occupato = false;
    const timer = setInterval(() => {
      const elemento = fotogramma();
      if (occupato || trovato.current || !elemento) return;
      occupato = true;
      lettore
        .leggi(elemento)
        .then((codice) => {
          if (codice && !trovato.current) void cerca(codice);
        })
        .catch(() => {})
        .finally(() => {
          occupato = false;
        });
    }, INTERVALLO_LETTURA_MS);
    return () => clearInterval(timer);
    // `cerca` cambia a ogni ridisegno ma fa sempre la stessa cosa: non
    // deve far ripartire il timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stato, lettore, fase.tipo, fotogramma]);

  async function daFoto(file: File | undefined) {
    if (!file || !lettore) return;
    setAvvisoFoto(false);
    try {
      const codice = await lettore.leggi(file);
      if (codice) {
        void cerca(codice);
        return;
      }
    } catch {
      // Una foto che non si apre: come una foto senza codice.
    }
    setAvvisoFoto(true);
  }

  function apriScrivi() {
    ferma();
    setScritto("");
    setErroreScritto(null);
    setFase({ tipo: "scrivi" });
  }

  function cercaScritto(e: React.FormEvent) {
    e.preventDefault();
    const lettura = leggiCodice(scritto);
    if (lettura.errore) {
      setErroreScritto(TESTI_CODICE_SBAGLIATO[lettura.errore]);
      return;
    }
    void cerca(lettura.codice);
  }

  // Torna al video: è un tocco, quindi la richiesta del permesso (se iOS
  // la rifà) arriva dopo un gesto dell'utente.
  function tornaAllaFotocamera() {
    setAvvisoFoto(false);
    setFase({ tipo: "fotocamera" });
    avvia();
  }

  const testoStato = testoFotocamera(stato);
  const inPausa = stato === "in-pausa";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scansione del codice a barre"
      style={{ top: areaVisibile.top, height: areaVisibile.height }}
      className="fixed inset-x-0 z-40 mx-auto flex w-full max-w-md flex-col overflow-hidden bg-scan text-on-scan"
    >
      {/* Il video sta dietro a tutto, a tutta pagina. muted e playsInline:
          su iOS senza questi due il video non parte da solo o va a tutto
          schermo. Nascosto finché non è acceso: un riquadro nero vuoto
          sembrerebbe un errore. */}
      <video
        ref={collegaVideo}
        muted
        playsInline
        aria-hidden
        className={`absolute inset-0 size-full object-cover ${
          stato === "attiva" && fase.tipo === "fotocamera" ? "" : "invisible"
        }`}
      />

      <header className="relative flex shrink-0 items-center justify-between gap-2 px-3 pt-3">
        <button type="button" onClick={onChiudi} aria-label="Chiudi la scansione" className={CLASSE_TONDO}>
          <IconaCroce />
        </button>
        <span className="min-w-0 truncate text-[15px] font-semibold">{titolo}</span>
        {torciaDisponibile && fase.tipo === "fotocamera" ? (
          <button
            type="button"
            onClick={cambiaTorcia}
            aria-label={torciaAccesa ? "Spegni la torcia" : "Accendi la torcia"}
            aria-pressed={torciaAccesa}
            className={CLASSE_TONDO}
          >
            <IconaTorcia />
          </button>
        ) : (
          // Lo stesso spazio del pulsante, così il titolo resta al centro.
          <span aria-hidden className="size-11 shrink-0" />
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        {fase.tipo === "fotocamera" && (
          <>
            {/* Il mirino: quattro angoli e la linea al centro. */}
            <div aria-hidden className="relative h-[170px] w-full max-w-[290px]">
              <span className="absolute left-0 top-0 size-9 rounded-tl-[14px] border-l-4 border-t-4 border-on-scan" />
              <span className="absolute right-0 top-0 size-9 rounded-tr-[14px] border-r-4 border-t-4 border-on-scan" />
              <span className="absolute bottom-0 left-0 size-9 rounded-bl-[14px] border-b-4 border-l-4 border-on-scan" />
              <span className="absolute bottom-0 right-0 size-9 rounded-br-[14px] border-b-4 border-r-4 border-on-scan" />
              <span className="absolute inset-x-[18px] top-1/2 h-0.5 rounded-full bg-scan-aim" />
            </div>
            {lettoreFallito ? (
              <>
                <p role="alert" className="max-w-[300px] text-base leading-snug">
                  {TESTO_LETTORE_NON_CARICATO}
                </p>
                <button type="button" onClick={riprovaLettore} className={`${CLASSE_AZIONE} max-w-[240px] flex-none px-6`}>
                  Riprova
                </button>
              </>
            ) : testoStato ? (
              <div className="max-w-[300px]">
                <p role="alert" className="text-base leading-snug">
                  {testoStato}
                </p>
                {/* Il nome tecnico dell'errore, piccolo: per capire dal
                    telefono cosa ha risposto iOS (difetto del 07/11). Come
                    "Dettagli tecnici" di Sincronizzazione, ma sempre
                    visibile e nei colori della scansione. */}
                {erroreTecnico && (
                  <p className="mt-2 font-mono text-[11px] leading-snug break-words text-scan-muted">
                    {erroreTecnico}
                  </p>
                )}
              </div>
            ) : inPausa ? (
              <button type="button" onClick={tornaAllaFotocamera} className={`${CLASSE_AZIONE} max-w-[260px] flex-none px-6`}>
                Riattiva la fotocamera
              </button>
            ) : (
              <div>
                <p className="max-w-[260px] text-base leading-snug">{TESTO_INQUADRA}</p>
                <p className="mt-2 text-[13px] text-scan-muted">
                  {soloCodice ? TESTO_TORNA_NEL_MODULO : TESTO_DA_SOLO}
                </p>
              </div>
            )}
            {avvisoFoto && (
              <p role="status" className="max-w-[300px] text-sm leading-snug text-scan-muted">
                {TESTO_FOTO_SENZA_CODICE}
              </p>
            )}
          </>
        )}

        {fase.tipo === "scrivi" && (
          <form onSubmit={cercaScritto} className="w-full max-w-[320px] text-left">
            <label htmlFor="scansione-codice" className="mb-2 block text-base font-semibold">
              Il codice sotto le barre
            </label>
            <input
              id="scansione-codice"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              // Il tasto Invio della tastiera dice «Cerca» solo dove si cerca.
              enterKeyHint={soloCodice ? "done" : "search"}
              autoFocus
              value={scritto}
              onChange={(e) => {
                setScritto(e.target.value);
                setErroreScritto(null);
              }}
              aria-invalid={erroreScritto !== null}
              aria-describedby={erroreScritto ? "scansione-codice-errore" : undefined}
              className={`h-12 w-full rounded-xl border border-scan-line bg-scan-key px-4 text-lg tracking-wider text-on-scan tabular-nums ${CLASSE_FOCUS}`}
            />
            {erroreScritto && (
              <p id="scansione-codice-errore" className="mt-2 text-sm text-on-scan">
                {erroreScritto}
              </p>
            )}
            {/* "Cerca" sarebbe falso nell'uso "solo-codice": lì non si
                cerca niente, il codice torna nel modulo. */}
            <button type="submit" className={`${CLASSE_AZIONE} mt-4 w-full flex-none`}>
              {soloCodice ? "Usa questo codice" : "Cerca"}
            </button>
            <button
              type="button"
              onClick={tornaAllaFotocamera}
              className={`mt-3 w-full rounded py-2 text-center text-sm text-scan-muted underline ${CLASSE_FOCUS}`}
            >
              Torna alla fotocamera
            </button>
          </form>
        )}

        {fase.tipo === "ricerca" && (
          <div role="status">
            <p className="text-base">{TESTO_CERCO}</p>
            <p className="mt-2 text-sm tabular-nums text-scan-muted">{fase.codice}</p>
          </div>
        )}

        {fase.tipo === "errore" && (
          <div className="flex w-full max-w-[320px] flex-col gap-3">
            <p role="alert" className="text-base leading-snug">
              {TESTI_ERRORE_RICERCA[fase.errore]}
            </p>
            <p className="text-sm tabular-nums text-scan-muted">{fase.codice}</p>
            <button type="button" onClick={() => void cerca(fase.codice)} className={`${CLASSE_AZIONE} flex-none`}>
              Riprova
            </button>
            <button
              type="button"
              onClick={() => uso.tipo === "cerca" && uso.onModulo({ barcode: fase.codice, prodotto: null })}
              className={`${CLASSE_AZIONE} flex-none`}
            >
              Crea a mano
            </button>
            <button
              type="button"
              onClick={tornaAllaFotocamera}
              className={`w-full rounded py-2 text-center text-sm text-scan-muted underline ${CLASSE_FOCUS}`}
            >
              Scansiona un altro codice
            </button>
          </div>
        )}

        {fase.tipo === "catalogo" && pannello && (
          <PannelloCatalogo
            fase={fase}
            onAggiungi={async () => {
              setFase({ ...fase, inCorso: true, errore: false });
              try {
                await pannello.onAggiungi(fase.voce);
              } catch {
                setFase({ ...fase, inCorso: false, errore: true });
              }
            }}
            onAltroCodice={tornaAllaFotocamera}
          />
        )}

        {fase.tipo === "avviso" && (
          <div className="flex w-full max-w-[320px] flex-col gap-3">
            <p role="status" className="text-base leading-snug">
              {fase.testo}
            </p>
            <p className="text-sm tabular-nums text-scan-muted">{fase.codice}</p>
            <button type="button" onClick={tornaAllaFotocamera} className={`${CLASSE_AZIONE} flex-none`}>
              Scansiona un altro codice
            </button>
          </div>
        )}
      </div>

      {fase.tipo === "fotocamera" && (
        <div className="relative flex shrink-0 gap-2.5 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {/* L'input vero è nascosto: il pulsante lo apre. capture apre
              direttamente la fotocamera posteriore di sistema. */}
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              void daFoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputFoto.current?.click()}
            disabled={!lettore}
            className={CLASSE_AZIONE}
          >
            <IconaFoto />
            Usa una foto
          </button>
          <button type="button" onClick={apriScrivi} className={CLASSE_AZIONE}>
            <IconaCancelletto />
            Scrivi il codice
          </button>
        </div>
      )}
    </div>
  );
}

// Il pannello «Nel catalogo» (PUNTO_DI_PARTENZA.md §10.1; mockup
// catalogo-precaricato.html, «Scansione di un codice del catalogo»): il
// codice non è fra i tuoi alimenti, ma il catalogo precaricato lo conosce,
// senza chiedere a Open Food Facts. Nei colori della scansione, come gli
// altri esiti.
function PannelloCatalogo({
  fase,
  onAggiungi,
  onAltroCodice,
}: {
  fase: Extract<Fase, { tipo: "catalogo" }>;
  onAggiungi: () => void;
  onAltroCodice: () => void;
}) {
  const { voce } = fase;
  return (
    <div className="flex w-full max-w-[320px] flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.8px] text-scan-muted">{TITOLO_NEL_CATALOGO}</p>
      <div>
        <p className="text-lg font-semibold leading-snug">
          {voce.marca ? `${voce.nome} · ${voce.marca}` : voce.nome}
        </p>
        <p className="mt-1 text-sm tabular-nums text-scan-muted">
          {Math.round(voce.kcal_100g)} kcal / 100 g · porzione {voce.porzione_default_g} g
        </p>
      </div>
      <p role="status" className="text-base leading-snug">
        {TESTO_NON_ANCORA_TUO}
      </p>
      {fase.errore && (
        <p role="alert" className="text-sm leading-snug">
          {ERRORE_AGGIUNTA_DAL_CATALOGO}
        </p>
      )}
      <p className="text-sm tabular-nums text-scan-muted">{fase.codice}</p>
      <button
        type="button"
        onClick={onAggiungi}
        disabled={fase.inCorso}
        className={`flex h-[52px] w-full items-center justify-center rounded-full bg-[var(--scansione-mirino)] px-3 text-[15px] font-semibold text-scan disabled:opacity-60 ${CLASSE_FOCUS}`}
      >
        {ETICHETTA_AGGIUNGI_DAL_CATALOGO}
      </button>
      <button
        type="button"
        onClick={onAltroCodice}
        className={`w-full rounded py-2 text-center text-sm text-scan-muted underline ${CLASSE_FOCUS}`}
      >
        Scansiona un altro codice
      </button>
    </div>
  );
}
