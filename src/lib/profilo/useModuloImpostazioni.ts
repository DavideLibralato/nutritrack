"use client";

// Lo stato e le azioni del modulo che Profilo e Obiettivi condividono
// (PUNTO_DI_PARTENZA.md, sezione 3, "Impostazioni" e "Un solo Salva").
//
// È un HOOK PERSONALIZZATO: una funzione che usa gli hook di React
// (useState, useLiveQuery...) e restituisce valori e azioni. Ogni pagina che
// lo chiama ne riceve una copia tutta sua, come se il codice fosse scritto
// dentro la pagina; serve a non ripeterlo in due pagine.
//
// Le due pagine caricano TUTTI i valori del modulo (dati personali,
// obiettivo, giorni) e ne modificano solo la propria parte: Profilo i dati
// personali, Obiettivi obiettivo, target e giorni. Il Salva passa tutto a
// salvaProfilo (src/lib/profilo/salvataggioProfilo.ts), che scrive SOLO le
// sezioni cambiate rispetto ai valori caricati: le parti dell'altra pagina,
// mai toccate, restano uguali e non vengono riscritte.
//
// Due copie dei valori:
//   - `prima` (caricati): com'erano in Dexie quando la pagina li ha letti, o
//     all'ultimo Salva riuscito;
//   - `ora` (attuali): quello che c'è sullo schermo.
// La differenza fra le due dice cosa è cambiato.

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  repositoryProfili,
  repositoryObiettivi,
  repositoryObiettiviTarget,
  repositoryMisurazioni,
} from "@/lib/repository";
import { ultimaMisurazione } from "@/lib/repository/misurazioni";
import { periodoInCorso } from "@/lib/totaliDiario";
import { oggiLocale } from "@/lib/dataGiorno";
import { useSegnalaModifiche } from "@/components/GuardianoModifiche";
import {
  valoriDaDati,
  modifiche,
  sezioniModificate,
  validaModulo,
  serveSceltaPeriodo,
  limitiDataInizio,
  salvaProfilo,
  dopoSalvataggio,
  ribasaModulo,
  type ValoriModulo,
  type ErroriModulo,
  type SceltaPeriodo,
} from "./salvataggioProfilo";

export type EsitoModulo = "salvato" | "errore" | "da-correggere" | "periodo-cambiato" | null;

export function useModuloImpostazioni() {
  const userId = useUtenteId();

  // Attenzione al valore restituito quando userId non c'è ancora: deve
  // essere `undefined` (= "non so ancora"), mai `null`/`[]` (= "so che non
  // c'è niente"). Al primo render, subito dopo un F5, userId è sempre
  // undefined per un istante (useUtenteId legge la sessione in modo
  // asincrono): se qui rispondessimo "niente", il modulo verrebbe
  // inizializzato vuoto prima di aver letto i dati veri da Dexie.
  const profilo = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryProfili.ottieniTutti(userId);
    return righe[0] ?? null;
  }, [userId]);

  const obiettivi = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettivi.ottieniTutti(userId);
  }, [userId]);

  const obiettiviTarget = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettiviTarget.ottieniTutti(userId);
  }, [userId]);

  const misurazioniPeso = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryMisurazioni.ottieniTutti(userId);
    return righe.filter((riga) => riga.tipo === "peso");
  }, [userId]);

  // Il giorno corrente è l'oggi del calendario, lo stesso della pagina Oggi
  // (PUNTO_DI_PARTENZA.md, sezione 4, "Il giorno è quello del calendario").
  const giornoCorrente = oggiLocale();
  // Il periodo in corso: una sola definizione in tutta l'app (totaliDiario.ts).
  const periodo = obiettivi ? periodoInCorso(obiettivi, giornoCorrente) : null;
  const ultimaPesata = misurazioniPeso ? ultimaMisurazione(misurazioniPeso) : null;

  const [caricati, setCaricati] = useState<ValoriModulo | null>(null);
  const [attuali, setAttuali] = useState<ValoriModulo | null>(null);

  // Popola il modulo una sola volta, quando tutti i dati sono arrivati da
  // Dexie. Dopo, i campi seguono solo quello che scrive l'utente: un
  // ridisegno non deve sovrascriverli a metà. Aggiornato durante il render,
  // non in un useEffect: è il pattern che React consiglia per "sincronizzare
  // stato in risposta a un cambiamento" (react.dev, "You Might Not Need an
  // Effect"); il controllo `caricati === null` lo fa scattare una volta sola.
  if (
    caricati === null &&
    profilo !== undefined &&
    obiettivi !== undefined &&
    obiettiviTarget !== undefined
  ) {
    const valori = valoriDaDati(profilo, periodo, obiettiviTarget);
    setCaricati(valori);
    setAttuali(valori);
  }

  const sezioni = caricati && attuali ? sezioniModificate(caricati, attuali) : [];
  const modificato = sezioni.length > 0;

  // Avvisa il guardiano (link interni: "‹ Impostazioni", tab bar) quando ci
  // sono modifiche non salvate.
  useSegnalaModifiche(modificato);

  useEffect(() => {
    if (!modificato) return;
    // "beforeunload": il browser chiede conferma prima di ricaricare o
    // chiudere la pagina. Il testo della domanda lo decide il browser, non
    // si può personalizzare. Non scatta con la navigazione interna di
    // Next.js: quella la ferma il guardiano.
    function avvisa(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [modificato]);

  const [errori, setErrori] = useState<ErroriModulo>({});
  const [sheetAperto, setSheetAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<EsitoModulo>(null);
  // "Salvato." dopo un salvataggio riuscito: la barra Salva a quel punto
  // sparisce (non ci sono più modifiche), quindi la conferma la dà una
  // BarraAnnulla breve, senza azione, nello stesso punto sopra la pillola.
  // Il valore è la `key`: un secondo salvataggio fa ripartire il timer.
  const [barraSalvato, setBarraSalvato] = useState<string | null>(null);

  const pronto = userId !== undefined && caricati !== null && attuali !== null;

  function aggiorna(nuovi: ValoriModulo) {
    setAttuali(nuovi);
    // Appena si ricomincia a modificare, l'esito dell'ultimo Salva non vale
    // più.
    setEsito(null);
  }

  function annullaModifiche() {
    if (caricati) setAttuali(caricati);
    setErrori({});
    setEsito(null);
  }

  function avviaSalvataggio() {
    if (!caricati || !attuali) return;
    const m = modifiche(caricati, attuali);
    const erroriTrovati = validaModulo(attuali, m, { profilo: profilo ?? null, periodo });
    setErrori(erroriTrovati);
    if (Object.keys(erroriTrovati).length > 0) {
      setEsito("da-correggere");
      return;
    }
    // La domanda "cambio vero o correzione?" solo se serve: al primo
    // inserimento, o se obiettivo e target non sono cambiati, si salva
    // direttamente.
    if (serveSceltaPeriodo(m, periodo)) {
      setSheetAperto(true);
      return;
    }
    void esegui(null);
  }

  // Le decisioni di scrittura (crea o aggiorna, quale periodo) le prende
  // salvaProfilo rileggendo Dexie: da qui partono solo i valori del modulo
  // e l'id del periodo che l'utente ha davanti.
  async function esegui(scelta: SceltaPeriodo | null) {
    if (!userId || !caricati || !attuali) return;
    const prima = caricati;
    const ora = attuali;
    setInCorso(true);
    try {
      const risultato = await salvaProfilo({
        userId,
        caricati: prima,
        attuali: ora,
        giornoCorrente,
        periodoVistoId: periodo?.id ?? null,
        scelta,
      });
      setSheetAperto(false);
      switch (risultato.esito) {
        case "salvato": {
          const nuovi = dopoSalvataggio(prima, ora);
          setCaricati(nuovi);
          setAttuali(nuovi);
          setErrori({});
          setEsito("salvato");
          setBarraSalvato(crypto.randomUUID());
          break;
        }
        case "da-correggere":
          setErrori(risultato.errori);
          setEsito("da-correggere");
          break;
        case "periodo-cambiato":
          // Niente è stato scritto. Il modulo riparte dai valori riletti,
          // tenendo solo ciò che l'utente aveva cambiato: al prossimo Salva
          // la domanda riguarderà il periodo giusto.
          setCaricati(risultato.caricati);
          setAttuali(ribasaModulo(prima, risultato.caricati, ora));
          setEsito("periodo-cambiato");
          break;
      }
    } catch (errore) {
      console.error("Salvataggio non riuscito.", errore);
      setEsito("errore");
    } finally {
      setInCorso(false);
    }
  }

  // Solo gli esiti che lasciano modifiche da salvare: con "salvato" la barra
  // Salva sparisce, e "Salvato." lo dice la BarraAnnulla (barraSalvato).
  const messaggioBarra =
    esito === "errore"
      ? { testo: "Salvataggio non riuscito. Riprova.", avviso: true }
      : esito === "da-correggere"
        ? { testo: "Correggi i campi segnalati prima di salvare.", avviso: true }
        : esito === "periodo-cambiato"
          ? {
              testo:
                "Nel frattempo l'obiettivo in corso è cambiato, forse da un altro dispositivo. Non è stato salvato niente: controlla i valori e salva di nuovo.",
              avviso: true,
            }
          : null;

  return {
    userId,
    pronto,
    profilo: profilo ?? null,
    periodo,
    ultimaPesata,
    giornoCorrente,
    // Valori del modulo: non null quando `pronto` è vero.
    prima: caricati,
    ora: attuali,
    m: caricati && attuali ? modifiche(caricati, attuali) : null,
    sezioni,
    errori,
    esito,
    inCorso,
    messaggioBarra,
    aggiorna,
    annullaModifiche,
    avviaSalvataggio,
    // Lo sheet "cambio vero o correzione?".
    sheet: {
      aperto: sheetAperto && periodo !== null,
      inizioPeriodo: periodo?.valido_dal ?? "",
      limiti: periodo ? limitiDataInizio(periodo, giornoCorrente) : null,
      errore: esito === "errore" ? "Salvataggio non riuscito. Riprova." : null,
      chiudi: () => setSheetAperto(false),
      conferma: (scelta: SceltaPeriodo) => void esegui(scelta),
    },
    barraSalvato,
    chiudiBarraSalvato: () => setBarraSalvato(null),
  };
}

export type ModuloImpostazioni = ReturnType<typeof useModuloImpostazioni>;
