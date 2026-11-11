"use client";

// Impostazioni > Sincronizzazione (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni", e sezione 9.2, "L'indicatore"; mockup approvato il 10/10
// in docs/mockups/sincronizzazione.html, pagina "A · Riquadro").
//
// Dall'alto (dal 02/11/2026 disposizione C del mockup
// docs/mockups/sincronizzazione-sessione.html):
// - il riquadro dello stato: uno solo dei sei (statoDaMostrare), con i
//   testi di testiStato. Niente finché la coda non è arrivata da Dexie;
// - "Sincronizza ora" (discesa e salita, come all'apertura dell'app),
//   SEMPRE, anche con la sessione scaduta: il 01/11 "Accesso scaduto" era
//   un rifiuto passeggero di PostgREST, e l'unica via era Esci, che svuota
//   il telefono. Spento mentre un giro è in corso;
// - con "sessione" ed "errore", "Dettagli tecnici" chiuso: una riga per
//   tabella o invio fallito, con status e codice dell'errore;
// - con modifiche accantonate, il gruppo "Non salvate online";
// - in fondo il gruppo dei dati: "Ricarica i dati dal tuo account" e, solo
//   con la sessione scaduta, "Esci e rientra" (è Esci, con la sua
//   conferma). Le due azioni pesanti stanno insieme: svuotano i dati del
//   telefono e li riscaricano.

import { useUtenteId } from "@/lib/supabase/useUtente";
import { useStatoSincronizzazione } from "@/lib/sync/useStatoSincronizzazione";
import { sincronizzaBidirezionale } from "@/lib/sync/orchestratore";
import { riepilogoPerTipo, rigaDettaglio, testiStato } from "@/lib/sync/testiSincronizzazione";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RicaricaDatiAccount from "@/components/RicaricaDatiAccount";
import RiquadroStatoSincronizzazione from "@/components/RiquadroStatoSincronizzazione";
import ModificheAccantonate from "@/components/ModificheAccantonate";
import EsciAccount from "@/components/EsciAccount";
import DettagliTecnici from "@/components/DettagliTecnici";

export default function SincronizzazionePage() {
  const userId = useUtenteId();
  const { stato, coda, voci, giri, adesso } = useStatoSincronizzazione(userId);
  const giroInCorso = giri.inCorsoDal !== null;
  const sessione = stato?.tipo === "sessione";
  const dettagli = stato?.tipo === "sessione" || stato?.tipo === "errore" ? stato.dettagli : [];

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
          {dettagli.length > 0 && (
            <DettagliTecnici
              righe={dettagli.map((d, i) => ({
                chiave: `${d.verso}:${d.tabella}:${i}`,
                testo: rigaDettaglio(d),
              }))}
            />
          )}
        </div>
      )}

      {userId && voci && coda && coda.accantonate > 0 && (
        <ModificheAccantonate userId={userId} voci={voci} />
      )}

      {userId && (
        <GruppoImpostazioni titolo="Dati su questo dispositivo">
          <RicaricaDatiAccount userId={userId} />
          {sessione && (
            <EsciAccount
              userId={userId}
              etichetta="Esci e rientra"
              variante="riga"
              nota="Svuota i dati di questo telefono e li riscarica dopo l'accesso."
            />
          )}
        </GruppoImpostazioni>
      )}
    </main>
  );
}
