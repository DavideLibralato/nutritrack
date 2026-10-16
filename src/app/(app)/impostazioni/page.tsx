"use client";

// La pagina Impostazioni (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni";
// mockup approvato in docs/mockups/impostazioni.html): un elenco a gruppi,
// come le impostazioni dell'iPhone, da cui si entra nelle sotto-pagine.
//
// Ci sono solo le righe che funzionano (sezione 3: un comando che non fa
// niente sembra rotto).
//
// La riga Obiettivi mostra a destra le calorie del periodo valido oggi
// (testoRigaObiettivi, con il suo test): "2500 kcal", oppure "2500 · 2950
// kcal" con i giorni differenziati accesi, "Da impostare" senza periodo.
// La riga Peso mostra l'ultima pesata ("85 kg", "78,4 kg") o "Da
// registrare" (testoRigaPeso, con il suo test). La riga Pasti e orari
// mostra quanti pasti valgono oggi ("5 pasti"). Tutte e tre non mostrano
// niente finché i dati non sono arrivati da Dexie.
// La riga Aspetto mostra le scelte salvate su questo dispositivo, tema e
// colore principale ("Sistema · Verde"), niente finché il browser non le ha
// lette.
// La riga Sincronizzazione mostra lo stato in breve, con un pallino
// colorato (dal 10/10, mockup docs/mockups/sincronizzazione.html, "2 ·
// Pallino + testo"): "Tutto salvato", "In corso…", "2 in attesa", "Errore",
// "Accedi di nuovo", "Da controllare" (rigaSincronizzazione, con il suo
// test). Niente finché la coda non è arrivata da Dexie.
// La riga Preferiti (dall'11/10 in App, dal 15/10 in Alimentazione dopo
// Pasti e orari; mockup
// docs/mockups/preferiti-e-pasti-salvati.html; la pagina si intitola
// "Preferiti e pasti salvati", ma per esteso l'etichetta veniva accorciata
// con "…" su iPhone) mostra "12 alimenti · 3 pasti", solo uno dei due se
// l'altro è a zero, o "Nessuno" (contaPreferiti e testoRigaPreferiti, con il loro
// test): contati con le stesse funzioni dell'elenco, mai dalle tabelle
// grezze. Niente finché i dati non sono arrivati da Dexie.
// La riga Alimenti (dal 15/10, branch catalogo-alimenti, prima di
// Preferiti; PUNTO_DI_PARTENZA.md sezione 3, "Alimenti") mostra quanti
// alimenti ha la pagina del catalogo: "46 alimenti", "1 alimento",
// "Nessuno" (alimentiModificabili e testoRigaAlimenti, con il loro test).
// La riga Amici (dal 15/10, branch amici, in un gruppo suo sotto
// Alimentazione) mostra quanti amici: "2 amici", "1 amico", "Nessuno"
// (testoRigaAmici, con il suo test). Si legge online (useAmicizie). Con
// delle novità (dal passo 7, useNovitaAmici) al posto del numero c'è "2
// nuove" in colore principale con il pallino.
//
// Questa pagina non ha un modulo: niente da salvare, quindi niente
// guardiano delle modifiche. Esci in fondo, con la sua conferma.

import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId, useNomeUtente } from "@/lib/supabase/useUtente";
import {
  repositoryProfili,
  repositoryMisurazioni,
  repositoryObiettivi,
  repositoryObiettiviTarget,
  repositoryPreferiti,
  repositoryComposizioni,
  repositoryComposizioniVoci,
} from "@/lib/repository";
import { ultimaMisurazione } from "@/lib/repository/misurazioni";
import { tuttiIPasti } from "@/lib/repository/pasti";
import { pastiValidiIl } from "@/lib/pasti/validitaPasti";
import { periodoInCorso } from "@/lib/totaliDiario";
import { oggiLocale } from "@/lib/dataGiorno";
import { testoRigaObiettivi } from "@/lib/profilo/rigaObiettivi";
import { testoRigaPeso } from "@/lib/profilo/testiPeso";
import { useSceltaAccento, useSceltaTema } from "@/lib/useSceltaTema";
import { NOMI_ACCENTO, type SceltaTema } from "@/lib/tema";
import SchedaAccount from "@/components/SchedaAccount";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaImpostazioni from "@/components/RigaImpostazioni";
import EsciAccount from "@/components/EsciAccount";
import ValoreRigaSincronizzazione from "@/components/ValoreRigaSincronizzazione";
import { useStatoSincronizzazione } from "@/lib/sync/useStatoSincronizzazione";
import { rigaSincronizzazione } from "@/lib/sync/rigaSincronizzazione";
import { catalogoLocale } from "@/lib/repository/alimenti";
import { contaPreferiti, testoRigaPreferiti } from "@/lib/inserimento/rigaPreferiti";
import { alimentiModificabili, testoRigaAlimenti } from "@/lib/catalogo/alimentiModificabili";
import { useAmicizie } from "@/lib/amici/useAmicizie";
import { testoNovitaRiga, testoRigaAmici } from "@/lib/amici/testiAmici";
import { useNovitaAmici } from "@/lib/amici/novita";

export default function ImpostazioniPage() {
  const userId = useUtenteId();
  const nome = useNomeUtente();
  const sceltaTema = useSceltaTema();
  const sceltaAccento = useSceltaAccento();

  const profilo = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryProfili.ottieniTutti(userId);
    return righe[0] ?? null;
  }, [userId]);

  const ultimaPesata = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryMisurazioni.ottieniTutti(userId);
    return ultimaMisurazione(righe.filter((riga) => riga.tipo === "peso"));
  }, [userId]);

  const obiettivi = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettivi.ottieniTutti(userId);
  }, [userId]);

  const obiettiviTarget = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettiviTarget.ottieniTutti(userId);
  }, [userId]);

  // Finché i dati non sono arrivati da Dexie, niente valore (non "Da
  // impostare", che sarebbe falso per un istante).
  const valoreObiettivi =
    profilo !== undefined && obiettivi !== undefined && obiettiviTarget !== undefined
      ? testoRigaObiettivi(
          periodoInCorso(obiettivi, oggiLocale()),
          obiettiviTarget,
          profilo?.differenzia_giorni ?? false
        )
      : undefined;

  const valorePeso = ultimaPesata === undefined ? undefined : testoRigaPeso(ultimaPesata);

  const pasti = useLiveQuery(async () => {
    if (!userId) return undefined;
    return tuttiIPasti(userId);
  }, [userId]);
  const numeroPasti = pasti === undefined ? undefined : pastiValidiIl(pasti, oggiLocale()).length;
  const valorePasti =
    numeroPasti === undefined ? undefined : numeroPasti === 1 ? "1 pasto" : `${numeroPasti} pasti`;

  const { stato: statoSincronizzazione } = useStatoSincronizzazione(userId);

  // Quanti amici, letti dal server come nella pagina Amici (stessa
  // divisione delle righe): "…" mentre legge, "Serve la connessione" se la
  // risposta non arriva. La riga apre comunque la pagina, che lo dice e
  // riprova da sola.
  const { stato: statoAmicizie } = useAmicizie();
  // Solo le richieste di amicizia ricevute, non il totale della tab: gli
  // alimenti in arrivo avranno il loro numero sulla riga Alimenti
  // (decisione del 16/10).
  const novitaAmici = useNovitaAmici().richiesteRicevute;

  // Gli stessi alimenti della pagina Alimenti, contati con la stessa
  // funzione dell'elenco.
  const valoreAlimenti = useLiveQuery(async () => {
    if (!userId) return undefined;
    return testoRigaAlimenti(alimentiModificabili(await catalogoLocale(userId), userId).length);
  }, [userId]);

  // Una sola lettura per le quattro tabelle: il valore compare tutto insieme,
  // non prima con gli alimenti e poi con i pasti.
  const valorePreferiti = useLiveQuery(async () => {
    if (!userId) return undefined;
    const [catalogo, preferiti, composizioni, composizioniVoci] = await Promise.all([
      catalogoLocale(userId),
      repositoryPreferiti.ottieniTutti(userId),
      repositoryComposizioni.ottieniTutti(userId),
      repositoryComposizioniVoci.ottieniTutti(userId),
    ]);
    return testoRigaPreferiti(contaPreferiti(catalogo, preferiti, composizioni, composizioniVoci));
  }, [userId]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <h1 className="mx-1 mt-1.5 font-display text-[34px] font-bold leading-tight">Impostazioni</h1>

      <SchedaAccount
        nome={nome}
        pesoKg={ultimaPesata?.valore ?? null}
        altezzaCm={profilo?.altezza_cm ?? null}
      />

      <GruppoImpostazioni titolo="Alimentazione">
        <RigaImpostazioni
          etichetta="Obiettivi"
          icona={<IconaObiettivi />}
          valore={valoreObiettivi}
          href="/impostazioni/obiettivi"
        />
        <RigaImpostazioni
          etichetta="Pasti e orari"
          icona={<IconaPasti />}
          valore={valorePasti}
          href="/impostazioni/pasti"
        />
        <RigaImpostazioni
          etichetta="Alimenti"
          icona={<IconaAlimenti />}
          valore={valoreAlimenti}
          href="/impostazioni/alimenti"
        />
        <RigaImpostazioni
          etichetta="Preferiti"
          icona={<IconaPreferiti />}
          valore={valorePreferiti}
          href="/impostazioni/preferiti"
        />
        <RigaImpostazioni
          etichetta="Peso"
          icona={<IconaPeso />}
          valore={valorePeso}
          href="/impostazioni/peso"
        />
      </GruppoImpostazioni>

      {/* Amici (dal 15/10, branch amici): letti online, non da Dexie. */}
      <GruppoImpostazioni titolo="Amici">
        <RigaImpostazioni
          etichetta="Amici"
          icona={<IconaAmici />}
          valore={
            // Con delle novità, "2 nuove" con il pallino al posto del
            // numero di amici (passo 7): anche offline, dall'ultimo numero
            // noto.
            novitaAmici > 0 ? (
              <span className="flex items-center gap-1.5 font-semibold text-accent">
                {testoNovitaRiga(novitaAmici)}
                <span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />
              </span>
            ) : statoAmicizie.esito === "ok" ? (
              testoRigaAmici(statoAmicizie.divise.amici.length)
            ) : statoAmicizie.esito === "errore" ? (
              "Serve la connessione"
            ) : (
              "…"
            )
          }
          href="/impostazioni/amici"
        />
      </GruppoImpostazioni>

      <GruppoImpostazioni titolo="App">
        <RigaImpostazioni
          etichetta="Aspetto"
          icona={<IconaAspetto />}
          valore={
            sceltaTema && sceltaAccento
              ? `${NOMI_TEMA[sceltaTema]} · ${NOMI_ACCENTO[sceltaAccento]}`
              : undefined
          }
          href="/impostazioni/aspetto"
        />
        <RigaImpostazioni
          etichetta="Sincronizzazione"
          icona={<IconaSincronizzazione />}
          valore={
            statoSincronizzazione && (
              <ValoreRigaSincronizzazione riga={rigaSincronizzazione(statoSincronizzazione)} />
            )
          }
          href="/impostazioni/sincronizzazione"
        />
      </GruppoImpostazioni>

      <GruppoImpostazioni>
        <RigaImpostazioni
          etichetta="Informazioni"
          icona={<IconaInformazioni />}
          valore={`v${process.env.VERSIONE_APP}`}
          href="/impostazioni/informazioni"
        />
      </GruppoImpostazioni>

      {userId && <EsciAccount userId={userId} />}

      {/* In un gruppo suo, sotto Esci (deciso l'11/10, mockup
          docs/mockups/elimina-account.html): rossa, a sinistra, con la
          freccia; la conferma sta nella sottopagina. */}
      {userId && (
        <GruppoImpostazioni>
          <RigaImpostazioni etichetta="Elimina il mio account" href="/impostazioni/elimina-account" pericolo />
        </GruppoImpostazioni>
      )}
    </main>
  );
}

const NOMI_TEMA: Record<SceltaTema, string> = {
  chiaro: "Chiaro",
  scuro: "Scuro",
  sistema: "Sistema",
};

// Icone dei quadratini, disegno del mockup. `currentColor`: prendono
// l'accento dal quadratino (RigaImpostazioni).
const TRATTO = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconaObiettivi() {
  return (
    <svg {...TRATTO}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r=".6" fill="currentColor" />
    </svg>
  );
}

function IconaPasti() {
  return (
    <svg {...TRATTO}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function IconaPeso() {
  return (
    <svg {...TRATTO}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M9 10a3 3 0 016 0" />
      <path d="M12 10l1.2-1.6" />
    </svg>
  );
}

// Due persone: gli amici (disegno del mockup docs/mockups/amici.html).
function IconaAmici() {
  return (
    <svg {...TRATTO}>
      <circle cx="9" cy="9" r="3.6" />
      <path d="M2.7 19.5c.75-3.6 3.3-5.4 6.3-5.4s5.55 1.8 6.3 5.4" />
      <circle cx="17" cy="8.1" r="2.85" />
      <path d="M16.5 13.95c2.7 0 4.5 1.5 5.1 4.5" />
    </svg>
  );
}

function IconaAspetto() {
  return (
    <svg {...TRATTO}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 010 16z" fill="currentColor" />
    </svg>
  );
}

// Una mela: il catalogo degli alimenti.
function IconaAlimenti() {
  return (
    <svg {...TRATTO}>
      <path d="M12 8c-1.6-1.3-4.6-1.3-6 .9-1.5 2.4-.8 6.2 1.3 8.7 1.3 1.5 2.5 2 3.4 1.5.8-.4 1.8-.4 2.6 0 .9.5 2.1 0 3.4-1.5 2.1-2.5 2.8-6.3 1.3-8.7-1.4-2.2-4.4-2.2-6-.9z" />
      <path d="M12 8c0-1.9.9-3.2 2.5-3.8" />
    </svg>
  );
}

function IconaPreferiti() {
  return (
    <svg {...TRATTO}>
      <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  );
}

function IconaSincronizzazione() {
  return (
    <svg {...TRATTO}>
      <path d="M19 8a7 7 0 00-12.6-1.5M5 4v3h3" />
      <path d="M5 16a7 7 0 0012.6 1.5M19 20v-3h-3" />
    </svg>
  );
}

function IconaInformazioni() {
  return (
    <svg {...TRATTO}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5M12 8v.01" />
    </svg>
  );
}
