"use client";

// Impostazioni > Sincronizzazione (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni", e sezione 9.2, "L'indicatore"; mockup approvato il 10/10
// in docs/mockups/sincronizzazione.html, pagina "A · Riquadro").
//
// Dall'alto:
// - il riquadro dello stato: uno solo dei sei (statoDaMostrare), con i
//   testi di testiStato. Niente finché la coda non è arrivata da Dexie;
// - "Sincronizza ora" (discesa e salita, come all'apertura dell'app),
//   spento mentre un giro è in corso. Con la sessione scaduta al suo posto
//   c'è "Esci e rientra": è Esci, con la sua conferma;
// - con modifiche accantonate, il gruppo "Non salvate online";
// - in fondo, com'era, "Ricarica i dati dal tuo account".

import { useUtenteId } from "@/lib/supabase/useUtente";
import { useStatoSincronizzazione } from "@/lib/sync/useStatoSincronizzazione";
import { sincronizzaBidirezionale } from "@/lib/sync/orchestratore";
import { riepilogoPerTipo, testiStato } from "@/lib/sync/testiSincronizzazione";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RicaricaDatiAccount from "@/components/RicaricaDatiAccount";
import RiquadroStatoSincronizzazione from "@/components/RiquadroStatoSincronizzazione";
import ModificheAccantonate from "@/components/ModificheAccantonate";
import EsciAccount from "@/components/EsciAccount";

export default function SincronizzazionePage() {
  const userId = useUtenteId();
  const { stato, coda, voci, giri, adesso } = useStatoSincronizzazione(userId);
  const giroInCorso = giri.inCorsoDal !== null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo="Sincronizzazione" />

      {userId && stato && coda && voci && (
        <div className="flex flex-col gap-3">
          <RiquadroStatoSincronizzazione
            testi={testiStato(
              stato,
              coda,
              riepilogoPerTipo(voci.filter((v) => v.sospesa_il)),
              adesso
            )}
          />
          {stato.tipo === "sessione" ? (
            <EsciAccount userId={userId} etichetta="Esci e rientra" />
          ) : (
            <button
              type="button"
              onClick={() => {
                sincronizzaBidirezionale(userId).catch(() => {});
              }}
              disabled={giroInCorso}
              className={`w-full rounded-lg bg-accent-strong p-3 font-medium text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              Sincronizza ora
            </button>
          )}
        </div>
      )}

      {userId && voci && coda && coda.accantonate > 0 && (
        <ModificheAccantonate userId={userId} voci={voci} />
      )}

      {userId && (
        <GruppoImpostazioni titolo="Dati su questo dispositivo">
          <RicaricaDatiAccount userId={userId} />
        </GruppoImpostazioni>
      )}
    </main>
  );
}
