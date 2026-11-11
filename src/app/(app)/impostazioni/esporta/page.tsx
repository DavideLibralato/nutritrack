"use client";

// Impostazioni > Esporta i miei dati (PUNTO_DI_PARTENZA.md §10.4; mockup
// approvato docs/mockups/esporta.html, versione 2, 08/11).
//
// Concetto nuovo per questa pagina: il file si prepara all'APERTURA, non
// al tocco. navigator.share() (il foglio di iOS) si può chiamare solo
// subito dopo un tocco: se fra il tocco e la condivisione ci fosse la
// lettura di Dexie e la verifica della foto (fino a 8 secondi), Safari la
// rifiuterebbe. Così useEffect, all'apertura, chiama preparaEsportazione
// (in /lib) e tiene in memoria i due testi pronti; il pulsante li passa a
// salvaJson / salvaCsv, che arrivano alla condivisione senza attese.
//
// Gli stati (testi in testiEsporta.ts):
// - preparazione: numeri che si caricano, foto "Controllo…", pulsante
//   spento "Preparo il file…";
// - dati non ancora scaricati / manca il profilo: un riquadro al posto del
//   riepilogo, con il suo pulsante («Vai a Sincronizzazione», «Vai al
//   profilo»). La pagina riprova da sola quando finisce un giro della
//   sincronizzazione;
// - pronta, con le note della foto quando serve;
// - dopo il tocco: salvato (messaggio in basso, promemoria "oggi" solo per
//   il JSON), annullato (niente), errore ("Riprova"), app installata senza
//   condivisione o browser che non sa salvare (messaggio).
//
// I dati non si rileggono mentre la pagina è aperta: il file è quello di
// quando la si è aperta, come dice il riepilogo.

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUtenteId } from "@/lib/supabase/useUtente";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaImpostazioni from "@/components/RigaImpostazioni";
import BarraAnnulla from "@/components/BarraAnnulla";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import {
  iscriviStatoGiri,
  leggiStatoGiri,
  leggiStatoGiriLatoServer,
} from "@/lib/sync/statoSincronizzazione";
import { preparaEsportazione, type EsitoPreparazione } from "@/lib/esporta/preparaEsportazione";
import { ambienteBrowser, type EsitoSalvataggio } from "@/lib/esporta/condividiFile";
import { salvaCsv, salvaJson } from "@/lib/esporta/salvaEsportazione";
import { useUltimaEsportazione } from "@/lib/esporta/useUltimaEsportazione";
import {
  TESTI_ESPORTA as T,
  conteggiRiepilogo,
  notaRiepilogo,
  testoFoto,
  testoPeso,
} from "@/lib/esporta/testiEsporta";

type Preparazione = { fase: "attesa" } | EsitoPreparazione | { esito: "lettura-fallita" };

// Il messaggio sopra il pulsante dopo un tentativo.
type Messaggio = "errore" | "app-installata" | "non-supportato" | null;

export default function EsportaPage() {
  const userId = useUtenteId();
  const router = useRouter();
  const [prep, setPrep] = useState<Preparazione>({ fase: "attesa" });
  const [messaggio, setMessaggio] = useState<Messaggio>(null);
  const [salvatoId, setSalvatoId] = useState<number | null>(null);
  // Il promemoria: si aggiorna da solo quando salvaJson segna la data.
  const promemoriaTesto = useUltimaEsportazione(userId);

  // Con la copia incompleta (dati non scaricati o profilo mancante) la
  // pagina riprova da sola alla fine di ogni giro della sincronizzazione
  // (lo stato dei giri cambia oggetto a ogni giro): il profilo compilato
  // in Profilo, o i dati riscaricati, la sbloccano. Con il file pronto no:
  // non si rifà da solo.
  const giri = useSyncExternalStore(iscriviStatoGiri, leggiStatoGiri, leggiStatoGiriLatoServer);
  const incompleta = "esito" in prep && prep.esito === "copia-incompleta";
  const chiaveRiprova = incompleta ? giri.discesa : null;

  useEffect(() => {
    if (!userId) return;
    let valida = true;
    preparaEsportazione(userId)
      .then((esito) => {
        if (valida) setPrep(esito);
      })
      .catch((errore) => {
        console.error("Esporta: preparazione non riuscita.", errore);
        if (valida) setPrep({ esito: "lettura-fallita" });
      });
    return () => {
      valida = false;
    };
  }, [userId, chiaveRiprova]);

  const dopoIlTentativo = useCallback((esito: EsitoSalvataggio) => {
    if (esito.esito === "salvato") {
      setMessaggio(null);
      setSalvatoId(Date.now());
    } else if (esito.esito === "annullato") {
      // Niente: il foglio chiuso non cambia niente.
    } else if (esito.esito === "errore") {
      console.error(`Esporta: salvataggio non riuscito (${esito.nome}).`);
      setMessaggio("errore");
    } else {
      setMessaggio(esito.motivo);
    }
  }, []);

  const pronti = "esito" in prep && prep.esito === "pronti" ? prep.file : null;

  // Questi due vanno chiamati direttamente dal tocco: nessuna attesa prima
  // di salvaJson / salvaCsv.
  function esportaJson() {
    if (!pronti || !userId) return;
    void salvaJson(ambienteBrowser(), userId, pronti.json.nome, pronti.json.testo).then(
      dopoIlTentativo
    );
  }
  function esportaCsv() {
    if (!pronti) return;
    void salvaCsv(ambienteBrowser(), pronti.csv.nome, pronti.csv.testo).then(dopoIlTentativo);
  }

  const promemoria = <p className="mx-3.5 text-center text-[13px] text-muted">{promemoriaTesto}</p>;

  let corpo: ReactNode;
  if ("esito" in prep && prep.esito === "copia-incompleta") {
    const nonScaricata = prep.manca === "non-scaricata";
    corpo = (
      <>
        <section className="flex flex-col items-center gap-2 rounded-[20px] border border-border bg-surface px-[18px] py-[22px] text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-[var(--capsula-attiva)] text-accent"
          >
            {nonScaricata ? <IconaNuvola /> : <IconaPersona />}
          </span>
          <h2 className="mt-1 font-display text-lg font-bold">
            {nonScaricata ? T.nonScaricataTitolo : T.senzaProfiloTitolo}
          </h2>
          <p className="max-w-[32ch] text-sm leading-snug text-muted">
            {nonScaricata ? T.nonScaricata : T.senzaProfilo}
          </p>
          <button
            type="button"
            onClick={() =>
              router.push(nonScaricata ? "/impostazioni/sincronizzazione" : "/impostazioni/profilo")
            }
            className={`mt-2 min-h-[46px] w-full rounded-2xl border border-border bg-surface font-bold text-accent ${CLASSE_FOCUS}`}
          >
            {nonScaricata ? T.nonScaricataAzione : T.senzaProfiloAzione}
          </button>
        </section>
        {promemoria}
      </>
    );
  } else if ("esito" in prep && prep.esito === "lettura-fallita") {
    corpo = (
      <>
        <Avviso forte={T.letturaFallitaForte} testo={T.letturaFallita} />
        {promemoria}
      </>
    );
  } else {
    const conteggi = pronti ? conteggiRiepilogo(pronti.esportazione.dati) : null;
    const statoFoto = pronti ? pronti.esportazione.intestazione.foto : null;
    const carica = (
      <span
        aria-label="Caricamento"
        className="carica-esporta inline-block h-[0.9em] w-[3.2em] rounded-md"
      />
    );
    const valore = (v: ReactNode) => (conteggi ? v : carica);
    const diarioVuoto = conteggi !== null && pronti!.esportazione.dati.voci_diario.length === 0;

    corpo = (
      <>
        <p className="mx-1 text-[15px] leading-snug">{T.apertura}</p>

        <GruppoImpostazioni
          titolo="Nel file"
          nota={
            pronti && statoFoto
              ? notaRiepilogo(statoFoto, pronti.esportazione.intestazione.ultimo_contatto_server)
              : undefined
          }
        >
          <RigaImpostazioni
            etichetta="Diario"
            icona={<IconaDiario />}
            valore={valore(
              conteggi && (
                <span className="block text-right">
                  {conteggi.diario.numero}
                  {conteggi.diario.periodo && (
                    <small className="block text-[13px]">{conteggi.diario.periodo}</small>
                  )}
                </span>
              )
            )}
          />
          <RigaImpostazioni
            etichetta="Alimenti"
            icona={<IconaAlimenti />}
            valore={valore(conteggi?.alimenti)}
          />
          <RigaImpostazioni
            etichetta="Pasti salvati"
            icona={<IconaPasti />}
            valore={valore(conteggi?.pastiSalvati)}
          />
          <RigaImpostazioni
            etichetta="Pesate"
            icona={<IconaPeso />}
            valore={valore(conteggi?.pesate)}
          />
          <RigaImpostazioni
            etichetta="Obiettivi"
            icona={<IconaObiettivi />}
            valore={valore(conteggi?.obiettivi)}
          />
          <RigaImpostazioni
            etichetta="Foto profilo"
            icona={<IconaFoto />}
            valore={
              <span className={statoFoto?.stato === "non-inclusa" ? "text-warning" : undefined}>
                {testoFoto(statoFoto)}
              </span>
            }
          />
        </GruppoImpostazioni>

        <div className="flex items-start gap-3 rounded-[20px] border border-border bg-surface px-3.5 py-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-warning/15 text-warning"
          >
            <IconaLucchetto />
          </span>
          <p className="text-sm leading-snug">
            <b className="font-bold">{T.avvisoForte}</b> {T.avviso}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {messaggio === "errore" && <Avviso forte={T.erroreForte} testo={T.errore} />}
          {messaggio === "app-installata" && (
            <Avviso
              forte={T.installataForte}
              testo={
                <>
                  {T.installataPrima} <b className="select-all font-bold">{T.indirizzo}</b>{" "}
                  {T.installataDopo}
                </>
              }
            />
          )}
          {messaggio === "non-supportato" && (
            <Avviso forte={T.nonSupportatoForte} testo={T.nonSupportato} />
          )}
          <button
            type="button"
            onClick={esportaJson}
            disabled={!pronti}
            className={`flex min-h-[50px] w-full items-center justify-center gap-2.5 rounded-2xl bg-accent-strong font-bold text-on-strong disabled:opacity-40 ${CLASSE_FOCUS}`}
          >
            {!pronti ? (
              <>
                <span
                  aria-hidden
                  className="giro-esporta size-[18px] rounded-full border-[2.5px]"
                />
                {T.preparo}
              </>
            ) : messaggio === "errore" ? (
              T.riprova
            ) : (
              T.pulsante
            )}
          </button>
          <p className="mx-1.5 flex justify-between gap-2.5 text-xs text-muted tabular-nums">
            <span className="[overflow-wrap:anywhere]">{pronti?.json.nome ?? ""}</span>
            <span>{pronti ? testoPeso(pronti.json.byte) : ""}</span>
          </p>
          {promemoria}
        </div>

        <GruppoImpostazioni titolo="Solo il diario">
          <RigaImpostazioni
            etichetta={T.csv}
            icona={<IconaCsv />}
            sottotitolo={diarioVuoto ? T.csvVuoto : T.csvSotto}
            onClick={esportaCsv}
            spenta={!pronti || diarioVuoto}
          />
        </GruppoImpostazioni>
      </>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo={T.titolo} />
      {corpo}

      {/* Sopra la tab bar, come le barre delle altre pagine. */}
      {salvatoId !== null && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[var(--ingombro-tab-bar)] z-40 mx-auto max-w-md">
          <BarraAnnulla
            key={salvatoId}
            testo={T.salvato}
            icona="spunta"
            onChiudi={() => setSalvatoId(null)}
          />
        </div>
      )}
    </main>
  );
}

function Avviso({ forte, testo }: { forte: string; testo: ReactNode }) {
  return (
    <p role="status" className="avviso-esporta rounded-2xl border px-3 py-2.5 text-sm leading-snug">
      <b className="font-bold text-warning">{forte}</b> {testo}
    </p>
  );
}

// Icone del mockup. `currentColor`: prendono il colore dal quadratino.
const TRATTO = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconaDiario() {
  return (
    <svg {...TRATTO}>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </svg>
  );
}
function IconaAlimenti() {
  return (
    <svg {...TRATTO}>
      <path d="M12 7c-3-3-8-1-7 4 .8 4 3.5 8 7 8s6.2-4 7-8c1-5-4-7-7-4z" />
      <path d="M12 7c0-2 1-3 3-3.5" />
    </svg>
  );
}
function IconaPasti() {
  return (
    <svg {...TRATTO}>
      <path d="M4 13h16a8 8 0 01-16 0z" />
      <path d="M9 9c0-2 2-2 2-4M14 9c0-2 2-2 2-4" />
    </svg>
  );
}
function IconaPeso() {
  return (
    <svg {...TRATTO}>
      <rect x="4" y="5" width="16" height="15" rx="4" />
      <path d="M9 10a4 4 0 016 0l-2 2.5" />
    </svg>
  );
}
function IconaObiettivi() {
  return (
    <svg {...TRATTO}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r=".8" />
    </svg>
  );
}
function IconaFoto() {
  return (
    <svg {...TRATTO}>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 20c1-3.8 4-5.5 7-5.5s6 1.7 7 5.5" />
    </svg>
  );
}
function IconaCsv() {
  return (
    <svg {...TRATTO}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16M4 14.5h16M10 5v14" />
    </svg>
  );
}
function IconaLucchetto() {
  return (
    <svg {...TRATTO}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
    </svg>
  );
}
function IconaNuvola() {
  return (
    <svg {...TRATTO} width={24} height={24}>
      <path d="M7 18a4 4 0 01-.6-8A5.5 5.5 0 0117 8.5 4.5 4.5 0 0117 18" />
      <path d="M12 11v7M9.5 15.5L12 18l2.5-2.5" />
    </svg>
  );
}
function IconaPersona() {
  return (
    <svg {...TRATTO} width={24} height={24}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1-3.8 4-5.5 7-5.5s6 1.7 7 5.5" />
      <path d="M18 4v4M16 6h4" />
    </svg>
  );
}
