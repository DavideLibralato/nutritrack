"use client";

// La pagina Impostazioni (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni";
// mockup approvato in docs/mockups/impostazioni.html): un elenco a gruppi,
// come le impostazioni dell'iPhone, da cui si entra nelle sotto-pagine.
//
// Ci sono solo le righe che funzionano (sezione 3: un comando che non fa
// niente sembra rotto). Pasti e orari, Preferiti e lo stato della
// sincronizzazione restano fuori finché non esistono.
//
// La riga Obiettivi mostra a destra le calorie del periodo valido oggi
// (testoRigaObiettivi, con il suo test): "2500 kcal", oppure "2500 · 2950
// kcal" con i giorni differenziati accesi, "Da impostare" senza periodo.
// La riga Peso mostra l'ultima pesata ("85 kg", "78,4 kg") o "Da
// registrare" (testoRigaPeso, con il suo test). Tutte e due non mostrano
// niente finché i dati non sono arrivati da Dexie.
// La riga Aspetto mostra la scelta del tema salvata su questo dispositivo
// ("Chiaro", "Scuro", "Sistema"), niente finché il browser non l'ha letta.
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
} from "@/lib/repository";
import { ultimaMisurazione } from "@/lib/repository/misurazioni";
import { periodoInCorso } from "@/lib/totaliDiario";
import { oggiLocale } from "@/lib/dataGiorno";
import { testoRigaObiettivi } from "@/lib/profilo/rigaObiettivi";
import { testoRigaPeso } from "@/lib/profilo/testiPeso";
import { useSceltaTema } from "@/lib/useSceltaTema";
import type { SceltaTema } from "@/lib/tema";
import SchedaAccount from "@/components/SchedaAccount";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaImpostazioni from "@/components/RigaImpostazioni";
import EsciAccount from "@/components/EsciAccount";

export default function ImpostazioniPage() {
  const userId = useUtenteId();
  const nome = useNomeUtente();
  const sceltaTema = useSceltaTema();

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
          etichetta="Peso"
          icona={<IconaPeso />}
          valore={valorePeso}
          href="/impostazioni/peso"
        />
      </GruppoImpostazioni>

      <GruppoImpostazioni titolo="App">
        <RigaImpostazioni
          etichetta="Aspetto"
          icona={<IconaAspetto />}
          valore={sceltaTema ? NOMI_TEMA[sceltaTema] : undefined}
          href="/impostazioni/aspetto"
        />
        <RigaImpostazioni
          etichetta="Sincronizzazione"
          icona={<IconaSincronizzazione />}
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

function IconaPeso() {
  return (
    <svg {...TRATTO}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M9 10a3 3 0 016 0" />
      <path d="M12 10l1.2-1.6" />
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
