"use client";

// L'onboarding dopo la registrazione (PUNTO_DI_PARTENZA.md, sezione 3,
// "Onboarding"; mockup docs/mockups/onboarding.html, stile B). Fuori dal
// gruppo (app), come /aggiungi: niente tab bar e niente guardiano delle
// modifiche. Nel service worker è fra le PAGINE_APP, quindi si riapre anche
// offline.
//
// Per ora i passi 1-3; il 4 è un segnaposto e il 5 arriva nel commit dopo.
//
// Chi entra (statoSegno, via useStatoOnboarding):
//   - non ancora noto, o i dati non ancora scesi su questo dispositivo →
//     "Caricamento...", oppure senza rete il testo della connessione. Si
//     riparte da soli: al ritorno della rete parte la discesa, e
//     useStatoOnboarding si aggiorna quando riesce;
//   - segno da_fare → dal passo di "ripresa" (Benvenuto solo se non è
//     salvato niente);
//   - segno rimandato → solo con ?continua=1 (il "Continua" della scheda di
//     Oggi), dal primo passo da fare;
//   - in tutti gli altri casi → Oggi.
//
// Il passo di partenza si decide UNA volta, quando i dati sono noti; poi si
// muove solo con Avanti e Indietro. Se lo si ricalcolasse a ogni modifica
// di Dexie, salvare il passo 2 farebbe saltare la pagina al passo 3 da sola
// (o al 4, salvando la pesata), mentre l'utente è ancora lì.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import { useOnline } from "@/lib/useOnline";
import { useAreaVisibile } from "@/lib/areaVisibile";
import { repositoryMisurazioni, repositoryObiettivi, repositoryProfili } from "@/lib/repository";
import { registraPesoSenzaDuplicati } from "@/lib/repository/misurazioni";
import { useStatoOnboarding } from "@/lib/onboarding/useStatoOnboarding";
import { concludiOnboarding } from "@/lib/onboarding/segnoOnboarding";
import { passoDiPartenza, type PassoOnboarding, type StatoSegno } from "@/lib/onboarding/statoOnboarding";
import {
  pesoDaRegistrare,
  pesoIniziale,
  salvaSuDiTe,
  suDiTeIniziale,
  type ValoriSuDiTe,
} from "@/lib/onboarding/passiOnboarding";
import { CLASSE_DOMANDA } from "@/lib/onboarding/classiOnboarding";
import BarraOnboarding from "@/components/BarraOnboarding";
import PassoBenvenuto from "@/components/PassoBenvenuto";
import PassoSuDiTe from "@/components/PassoSuDiTe";
import PassoPeso from "@/components/PassoPeso";
import StrutturaPasso from "@/components/StrutturaPasso";

const TESTO_SALVATAGGIO_FALLITO = "Salvataggio non riuscito. Riprova.";

// useSearchParams() legge ?continua=1; Next.js vuole che la parte che lo usa
// stia in <Suspense>, come in /aggiungi e nella pagina di login.
export default function OnboardingPage() {
  return (
    <Suspense fallback={<SchermataCentrata testo="Caricamento..." />}>
      <Onboarding />
    </Suspense>
  );
}

function SchermataCentrata({ testo }: { testo: string }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-4">
      <p className="max-w-xs text-center text-sm text-muted">{testo}</p>
    </main>
  );
}

type Ingresso = "attendi" | "connessione" | "esci" | "ripresa" | "continua";

function ingresso(stato: StatoSegno | undefined, continua: boolean, online: boolean): Ingresso {
  if (stato === undefined) return "attendi";
  const da =
    stato.segno === "da_fare" ? "ripresa" : stato.segno === "rimandato" && continua ? "continua" : null;
  if (da === null) return "esci";
  if (stato.attendiDiscesa) return online ? "attendi" : "connessione";
  return da;
}

// Deciso una volta, all'ingresso: il passo e i valori iniziali dei campi.
interface Avvio {
  passo: PassoOnboarding;
  suDiTe: ValoriSuDiTe;
  peso: string;
}

function Onboarding() {
  const router = useRouter();
  const continua = useSearchParams().get("continua") === "1";
  const userId = useUtenteId();
  const stato = useStatoOnboarding();
  const online = useOnline();
  const areaVisibile = useAreaVisibile();

  // I dati da cui partono il passo e i campi. Servono solo all'ingresso: poi
  // la pagina va avanti con i suoi valori.
  const dati = useLiveQuery(async () => {
    if (!userId) return undefined;
    const [profili, misurazioni, obiettivi] = await Promise.all([
      repositoryProfili.ottieniTutti(userId),
      repositoryMisurazioni.ottieniTutti(userId),
      repositoryObiettivi.ottieniTutti(userId),
    ]);
    return { profilo: profili[0] ?? null, misurazioni, obiettivi };
  }, [userId]);

  const [avvio, setAvvio] = useState<Avvio | null>(null);
  const [passo, setPasso] = useState<PassoOnboarding>(1);
  const [suDiTe, setSuDiTe] = useState<ValoriSuDiTe | null>(null);
  const [peso, setPeso] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const comeEntra = ingresso(stato, continua, online);
  const partenza =
    avvio === null && dati !== undefined && (comeEntra === "ripresa" || comeEntra === "continua")
      ? passoDiPartenza(comeEntra, dati.profilo, dati.misurazioni, dati.obiettivi)
      : null;

  // L'avvio si scrive durante il disegno, non in un useEffect: è il modo che
  // React consiglia per "aggiornare uno stato quando cambia un dato" (come in
  // useModuloImpostazioni). Il controllo `avvio === null` lo fa scattare una
  // volta sola.
  if (avvio === null && dati !== undefined && partenza !== null && partenza !== "finito") {
    const nuovo: Avvio = {
      passo: partenza,
      suDiTe: suDiTeIniziale(dati.profilo),
      peso: pesoIniziale(dati.misurazioni),
    };
    setAvvio(nuovo);
    setPasso(nuovo.passo);
    setSuDiTe(nuovo.suDiTe);
    setPeso(nuovo.peso);
  }

  // Si esce solo prima di essere entrati: dentro, la pagina non segue più i
  // cambi del segno (quello di "Dopo" compreso, che porta fuori da sé).
  const esci = avvio === null && (comeEntra === "esci" || partenza === "finito");
  useEffect(() => {
    if (esci) router.replace("/");
  }, [esci, router]);

  if (comeEntra === "connessione" && avvio === null) {
    return (
      <SchermataCentrata testo="Per continuare serve la connessione: prima devono arrivare i tuoi dati su questo dispositivo." />
    );
  }
  if (avvio === null || suDiTe === null || !userId) {
    return <SchermataCentrata testo="Caricamento..." />;
  }

  function vaiA(nuovo: PassoOnboarding) {
    setErrore(null);
    setPasso(nuovo);
  }

  // "Dopo": non salva il passo in corso e non aspetta la rete. La chiave
  // locale si scrive subito, dentro concludiOnboarding; se updateUser non
  // riesce, ci pensa la ripresa (RipresaSegnoOnboarding).
  function dopo() {
    void concludiOnboarding(userId!, "rimandato");
    router.replace("/");
  }

  async function avantiSuDiTe() {
    setInCorso(true);
    setErrore(null);
    try {
      const esito = await salvaSuDiTe(userId!, suDiTe!);
      if (esito.esito === "salvato") vaiA(3);
      else if (esito.esito === "da-correggere") {
        setErrore(esito.errori.datiPersonali ?? TESTO_SALVATAGGIO_FALLITO);
      } else setErrore(TESTO_SALVATAGGIO_FALLITO);
    } catch (e) {
      console.error("Onboarding: salvataggio del passo 2 non riuscito.", e);
      setErrore(TESTO_SALVATAGGIO_FALLITO);
    } finally {
      setInCorso(false);
    }
  }

  async function avantiPeso() {
    const kg = pesoDaRegistrare(peso);
    if (kg === null) return; // il pulsante è già spento
    setInCorso(true);
    setErrore(null);
    try {
      // Tornando indietro e cambiando il valore, la pesata di oggi si
      // sostituisce: la regola è in registraPesoSenzaDuplicati.
      await registraPesoSenzaDuplicati(userId!, kg);
      vaiA(4);
    } catch (e) {
      console.error("Onboarding: salvataggio del passo 3 non riuscito.", e);
      setErrore(TESTO_SALVATAGGIO_FALLITO);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <main
      style={{ top: areaVisibile.top, height: areaVisibile.height }}
      className="fixed inset-x-0 mx-auto flex w-full max-w-md flex-col overflow-hidden bg-background"
    >
      {passo > 1 && (
        <div className="px-[18px] pt-[calc(0.5rem+env(safe-area-inset-top))]">
          <BarraOnboarding
            passo={passo}
            onIndietro={() => vaiA((passo - 1) as PassoOnboarding)}
            onDopo={dopo}
          />
        </div>
      )}

      {passo === 1 && <PassoBenvenuto onIniziamo={() => vaiA(2)} />}
      {passo === 2 && (
        <PassoSuDiTe
          valori={suDiTe}
          onCambia={setSuDiTe}
          onAvanti={avantiSuDiTe}
          inCorso={inCorso}
          errore={errore}
        />
      )}
      {passo === 3 && (
        <PassoPeso valore={peso} onCambia={setPeso} onAvanti={avantiPeso} inCorso={inCorso} errore={errore} />
      )}
      {/* Segnaposto fino al commit 7: obiettivo e obiettivi giornalieri. */}
      {passo >= 4 && (
        <StrutturaPasso etichetta="Avanti" attivo={false} onAvanti={() => {}}>
          <h1 className={CLASSE_DOMANDA}>Il tuo obiettivo</h1>
        </StrutturaPasso>
      )}
    </main>
  );
}
