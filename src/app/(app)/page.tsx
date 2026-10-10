"use client";

// La pagina Oggi (PUNTO_DI_PARTENZA.md, sezione 3 e 6): la schermata di
// apertura. Sta nel route group "(app)", quindi il suo URL è "/".
//
// Dexie vive solo nel browser, quindi è un componente client. useLiveQuery
// (dexie-react-hooks) riesegue la query e ridisegna da solo ogni volta che i
// dati locali cambiano — non serve rileggere a mano dopo una scrittura.
// Come nella pagina Profilo, le query rispondono `undefined` (= "non so
// ancora") finché non conosciamo l'utente, mai `[]` (= "so che è vuoto").
//
// Layout (sezione 3): in alto, fisso, data navigabile, calorie rimanenti,
// anello e macro; sotto, la lista dei pasti, l'unica cosa che scorre. Sopra
// la lista galleggiano il bottone "+ Aggiungi" e la pillola della tab bar.
//
// Altezza fissa: esattamente lo schermo (h-dvh). Nelle altre pagine con la
// tab bar a scorrere è il documento (layout.tsx di (app)); qui il documento
// è alto uno schermo e non scorre, e scorre solo la lista, che arriva fino
// al fondo passando sotto bottone e pillola. Scorrimento interno apposta:
// così anello e calorie restano sempre visibili. Oggi non ha campi che
// aprono la tastiera fuori dagli sheet, che si agganciano da soli alla
// parte visibile.
//
// Il pulsante "+ Aggiungi" apre /aggiungi passando il giorno mostrato, così
// dopo il salvataggio si torna all'Oggi del giorno giusto (anche un giorno
// passato). Per leggere ?giorno= serve useSearchParams, che va avvolto in
// <Suspense> (come nella pagina di login).

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  repositoryVociDiario,
  repositoryObiettivi,
  repositoryObiettiviTarget,
  repositoryComposizioni,
  repositoryComposizioniVoci,
  repositoryProfili,
  repositoryGiorni,
} from "@/lib/repository";
import { usePastiIniziali } from "@/lib/usePastiIniziali";
import { useGiornoCorrente } from "@/lib/useGiornoCorrente";
import { tuttiIPasti } from "@/lib/repository/pasti";
import {
  ETICHETTA_NON_IN_USO,
  opzioniPastoDellaVoce,
  pastiDaMostrare,
  pastiValidiIl,
} from "@/lib/pasti/validitaPasti";
import { targetPerTipo, targetEffettivo } from "@/lib/repository/obiettiviTarget";
import { tipoGiornoEffettivo, scriviTipoGiornoScelto } from "@/lib/repository/giorni";
import {
  sommaTotali,
  totaleVoce,
  vociDelGiorno,
  obiettivoValidoPer,
} from "@/lib/totaliDiario";
import {
  giornoPrecedente,
  giornoSuccessivo,
  formattaGiornoSettimana,
  formattaGiornoMese,
  formattaDataEstesa,
  formattaGiornoCorto,
  dataScrivibile,
  oggiLocale,
  ultimoGiornoDiario,
} from "@/lib/dataGiorno";
import { TIPO_GIORNO_NORMALE } from "@/lib/db/tipi";
import { catalogoLocale } from "@/lib/repository/alimenti";
import AnelloCalorie from "@/components/AnelloCalorie";
import BarraMacro from "@/components/BarraMacro";
import SheetQuantita from "@/components/SheetQuantita";
import SheetNome from "@/components/SheetNome";
import SheetScegliPasto from "@/components/SheetScegliPasto";
import ServeConnessione from "@/components/ServeConnessione";
import SheetDoppioni from "@/components/SheetDoppioni";
import SheetDuplica from "@/components/SheetDuplica";
import type { Doppione, SceltaDoppione } from "@/lib/diario/pianoSpostamento";
import {
  accorcia,
  MASSIMO_ALIMENTO,
  MASSIMO_PASTO,
  messaggioDuplicazione,
  messaggioSpostamento,
} from "@/lib/diario/testiSpostamento";
import { daVoce } from "@/lib/inserimento/alimentoPerSheet";
import {
  pastoGiaSalvato,
  composizioniCorrispondenti,
  pastoSalvatoCoiSoliValidi,
  separaVociPerCatalogo,
} from "@/lib/inserimento/pastiSalvati";
import { testoAvvisoEsclusi, testoGiaSalvato } from "@/lib/inserimento/testiAlimentiCancellati";
import {
  salvaPastoComeComposizione,
  eliminaComposizione,
} from "@/lib/repository/composizioni";
import BarraAnnulla from "@/components/BarraAnnulla";
import { prendiInserimento } from "@/lib/inserimento/ultimoInserimento";
import {
  messaggioAggiunto,
  messaggioEliminato,
  MESSAGGIO_ANNULLATO,
  type MessaggioBarra,
} from "@/lib/inserimento/testiBarra";
import {
  annullaOperazione,
  eliminaPastoDelGiorno,
  eliminaVoci,
  fotografiaInserimento,
  spostaNelPasto,
  duplicaNelPasto,
  type OrigineSpostamento,
  type FotografiaVoci,
} from "@/lib/repository/vociDiario";
import MenuContestuale from "@/components/MenuContestuale";
import type { Pasto, VoceDiario } from "@/lib/db/tipi";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useSwipeGiorno } from "@/lib/swipeGiorno";
import { useTieniPremuto, type TipoRiga } from "@/lib/tieniPremuto";
import { useTrascinaInPasto } from "@/lib/trascinaInPasto";
import CopiaTrascinata from "@/components/CopiaTrascinata";

// "Sposta" (sezione 3, "Tieni premuto"): cosa si sposta e a che punto si è.
// `sceltaPasto`: si sta scegliendo il pasto nel foglio (Sposta dal menu); col
// trascinamento la destinazione la dà il rilascio, e il foglio dei pasti non
// si apre mai. Con `doppioni` è aperto il foglio dei doppioni.
interface StatoSpostamento {
  origine: OrigineSpostamento;
  // Il nome dell'alimento o del pasto che si sposta, per i titoli.
  nome: string;
  sceltaPasto: boolean;
  pastoPartenzaId: string | null;
  pastoDestinazioneId: string | null;
  doppioni: Doppione[] | null;
  avviso: string | null;
  inCorso: boolean;
  errore: string | null;
}

// "Duplica" (sezione 3, "Tieni premuto", passo E): cosa si duplica, da
// quale giorno, e — scelti nel foglio — giorno e pasto di destinazione. Con
// `doppioni` è aperto il foglio dei doppioni.
interface StatoDuplicazione {
  origine: OrigineSpostamento;
  nome: string;
  pastoPartenzaId: string | null;
  dataPartenza: string;
  dataDestinazione: string | null;
  pastoDestinazioneId: string | null;
  doppioni: Doppione[] | null;
  avviso: string | null;
  inCorso: boolean;
  errore: string | null;
}

// Etichetta della pastiglia: "normale" -> "Normale". I tipi non sono un
// elenco fisso (sezione 3), quindi non c'è una tabella di etichette da
// mantenere — solo la prima lettera maiuscola.
function capitalizza(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

export default function OggiPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center p-4">
          <p className="text-sm text-muted">Caricamento...</p>
        </main>
      }
    >
      <OggiContenuto />
    </Suspense>
  );
}

function OggiContenuto() {
  const userId = useUtenteId();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Il giorno visualizzato, "YYYY-MM-DD". Se /aggiungi ci ha rimandato qui con
  // un ?giorno= (un giorno vero, non oltre oggi + 7) si parte da quello.
  // Altrimenti si parte dall'oggi del calendario, anche all'una di notte
  // (PUNTO_DI_PARTENZA.md, sezione 4, "Il giorno è quello del calendario"):
  // non serve aspettare i pasti da Dexie per saperlo.
  const [giorno, setGiorno] = useState<string>(() => {
    const param = searchParams.get("giorno");
    return param && dataScrivibile(param) ? param : oggiLocale();
  });

  // L'oggi del calendario, che si aggiorna da solo a mezzanotte e al
  // ritorno in primo piano (useGiornoCorrente). `giornoCorrenteVisto` è
  // l'oggi su cui la pagina si è già regolata: quando i due non coincidono
  // il giorno è cambiato, e la pagina salta al nuovo oggi (più sotto, dopo
  // gestiAttivi).
  const giornoCorrente = useGiornoCorrente();
  const [giornoCorrenteVisto, setGiornoCorrenteVisto] = useState(giornoCorrente);

  // Il calendario si apre da codice con showPicker() sull'input date, non
  // sovrapponendo un input invisibile al testo: quel trucco lasciava
  // cliccabile solo una porzione della scritta (l'area utile di un input
  // date nativo non è tutta la sua superficie). Il testo della data è un
  // <button> vero: tap o Invio/Spazio aprono il calendario.
  const rifData = useRef<HTMLInputElement>(null);

  function apriCalendario() {
    const el = rifData.current;
    if (!el) return;
    // showPicker() è supportato da Chrome/Edge/Safari/Firefox recenti; può
    // lanciare un'eccezione (nessun gesto utente, input non renderizzato).
    // Nel dubbio si ripiega sul focus, che sui browser da telefono apre
    // comunque il calendario.
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  // TUTTE le righe di `pasti` dell'utente, comprese le cancellate e quelle
  // fuori dal loro periodo: servono a cercare il nome di un pasto per id
  // (messaggi, menu, fogli) e alla rete di sicurezza. Quali si mostrano e
  // quali si possono scegliere in un giorno lo dicono pastiDaMostrare e
  // pastiValidiIl (src/lib/pasti/validitaPasti.ts), più sotto.
  const pasti = useLiveQuery(async () => {
    if (!userId) return undefined;
    return tuttiIPasti(userId);
  }, [userId]);

  // Tutte le voci dell'utente: il filtro per giorno lo fa vociDelGiorno qui
  // sotto, così cambiare data non rilancia una query.
  const vociTutte = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryVociDiario.ottieniTutti(userId);
  }, [userId]);

  const obiettivi = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettivi.ottieniTutti(userId);
  }, [userId]);

  // Giorni differenziati (sezione 3): profilo per differenzia_giorni/
  // giorni_allenamento_default, le righe già classificate in `giorni`, e i
  // target per tipo di giorno. `?? null`/`[0]` come nella pagina Profilo: un
  // profilo non ancora salvato è un caso normale, non "non so ancora".
  const profilo = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryProfili.ottieniTutti(userId);
    return righe[0] ?? null;
  }, [userId]);
  const giorniRighe = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryGiorni.ottieniTutti(userId);
  }, [userId]);
  const obiettiviTarget = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettiviTarget.ottieniTutti(userId);
  }, [userId]);

  // Pasti salvati (solo per sapere se un pasto di oggi corrisponde già a uno
  // di essi — la stella del segnalibro, sezione 3): servono composizioni e le
  // loro righe.
  const composizioni = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryComposizioni.ottieniTutti(userId);
  }, [userId]);
  const composizioniVoci = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryComposizioniVoci.ottieniTutti(userId);
  }, [userId]);
  // Serve alla stella e al suo sheet: quali alimenti dei pasti salvati e
  // delle voci di oggi sono ancora nel catalogo (stessa regola di
  // pastiSalvati() in /aggiungi, e "Alimenti cancellati" in
  // PUNTO_DI_PARTENZA.md). Solo per mostrare: le decisioni di scrittura
  // rileggono il catalogo da Dexie (salvaPastoComeComposizione).
  const catalogo = useLiveQuery(async () => {
    if (!userId) return undefined;
    return catalogoLocale(userId);
  }, [userId]);

  // Primo avvio: i 5 pasti predefiniti si creano solo se il server è vuoto
  // (usePastiIniziali, garantisciPastiPredefiniti). Finché l'utente non ha
  // nessun pasto, `statoPastiIniziali` dice se si sta ancora leggendo o se
  // la lettura è fallita ("Serve la connessione"). La useLiveQuery sopra si
  // aggiorna da sola appena i pasti sono in Dexie.
  const { stato: statoPastiIniziali, riprova: riprovaPastiIniziali } = usePastiIniziali(userId);

  // Diagnostica per il ripiego "manca il target del tipo scritto" (sezione
  // 4, "obiettivi_target"): un caso atteso (es. un periodo creato prima del
  // Salva unico del Profilo, senza riga "allenamento"), non un
  // bug, ma va comunque loggato per essere trovato quando qualcuno si chiede
  // perché i numeri di un giorno "Allenamento" sono quelli di "Normale". In
  // un useEffect (non nel corpo del render) per non spammare la console a
  // ogni ridisegno: parte solo quando uno di questi valori cambia davvero.
  useEffect(() => {
    if (
      profilo === undefined ||
      giorniRighe === undefined ||
      obiettivi === undefined ||
      obiettiviTarget === undefined
    ) {
      return;
    }
    if (!profilo?.differenzia_giorni) return;

    const obiettivoAttuale = obiettivoValidoPer(obiettivi, giorno);
    if (!obiettivoAttuale) return;

    const tipoScritto = tipoGiornoEffettivo(giorniRighe, profilo, giorno);
    const haTarget = targetPerTipo(obiettiviTarget, obiettivoAttuale.id, tipoScritto) !== null;
    if (!haTarget) {
      console.error(
        `Oggi (${giorno}): tipo_giorno "${tipoScritto}" scritto ma manca la riga corrispondente in obiettivi_target per l'obiettivo corrente (${obiettivoAttuale.id}). Mostro il target "normale" come ripiego.`
      );
    }
  }, [giorno, profilo, giorniRighe, obiettivi, obiettiviTarget]);

  // Modifica di una voce già a diario: tap sulla voce → riapre lo stesso
  // SheetQuantita, precompilato con i valori reali (grammi e pasto), con
  // un'azione di eliminazione (sezione 5).
  const [voceInModifica, setVoceInModifica] = useState<VoceDiario | null>(null);
  const [pastoModificaId, setPastoModificaId] = useState<string>("");
  const [salvataggioVoce, setSalvataggioVoce] = useState<
    "inattivo" | "in-corso" | "errore"
  >("inattivo");

  // "Salva come preferito" (sezione 3): il pasto in attesa del nome nello
  // SheetNome, e lo stato del salvataggio della composizione.
  const [pastoDaSalvare, setPastoDaSalvare] = useState<Pasto | null>(null);
  const [salvataggioComposizione, setSalvataggioComposizione] = useState<
    | "inattivo"
    | "in-corso"
    | "errore"
    | "duplicato"
    | "senza-alimenti"
    | "gia-salvato"
    | "esclusi-cambiati"
  >("inattivo");
  // Regola "Alimenti cancellati" (PUNTO_DI_PARTENZA.md): le voci del pasto
  // che NON verranno salvate perché il loro alimento non è più nel catalogo,
  // così come l'utente le vede annunciate nello sheet. Passate a
  // salvaPastoComeComposizione, che rilegge Dexie e rifiuta di salvare se
  // nel frattempo non sono più queste.
  const [idVociEsclusePreviste, setIdVociEsclusePreviste] = useState<string[]>([]);
  // Testo informativo del caso "gia-salvato" nello sheet.
  const [testoGiaSalvatoSheet, setTestoGiaSalvatoSheet] = useState<string | null>(null);
  // Barra temporanea in basso (BarraAnnulla), una sola alla volta: un
  // messaggio nuovo sostituisce il precedente e `id` (la `key`) fa ripartire
  // il timer. La usano:
  // - ogni inserimento nel diario fatto in /aggiungi, con "Annulla"
  //   (punto 10.2);
  // - Elimina dal menu contestuale, con "Annulla" (sezione 3, "Tieni
  //   premuto");
  // - il tocco della stella su un pasto il cui contenuto valido è già
  //   salvato, senza azione.
  // `fotografia`: com'erano le voci prima dell'operazione
  // (src/lib/repository/vociDiario.ts). Se c'è, la barra ha "Annulla".
  const [barra, setBarra] = useState<
    | (MessaggioBarra & {
        id: string;
        fotografia?: FotografiaVoci;
        // Duplica su un altro giorno: il giorno che "Vedi" mostra.
        vediGiorno?: string;
      })
    | null
  >(null);

  // L'inserimento appena fatto in /aggiungi, che ci ha riportati qui
  // (src/lib/inserimento/ultimoInserimento.ts). Letto e svuotato in un
  // useEffect, non durante il render: in sviluppo React (Strict Mode) può
  // ripetere il render, e un secondo "leggi e svuota" troverebbe già vuoto.
  // L'effetto può ripetersi anch'esso, ma lo stato messo dal primo giro
  // resta, e il secondo trova vuoto e non fa nulla.
  useEffect(() => {
    const inserimento = prendiInserimento();
    if (!inserimento) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizzazione con una sorgente esterna (il modulo in memoria), una volta al montaggio
    setBarra({
      id: crypto.randomUUID(),
      ...messaggioAggiunto(inserimento.nome, inserimento.numeroAlimenti),
      fotografia: fotografiaInserimento(inserimento.idVoci),
    });
  }, []);

  // "Annulla" nella barra: riporta le voci a com'erano prima
  // dell'operazione (annullaOperazione, che le rilegge da Dexie e passa dal
  // repository, quindi anche dall'outbox; scrive solo in avanti). La barra
  // si toglie PRIMA di scrivere, così un secondo tocco ravvicinato non
  // lancia un secondo annullamento.
  async function annullaUltimaOperazione() {
    const fotografia = barra?.fotografia;
    if (!fotografia) return;
    const precedente = barra;
    setBarra(null);
    try {
      await annullaOperazione(fotografia);
      setBarra({ id: crypto.randomUUID(), ...MESSAGGIO_ANNULLATO });
    } catch {
      // Si ripropone l'Annulla: quello che è già stato rimesso a posto
      // viene saltato, quindi riprovare dopo un guasto a metà converge.
      setBarra({ ...precedente, id: crypto.randomUUID() });
    }
  }

  // Menu contestuale (sezione 3, "Tieni premuto"): la riga a cui è
  // ancorato. `ancora` è il suo rettangolo sullo schermo all'apertura,
  // `limiteBasso` dove comincia la fascia di "+ Aggiungi" e della pillola.
  const [menu, setMenu] = useState<{
    tipo: TipoRiga;
    id: string;
    ancora: DOMRect;
    limiteBasso: number;
    elemento: HTMLElement;
    fuocoAllaPrimaVoce: boolean;
  } | null>(null);
  // L'unica chiusura del menu: tocco fuori (anche sulla riga stessa, che sta
  // sotto lo sfondo), Esc, Tab ed Elimina passano tutti da qui, tramite
  // onChiudi di MenuContestuale. Il gesto non ha niente da rimettere a
  // posto: l'hook lo chiude da solo nel momento in cui decide il menu
  // (tieniPremuto.ts).
  function chiudiMenu() {
    setMenu(null);
    azzeraTieniPremuto();
  }
  const rifFasciaAggiungi = useRef<HTMLDivElement>(null);

  // Swipe e tieni-premuto: spenti con uno sheet o il menu aperti.
  // "Sposta" dal menu (sezione 3, "Tieni premuto"): cosa si sposta e a che
  // punto si è. Senza destinazione si sceglie il pasto (SheetScegliPasto);
  // con `doppioni` è aperto il foglio dei doppioni (SheetDoppioni). Niente
  // si scrive finché non si conferma: chiudere uno dei due fogli butta via
  // tutto.
  const [spostamento, setSpostamento] = useState<StatoSpostamento | null>(null);
  const [duplicazione, setDuplicazione] = useState<StatoDuplicazione | null>(null);

  // Trascinare un alimento o un pasto su un altro pasto (sezione 3, "Tieni
  // premuto", passo D): la copia che segue il dito, il pasto sotto il dito,
  // e al rilascio lo stesso spostamento di "Sposta" dal menu.
  const rifLista = useRef<HTMLUListElement>(null);
  const {
    trascinamento,
    bersaglio,
    rifElementoCopia,
    ascoltatori: ascoltatoriTrascinamento,
  } = useTrascinaInPasto({
    rifLista,
    rifFasciaAggiungi,
    pastoDi: (riga) =>
      riga.tipo === "pasto" ? riga.id : (vociTutte?.find((v) => v.id === riga.id)?.pasto_id ?? null),
    onRilascio: (riga, pastoDestinazioneId) => {
      const s = nuovoSpostamento(riga.tipo, riga.id, false);
      if (s) void eseguiSpostamento(s, pastoDestinazioneId);
    },
  });

  const gestiAttivi =
    voceInModifica === null &&
    pastoDaSalvare === null &&
    menu === null &&
    spostamento === null &&
    duplicazione === null &&
    trascinamento === null;

  // Il giorno del calendario è cambiato (mezzanotte, o l'app riaperta il
  // giorno dopo): la pagina va subito sul nuovo oggi, qualunque giorno
  // stesse mostrando (decisione del 10/10). Prima chiude ogni foglio aperto
  // (sheet della voce, "Salva come pasto", menu, Sposta, Duplica): Sposta,
  // Duplica ed "Elimina tutto il pasto" leggono `giorno` alla conferma, e
  // un foglio rimasto aperto sopra il giorno nuovo farebbe agire la conferma
  // sulle voci di un altro giorno. Quello che si stava scrivendo nel foglio
  // si perde, come toccando fuori. Unica attesa: un trascinamento in corso
  // (dura finché il dito è giù, e il rilascio agisce sul giorno da cui è
  // partito); finito quello, il salto avviene qui.
  // Stato aggiornato durante il render (come il pasto proposto in
  // /aggiungi): React ridisegna subito, senza mostrare il giorno vecchio. Il
  // gesto del tieni-premuto si azzera in un effetto, dopo useTieniPremuto:
  // non è uno stato di React.
  if (giornoCorrenteVisto !== giornoCorrente && trascinamento === null) {
    setGiornoCorrenteVisto(giornoCorrente);
    setVoceInModifica(null);
    setPastoDaSalvare(null);
    setMenu(null);
    setSpostamento(null);
    setDuplicazione(null);
    setGiorno(giornoCorrente);
  }

  // Swipe per cambiare giorno (sezione 3, "Swipe per cambiare giorno"): si
  // attiva sul pannello del giorno (anello, macro e lista), non sulla testata
  // con la data.
  const rifPannello = useSwipeGiorno({
    giorno,
    attivo: gestiAttivi,
    onCambia: (verso) =>
      setGiorno((g) => (verso === "successivo" ? giornoSuccessivo(g) : giornoPrecedente(g))),
    rifScorrimento: rifLista,
  });

  // Tieni premuto su un alimento o sul nome di un pasto (sezione 3, "Tieni
  // premuto: sposta, duplica, elimina"): il ramo "menu" apre il menu
  // contestuale. Il ramo "trascina" per ora non fa niente (passo D).
  const { rif: rifTieniPremuto, azzera: azzeraTieniPremuto } = useTieniPremuto({
    attivo: gestiAttivi,
    onMenu: (riga, daContextmenu) =>
      setMenu({
        fuocoAllaPrimaVoce: daContextmenu,
        tipo: riga.tipo,
        id: riga.id,
        ancora: riga.elemento.getBoundingClientRect(),
        limiteBasso:
          rifFasciaAggiungi.current?.getBoundingClientRect().top ?? window.innerHeight,
        elemento: riga.elemento,
      }),
    onTrascinamento: ascoltatoriTrascinamento,
  });
  // Dopo il salto al nuovo oggi (sopra), che chiude anche il menu: il dito
  // che l'aveva aperto è finito, come in chiudiMenu. Al primo montaggio
  // non c'è nessun gesto da azzerare, e azzerare non fa niente.
  useEffect(() => {
    azzeraTieniPremuto();
  }, [giornoCorrenteVisto, azzeraTieniPremuto]);
  // La lista ha due ref: l'oggetto che usa lo swipe (rifScorrimento) e la
  // callback del tieni-premuto. Questa le unisce; useCallback la tiene
  // identica fra un render e l'altro, altrimenti React staccherebbe e
  // riattaccherebbe gli ascoltatori a ogni render, a metà di un gesto.
  const refLista = useCallback(
    (nodo: HTMLUListElement | null) => {
      rifLista.current = nodo;
      const stacca = rifTieniPremuto(nodo);
      return () => {
        rifLista.current = null;
        stacca?.();
      };
    },
    [rifTieniPremuto]
  );

  // A ogni cambio di giorno (swipe, frecce, "Oggi", calendario) la lista
  // riparte dall'alto, non dalla posizione del giorno prima. Layout effect:
  // gira dopo che il DOM mostra il giorno nuovo ma prima che venga
  // dipinto, quindi non si vede mai il giorno nuovo nella posizione vecchia.
  useLayoutEffect(() => {
    if (rifLista.current) rifLista.current.scrollTop = 0;
  }, [giorno]);

  // Voce 3: i pasti (fasce) di cui l'utente ha nascosto la lista di alimenti.
  // In memoria, non su disco: al riavvio dell'app tornano tutti aperti.
  const [pastiCollassati, setPastiCollassati] = useState<Set<string>>(
    () => new Set()
  );

  function toggleCollasso(pastoId: string) {
    setPastiCollassati((prec) => {
      const succ = new Set(prec);
      if (succ.has(pastoId)) succ.delete(pastoId);
      else succ.add(pastoId);
      return succ;
    });
  }

  if (
    userId === undefined ||
    pasti === undefined ||
    vociTutte === undefined ||
    obiettivi === undefined ||
    composizioni === undefined ||
    composizioniVoci === undefined ||
    catalogo === undefined ||
    profilo === undefined ||
    giorniRighe === undefined ||
    obiettiviTarget === undefined
  ) {
    return (
      <main className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  // Da qui in giù `pasti`, `vociTutte` e `obiettivi` ci sono di sicuro.

  // L'oggi del calendario (giornoCorrente, sopra): il giorno a cui riporta
  // il pulsante "Oggi" e l'unico con "Rimangono X kcal". Il limite in avanti
  // è un'altra cosa: oggi + 7 (ultimoGiornoDiario), lo stesso di
  // dataScrivibile.
  const eGiornoCorrente = giorno === giornoCorrente;
  const ultimoGiorno = ultimoGiornoDiario();

  // Derivati: con React Compiler attivo non serve useMemo, il ricalcolo a
  // ogni render è già memoizzato dal compilatore.
  const vociGiorno = vociDelGiorno(vociTutte, giorno);
  const totali = sommaTotali(vociGiorno);
  const obiettivo = obiettivoValidoPer(obiettivi, giorno);

  // I pasti del giorno mostrato (sezione 3, "I pasti"):
  // - `pastiMostrati`: la lista, in ordine d'orario. Quelli validi oggi più
  //   la rete di sicurezza: un pasto che quel giorno non vale più ma ha
  //   ancora voci si mostra lo stesso, con "Non più in uso", così ogni voce
  //   che conta nei totali qui sopra ha la sua riga;
  // - `pastiSceglibili`: quelli validi quel giorno, gli unici che possono
  //   ricevere voci (Sposta, trascinamento, il pasto nello sheet). Da un
  //   pasto "non più in uso" le voci si possono solo portare via.
  const pastiMostrati = pastiDaMostrare(pasti, vociGiorno, giorno);
  const pastiSceglibili = pastiValidiIl(pasti, giorno);
  const eInUso = (pastoId: string) => pastiSceglibili.some((p) => p.id === pastoId);

  // Il tipo REALMENTE scritto per questo giorno (o proposto dal pattern se
  // non è mai stato scritto, sezione 3) — è la classificazione vera, non
  // tocca mai la trappola: resta questo anche se manca il target
  // corrispondente (vedi tipoGiornoMostrato sotto).
  const tipoGiornoScrittoGiorno = tipoGiornoEffettivo(giorniRighe, profilo, giorno);
  const haTargetPerTipoScritto = obiettivo
    ? targetPerTipo(obiettiviTarget, obiettivo.id, tipoGiornoScrittoGiorno) !== null
    : true;

  // Cosa si MOSTRA (pastiglia e numeri): se manca il target per il tipo
  // scritto, la pastiglia non deve "mentire" mostrando "Allenamento" sopra a
  // dei numeri che sono in realtà quelli di "Normale" — mostra "Normale"
  // anche lei, finché il target mancante non viene aggiunto in Profilo. La
  // classificazione vera in `giorni` non viene toccata da questo: appena il
  // target esiste, torna a mostrarsi da sola senza bisogno di ritoccare la
  // pastiglia.
  const tipoGiornoMostrato = haTargetPerTipoScritto
    ? tipoGiornoScrittoGiorno
    : TIPO_GIORNO_NORMALE;

  // Tipi selezionabili dalla pastiglia (sezione 3, punto 2): le righe di
  // obiettivi_target dell'obiettivo corrente, non un elenco fisso — "normale"
  // per primo, gli altri in ordine alfabetico (solo estetica, non limita
  // l'insieme dei tipi possibili).
  const tipiGiornoDisponibili = obiettivo
    ? [
        ...new Set(
          obiettiviTarget
            .filter((t) => t.obiettivo_id === obiettivo.id && t.deleted_at === null)
            .map((t) => t.tipo_giorno)
        ),
      ].sort((a, b) => {
        if (a === TIPO_GIORNO_NORMALE) return -1;
        if (b === TIPO_GIORNO_NORMALE) return 1;
        return a.localeCompare(b);
      })
    : [];
  const mostraPastiglia = Boolean(profilo?.differenzia_giorni) && tipiGiornoDisponibili.length > 0;

  const target = obiettivo
    ? targetEffettivo(obiettiviTarget, obiettivo.id, tipoGiornoScrittoGiorno)
    : null;

  const targetKcal = target?.kcal ?? null;
  const consumateKcal = Math.round(totali.kcal);

  async function cambiaTipoGiorno(tipo: string) {
    if (!userId || giorno === null) return;
    try {
      await scriviTipoGiornoScelto(userId, giorno, tipo);
    } catch {
      // Azione istantanea senza sheet aperto (come toggleSalvaPreferito qui
      // sotto): nessun posto dove mostrare un errore. L'utente vede la
      // pastiglia non cambiare e può riprovare.
    }
  }

  // La seconda riga sotto la data cambia significato a seconda del giorno
  // (sezione 3): "Rimangono X kcal" sul giorno che stai riempiendo adesso,
  // "consumate di target" sui giorni passati (dove "rimangono" non vuol dire
  // niente).
  let rigaCalorie: string;
  let classeRigaCalorie = "text-muted";
  if (targetKcal == null) {
    rigaCalorie = "Nessun obiettivo impostato";
  } else if (eGiornoCorrente) {
    const rimaste = targetKcal - consumateKcal;
    if (rimaste >= 0) {
      rigaCalorie = `Rimangono ${rimaste} kcal`;
    } else {
      rigaCalorie = `${-rimaste} kcal oltre l'obiettivo`;
      classeRigaCalorie = "text-warning";
    }
  } else {
    rigaCalorie = `${consumateKcal} di ${targetKcal} kcal`;
  }

  // Lo stato iniziale di uno spostamento di una riga (alimento o pasto);
  // null se la riga non c'è più. `sceltaPasto`: dal menu si sceglie il pasto
  // nel foglio; trascinando il pasto è già deciso dal rilascio.
  function nuovoSpostamento(tipo: TipoRiga, id: string, sceltaPasto: boolean): StatoSpostamento | null {
    const vuoto = { sceltaPasto, pastoDestinazioneId: null, doppioni: null, avviso: null, inCorso: false, errore: null };
    if (tipo === "voce") {
      const voce = vociGiorno.find((v) => v.id === id);
      if (!voce) return null;
      return { ...vuoto, origine: { tipo: "voce", id }, nome: voce.nome_alimento, pastoPartenzaId: voce.pasto_id };
    }
    const pasto = pasti?.find((p) => p.id === id);
    if (!pasto) return null;
    return { ...vuoto, origine: { tipo: "pasto", pastoId: id }, nome: pasto.nome, pastoPartenzaId: id };
  }

  // Cosa scrive la copia che segue il dito: per un alimento nome e
  // "80 g · 200 kcal", come la riga; per un pasto intero, compatta, nome e
  // numero di alimenti ("Pranzo · 3 alimenti").
  function descriviCopia(tipo: TipoRiga, id: string): { titolo: string; dettaglio?: string } {
    if (tipo === "voce") {
      const voce = vociGiorno.find((v) => v.id === id);
      if (!voce) return { titolo: "" };
      return {
        titolo: voce.nome_alimento,
        dettaglio: `${voce.quantita_g} g · ${Math.round(totaleVoce(voce).kcal)} kcal`,
      };
    }
    const nome = pasti?.find((p) => p.id === id)?.nome ?? "";
    const n = vociGiorno.filter((v) => v.pasto_id === id).length;
    return { titolo: `${nome} · ${n} ${n === 1 ? "alimento" : "alimenti"}` };
  }

  // "Duplica" dal menu: apre il foglio con giorno e pasto. Un pasto senza
  // alimenti non ha niente da duplicare.
  function apriDuplica(tipo: TipoRiga, id: string) {
    const s = nuovoSpostamento(tipo, id, false);
    if (!s) return;
    if (tipo === "pasto" && !vociGiorno.some((v) => v.pasto_id === id)) return;
    setDuplicazione({
      origine: s.origine,
      nome: s.nome,
      pastoPartenzaId: s.pastoPartenzaId,
      dataPartenza: giorno,
      dataDestinazione: null,
      pastoDestinazioneId: null,
      doppioni: null,
      avviso: null,
      inCorso: false,
      errore: null,
    });
  }

  // Scelti giorno e pasto (e, se servono, le scelte per i doppioni):
  // duplicaNelPasto rilegge le righe e copia. Come per Sposta, se ci sono
  // doppioni da decidere apre il foglio invece di scrivere. Se il giorno è
  // diverso da quello che si sta guardando, il messaggio lo dice e la barra
  // ha anche "Vedi".
  async function eseguiDuplicazione(
    d: StatoDuplicazione,
    dataDestinazione: string,
    pastoDestinazioneId: string,
    scelte?: Record<string, SceltaDoppione>
  ) {
    if (!userId || profilo === undefined) return;
    setDuplicazione({ ...d, dataDestinazione, pastoDestinazioneId, inCorso: true, errore: null });
    try {
      const esito = await duplicaNelPasto({
        userId,
        dataPartenza: d.dataPartenza,
        origine: d.origine,
        dataDestinazione,
        pastoDestinazioneId,
        profilo,
        scelte,
        doppioniVisti: d.doppioni ?? undefined,
      });
      if (esito.esito === "doppioni") {
        setDuplicazione({
          ...d,
          dataDestinazione,
          pastoDestinazioneId,
          doppioni: esito.doppioni,
          avviso: d.doppioni ? "Nel frattempo l'elenco è cambiato: controlla e conferma di nuovo." : null,
          inCorso: false,
          errore: null,
        });
        return;
      }
      setDuplicazione(null);
      const { piano, fotografia } = esito;
      if (piano.duplicati.length === 0 && piano.esclusi.length === 0) return;
      const nomePasto = (pastoId: string | null) => pasti?.find((p) => p.id === pastoId)?.nome ?? "";
      const altroGiorno = dataDestinazione !== giorno;
      const scritto = fotografia.prima.length > 0 || fotografia.idCreate.length > 0;
      setBarra({
        id: crypto.randomUUID(),
        ...messaggioDuplicazione({
          tipo: d.origine.tipo,
          nomeAlimento: d.origine.tipo === "voce" ? d.nome : undefined,
          pastoPartenza: nomePasto(d.pastoPartenzaId),
          pastoDestinazione: nomePasto(pastoDestinazioneId),
          giornoDiverso: altroGiorno ? formattaGiornoCorto(dataDestinazione) : null,
          duplicati: piano.duplicati.length,
          esclusi: piano.esclusi,
        }),
        fotografia: scritto ? fotografia : undefined,
        vediGiorno: altroGiorno && scritto ? dataDestinazione : undefined,
      });
    } catch {
      setDuplicazione({
        ...d,
        dataDestinazione,
        pastoDestinazioneId,
        inCorso: false,
        errore: "Operazione non riuscita. Riprova.",
      });
    }
  }

  // Il titolo del foglio dei doppioni per Duplica: come per Sposta, più il
  // giorno se è diverso da quello che si sta guardando.
  function titoloDoppioniDuplica(d: StatoDuplicazione): string {
    const dest = accorcia(pasti?.find((p) => p.id === d.pastoDestinazioneId)?.nome ?? "", MASSIMO_PASTO);
    const di =
      d.dataDestinazione && d.dataDestinazione !== giorno
        ? ` di ${formattaGiornoCorto(d.dataDestinazione)}`
        : "";
    const doppioni = d.doppioni ?? [];
    return doppioni.length === 1
      ? `«${accorcia(doppioni[0].nome, MASSIMO_ALIMENTO)}» c'è già in «${dest}»${di}`
      : `${doppioni.length} alimenti ci sono già in «${dest}»${di}`;
  }

  // "Sposta" dal menu: apre l'elenco dei pasti.
  function apriSposta(tipo: TipoRiga, id: string) {
    setSpostamento(nuovoSpostamento(tipo, id, true));
  }

  // Scelto il pasto (e, se servono, le scelte per i doppioni): rilegge le
  // righe da Dexie e sposta (spostaNelPasto). Se ci sono doppioni da
  // decidere, o nel frattempo sono cambiati, apre il foglio invece di
  // scrivere. Alla fine la barra dice cosa è successo davvero, con
  // "Annulla" solo se si è scritto qualcosa.
  async function eseguiSpostamento(
    s: StatoSpostamento,
    pastoDestinazioneId: string,
    scelte?: Record<string, SceltaDoppione>
  ) {
    if (!userId) return;
    setSpostamento({ ...s, pastoDestinazioneId, inCorso: true, errore: null });
    try {
      const esito = await spostaNelPasto({
        userId,
        data: giorno,
        origine: s.origine,
        pastoDestinazioneId,
        scelte,
        doppioniVisti: s.doppioni ?? undefined,
      });
      if (esito.esito === "doppioni") {
        setSpostamento({
          ...s,
          pastoDestinazioneId,
          doppioni: esito.doppioni,
          avviso: s.doppioni ? "Nel frattempo l'elenco è cambiato: controlla e conferma di nuovo." : null,
          inCorso: false,
          errore: null,
        });
        return;
      }
      setSpostamento(null);
      const { piano, fotografia } = esito;
      // Niente da spostare (la voce è sparita nel frattempo): niente barra.
      if (piano.spostati.length === 0 && piano.esclusi.length === 0) return;
      const nomePasto = (pastoId: string | null) => pasti?.find((p) => p.id === pastoId)?.nome ?? "";
      const scritto = fotografia.prima.length > 0 || fotografia.idCreate.length > 0;
      setBarra({
        id: crypto.randomUUID(),
        ...messaggioSpostamento({
          tipo: s.origine.tipo,
          nomeAlimento: s.origine.tipo === "voce" ? s.nome : undefined,
          pastoPartenza: nomePasto(s.pastoPartenzaId),
          pastoDestinazione: nomePasto(pastoDestinazioneId),
          spostati: piano.spostati.length,
          esclusi: piano.esclusi,
        }),
        fotografia: scritto ? fotografia : undefined,
      });
    } catch {
      // applicaScritture ha già rimesso a posto quello che aveva scritto.
      setSpostamento({ ...s, pastoDestinazioneId, inCorso: false, errore: "Operazione non riuscita. Riprova." });
    }
  }

  // "Elimina" / "Elimina tutto il pasto" dal menu contestuale (sezione 3,
  // "Tieni premuto"). Le voci si rileggono da Dexie al momento del tocco:
  // quello che si cancella è lo stato vero, non quello dell'ultimo render.
  // Niente conferma prima, come per l'inserimento: c'è "Annulla" dopo
  // (punto 10.2). Cancellato niente (già sparito nel frattempo) → niente
  // barra.
  async function eliminaDalMenu(tipo: TipoRiga, id: string) {
    if (!userId) return;
    try {
      if (tipo === "voce") {
        await eliminaUnaVoce(id);
      } else {
        const nomePasto = pasti?.find((p) => p.id === id)?.nome ?? "";
        const fotografia = await eliminaPastoDelGiorno(userId, giorno, id);
        if (fotografia.prima.length === 0) return;
        setBarra({
          id: crypto.randomUUID(),
          ...messaggioEliminato(nomePasto, fotografia.prima.length),
          fotografia,
        });
      }
    } catch {
      // eliminaVoci ha già rimesso a posto le voci cancellate prima del
      // guasto: non è successo niente.
      setBarra({ id: crypto.randomUUID(), testo: "Operazione non riuscita. Riprova." });
    }
  }

  // Elimina un alimento dal diario e mostra "Eliminato: Mela" con
  // "Annulla" (la fotografia di vociDiario.ts). Una sola strada per il menu
  // contestuale e per lo sheet quantità, così le due non divergono. Rilancia
  // l'errore: ognuno dei due lo mostra a modo suo.
  async function eliminaUnaVoce(id: string) {
    const fotografia = await eliminaVoci([id]);
    if (fotografia.prima.length === 0) return;
    setBarra({
      id: crypto.randomUUID(),
      ...messaggioEliminato(fotografia.prima[0].nome_alimento),
      fotografia,
    });
  }

  function apriModifica(voce: VoceDiario) {
    setVoceInModifica(voce);
    // Una voce senza pasto (non dovrebbe esistere) parte dal primo pasto
    // valido nel SUO giorno, non dal primo di tutte le righe.
    setPastoModificaId(voce.pasto_id ?? pastiValidiIl(pasti ?? [], voce.data)[0]?.id ?? "");
    setSalvataggioVoce("inattivo");
  }

  function chiudiModifica() {
    setVoceInModifica(null);
    setSalvataggioVoce("inattivo");
  }

  async function confermaModifica(grammi: number) {
    if (!voceInModifica) return;
    setSalvataggioVoce("in-corso");
    try {
      // Stessa riga (stesso id): aggiorna(), non crea(). Il pasto può essere
      // cambiato (spostare la voce di pasto, sezione 5).
      await repositoryVociDiario.aggiorna(voceInModifica.id, {
        quantita_g: grammi,
        pasto_id: pastoModificaId || voceInModifica.pasto_id,
      });
      chiudiModifica();
    } catch {
      setSalvataggioVoce("errore");
    }
  }

  async function eliminaVoce() {
    if (!voceInModifica) return;
    setSalvataggioVoce("in-corso");
    try {
      // Cancellazione logica (scrive deleted_at): la useLiveQuery toglie
      // subito la voce dalla lista. Stessa barra con "Annulla" di Elimina
      // dal menu contestuale.
      await eliminaUnaVoce(voceInModifica.id);
      chiudiModifica();
    } catch {
      setSalvataggioVoce("errore");
    }
  }

  // "Salva come preferito" (sezione 3): se il pasto di oggi non corrisponde
  // già a un pasto salvato, apre SheetNome per il nome — non window.prompt(),
  // non disponibile in alcuni ambienti (webview integrate, alcune PWA
  // installate). Se invece la stella è già piena, ripremerla lo toglie
  // subito dai preferiti, senza sheet: stessa immediatezza della stella sugli
  // alimenti singoli in SheetQuantita.
  async function toggleSalvaPreferito(pasto: Pasto) {
    if (!userId || !composizioni || !composizioniVoci || !catalogo) return;
    const vociPasto = vociGiorno.filter((v) => v.pasto_id === pasto.id);
    if (vociPasto.length === 0) return;

    const idsCorrispondenti = composizioniCorrispondenti(
      vociPasto,
      catalogo,
      composizioni,
      composizioniVoci
    );
    if (idsCorrispondenti.length > 0) {
      try {
        await Promise.all(
          idsCorrispondenti.map((id) => eliminaComposizione(userId, id))
        );
      } catch {
        // Azione istantanea senza sheet aperto: nessun posto dove mostrare un
        // errore. Come toggleStellaAlimentoScelto in /aggiungi, un fallimento
        // qui lascia solo la stella ancora piena — l'utente può riprovare.
      }
      return;
    }

    // Stella vuota perché la giornata contiene alimenti non più nel
    // catalogo (regola "Alimenti cancellati", punto 2: la stella confronta
    // l'elenco intero che si vede a schermo). Se le sole voci valide sono già
    // un pasto salvato, niente sheet: si dice cosa c'è già e cosa manca
    // (punto 3). Qui basta lo stato React: non si scrive niente, e il
    // salvataggio vero ripete lo stesso controllo rileggendo Dexie.
    const giaSalvatoValide = pastoSalvatoCoiSoliValidi(
      vociPasto,
      catalogo,
      composizioni,
      composizioniVoci
    );
    const { valide, escluse } = separaVociPerCatalogo(vociPasto, catalogo);
    if (giaSalvatoValide) {
      setBarra({
        id: crypto.randomUUID(),
        testo: testoGiaSalvato(
          giaSalvatoValide.nome,
          escluse.map((v) => v.nome_alimento)
        ),
      });
      return;
    }

    setPastoDaSalvare(pasto);
    // Quali voci l'avviso dello sheet annuncia come escluse. Se non ne resta
    // nessuna valida, nessun avviso: il salvataggio risponderà
    // "senza-alimenti", che dice già tutto.
    setIdVociEsclusePreviste(valide.length > 0 ? escluse.map((v) => v.id) : []);
    setTestoGiaSalvatoSheet(null);
    setSalvataggioComposizione("inattivo");
  }

  function chiudiSalvaPreferito() {
    setPastoDaSalvare(null);
    setIdVociEsclusePreviste([]);
    setTestoGiaSalvatoSheet(null);
    setSalvataggioComposizione("inattivo");
  }

  async function confermaSalvaPreferito(nome: string) {
    if (!userId || !pastoDaSalvare) return;
    const vociPasto = vociGiorno.filter((v) => v.pasto_id === pastoDaSalvare.id);
    if (vociPasto.length === 0) {
      chiudiSalvaPreferito();
      return;
    }

    setSalvataggioComposizione("in-corso");
    try {
      // Tutti i controlli (nome doppio, contenuto già salvato, alimenti
      // esclusi) li fa salvaPastoComeComposizione rileggendo Dexie — non più
      // qui sullo stato React. Ogni esito diverso da "salvato" lascia lo
      // sheet aperto con un messaggio: chiuderlo in silenzio farebbe
      // sembrare salvato ciò che non lo è.
      const risultato = await salvaPastoComeComposizione(
        userId,
        nome,
        vociPasto,
        idVociEsclusePreviste
      );
      switch (risultato.esito) {
        case "salvato":
          chiudiSalvaPreferito();
          break;
        case "senza-alimenti":
          setSalvataggioComposizione("senza-alimenti");
          break;
        case "nome-duplicato":
          setSalvataggioComposizione("duplicato");
          break;
        case "gia-salvato":
          setTestoGiaSalvatoSheet(testoGiaSalvato(risultato.nomePasto, risultato.nomiEsclusi));
          setSalvataggioComposizione("gia-salvato");
          break;
        case "esclusi-cambiati":
          // L'avviso si aggiorna con l'elenco vero; serve un altro "Salva".
          setIdVociEsclusePreviste(risultato.idVociEscluse);
          setSalvataggioComposizione("esclusi-cambiati");
          break;
      }
    } catch {
      setSalvataggioComposizione("errore");
    }
  }

  // Avviso dello sheet (punto 1): costruito dalle voci annunciate come
  // escluse, non da un nuovo calcolo sul catalogo — dice esattamente ciò che
  // "Salva" confermerà. Quando il contenuto è già salvato vince il
  // messaggio informativo e l'avviso non compare (punto E).
  let avvisoSalvaPreferito: string | null = null;
  if (pastoDaSalvare) {
    const vociPastoDaSalvare = vociGiorno.filter((v) => v.pasto_id === pastoDaSalvare.id);
    const escluse = vociPastoDaSalvare.filter((v) => idVociEsclusePreviste.includes(v.id));
    if (salvataggioComposizione === "gia-salvato") {
      avvisoSalvaPreferito = testoGiaSalvatoSheet;
    } else if (escluse.length > 0) {
      avvisoSalvaPreferito = testoAvvisoEsclusi(
        vociPastoDaSalvare.length - escluse.length,
        vociPastoDaSalvare.length,
        escluse.map((v) => v.nome_alimento)
      );
    }
  }

  const nomePastoInModifica =
    pasti.find((p) => p.id === (voceInModifica?.pasto_id ?? ""))?.nome ?? "";

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* FASCIA ALTA — fissa. `safe-area-inset-top` vale 0 con
          statusBarStyle "default" (la pagina comincia sotto l'orologio); è
          qui solo perché la testata resti fuori dall'orologio anche se un
          giorno la barra di stato diventasse trasparente. */}
      <header className="shrink-0 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        {/* Prima riga: ‹ data › a sinistra, "Oggi" e la pastiglia a destra.
            Misurata con i font veri, nel caso peggiore ("30 mag", "Oggi" e
            "Allenamento" insieme) la riga è larga 315 px: a 390 e 375 px di
            schermo ci sta con 43 e 28 px di margine, quindi la forma è
            sempre la stessa. `flex-wrap` è solo una rete di sicurezza: se il
            gruppo di destra non entra (schermo da 320 px, o un tipo di
            giorno dal nome più lungo di "Allenamento"), il browser lo porta
            intero sulla riga sotto, ancora a destra (`ml-auto`), invece di
            farlo uscire dallo schermo. Solo CSS. */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setGiorno(giornoPrecedente(giorno))}
              aria-label="Giorno precedente"
              className={`rounded p-1 text-muted ${CLASSE_FOCUS}`}
            >
              <Chevron verso="sinistra" />
            </button>

            {/* Il titolo-data è un pulsante: aprirlo mostra il calendario
                nativo (sezione "Inserimento retroattivo"). `max` è
                l'ultimo giorno del diario (oggi + 7); siccome alcuni
                browser lasciano digitare oltre il massimo, onChange
                ricontrolla con dataScrivibile e ignora una data fuori.
                L'input date resta fuori schermo (sr-only) e serve solo
                come bersaglio di showPicker().
                "Giorno sopra la data": una colonna centrata, sopra il giorno
                della settimana piccolo, maiuscolo e tenue ("VENERDÌ", nel
                font del testo), sotto "25 set" alla grandezza e nel font di
                sempre. Tutto il blocco è il pulsante; l'aria-label dice la
                data per esteso ("venerdì 25 settembre"). La scritta piccola
                eredita l'interlinea normale e aggiunge circa 15 px di
                altezza alla testata. */}
            <h1 className="whitespace-nowrap font-display text-2xl font-bold">
              <button
                type="button"
                onClick={apriCalendario}
                aria-label={`Cambia data, ${formattaDataEstesa(giorno)}`}
                className={`flex flex-col items-center rounded ${CLASSE_FOCUS}`}
              >
                <span className="font-sans text-[11px] font-medium uppercase tracking-wider text-muted">
                  {formattaGiornoSettimana(giorno)}
                </span>
                <span>{formattaGiornoMese(giorno)}</span>
              </button>
            </h1>
            <input
              ref={rifData}
              type="date"
              value={giorno}
              max={ultimoGiorno}
              onChange={(e) => dataScrivibile(e.target.value) && setGiorno(e.target.value)}
              tabIndex={-1}
              aria-hidden
              className="sr-only"
            />

            <button
              type="button"
              onClick={() => setGiorno(giornoSuccessivo(giorno))}
              disabled={giorno >= ultimoGiorno}
              aria-label="Giorno successivo"
              className={`rounded p-1 text-muted disabled:opacity-30 ${CLASSE_FOCUS}`}
            >
              <Chevron verso="destra" />
            </button>
          </div>

          {(!eGiornoCorrente || mostraPastiglia) && (
            <div className="ml-auto flex items-center gap-1">
              {!eGiornoCorrente && (
                <button
                  type="button"
                  onClick={() => setGiorno(giornoCorrente)}
                  className={`rounded-full border border-border px-3 py-1 text-xs ${CLASSE_FOCUS}`}
                >
                  Oggi
                </button>
              )}

              {/* Pastiglia Normale/Allenamento (sezione 3, punto 1): solo se
                  la differenziazione è attiva E c'è almeno un tipo
                  selezionabile — da spenta la riga resta esattamente com'è
                  oggi, nessun resto. Stesso trucco della select del pasto in
                  /aggiungi: un <select> nativo travestito da pillola,
                  accessibile di default. */}
              {mostraPastiglia && (
                <div className="relative">
                  <select
                    value={tipoGiornoMostrato}
                    onChange={(e) => cambiaTipoGiorno(e.target.value)}
                    aria-label="Tipo di giornata"
                    className={`appearance-none rounded-full border border-border bg-transparent py-1 pl-3 pr-6 text-xs ${CLASSE_FOCUS}`}
                  >
                    {tipiGiornoDisponibili.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {capitalizza(tipo)}
                      </option>
                    ))}
                  </select>
                  <ChevronGiu className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              )}
            </div>
          )}
        </div>

        <p className={`mt-1 text-sm ${classeRigaCalorie}`}>{rigaCalorie}</p>
      </header>

      {/* PANNELLO DEL GIORNO — anello, macro e lista: è l'area dello swipe
          (useSwipeGiorno) e si muove tutto insieme col dito. La testata
          sopra resta ferma e cambia testo quando cambia il giorno.
          `touch-pan-y` (touch-action: pan-y): lo scroll verticale lo fa il
          browser, i trascinamenti orizzontali arrivano allo swipe. */}
      <div ref={rifPannello} className="flex min-h-0 flex-1 touch-pan-y flex-col">
        {/* Anello + macro affiancati, non impilati (sezione 3). Ordine dei
            macro come sulle etichette dei prodotti: Grassi, Carboidrati,
            Proteine (PUNTO_DI_PARTENZA.md §7, "Le barre macro"; le kcal
            sono l'anello). I target
            vengono dal tipo del GIORNO MOSTRATO (tipoGiornoMostrato, sopra),
            non dall'obiettivo generico: su un giorno di allenamento passato
            devono restare quelli di allenamento anche se oggi è "normale". */}
        <div className="mt-5 flex shrink-0 items-center gap-4 px-4 pb-5">
          <AnelloCalorie consumate={totali.kcal} obiettivo={targetKcal} />
          <div className="flex-1 space-y-3">
            <BarraMacro
              nome="Grassi"
              valore={totali.grassi}
              obiettivo={target?.grassi_g ?? null}
            />
            <BarraMacro
              nome="Carboidrati"
              valore={totali.carboidrati}
              obiettivo={target?.carboidrati_g ?? null}
            />
            <BarraMacro
              nome="Proteine"
              valore={totali.proteine}
              obiettivo={target?.proteine_g ?? null}
            />
          </div>
        </div>

        {/* FASCIA CENTRALE — l'unica che scorre, fino al fondo dello schermo:
            passa sotto "+ Aggiungi" e la pillola. Lo spazio in fondo
            (--ingombro-oggi, globals.css) fa salire l'ultimo alimento sopra
            bottone e pillola. Anche qui `touch-pan-y`: la lista è un'area che
            scorre per conto suo, e il browser controlla touch-action fino a
            lei. */}
        <ul
          ref={refLista}
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-4 pb-[calc(var(--ingombro-oggi)+1rem)]"
        >
          {/* "Nessun pasto" vuol dire nessuna riga in `pasti` per l'utente
              (primo avvio): solo allora "Preparo…" o "Serve la connessione".
              Un giorno in cui nessun pasto vale (tutti nati dopo, per
              esempio) è un'altra cosa, e lo dice. */}
          {pasti.length === 0 ? (
            statoPastiIniziali === "lettura-fallita" ? (
              <li className="pt-2">
                <ServeConnessione onRiprova={riprovaPastiIniziali} />
              </li>
            ) : (
              <li className="py-8 text-center text-sm text-muted">Preparo i tuoi pasti…</li>
            )
          ) : pastiMostrati.length === 0 ? (
            <li className="py-8 text-center text-sm text-muted">Nessun pasto in questo giorno.</li>
          ) : (
            pastiMostrati.map((pasto) => {
              const vociPasto = vociGiorno.filter((v) => v.pasto_id === pasto.id);
              const kcalPasto = Math.round(sommaTotali(vociPasto).kcal);
              const haVoci = vociPasto.length > 0;
              const collassato = pastiCollassati.has(pasto.id);
              // Rete di sicurezza: il pasto quel giorno non vale (fuori dal
              // suo periodo o cancellato) ma ha voci. Si mostra, con "Non
              // più in uso", ma non riceve voci: niente data-pasto-id, che è
              // l'attributo con cui il trascinamento trova i bersagli.
              const inUso = eInUso(pasto.id);
              // Stella del segnalibro (sezione 3, punto 3): piena finché gli
              // alimenti+quantità di oggi coincidono con un pasto già salvato.
              const giaSalvato = pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci);
              return (
                <li
                  key={pasto.id}
                  // Trascinamento (passo D): ogni pasto è misurato come
                  // bersaglio (data-pasto-id). Mentre si trascina, tutti i
                  // pasti tranne quello di partenza hanno il bordo
                  // tratteggiato, quello sotto il dito è evidenziato; il
                  // pasto di partenza si spegne solo trascinando un pasto
                  // intero (globals.css, .pasto-trascinamento).
                  data-pasto-id={inUso ? pasto.id : undefined}
                  data-bersaglio={
                    inUso && trascinamento && trascinamento.pastoPartenzaId !== pasto.id ? "" : undefined
                  }
                  data-bersaglio-attivo={bersaglio === pasto.id ? "" : undefined}
                  data-trascinato={
                    trascinamento?.riga.tipo === "pasto" && trascinamento.riga.id === pasto.id
                      ? ""
                      : undefined
                  }
                  className="pasto-trascinamento border-b border-border py-4"
                >
                  {/* Voce 3: se il pasto ha degli alimenti, la riga del titolo è
                      un pulsante che ne nasconde/mostra la lista. Il pasto vuoto
                      resta una riga non interattiva (non c'è niente da
                      collassare). Lo stato è tenuto per id di pasto e non per
                      giorno, così una fascia chiusa resta chiusa anche
                      cambiando data. */}
                  {haVoci ? (
                    <div className="flex w-full items-baseline justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleCollasso(pasto.id)}
                        aria-expanded={!collassato}
                        data-tieni-premuto="pasto"
                        data-menu-aperto={menu?.id === pasto.id ? "" : undefined}
                        data-id={pasto.id}
                        className={`riga-tieni-premuto flex min-w-0 items-baseline gap-1.5 rounded text-left text-lg ${CLASSE_FOCUS}`}
                      >
                        <CaretPasto aperto={!collassato} />
                        <span className="truncate">{pasto.nome}</span>
                      </button>
                      <div className="flex shrink-0 items-baseline gap-2.5">
                        {/* Voce "Salvare un pasto intero" (sezione 3): non si
                            costruisce in una schermata apposta, si promuove da
                            una giornata già registrata — bersaglio separato dal
                            collasso, stessa riga. */}
                        <button
                          type="button"
                          onClick={() => toggleSalvaPreferito(pasto)}
                          aria-pressed={giaSalvato}
                          aria-label={
                            giaSalvato
                              ? `Togli ${pasto.nome} dai preferiti`
                              : `Salva ${pasto.nome} come preferito`
                          }
                          className={`rounded p-1 ${giaSalvato ? "text-accent" : "text-muted"} ${CLASSE_FOCUS}`}
                        >
                          <Segnalibro piena={giaSalvato} />
                        </button>
                        <span className="text-lg">{kcalPasto} kcal</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-lg">{pasto.nome}</span>
                      <span className="shrink-0 text-lg">—</span>
                    </div>
                  )}

                  {!inUso && <p className="text-xs text-muted">{ETICHETTA_NON_IN_USO}</p>}

                  {/* Ogni voce è tappabile: apre lo SheetQuantita in modifica
                      (sezione 5). */}
                  {haVoci && !collassato && (
                    <ul className="mt-1.5">
                      {vociPasto.map((voce) => (
                        <li key={voce.id}>
                          <button
                            type="button"
                            onClick={() => apriModifica(voce)}
                            data-tieni-premuto="voce"
                            data-menu-aperto={menu?.id === voce.id ? "" : undefined}
                            data-trascinato={trascinamento?.riga.id === voce.id ? "" : undefined}
                            data-id={voce.id}
                            className={`riga-tieni-premuto flex w-full items-baseline justify-between gap-3 rounded py-1 text-left text-sm text-muted ${CLASSE_FOCUS}`}
                          >
                            <span className="min-w-0 truncate">{voce.nome_alimento}</span>
                            <span className="shrink-0">
                              {voce.quantita_g} g · {Math.round(totaleVoce(voce).kcal)} kcal
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {/* "+ Aggiungi" FLUTTUANTE, centrato appena sopra la pillola della tab
          bar. Non deve mai finire sotto la piega: è l'azione per cui esiste
          l'app (sezione 3). Apre /aggiungi per il giorno mostrato. Il gruppo
          non riceve tocchi (la lista sotto resta scorrevole ai lati del
          bottone), il bottone e la BarraAnnulla sì.
          `data-pulsante-aggiungi`: alza la sfumatura dietro le barre fino a
          coprire anche il bottone (regola :has in globals.css). Si nasconde
          mentre un campo ha il fuoco, come la pillola. */}
      <div
        ref={rifFasciaAggiungi}
        data-pulsante-aggiungi
        data-nascondi-mentre-scrivi
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--ingombro-tab-bar)+var(--spazio-fra-barre))] z-30 mx-auto max-w-md"
      >
        {/* Appena sopra il bottone, senza coprirlo. Ha il suo sfondo pieno,
            quindi resta leggibile sopra la lista che passa sotto. Qui non
            serve il margine della barretta home (c'è la pillola sotto) né il
            visual viewport: quando compare non c'è nessun campo di testo
            aperto, quindi nessuna tastiera. */}
        {barra && (
          <BarraAnnulla
            key={barra.id}
            testo={barra.testo}
            nome={barra.nome}
            coda={barra.coda}
            icona={barra.icona}
            durataMs={barra.durataMs}
            azione={
              barra.fotografia
                ? { etichetta: "Annulla", onClick: annullaUltimaOperazione }
                : undefined
            }
            // "Vedi" porta al giorno della Duplica. La barra resta (stessa
            // key, il tempo continua da dove era) con "Annulla" ancora
            // valido; "Vedi" sparisce, perché quel giorno ora è sullo
            // schermo.
            azioneSecondaria={
              barra.vediGiorno && barra.vediGiorno !== giorno
                ? { etichetta: "Vedi", onClick: () => setGiorno(barra.vediGiorno!) }
                : undefined
            }
            sopra
            onChiudi={() => setBarra(null)}
          />
        )}
        <button
          type="button"
          onClick={() => router.push(`/aggiungi?giorno=${giorno}`)}
          style={{ boxShadow: "var(--ombra-fluttuante)" }}
          className={`pointer-events-auto mx-auto flex h-[var(--aggiungi-altezza)] items-center rounded-full bg-accent-strong px-10 font-medium text-on-strong ${CLASSE_FOCUS}`}
        >
          + Aggiungi
        </button>
      </div>

      {/* Menu contestuale del tieni-premuto (sezione 3). Per ora solo
          Elimina: Sposta e Duplica compaiono quando funzionano (passi C ed
          E), voci spente sembrerebbero rotte. */}
      {trascinamento && (
        <CopiaTrascinata
          rettangolo={trascinamento.rettangolo}
          compatta={trascinamento.riga.tipo === "pasto"}
          rifElemento={rifElementoCopia}
          {...descriviCopia(trascinamento.riga.tipo, trascinamento.riga.id)}
        />
      )}

      {menu && (
        <MenuContestuale
          etichetta={`Azioni per ${
            menu.tipo === "pasto"
              ? (pasti.find((p) => p.id === menu.id)?.nome ?? "il pasto")
              : (vociGiorno.find((v) => v.id === menu.id)?.nome_alimento ?? "l'alimento")
          }`}
          ancora={menu.ancora}
          limiteBasso={menu.limiteBasso}
          elementoOrigine={menu.elemento}
          fuocoAllaPrimaVoce={menu.fuocoAllaPrimaVoce}
          voci={[
            {
              etichetta: "Sposta",
              onSeleziona: () => apriSposta(menu.tipo, menu.id),
            },
            // Duplica: sempre sull'alimento, sul pasto solo se ha alimenti.
            ...(menu.tipo === "voce" || vociGiorno.some((v) => v.pasto_id === menu.id)
              ? [{ etichetta: "Duplica", onSeleziona: () => apriDuplica(menu.tipo, menu.id) }]
              : []),
            {
              etichetta: menu.tipo === "pasto" ? "Elimina tutto il pasto" : "Elimina",
              distruttiva: true,
              onSeleziona: () => void eliminaDalMenu(menu.tipo, menu.id),
            },
          ]}
          onChiudi={chiudiMenu}
        />
      )}

      {duplicazione && duplicazione.doppioni === null && (
        <SheetDuplica
          titolo={`Duplica «${accorcia(duplicazione.nome, MASSIMO_ALIMENTO)}»`}
          giornoIniziale={duplicazione.dataPartenza}
          pasti={pasti}
          pastoIniziale={duplicazione.pastoPartenzaId}
          inCorso={duplicazione.inCorso}
          errore={duplicazione.errore}
          onAnnulla={() => setDuplicazione(null)}
          onConferma={(data, pastoId) => void eseguiDuplicazione(duplicazione, data, pastoId)}
        />
      )}

      {duplicazione &&
        duplicazione.doppioni !== null &&
        duplicazione.dataDestinazione &&
        duplicazione.pastoDestinazioneId && (
          <SheetDoppioni
            titolo={titoloDoppioniDuplica(duplicazione)}
            doppioni={duplicazione.doppioni}
            nomeDestinazione={pasti.find((p) => p.id === duplicazione.pastoDestinazioneId)?.nome ?? ""}
            nomePartenza={pasti.find((p) => p.id === duplicazione.pastoPartenzaId)?.nome ?? ""}
            etichettaEscludi="Non duplicarlo"
            esitoEscludi="Non si duplica"
            etichettaConferma="Duplica"
            avviso={duplicazione.avviso}
            inCorso={duplicazione.inCorso}
            errore={duplicazione.errore}
            onAnnulla={() => setDuplicazione(null)}
            onConferma={(scelte) =>
              void eseguiDuplicazione(
                duplicazione,
                duplicazione.dataDestinazione!,
                duplicazione.pastoDestinazioneId!,
                scelte
              )
            }
          />
        )}

      {spostamento && spostamento.sceltaPasto && spostamento.doppioni === null && (
        <SheetScegliPasto
          titolo={`Sposta «${accorcia(spostamento.nome, MASSIMO_ALIMENTO)}» in…`}
          pasti={pastiSceglibili.filter((p) => p.id !== spostamento.pastoPartenzaId)}
          inCorso={spostamento.inCorso}
          errore={spostamento.errore}
          onScegli={(pastoId) => void eseguiSpostamento(spostamento, pastoId)}
          onAnnulla={() => setSpostamento(null)}
        />
      )}

      {spostamento && spostamento.doppioni !== null && spostamento.pastoDestinazioneId && (
        <SheetDoppioni
          titolo={
            spostamento.doppioni.length === 1
              ? `«${accorcia(spostamento.doppioni[0].nome, MASSIMO_ALIMENTO)}» c'è già in «${accorcia(
                  pasti.find((p) => p.id === spostamento.pastoDestinazioneId)?.nome ?? "",
                  MASSIMO_PASTO
                )}»`
              : `${spostamento.doppioni.length} alimenti ci sono già in «${accorcia(
                  pasti.find((p) => p.id === spostamento.pastoDestinazioneId)?.nome ?? "",
                  MASSIMO_PASTO
                )}»`
          }
          doppioni={spostamento.doppioni}
          nomeDestinazione={pasti.find((p) => p.id === spostamento.pastoDestinazioneId)?.nome ?? ""}
          nomePartenza={pasti.find((p) => p.id === spostamento.pastoPartenzaId)?.nome ?? ""}
          etichettaEscludi="Non spostarlo"
          esitoEscludi={`Resta in ${pasti.find((p) => p.id === spostamento.pastoPartenzaId)?.nome ?? ""}, non si sposta`}
          etichettaConferma="Sposta"
          avviso={spostamento.avviso}
          inCorso={spostamento.inCorso}
          errore={spostamento.errore}
          onAnnulla={() => setSpostamento(null)}
          onConferma={(scelte) => void eseguiSpostamento(spostamento, spostamento.pastoDestinazioneId!, scelte)}
        />
      )}

      {voceInModifica && (
        <SheetQuantita
          alimento={daVoce(voceInModifica)}
          nomePasto={nomePastoInModifica}
          grammiIniziali={voceInModifica.quantita_g}
          modifica
          pasti={opzioniPastoDellaVoce(pasti, voceInModifica)}
          pastoSelezionatoId={pastoModificaId}
          onCambiaPasto={setPastoModificaId}
          inCorso={salvataggioVoce === "in-corso"}
          errore={
            salvataggioVoce === "errore"
              ? "Operazione non riuscita. Riprova."
              : null
          }
          onAnnulla={chiudiModifica}
          onConferma={confermaModifica}
          onElimina={eliminaVoce}
        />
      )}

      {pastoDaSalvare && (
        <SheetNome
          titolo={`Salva "${pastoDaSalvare.nome}" come preferito`}
          valoreIniziale={pastoDaSalvare.nome}
          inCorso={salvataggioComposizione === "in-corso"}
          errore={
            salvataggioComposizione === "errore"
              ? "Non è stato possibile salvare. Riprova."
              : salvataggioComposizione === "duplicato"
                ? "Esiste già un pasto salvato con questo nome. Scegline un altro."
                : salvataggioComposizione === "senza-alimenti"
                  ? "Nessuno degli alimenti di questo pasto è ancora nel catalogo: non c'è niente da salvare."
                  : salvataggioComposizione === "esclusi-cambiati"
                    ? "Nel frattempo l'elenco è cambiato: controlla e premi di nuovo Salva."
                    : null
          }
          avviso={avvisoSalvaPreferito}
          onAnnulla={chiudiSalvaPreferito}
          onConferma={confermaSalvaPreferito}
        />
      )}
    </div>
  );
}

// Segnalibro: "Salva come preferito" su un pasto (sezione 3). Azione, non
// stato on/off — a differenza della stella dei preferiti-alimento, si può
// usare più volte con nomi diversi sullo stesso pasto.
function Segnalibro({ piena }: { piena: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={piena ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3h12v18l-6-4-6 4Z" />
    </svg>
  );
}

function Chevron({ verso }: { verso: "sinistra" | "destra" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={verso === "sinistra" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

// Freccetta della pastiglia Normale/Allenamento: stesso disegno di
// ChevronGiu in /aggiungi (il <select> del pasto), qui più piccola perché la
// pastiglia è un testo minuscolo, non un titolo.
function ChevronGiu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Freccetta accanto al nome del pasto (voce 3): punta in giù quando la lista
// è aperta, ruota a destra quando è collassata.
function CaretPasto({ aperto }: { aperto: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 self-center text-muted transition-transform ${
        aperto ? "" : "-rotate-90"
      }`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
