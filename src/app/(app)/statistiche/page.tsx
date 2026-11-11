"use client";

// La pagina Statistiche (PUNTO_DI_PARTENZA.md §3, "Statistiche"; mockup
// approvato docs/mockups/statistiche.html, 09/11).
//
// Legge SOLO da Dexie, come Oggi, quindi funziona offline. Non scrive
// niente, né in Dexie né su Supabase: tutti i numeri si calcolano qui da
// voci, obiettivi, target, giorni e pesate con le funzioni pure di /lib
// (medieStatistiche, targetGiorno, esitoObiettivo, periodiStatistiche,
// pesoStatistiche).
//
// Il periodo sta nell'indirizzo (?vista=mese&dal=2026-10-01), così il tasto
// indietro dopo «Apri il giorno» riporta allo stesso periodo. Si cambia con
// window.history.replaceState, non con il router di Next: Next se ne
// accorge da solo (useSearchParams si aggiorna) e non chiede niente al
// server, quindi funziona anche offline. replace e non push: le frecce non
// riempiono la cronologia, e "indietro" esce dalla pagina come sempre.
// Un indirizzo non valido torna alla settimana in corso (periodoDaIndirizzo).
//
// Nessun caricamento pigro di codice (next/dynamic): il service worker
// salva solo i file citati dall'HTML della pagina, e un pezzo caricato dopo
// offline mancherebbe.

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { useGiornoCorrente } from "@/lib/useGiornoCorrente";
import {
  repositoryGiorni,
  repositoryMisurazioni,
  repositoryObiettivi,
  repositoryObiettiviTarget,
  repositoryProfili,
  repositoryVociDiario,
} from "@/lib/repository";
import {
  etichettaPeriodo,
  giorniDelPeriodo,
  limitiFrecce,
  periodoAdiacente,
  periodoCambiandoModo,
  periodoDaIndirizzo,
  type ModoPeriodo,
} from "@/lib/periodiStatistiche";
import {
  giorniStatistiche,
  medieDelPeriodo,
  primoGiornoConVoci,
  segnoObiettivo,
  senzaVoci,
} from "@/lib/medieStatistiche";
import {
  graficoPeso,
  testoDifferenzaPeso,
  testoUltimaPesataStatistiche,
} from "@/lib/pesoStatistiche";
import { periodoInCorso } from "@/lib/totaliDiario";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import SelettoreSegmenti from "@/components/SelettoreSegmenti";
import RiquadroMedia from "@/components/RiquadroMedia";
import GraficoCalorie from "@/components/GraficoCalorie";
import DettaglioGiorno from "@/components/DettaglioGiorno";
import GraficoPeso from "@/components/GraficoPeso";
import IconaIndietro from "@/components/IconaIndietro";
import IconaAvanti from "@/components/IconaAvanti";
import IconaPiu from "@/components/IconaPiu";

// useSearchParams va avvolto in <Suspense>, come in Oggi e nel login:
// Next prepara la pagina in anticipo senza conoscere l'indirizzo.
export default function StatistichePage() {
  return (
    <Suspense fallback={<Caricamento />}>
      <StatisticheContenuto />
    </Suspense>
  );
}

function Caricamento() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <p className="text-sm text-muted">Caricamento...</p>
    </main>
  );
}

const CLASSE_LINK = `inline-flex min-h-11 items-center gap-0.5 rounded-lg text-sm font-semibold text-accent ${CLASSE_FOCUS}`;

function StatisticheContenuto() {
  const userId = useUtenteId();
  const searchParams = useSearchParams();
  const oggi = useGiornoCorrente();

  // Il giorno toccato, legato al periodo in cui lo si è toccato: cambiando
  // periodo la selezione sparisce da sola, senza un effetto che la azzeri.
  const [selezione, setSelezione] = useState<{ periodo: string; data: string } | null>(null);

  // Come in Oggi: `undefined` = "non so ancora", finché non si conosce
  // l'utente o Dexie non ha risposto.
  const voci = useLiveQuery(
    async () => (userId ? repositoryVociDiario.ottieniTutti(userId) : undefined),
    [userId]
  );
  const obiettivi = useLiveQuery(
    async () => (userId ? repositoryObiettivi.ottieniTutti(userId) : undefined),
    [userId]
  );
  const obiettiviTarget = useLiveQuery(
    async () => (userId ? repositoryObiettiviTarget.ottieniTutti(userId) : undefined),
    [userId]
  );
  const giorniRighe = useLiveQuery(
    async () => (userId ? repositoryGiorni.ottieniTutti(userId) : undefined),
    [userId]
  );
  const profilo = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryProfili.ottieniTutti(userId);
    return righe[0] ?? null;
  }, [userId]);
  const misurazioni = useLiveQuery(
    async () => (userId ? repositoryMisurazioni.ottieniTutti(userId) : undefined),
    [userId]
  );

  if (
    voci === undefined ||
    obiettivi === undefined ||
    obiettiviTarget === undefined ||
    giorniRighe === undefined ||
    profilo === undefined ||
    misurazioni === undefined
  ) {
    return <Caricamento />;
  }

  const dati = { obiettivi, obiettiviTarget, giorni: giorniRighe, profilo };
  const nuovo = senzaVoci(voci);
  const primo = primoGiornoConVoci(voci, oggi);
  const { modo, inizio } = periodoDaIndirizzo(
    searchParams.get("vista"),
    searchParams.get("dal"),
    primo,
    oggi
  );
  const chiavePeriodo = `${modo}:${inizio}`;

  const giorni = giorniStatistiche(giorniDelPeriodo(modo, inizio), voci, dati, oggi);
  const medie = medieDelPeriodo(giorni);
  const segno = segnoObiettivo(giorni);
  // Per un utente nuovo tutte e due spente: senza voci il primo periodo è
  // quello in corso (limitiFrecce).
  const frecce = limitiFrecce(modo, inizio, primo, oggi);
  const etichetta = etichettaPeriodo(modo, inizio, oggi);

  const dataScelta = selezione?.periodo === chiavePeriodo ? selezione.data : null;
  const giornoScelto = giorni.find((g) => g.data === dataScelta) ?? null;

  const peso = graficoPeso(misurazioni, oggi);
  const pesoObiettivo = periodoInCorso(obiettivi, oggi)?.peso_obiettivo ?? null;

  function vaiA(modoNuovo: ModoPeriodo, inizioNuovo: string) {
    window.history.replaceState(null, "", `/statistiche?vista=${modoNuovo}&dal=${inizioNuovo}`);
  }

  function tocca(data: string) {
    setSelezione(dataScelta === data ? null : { periodo: chiavePeriodo, data });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <h1 className="mx-1 mt-1.5 font-display text-[34px] font-bold leading-tight">Statistiche</h1>

      <SelettoreSegmenti
        etichetta="Periodo"
        segmenti={[
          { valore: "settimana", etichetta: "Settimana" },
          { valore: "mese", etichetta: "Mese" },
        ]}
        valore={modo}
        onCambia={(m) => {
          if (m !== modo) vaiA(m, periodoCambiandoModo(m, inizio, primo, oggi));
        }}
      />

      <div className="-mt-1 flex items-center justify-between gap-2">
        <FrecciaPeriodo
          direzione="precedente"
          attiva={frecce.precedente}
          onClick={() => vaiA(modo, periodoAdiacente(modo, inizio, -1))}
        />
        <div className="min-w-0 text-center">
          <p className="text-[17px] font-semibold tabular-nums">{etichetta.titolo}</p>
          <p className="min-h-[17px] text-[13px] text-muted">{etichetta.sottotitolo}</p>
        </div>
        <FrecciaPeriodo
          direzione="successivo"
          attiva={frecce.successivo}
          onClick={() => vaiA(modo, periodoAdiacente(modo, inizio, 1))}
        />
      </div>

      {/* Ordine dell'app: Kcal, Grassi, Carboidrati, Proteine (PUNTO §7). */}
      <div className="grid grid-cols-2 gap-3">
        <RiquadroMedia etichetta="Media kcal" grandezza="kcal" media={medie?.kcal ?? null} />
        <RiquadroMedia etichetta="Media grassi" grandezza="grassi" media={medie?.grassi ?? null} />
        <RiquadroMedia
          etichetta="Media carboidrati"
          grandezza="carboidrati"
          media={medie?.carboidrati ?? null}
        />
        <RiquadroMedia
          etichetta="Media proteine"
          grandezza="proteine"
          media={medie?.proteine ?? null}
        />
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="titolo-calorie">
        <TestataSezione
          id="titolo-calorie"
          titolo="Calorie giornaliere"
          destra={!nuovo && !medie ? "nessun giorno registrato" : null}
        />
        {nuovo ? (
          <Vuoto testo="Le medie e le barre compaiono dal primo pasto che registri.">
            <Link
              href="/aggiungi"
              className={`inline-flex h-11 items-center gap-1.5 rounded-full bg-accent-strong px-[18px] text-[15px] font-semibold text-on-strong ${CLASSE_FOCUS}`}
            >
              <IconaPiu size={18} />
              Registra il primo pasto
            </Link>
          </Vuoto>
        ) : (
          <>
            <GraficoCalorie
              giorni={giorni}
              modo={modo}
              oggi={oggi}
              segno={segno}
              selezionato={dataScelta}
              onTocca={tocca}
            />
            <DettaglioGiorno
              giorno={giornoScelto}
              differenziaGiorni={profilo?.differenzia_giorni ?? false}
            />
          </>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="titolo-peso">
        <TestataSezione
          id="titolo-peso"
          titolo="Peso"
          destra={peso.stato === "pesate" ? testoDifferenzaPeso(peso.pesate) : null}
        />
        {peso.stato === "nessuna" && (
          <Vuoto testo="Nessuna pesata. Ogni pesata diventa un punto del grafico.">
            <Link href="/impostazioni/peso" className={CLASSE_LINK}>
              Registra peso
              <IconaAvanti size={18} />
            </Link>
          </Vuoto>
        )}
        {peso.stato === "fuori-finestra" && (
          <>
            <Vuoto testo="Nessuna pesata nelle ultime 12 settimane." />
            <PiedePeso ultima={peso.ultima.data} oggi={oggi} />
          </>
        )}
        {peso.stato === "pesate" && (
          <>
            <GraficoPeso
              pesate={peso.pesate}
              inizioAsse={peso.inizioAsse}
              fineAsse={peso.fineAsse}
              pesoObiettivo={pesoObiettivo}
            />
            <PiedePeso ultima={peso.pesate[peso.pesate.length - 1].data} oggi={oggi} />
          </>
        )}
      </section>
    </main>
  );
}

function FrecciaPeriodo({
  direzione,
  attiva,
  onClick,
}: {
  direzione: "precedente" | "successivo";
  attiva: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!attiva}
      aria-label={direzione === "precedente" ? "Periodo precedente" : "Periodo successivo"}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground disabled:text-border ${CLASSE_FOCUS}`}
    >
      {direzione === "precedente" ? <IconaIndietro /> : <IconaAvanti />}
    </button>
  );
}

function TestataSezione({
  id,
  titolo,
  destra,
}: {
  id: string;
  titolo: string;
  destra: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <h2 id={id} className="text-xs font-medium uppercase tracking-[1.2px] text-muted">
        {titolo}
      </h2>
      {destra && <span className="text-[13px] text-muted tabular-nums">{destra}</span>}
    </div>
  );
}

function Vuoto({ testo, children }: { testo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-border px-4 py-[22px] text-center">
      <p className="max-w-[30ch] text-sm leading-relaxed text-muted">{testo}</p>
      {children}
    </div>
  );
}

function PiedePeso({ ultima, oggi }: { ultima: string; oggi: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 text-[13.5px] text-muted">
      <span>{testoUltimaPesataStatistiche(ultima, oggi)}</span>
      <Link href="/impostazioni/peso" className={CLASSE_LINK}>
        Registra peso
        <IconaAvanti size={18} />
      </Link>
    </div>
  );
}
