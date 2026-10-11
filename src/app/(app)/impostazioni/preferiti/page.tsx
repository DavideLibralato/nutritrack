"use client";

// Impostazioni > Preferiti e pasti salvati (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni"; mockup approvato docs/mockups/preferiti-e-pasti-salvati.html,
// proposta A "la stella sulla riga").
//
// Due gruppi, ciascuno in ordine alfabetico come in Aggiungi, e mostrato solo
// se ha qualcosa; con tutti e due vuoti, un riquadro che spiega da dove
// nascono. Gli elenchi vengono dalle stesse funzioni di Aggiungi
// (alimentiPreferiti, pastiSalvati): un alimento uscito dal catalogo o un
// pasto senza più alimenti validi non compaiono qui come non compaiono là.
//
// - Alimento: la stella piena lo toglie, con un tocco e senza conferma. La
//   riga resta sbiadita finché si è sulla pagina (lo stato `tolti`, solo in
//   memoria) e la barra in basso offre "Annulla". Ritoccare la stella lo
//   rimette. Togliere e rimettere passano da togliPreferito e
//   rimettiPreferito, che rileggono Dexie: rimettere fa tornare in vita la
//   stessa riga, non ne crea una nuova (vincolo unico sul server).
// - Pasto salvato: la riga apre ModificaPastoSalvato, la schermata della
//   matita in Aggiungi, che copre anche la tab bar. Si elimina da lì, con la
//   sua conferma: niente Annulla.
//
// Niente modulo da salvare in questa pagina, quindi niente guardiano qui:
// lo chiama ModificaPastoSalvato quando è aperta e ha modifiche.

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  repositoryComposizioni,
  repositoryComposizioniVoci,
  repositoryPreferiti,
  repositoryVociDiario,
} from "@/lib/repository";
import { catalogoLocale } from "@/lib/repository/alimenti";
import { rimettiPreferito, togliPreferito } from "@/lib/repository/preferiti";
import { alimentiPreferiti, type AlimentoPreferito } from "@/lib/inserimento/preferiti";
import { pastiSalvati } from "@/lib/inserimento/pastiSalvati";
import {
  MESSAGGIO_ANNULLATO,
  messaggioToltoDaiPreferiti,
  type MessaggioBarra,
} from "@/lib/inserimento/testiBarra";
import IntestazioneSottopagina from "@/components/IntestazioneSottopagina";
import GruppoImpostazioni from "@/components/GruppoImpostazioni";
import RigaAlimentoPreferito from "@/components/RigaAlimentoPreferito";
import RigaPastoSalvatoImpostazioni from "@/components/RigaPastoSalvatoImpostazioni";
import ModificaPastoSalvato from "@/components/ModificaPastoSalvato";
import BarraAnnulla from "@/components/BarraAnnulla";

type Barra = MessaggioBarra & {
  // Cambia a ogni messaggio: è la `key` della barra, così il timer riparte.
  id: string;
  // Presente solo dopo "Tolto dai preferiti": l'alimento da rimettere.
  annullabile?: { alimentoId: string; nome: string };
};

export default function PreferitiPage() {
  const userId = useUtenteId();

  const catalogo = useLiveQuery(async () => {
    if (!userId) return undefined;
    return catalogoLocale(userId);
  }, [userId]);
  const preferiti = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryPreferiti.ottieniTutti(userId);
  }, [userId]);
  // Lo storico del diario: solo per l'ultima quantità usata di ogni
  // alimento, come in Aggiungi.
  const vociTutte = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryVociDiario.ottieniTutti(userId);
  }, [userId]);
  const composizioni = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryComposizioni.ottieniTutti(userId);
  }, [userId]);
  const composizioniVoci = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryComposizioniVoci.ottieniTutti(userId);
  }, [userId]);

  // Gli alimenti tolti durante questa visita, con quantità e kcal com'erano
  // al tocco: restano a schermo, sbiaditi, anche se alimentiPreferiti non li
  // restituisce più. Solo in memoria: uscendo dalla pagina spariscono.
  const [tolti, setTolti] = useState<Map<string, AlimentoPreferito>>(new Map());
  const [pastoInModificaId, setPastoInModificaId] = useState<string | null>(null);
  const [barra, setBarra] = useState<Barra | null>(null);

  if (
    !userId ||
    catalogo === undefined ||
    preferiti === undefined ||
    vociTutte === undefined ||
    composizioni === undefined ||
    composizioniVoci === undefined
  ) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
        <IntestazioneSottopagina titolo="Preferiti e pasti salvati" />
      </main>
    );
  }

  const vivi = alimentiPreferiti(catalogo, preferiti, vociTutte);
  const idVivi = new Set(vivi.map((p) => p.alimento.id));
  // Un alimento tolto resta a schermo solo se è ancora nel catalogo: se nel
  // frattempo è stato cancellato, non c'è più niente da rimettere.
  const idCatalogo = new Set(catalogo.map((a) => a.id));
  const soloTolti = [...tolti.values()].filter(
    (p) => !idVivi.has(p.alimento.id) && idCatalogo.has(p.alimento.id)
  );
  const alimenti = [...vivi, ...soloTolti].sort((a, b) =>
    a.alimento.nome.localeCompare(b.alimento.nome, "it")
  );
  const pasti = pastiSalvati(catalogo, composizioni, composizioniVoci);

  function mostra(messaggio: MessaggioBarra, annullabile?: Barra["annullabile"]) {
    setBarra({ id: crypto.randomUUID(), ...messaggio, annullabile });
  }

  async function togli(voce: AlimentoPreferito) {
    if (!userId) return;
    const nome = voce.alimento.nome;
    setTolti((prima) => new Map(prima).set(voce.alimento.id, voce));
    try {
      await togliPreferito(userId, voce.alimento.id);
      mostra(messaggioToltoDaiPreferiti(nome), { alimentoId: voce.alimento.id, nome });
    } catch {
      mostra({ testo: `Non è stato possibile togliere ${nome} dai preferiti.` });
    }
  }

  async function rimetti(alimentoId: string, nome: string, dallaBarra: boolean) {
    if (!userId) return;
    // La barra si toglie PRIMA di scrivere: un secondo tocco ravvicinato su
    // "Annulla" non trova più niente da annullare. Dalla stella si toglie
    // solo se parla di questo alimento: l'"Annulla" di un altro resta.
    setBarra((b) => (dallaBarra || b?.annullabile?.alimentoId === alimentoId ? null : b));
    try {
      await rimettiPreferito(userId, alimentoId);
      if (dallaBarra) mostra(MESSAGGIO_ANNULLATO);
    } catch {
      mostra({ testo: `Non è stato possibile rimettere ${nome} nei preferiti.` });
    }
  }

  function chiudiModificaPasto(messaggio: string | null) {
    setPastoInModificaId(null);
    if (messaggio) mostra({ testo: messaggio });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-4 pt-6 pb-[calc(var(--ingombro-tab-bar)+1.5rem)]">
      <IntestazioneSottopagina titolo="Preferiti e pasti salvati" />

      {alimenti.length === 0 && pasti.length === 0 && (
        <div className="rounded-[20px] border border-border bg-surface px-[18px] py-[22px]">
          <h2 className="font-semibold">Ancora niente qui</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Un alimento diventa preferito con la stella, quando lo scegli in Aggiungi.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Un pasto si salva dal segnalibro accanto alle sue kcal, in Oggi.
          </p>
        </div>
      )}

      {alimenti.length > 0 && (
        <GruppoImpostazioni
          titolo="Alimenti preferiti"
          nota="Si aggiungono con la stella quando scegli un alimento in Aggiungi."
        >
          {alimenti.map((voce) => {
            const tolto = !idVivi.has(voce.alimento.id);
            return (
              <RigaAlimentoPreferito
                key={voce.alimento.id}
                alimento={voce.alimento}
                quantitaG={voce.quantitaG}
                tolto={tolto}
                onStella={() =>
                  tolto
                    ? void rimetti(voce.alimento.id, voce.alimento.nome, false)
                    : void togli(voce)
                }
              />
            );
          })}
        </GruppoImpostazioni>
      )}

      {pasti.length > 0 && (
        <GruppoImpostazioni
          titolo="Pasti salvati"
          nota="Si salvano dal segnalibro di un pasto in Oggi."
        >
          {pasti.map((pasto) => (
            <RigaPastoSalvatoImpostazioni
              key={pasto.composizioneId}
              pasto={pasto}
              onApri={() => {
                setBarra(null);
                setPastoInModificaId(pasto.composizioneId);
              }}
            />
          ))}
        </GruppoImpostazioni>
      )}

      {/* Sopra la tab bar, come "Salvato." in Profilo (SalvataggioModulo). */}
      {barra && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[var(--ingombro-tab-bar)] z-40 mx-auto max-w-md">
          <BarraAnnulla
            key={barra.id}
            testo={barra.testo}
            nome={barra.nome}
            coda={barra.coda}
            icona={barra.icona}
            durataMs={barra.durataMs}
            azione={
              barra.annullabile
                ? {
                    etichetta: "Annulla",
                    onClick: () =>
                      void rimetti(barra.annullabile!.alimentoId, barra.annullabile!.nome, true),
                  }
                : undefined
            }
            onChiudi={() => setBarra(null)}
          />
        </div>
      )}

      {pastoInModificaId && (
        <ModificaPastoSalvato
          userId={userId}
          composizioneId={pastoInModificaId}
          catalogo={catalogo}
          onChiudi={chiudiModificaPasto}
        />
      )}
    </main>
  );
}
