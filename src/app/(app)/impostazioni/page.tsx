"use client";

// La pagina Impostazioni (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni";
// mockup approvato in docs/mockups/impostazioni.html): un elenco a gruppi,
// come le impostazioni dell'iPhone, da cui si entra nelle sotto-pagine.
//
// Ci sono solo le righe che funzionano (sezione 3: un comando che non fa
// niente sembra rotto). Obiettivi, Peso e Aspetto arrivano con i loro passi;
// Pasti e orari, Preferiti e lo stato della sincronizzazione restano fuori
// finché non esistono. Finché Obiettivi e Peso non sono pagine a sé, si
// modificano da Profilo (la scheda dell'account in cima).
//
// Questa pagina non ha un modulo: niente da salvare, quindi niente
// guardiano delle modifiche. Esci in fondo, con la sua conferma.

import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId, useNomeUtente } from "@/lib/supabase/useUtente";
import { repositoryProfili, repositoryMisurazioni } from "@/lib/repository";
import { ultimaMisurazione } from "@/lib/repository/misurazioni";
import SchedaAccount from "@/components/SchedaAccount";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaImpostazioni from "@/components/RigaImpostazioni";
import EsciAccount from "@/components/EsciAccount";

export default function ImpostazioniPage() {
  const userId = useUtenteId();
  const nome = useNomeUtente();

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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <h1 className="mx-1 mt-1.5 font-display text-[34px] font-bold leading-tight">Impostazioni</h1>

      <SchedaAccount
        nome={nome}
        pesoKg={ultimaPesata?.valore ?? null}
        altezzaCm={profilo?.altezza_cm ?? null}
      />

      <GruppoImpostazioni titolo="App">
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
