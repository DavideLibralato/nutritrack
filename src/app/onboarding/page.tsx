"use client";

// L'onboarding dopo la registrazione (PUNTO_DI_PARTENZA.md, sezione 3,
// "Onboarding"; mockup docs/mockups/onboarding.html, stile B). Fuori dal
// gruppo (app), come /aggiungi: niente tab bar e niente guardiano delle
// modifiche. Nel service worker è fra le PAGINE_APP, quindi si riapre anche
// offline.
//
// I cinque passi: Benvenuto, "Parlami un po' di te" (salvato con Avanti),
// "Quanto pesi oggi?" (salvato con Avanti), "Cosa vuoi ottenere?" (solo in
// memoria) e gli obiettivi giornalieri, salvati con il passo 4 da "Inizia a
// usare Libra".
//
// Fra il Benvenuto e "Su di te", per chi non ha ancora uno username, il
// passo "Scegli il tuo nome su Libra" (PassoUsername, salvato con Avanti
// sul server, in nomi_utente). Lo decide il tocco su "Iniziamo", con la
// lettura di useMioUsername partita all'apertura della pagina:
// mostraPassoUsername in src/lib/onboarding/passoUsername.ts, con le
// regole di Indietro e dei puntini.
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
  mostraPassoUsername,
  passoPrecedente,
  posizioneNellaBarra,
  type PassoPagina,
} from "@/lib/onboarding/passoUsername";
import { useMioUsername } from "@/lib/amici/useMioUsername";
import { useSceltaUsername } from "@/lib/amici/useSceltaUsername";
import {
  pesoDaRegistrare,
  pesoIniziale,
  propostaPasso5,
  salvaObiettivo,
  salvaSuDiTe,
  suDiTeIniziale,
  targetDelPasso5,
  type ValoriSuDiTe,
} from "@/lib/onboarding/passiOnboarding";
import type { ValoriTarget } from "@/lib/profilo/salvataggioProfilo";
import type { TipoObiettivo } from "@/lib/db/tipi";
import { CLASSE_DOMANDA, CLASSE_SOTTO } from "@/lib/onboarding/classiOnboarding";
import BarraOnboarding from "@/components/BarraOnboarding";
import PassoBenvenuto from "@/components/PassoBenvenuto";
import PassoUsername from "@/components/PassoUsername";
import PassoSuDiTe from "@/components/PassoSuDiTe";
import PassoPeso from "@/components/PassoPeso";
import PassoObiettivo from "@/components/PassoObiettivo";
import PassoTargetGiornalieri from "@/components/PassoTargetGiornalieri";
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
  const [passo, setPasso] = useState<PassoPagina>(1);
  // Il passo dello username fa parte di questo giro: deciso da "Iniziamo".
  const [conUsername, setConUsername] = useState(false);
  // Letto all'apertura, così al tocco su "Iniziamo" la risposta c'è già.
  // Solo per decidere se mostrare il passo; dopo un salvataggio non serve
  // aggiornarlo, perché il passo resta nel giro (mostraPassoUsername).
  const mioUsername = useMioUsername();
  // Acceso sempre, anche quando il passo non si vede: tornando indietro
  // da "Su di te" il campo ritrova il nome scritto. Salvato il nome, si va
  // a "Su di te" (l'errore della pagina è già vuoto: lo azzera vaiA
  // entrando nel passo dello username).
  const scelta = useSceltaUsername(() => setPasso(2));
  const [suDiTe, setSuDiTe] = useState<ValoriSuDiTe | null>(null);
  const [peso, setPeso] = useState("");
  // Passo 4: solo in memoria, si salva alla fine del 5. Si parte senza
  // scelta, e chi esce prima del 5 la perde ("Continua" riparte dal 4).
  const [tipo, setTipo] = useState<TipoObiettivo | null>(null);
  const [pesoObiettivo, setPesoObiettivo] = useState("");
  // Passo 5: null = i numeri seguono la proposta (che cambia con
  // l'obiettivo); altrimenti quelli scritti dall'utente.
  const [manuali, setManuali] = useState<ValoriTarget | null>(null);
  // Nel frattempo è arrivato un obiettivo da un altro dispositivo.
  const [giaImpostati, setGiaImpostati] = useState(false);
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
  if (avvio === null || suDiTe === null || !userId || dati === undefined) {
    return <SchermataCentrata testo="Caricamento..." />;
  }

  // La proposta del passo 5, dai dati salvati adesso (profilo e pesata dei
  // passi 2 e 3, letti da Dexie con useLiveQuery) e dall'obiettivo scelto.
  const proposta = tipo ? propostaPasso5(dati.profilo, dati.misurazioni, tipo) : null;
  const barra = posizioneNellaBarra(passo, conUsername);

  function vaiA(nuovo: PassoPagina) {
    setErrore(null);
    setPasso(nuovo);
  }

  function iniziamo() {
    const mostra = mostraPassoUsername(mioUsername.stato, conUsername);
    setConUsername(mostra);
    vaiA(mostra ? "username" : 2);
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

  // "Inizia a usare Libra": passi 4 e 5 insieme, poi l'onboarding è finito.
  // concludiOnboarding non si aspetta, come per "Dopo": la chiave locale si
  // scrive subito, e se updateUser non riesce ci pensa la ripresa.
  async function inizia() {
    if (!tipo || !proposta) return; // il pulsante non c'è senza obiettivo
    setInCorso(true);
    setErrore(null);
    try {
      const esito = await salvaObiettivo(userId!, {
        tipo,
        pesoObiettivo,
        target: targetDelPasso5(proposta, manuali),
      });
      if (esito.esito === "salvato") {
        void concludiOnboarding(userId!, "fatto");
        router.replace("/");
        return;
      }
      if (esito.esito === "periodo-cambiato") {
        // Non è stato scritto niente, e gli obiettivi ci sono già: per
        // questo dispositivo l'onboarding è finito.
        void concludiOnboarding(userId!, "fatto");
        setGiaImpostati(true);
        return;
      }
      setErrore(esito.errori.obiettivo ?? TESTO_SALVATAGGIO_FALLITO);
    } catch (e) {
      console.error("Onboarding: salvataggio degli obiettivi non riuscito.", e);
      setErrore(TESTO_SALVATAGGIO_FALLITO);
    } finally {
      setInCorso(false);
    }
  }

  // Obiettivi già impostati altrove: un messaggio e "Vai a Oggi", senza
  // passare da soli. Un cambio di pagina a tempo toglie lo schermo a chi
  // sta ancora leggendo (o usa uno screen reader), e qui non c'è fretta:
  // l'onboarding è già concluso.
  if (giaImpostati) {
    return (
      <main
        style={{ top: areaVisibile.top, height: areaVisibile.height }}
        className="fixed inset-x-0 mx-auto flex w-full max-w-md flex-col overflow-hidden bg-background"
      >
        <StrutturaPasso etichetta="Vai a Oggi" attivo onAvanti={() => router.replace("/")}>
          <h1 className={`${CLASSE_DOMANDA} mt-10`}>I tuoi obiettivi</h1>
          <p role="status" className={CLASSE_SOTTO}>
            I tuoi obiettivi sono già stati impostati da un altro dispositivo.
          </p>
        </StrutturaPasso>
      </main>
    );
  }

  return (
    <main
      style={{ top: areaVisibile.top, height: areaVisibile.height }}
      className="fixed inset-x-0 mx-auto flex w-full max-w-md flex-col overflow-hidden bg-background"
    >
      {passo !== 1 && (
        <div className="px-[18px] pt-[calc(0.5rem+env(safe-area-inset-top))]">
          <BarraOnboarding
            passo={barra.posizione}
            totale={barra.totale}
            onIndietro={() => vaiA(passoPrecedente(passo, conUsername))}
            // Il passo dello username è obbligatorio: niente "Dopo".
            onDopo={passo === "username" ? undefined : dopo}
          />
        </div>
      )}

      {passo === 1 && <PassoBenvenuto onIniziamo={iniziamo} />}
      {passo === "username" && <PassoUsername scelta={scelta} onSalta={() => vaiA(2)} />}
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
      {passo === 4 && (
        <PassoObiettivo
          tipo={tipo}
          pesoObiettivo={pesoObiettivo}
          onScegliTipo={setTipo}
          onCambiaPeso={setPesoObiettivo}
          onAvanti={() => vaiA(5)}
        />
      )}
      {passo === 5 && proposta && (
        <PassoTargetGiornalieri
          proposta={proposta}
          manuali={manuali}
          onCambiaManuali={setManuali}
          onInizia={inizia}
          inCorso={inCorso}
          errore={errore}
        />
      )}
    </main>
  );
}
