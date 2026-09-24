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
// Layout a tre fasce, solo quella centrale scorre (sezione 3):
//   - in alto, fisso: data navigabile, calorie rimanenti, anello e macro
//   - al centro, scorrevole: la lista dei pasti
//   - in basso, fisso: il pulsante "+ Aggiungi"
//
// Il pulsante "+ Aggiungi" apre /aggiungi passando il giorno mostrato, così
// dopo il salvataggio si torna all'Oggi del giorno giusto (anche un giorno
// passato). Per leggere ?giorno= serve useSearchParams, che va avvolto in
// <Suspense> (come nella pagina di login).

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  repositoryPasti,
  repositoryVociDiario,
  repositoryObiettivi,
  repositoryObiettiviTarget,
  repositoryComposizioni,
  repositoryComposizioniVoci,
  repositoryProfili,
  repositoryGiorni,
} from "@/lib/repository";
import { garantisciPastiPredefiniti } from "@/lib/repository/pasti";
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
  formattaData,
  eFuturo,
  giornoLogico,
} from "@/lib/dataGiorno";
import { TIPO_GIORNO_NORMALE } from "@/lib/db/tipi";
import { oraInizioPrimoPasto } from "@/lib/inserimento/propostaPasto";
import AnelloCalorie from "@/components/AnelloCalorie";
import BarraMacro from "@/components/BarraMacro";
import SheetQuantita from "@/components/SheetQuantita";
import SheetNome from "@/components/SheetNome";
import { daVoce } from "@/lib/inserimento/alimentoPerSheet";
import { pastoGiaSalvato, composizioniCorrispondenti } from "@/lib/inserimento/pastiSalvati";
import {
  salvaPastoComeComposizione,
  esisteComposizioneConNome,
  eliminaComposizione,
} from "@/lib/repository/composizioni";
import type { Pasto, VoceDiario } from "@/lib/db/tipi";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

// Etichetta della pastiglia: "normale" -> "Normale". I tipi non sono un
// elenco fisso (sezione 3), quindi non c'è una tabella di etichette da
// mantenere — solo la prima lettera maiuscola, come già in formattaData
// (dataGiorno.ts).
function capitalizza(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

export default function OggiPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-full items-center justify-center p-4">
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
  // un ?giorno= (e non è futuro) si parte da quello. Altrimenti il giorno di
  // partenza è il GIORNO LOGICO, che non è sempre l'oggi del calendario:
  // all'una di notte è ancora "ieri" perché la Cena scavalca la mezzanotte
  // (PUNTO_DI_PARTENZA.md, sezione "Il giorno logico"). Il giorno logico
  // dipende dall'ora del primo pasto, che arriva da Dexie in modo asincrono:
  // finché non la conosciamo `giorno` resta null e la pagina mostra
  // "Caricamento" (come già fa per userId/pasti/voci).
  const [giorno, setGiorno] = useState<string | null>(() => {
    const param = searchParams.get("giorno");
    return param && !eFuturo(param) ? param : null;
  });

  // Il calendario si apre da codice con showPicker() sull'input date, non
  // sovrapponendo un input invisibile al testo: quel trucco lasciava
  // cliccabile solo una porzione della scritta (l'area utile di un input
  // date nativo non è tutta la sua superficie). Il testo della data è un
  // <button> vero: tap o Invio/Spazio aprono il calendario.
  const rifData = useRef<HTMLInputElement>(null);

  // Ricorda per quale userId è già stato tentato il seed dei pasti
  // predefiniti in questo montaggio, indipendentemente da come si evolve
  // `pasti` (vedi l'effetto più sotto).
  const rifTentatoSeed = useRef<string | null>(null);

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

  const pasti = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryPasti.ottieniTutti(userId);
    // Le fasce si mostrano nell'ordine scelto dall'utente (campo `ordine`).
    return [...righe].sort((a, b) => a.ordine - b.ordine);
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

  // Se l'utente non ha ancora nessun pasto (registrazione fatta prima che
  // esistesse questa logica, o primo avvio), crea il set predefinito dei 5
  // pasti. Una volta sola per utente per montaggio (rifTentatoSeed, non
  // `pasti` nelle dipendenze): garantisciPastiPredefiniti decide da sola,
  // rileggendo Dexie, se serve seminare — non dal `pasti` qui sopra, che è
  // stato React reattivo e può restare "non ancora arrivato" più a lungo di
  // quanto ci si aspetterebbe dopo un refresh (bug reale: un secondo
  // refresh ravvicinato aveva rifatto il seed da capo). La useLiveQuery
  // sopra si aggiorna comunque da sola appena i pasti sono in Dexie.
  useEffect(() => {
    if (!userId || rifTentatoSeed.current === userId) return;
    rifTentatoSeed.current = userId;
    garantisciPastiPredefiniti(userId).catch(() => {});
  }, [userId]);

  // Diagnostica per il ripiego "manca il target del tipo scritto" (sezione
  // 4, "obiettivi_target"): un caso atteso (es. obiettivo appena cambiato,
  // target "allenamento" non ancora risalvato per il nuovo periodo), non un
  // bug, ma va comunque loggato per essere trovato quando qualcuno si chiede
  // perché i numeri di un giorno "Allenamento" sono quelli di "Normale". In
  // un useEffect (non nel corpo del render) per non spammare la console a
  // ogni ridisegno: parte solo quando uno di questi valori cambia davvero.
  useEffect(() => {
    if (
      giorno === null ||
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
    "inattivo" | "in-corso" | "errore" | "duplicato"
  >("inattivo");

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

  // Nessun ?giorno= in arrivo: il giorno di partenza è quello logico (vedi il
  // commento sullo useState sopra). Serve l'ora del primo pasto, quindi si
  // aspettano i `pasti` da Dexie. Impostato durante il render e guardato da
  // `=== null` — come nella pagina Profilo — non in un useEffect (che React
  // segnala come set-state-in-effect). Se per un attimo `pasti` è [] (default
  // non ancora creati) vale l'oggi del calendario: si corregge da sé al
  // prossimo avvio, il caso è il primo utilizzo in assoluto fra le 00 e le 06.
  if (giorno === null && pasti !== undefined) {
    setGiorno(giornoLogico(oraInizioPrimoPasto(pasti)));
  }

  if (
    giorno === null ||
    userId === undefined ||
    pasti === undefined ||
    vociTutte === undefined ||
    obiettivi === undefined ||
    composizioni === undefined ||
    composizioniVoci === undefined ||
    profilo === undefined ||
    giorniRighe === undefined ||
    obiettiviTarget === undefined
  ) {
    return (
      <main className="flex min-h-full items-center justify-center p-4">
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  // Da qui in giù `giorno`, `pasti`, `vociTutte` e `obiettivi` ci sono di sicuro.

  // Il giorno logico "adesso": di norma l'oggi del calendario, ma fra la
  // mezzanotte e l'ora del primo pasto è ieri (sezione "Il giorno logico").
  // È il giorno a cui riporta il pulsante "Oggi" e oltre il quale non si
  // naviga in avanti.
  const giornoCorrente = giornoLogico(oraInizioPrimoPasto(pasti));
  const eGiornoCorrente = giorno === giornoCorrente;

  // Derivati: con React Compiler attivo non serve useMemo, il ricalcolo a
  // ogni render è già memoizzato dal compilatore.
  const vociGiorno = vociDelGiorno(vociTutte, giorno);
  const totali = sommaTotali(vociGiorno);
  const obiettivo = obiettivoValidoPer(obiettivi, giorno);

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

  function apriModifica(voce: VoceDiario) {
    setVoceInModifica(voce);
    setPastoModificaId(voce.pasto_id ?? pasti?.[0]?.id ?? "");
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
      // subito la voce dalla lista.
      await repositoryVociDiario.elimina(voceInModifica.id);
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
    if (!composizioni || !composizioniVoci) return;
    const vociPasto = vociGiorno.filter((v) => v.pasto_id === pasto.id);
    if (vociPasto.length === 0) return;

    const idsCorrispondenti = composizioniCorrispondenti(
      vociPasto,
      composizioni,
      composizioniVoci
    );
    if (idsCorrispondenti.length > 0) {
      try {
        await Promise.all(
          idsCorrispondenti.map((id) => eliminaComposizione(id, composizioniVoci))
        );
      } catch {
        // Azione istantanea senza sheet aperto: nessun posto dove mostrare un
        // errore. Come toggleStellaAlimentoScelto in /aggiungi, un fallimento
        // qui lascia solo la stella ancora piena — l'utente può riprovare.
      }
      return;
    }

    setPastoDaSalvare(pasto);
    setSalvataggioComposizione("inattivo");
  }

  function chiudiSalvaPreferito() {
    setPastoDaSalvare(null);
    setSalvataggioComposizione("inattivo");
  }

  async function confermaSalvaPreferito(nome: string) {
    if (!userId || !pastoDaSalvare || !composizioni) return;
    const vociPasto = vociGiorno.filter((v) => v.pasto_id === pastoDaSalvare.id);
    if (vociPasto.length === 0) {
      chiudiSalvaPreferito();
      return;
    }

    // Nome già usato da un altro pasto salvato: non si crea un duplicato
    // silenzioso, si segnala e si lascia lo sheet aperto per correggere.
    if (esisteComposizioneConNome(nome, composizioni)) {
      setSalvataggioComposizione("duplicato");
      return;
    }

    setSalvataggioComposizione("in-corso");
    try {
      await salvaPastoComeComposizione(userId, nome, vociPasto);
      chiudiSalvaPreferito();
    } catch {
      setSalvataggioComposizione("errore");
    }
  }

  const nomePastoInModifica =
    pasti.find((p) => p.id === (voceInModifica?.pasto_id ?? ""))?.nome ?? "";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* FASCIA ALTA — fissa */}
      <header className="shrink-0 px-4 pt-6 pb-5">
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
              nativo (sezione "Inserimento retroattivo"). `max` impedisce di
              scegliere un giorno oltre quello logico corrente (fra mezzanotte
              e l'ora del primo pasto è ieri). L'input date resta fuori schermo
              (sr-only) e serve solo come bersaglio di showPicker(). */}
          <h1 className="font-display text-2xl font-bold">
            <button
              type="button"
              onClick={apriCalendario}
              aria-label={`Cambia data, ${formattaData(giorno)}`}
              className={`rounded ${CLASSE_FOCUS}`}
            >
              {formattaData(giorno)}
            </button>
          </h1>
          <input
            ref={rifData}
            type="date"
            value={giorno}
            max={giornoCorrente}
            onChange={(e) => e.target.value && setGiorno(e.target.value)}
            tabIndex={-1}
            aria-hidden
            className="sr-only"
          />

          <button
            type="button"
            onClick={() => setGiorno(giornoSuccessivo(giorno))}
            disabled={eGiornoCorrente}
            aria-label="Giorno successivo"
            className={`rounded p-1 text-muted disabled:opacity-30 ${CLASSE_FOCUS}`}
          >
            <Chevron verso="destra" />
          </button>

          {!eGiornoCorrente && (
            <button
              type="button"
              onClick={() => setGiorno(giornoCorrente)}
              className={`ml-auto rounded-full border border-border px-3 py-1 text-xs ${CLASSE_FOCUS}`}
            >
              Oggi
            </button>
          )}

          {/* Pastiglia Normale/Allenamento (sezione 3, punto 1): solo se la
              differenziazione è attiva E c'è almeno un tipo selezionabile —
              da spenta la riga resta esattamente com'è oggi, nessun resto.
              Stesso trucco della select del pasto in /aggiungi: un <select>
              nativo travestito da pillola, accessibile di default. */}
          {profilo?.differenzia_giorni && tipiGiornoDisponibili.length > 0 && (
            <div className={`relative ${eGiornoCorrente ? "ml-auto" : ""}`}>
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

        <p className={`mt-1 text-sm ${classeRigaCalorie}`}>{rigaCalorie}</p>

        {/* Anello + macro affiancati, non impilati (sezione 3). Ordine dei
            macro come sulle etichette dei prodotti: Grassi, Carboidrati,
            Proteine (NOTE_MODIFICHE voce 1; le kcal sono l'anello). I target
            vengono dal tipo del GIORNO MOSTRATO (tipoGiornoMostrato, sopra),
            non dall'obiettivo generico: su un giorno di allenamento passato
            devono restare quelli di allenamento anche se oggi è "normale". */}
        <div className="mt-5 flex items-center gap-4">
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
      </header>

      {/* FASCIA CENTRALE — l'unica che scorre */}
      <ul className="min-h-0 flex-1 overflow-y-auto px-4">
        {pasti.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted">Preparo i tuoi pasti…</li>
        ) : (
          pasti.map((pasto) => {
            const vociPasto = vociGiorno.filter((v) => v.pasto_id === pasto.id);
            const kcalPasto = Math.round(sommaTotali(vociPasto).kcal);
            const haVoci = vociPasto.length > 0;
            const collassato = pastiCollassati.has(pasto.id);
            // Stella del segnalibro (sezione 3, punto 3): piena finché gli
            // alimenti+quantità di oggi coincidono con un pasto già salvato.
            const giaSalvato = pastoGiaSalvato(vociPasto, composizioni, composizioniVoci);
            return (
              <li key={pasto.id} className="border-b border-border py-4">
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
                      className={`flex min-w-0 items-baseline gap-1.5 text-left text-lg ${CLASSE_FOCUS}`}
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

                {/* Ogni voce è tappabile: apre lo SheetQuantita in modifica
                    (sezione 5). */}
                {haVoci && !collassato && (
                  <ul className="mt-1.5">
                    {vociPasto.map((voce) => (
                      <li key={voce.id}>
                        <button
                          type="button"
                          onClick={() => apriModifica(voce)}
                          className={`flex w-full items-baseline justify-between gap-3 rounded py-1 text-left text-sm text-muted ${CLASSE_FOCUS}`}
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

      {/* FASCIA BASSA — fissa. Il pulsante non deve mai finire sotto la
          piega: è l'azione per cui esiste l'app (sezione 3). Apre /aggiungi
          per il giorno mostrato. */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => router.push(`/aggiungi?giorno=${giorno}`)}
          className={`mx-auto block rounded-full bg-accent px-10 py-3 font-medium text-background ${CLASSE_FOCUS}`}
        >
          + Aggiungi
        </button>
      </div>

      {voceInModifica && (
        <SheetQuantita
          alimento={daVoce(voceInModifica)}
          nomePasto={nomePastoInModifica}
          grammiIniziali={voceInModifica.quantita_g}
          modifica
          pasti={pasti}
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
                : null
          }
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
