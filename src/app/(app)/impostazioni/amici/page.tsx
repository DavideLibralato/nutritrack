"use client";

// Impostazioni > Amici (PUNTO_DI_PARTENZA.md §3 "Amici"; mockup
// docs/mockups/amici.html, schermate 3 e 4). Solo online: le tabelle di
// Amici non stanno in Dexie.
//
// Che cosa si vede, in ordine:
// - offline: "Serve la connessione", che si toglie da solo quando torna la
//   rete (useOnline, e le letture ripartono con l'evento "online");
// - senza username: "Scegli il tuo nome su Libra" (SceltaUsername);
// - la pagina: "Aggiungi un amico" (SheetAggiungiAmico), poi le sezioni non
//   vuote: Richieste ricevute (Rifiuta / Accetta), Richieste inviate ("In
//   attesa che accetti" con Annulla, "Non accettata" con Ok), I tuoi amici
//   (tocco → conferma → Rimuovi). Senza niente, un riquadro "Ancora nessun
//   amico". Gli alimenti in arrivo arrivano con il branch
//   condivisione-alimenti.
//
// Esiti: Accetta/Rifiuta su una richiesta che non c'è più → la barra
// "Questa richiesta non c'è più."; Annulla/Rimuovi/Ok con "non_trovata"
// valgono "già fatto", senza messaggi (deciso al passo 5). Dopo ogni azione
// l'elenco si rilegge. Durante un'azione i pulsanti di quella riga sono
// spenti (niente doppio tocco).

import { useRef, useState } from "react";
import { useOnline } from "@/lib/useOnline";
import { createClient } from "@/lib/supabase/client";
import { useMioUsername } from "@/lib/amici/useMioUsername";
import { useAmicizie } from "@/lib/amici/useAmicizie";
import {
  annullaORimuoviAmicizia,
  chiudiRifiuto,
  rispondiAmicizia,
  type VoceAmicizia,
} from "@/lib/amici/amicizie";
import {
  TESTO_AZIONE_NON_RIUSCITA,
  TESTO_PRIMA_USERNAME,
  TESTO_RICHIESTA_NON_CE_PIU,
  testiConfermaRimozione,
} from "@/lib/amici/testiAmici";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import ServeConnessione from "@/components/ServeConnessione";
import SceltaUsername from "@/components/SceltaUsername";
import SheetAggiungiAmico from "@/components/SheetAggiungiAmico";
import SheetConferma from "@/components/SheetConferma";
import RigaAmico, { PulsanteRiga } from "@/components/RigaAmico";
import BarraAnnulla from "@/components/BarraAnnulla";

const CLASSE_MAIN =
  "mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]";

const TESTO_SENZA_RETE =
  "Amici funziona solo con internet: cerca e risponde alle richieste sul server. Si apre da sola appena torna la rete.";

export default function AmiciPage() {
  const online = useOnline();
  const mioUsername = useMioUsername();
  const { stato, ricarica } = useAmicizie();

  const [foglioAggiungi, setFoglioAggiungi] = useState(false);
  const [daRimuovere, setDaRimuovere] = useState<VoceAmicizia | null>(null);
  // L'id della riga su cui un'azione è in corso: i suoi pulsanti sono spenti.
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [barra, setBarra] = useState<{ id: number; testo: string } | null>(null);
  // Un numero nuovo per ogni barra: come `key`, fa ripartire il suo tempo
  // anche se il testo è lo stesso della barra prima.
  const contatoreBarre = useRef(0);

  function mostraBarra(testo: string) {
    contatoreBarre.current += 1;
    setBarra({ id: contatoreBarre.current, testo });
  }

  // Un'azione su una riga: spegne la riga, chiama, rilegge l'elenco.
  // `esito` decide il messaggio; "errore" → la barra di sempre.
  async function agisci(id: string, azione: () => Promise<string>) {
    setInCorso(id);
    const esito = await azione();
    if (esito === "errore") mostraBarra(TESTO_AZIONE_NON_RIUSCITA);
    await ricarica();
    setInCorso(null);
    return esito;
  }

  async function rispondi(voce: VoceAmicizia, accetta: boolean) {
    const esito = await agisci(voce.id, () => rispondiAmicizia(createClient(), voce.id, accetta));
    if (esito === "non_trovata") mostraBarra(TESTO_RICHIESTA_NON_CE_PIU);
    else if (esito === "senza_username") mostraBarra(TESTO_PRIMA_USERNAME);
  }

  // Annulla, Rimuovi: "non_trovata" vale "già fatto", nessun messaggio.
  async function annullaORimuovi(voce: VoceAmicizia) {
    await agisci(voce.id, () => annullaORimuoviAmicizia(createClient(), voce.id));
  }

  async function chiudi(voce: VoceAmicizia) {
    await agisci(voce.id, () => chiudiRifiuto(createClient(), voce.id));
  }

  if (!online) {
    return (
      <main className={CLASSE_MAIN}>
        <IntestazioneSottopagina titolo="Amici" />
        <ServeConnessione testo={TESTO_SENZA_RETE} onRiprova={() => void ricarica()} />
      </main>
    );
  }

  if (mioUsername.stato.esito === "caricamento") {
    return (
      <main className={CLASSE_MAIN}>
        <IntestazioneSottopagina titolo="Amici" />
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  if (mioUsername.stato.esito === "errore") {
    return (
      <main className={CLASSE_MAIN}>
        <IntestazioneSottopagina titolo="Amici" />
        <ServeConnessione testo={TESTO_SENZA_RETE} onRiprova={mioUsername.ricarica} />
      </main>
    );
  }

  if (mioUsername.stato.username === null) {
    return (
      <main className={CLASSE_MAIN}>
        <IntestazioneSottopagina titolo="Amici" />
        <SceltaUsername
          onScelto={(username) => {
            mioUsername.impostato(username);
            void ricarica();
          }}
        />
      </main>
    );
  }

  const divise = stato.esito === "ok" ? stato.divise : null;
  const inviateTutte = divise ? [...divise.inviate, ...divise.nonAccettate] : [];
  const vuota =
    divise !== null &&
    divise.ricevute.length === 0 &&
    inviateTutte.length === 0 &&
    divise.amici.length === 0;
  const conferma = daRimuovere ? testiConfermaRimozione(daRimuovere.username) : null;

  return (
    <main className={CLASSE_MAIN}>
      <IntestazioneSottopagina titolo="Amici" />

      <button
        type="button"
        onClick={() => setFoglioAggiungi(true)}
        className={`w-full rounded-lg bg-accent-strong p-3 font-medium text-on-strong ${CLASSE_FOCUS}`}
      >
        Aggiungi un amico
      </button>

      {stato.esito === "caricamento" && <p className="text-sm text-muted">Caricamento...</p>}

      {stato.esito === "errore" && (
        <ServeConnessione testo={TESTO_SENZA_RETE} onRiprova={() => void ricarica()} />
      )}

      {vuota && (
        <p className="rounded-[20px] border border-border bg-surface p-4 text-sm text-muted">
          Ancora nessun amico. Aggiungine uno con il suo username esatto.
        </p>
      )}

      {divise && divise.ricevute.length > 0 && (
        <GruppoImpostazioni titolo="Richieste ricevute">
          {divise.ricevute.map((voce) => (
            <RigaAmico
              key={voce.id}
              username={voce.username}
              sotto="Vuole essere tuo amico"
              azioni={
                <>
                  <PulsanteRiga
                    disabled={inCorso === voce.id}
                    onClick={() => void rispondi(voce, false)}
                  >
                    Rifiuta
                  </PulsanteRiga>
                  <PulsanteRiga
                    pieno
                    disabled={inCorso === voce.id}
                    onClick={() => void rispondi(voce, true)}
                  >
                    Accetta
                  </PulsanteRiga>
                </>
              }
            />
          ))}
        </GruppoImpostazioni>
      )}

      {inviateTutte.length > 0 && (
        <GruppoImpostazioni titolo="Richieste inviate">
          {inviateTutte.map((voce) =>
            voce.stato === "in_attesa" ? (
              <RigaAmico
                key={voce.id}
                username={voce.username}
                sotto="In attesa che accetti"
                azioni={
                  <PulsanteRiga
                    disabled={inCorso === voce.id}
                    onClick={() => void annullaORimuovi(voce)}
                  >
                    Annulla
                  </PulsanteRiga>
                }
              />
            ) : (
              <RigaAmico
                key={voce.id}
                username={voce.username}
                sotto="Non accettata"
                azioni={
                  <PulsanteRiga disabled={inCorso === voce.id} onClick={() => void chiudi(voce)}>
                    Ok
                  </PulsanteRiga>
                }
              />
            )
          )}
        </GruppoImpostazioni>
      )}

      {divise && divise.amici.length > 0 && (
        <GruppoImpostazioni
          titolo={`I tuoi amici · ${divise.amici.length}`}
          nota="Tocca un amico per rimuoverlo."
        >
          {divise.amici.map((voce) => (
            <RigaAmico
              key={voce.id}
              username={voce.username}
              disattivata={inCorso === voce.id}
              onClick={() => setDaRimuovere(voce)}
            />
          ))}
        </GruppoImpostazioni>
      )}

      {foglioAggiungi && (
        <SheetAggiungiAmico
          onChiudi={() => setFoglioAggiungi(false)}
          onCambiato={() => void ricarica()}
        />
      )}

      {daRimuovere && conferma && (
        <SheetConferma
          titolo={conferma.titolo}
          testo={conferma.testo}
          etichettaNo="Annulla"
          etichettaSi="Rimuovi"
          distruttiva
          onNo={() => setDaRimuovere(null)}
          onSi={() => {
            const voce = daRimuovere;
            setDaRimuovere(null);
            void annullaORimuovi(voce);
          }}
        />
      )}

      {/* La barra sta appena sopra la tab bar: il contenitore fisso non ha
          altezza, la barra si appoggia al suo fondo. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--ingombro-tab-bar)+var(--spazio-fra-barre))] z-30 mx-auto max-w-md">
        {barra && (
          <BarraAnnulla key={barra.id} testo={barra.testo} onChiudi={() => setBarra(null)} />
        )}
      </div>
    </main>
  );
}
