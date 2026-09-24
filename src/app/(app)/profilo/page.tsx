"use client";

// Dexie vive solo nel browser (IndexedDB), quindi questa pagina è client.
//
// useLiveQuery (dexie-react-hooks) esegue la query e ridisegna da solo il
// componente ogni volta che i dati in Dexie cambiano — non serve un
// useEffect che rilegge a mano dopo ogni salvataggio, come si farebbe con
// una fetch normale.

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  repositoryProfili,
  repositoryObiettivi,
  repositoryObiettiviTarget,
  repositoryMisurazioni,
} from "@/lib/repository";
import { ultimaMisurazione, registraPesoSenzaDuplicati } from "@/lib/repository/misurazioni";
import { targetPerTipo, salvaTarget } from "@/lib/repository/obiettiviTarget";
import type {
  LivelloAttivita,
  Sesso,
  TipoObiettivo,
  GiornoSettimana,
} from "@/lib/db/tipi";
import { TIPO_GIORNO_NORMALE, TIPO_GIORNO_ALLENAMENTO } from "@/lib/db/tipi";
import { calcolaEta, calcolaFabbisogno } from "@/lib/fabbisogno";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

const OPZIONI_SESSO: { valore: Sesso; etichetta: string }[] = [
  { valore: "maschio", etichetta: "Uomo" },
  { valore: "femmina", etichetta: "Donna" },
  { valore: "non_indicato", etichetta: "Preferisco non indicarlo" },
];

const OPZIONI_ATTIVITA: { valore: LivelloAttivita; etichetta: string }[] = [
  { valore: "sedentario", etichetta: "Sedentario" },
  { valore: "leggero", etichetta: "Leggero (1-3 allenamenti a settimana)" },
  { valore: "moderato", etichetta: "Moderato (3-5 allenamenti a settimana)" },
  { valore: "attivo", etichetta: "Attivo (6-7 allenamenti a settimana)" },
  { valore: "molto_attivo", etichetta: "Molto attivo (lavoro fisico o due allenamenti al giorno)" },
];

const OPZIONI_OBIETTIVO: { valore: TipoObiettivo; etichetta: string }[] = [
  { valore: "dimagrire", etichetta: "Dimagrire" },
  { valore: "mantenere", etichetta: "Mantenere" },
  { valore: "massa", etichetta: "Massa" },
];

const OPZIONI_GIORNO: { valore: GiornoSettimana; etichetta: string; nomeCompleto: string }[] = [
  { valore: "lunedi", etichetta: "Lu", nomeCompleto: "Lunedì" },
  { valore: "martedi", etichetta: "Ma", nomeCompleto: "Martedì" },
  { valore: "mercoledi", etichetta: "Me", nomeCompleto: "Mercoledì" },
  { valore: "giovedi", etichetta: "Gi", nomeCompleto: "Giovedì" },
  { valore: "venerdi", etichetta: "Ve", nomeCompleto: "Venerdì" },
  { valore: "sabato", etichetta: "Sa", nomeCompleto: "Sabato" },
  { valore: "domenica", etichetta: "Do", nomeCompleto: "Domenica" },
];

export default function ProfiloPage() {
  const userId = useUtenteId();

  // Attenzione al valore restituito quando userId non c'è ancora: deve
  // essere `undefined` (= "non so ancora"), mai `null`/`[]` (= "so che non
  // c'è niente"). Al primo render, subito dopo un F5, userId è sempre
  // undefined per un istante (useUtenteId legge la sessione in modo
  // asincrono) — se qui rispondessimo "niente", gli effetti qui sotto
  // segnerebbero il form come già inizializzato prima ancora di aver letto
  // i dati veri da Dexie, e i campi resterebbero vuoti per sempre.
  const profilo = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryProfili.ottieniTutti(userId);
    return righe[0] ?? null;
  }, [userId]);

  // obiettivi è uno storico (sezione 4): ogni riga è un obiettivo diverso nel
  // tempo, non c'è una riga sola da aggiornare. "Quello attuale" è il più
  // recente per updated_at, non per valido_dal — due righe create lo stesso
  // giorno avrebbero lo stesso valido_dal, ma updated_at le distingue sempre.
  const obiettivi = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettivi.ottieniTutti(userId);
  }, [userId]);

  const obiettivoCorrente =
    obiettivi === undefined
      ? undefined
      : [...obiettivi].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ?? null;

  // ?? false: un profilo locale salvato prima di questa modifica non ha
  // ancora il campo (sezione B.4 di CLAUDE.md — vedi database.ts, version 3).
  const differenziaGiorni = profilo?.differenzia_giorni ?? false;

  const obiettiviTarget = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettiviTarget.ottieniTutti(userId);
  }, [userId]);

  // undefined finché non sappiamo ancora se c'è un obiettivo corrente, o
  // finché obiettiviTarget non è arrivato; null se l'obiettivo c'è ma non ha
  // (ancora) un target "allenamento" — stesso principio di userId/profilo qui
  // sopra, per non confondere "non so ancora" con "ho controllato, non c'è".
  const targetAllenamentoCorrente =
    obiettiviTarget === undefined || obiettivoCorrente === undefined
      ? undefined
      : !obiettivoCorrente
        ? null
        : targetPerTipo(obiettiviTarget, obiettivoCorrente.id, TIPO_GIORNO_ALLENAMENTO);

  const misurazioniPeso = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryMisurazioni.ottieniTutti(userId);
    return righe.filter((riga) => riga.tipo === "peso");
  }, [userId]);

  const ultimaMisurazionePeso =
    misurazioniPeso === undefined ? undefined : ultimaMisurazione(misurazioniPeso);

  const [inizializzato, setInizializzato] = useState(false);
  const [sesso, setSesso] = useState<Sesso>("non_indicato");
  const [dataNascita, setDataNascita] = useState("");
  const [altezzaCm, setAltezzaCm] = useState("");
  const [livelloAttivita, setLivelloAttivita] = useState<LivelloAttivita | "">("");
  const [erroreAnagrafica, setErroreAnagrafica] = useState<string | null>(null);
  const [salvataggio, setSalvataggio] = useState<"inattivo" | "in-corso" | "salvato" | "errore">(
    "inattivo"
  );

  // Popola il form una sola volta, quando il profilo esistente (se c'è)
  // arriva da Dexie. Dopo, i campi seguono solo quello che digita l'utente:
  // non vogliamo che un futuro ri-render sovrascriva a metà digitazione.
  //
  // Aggiornato durante il render, non in un useEffect: è il pattern che
  // React consiglia per "sincronizzare stato in risposta a un cambiamento"
  // (react.dev, "You Might Not Need an Effect") — un giro di render in meno
  // rispetto a un effetto equivalente, e nessun problema se `profilo` non
  // cambia più dopo la prima volta (il flag `inizializzato` blocca tutto).
  if (!inizializzato && profilo !== undefined) {
    setInizializzato(true);

    if (profilo) {
      setSesso(profilo.sesso);
      setDataNascita(profilo.data_nascita ?? "");
      setAltezzaCm(profilo.altezza_cm != null ? String(profilo.altezza_cm) : "");
      setLivelloAttivita(profilo.livello_attivita ?? "");
    }
  }

  const [inizializzatoObiettivo, setInizializzatoObiettivo] = useState(false);
  const [tipoObiettivo, setTipoObiettivo] = useState<TipoObiettivo>("mantenere");
  const [pesoAttuale, setPesoAttuale] = useState("");
  const [pesoObiettivo, setPesoObiettivo] = useState("");
  const [kcal, setKcal] = useState("");
  const [proteine, setProteine] = useState("");
  const [carboidrati, setCarboidrati] = useState("");
  const [grassi, setGrassi] = useState("");
  const [erroreCalcolo, setErroreCalcolo] = useState<string | null>(null);
  const [salvataggioObiettivo, setSalvataggioObiettivo] = useState<
    "inattivo" | "in-corso" | "salvato" | "errore"
  >("inattivo");

  // Stesso principio della sezione anagrafica (aggiornato durante il
  // render, non in un useEffect): popola una sola volta con l'obiettivo/
  // peso esistenti, poi lascia fare all'utente. Il calcolo del fabbisogno
  // non deve mai sovrascrivere questi campi da solo — solo il pulsante
  // "Calcola proposta" lo fa, ed è un'azione esplicita.
  if (
    !inizializzatoObiettivo &&
    obiettivoCorrente !== undefined &&
    ultimaMisurazionePeso !== undefined
  ) {
    setInizializzatoObiettivo(true);

    if (obiettivoCorrente) {
      setTipoObiettivo(obiettivoCorrente.tipo);
      setKcal(String(obiettivoCorrente.kcal));
      setProteine(String(obiettivoCorrente.proteine_g));
      setCarboidrati(String(obiettivoCorrente.carboidrati_g));
      setGrassi(String(obiettivoCorrente.grassi_g));
      setPesoObiettivo(
        obiettivoCorrente.peso_obiettivo != null ? String(obiettivoCorrente.peso_obiettivo) : ""
      );
    }

    if (ultimaMisurazionePeso) {
      setPesoAttuale(String(ultimaMisurazionePeso.valore));
    }
  }

  const [inizializzatoAllenamento, setInizializzatoAllenamento] = useState(false);
  const [giorniAllenamento, setGiorniAllenamento] = useState<GiornoSettimana[]>([]);
  const [kcalAllenamento, setKcalAllenamento] = useState("");
  const [proteineAllenamento, setProteineAllenamento] = useState("");
  const [carboidratiAllenamento, setCarboidratiAllenamento] = useState("");
  const [grassiAllenamento, setGrassiAllenamento] = useState("");
  const [erroreAllenamento, setErroreAllenamento] = useState<string | null>(null);
  const [salvataggioAllenamento, setSalvataggioAllenamento] = useState<
    "inattivo" | "in-corso" | "salvato" | "errore"
  >("inattivo");

  // Popola una sola volta: i giorni proposti dal profilo, e il target
  // "allenamento" se esiste già — altrimenti parte dagli stessi valori del
  // set "normale" corrente, come proposta di partenza da correggere, non un
  // vincolo (stesso principio del calcolo del fabbisogno).
  if (
    !inizializzatoAllenamento &&
    profilo !== undefined &&
    targetAllenamentoCorrente !== undefined
  ) {
    setInizializzatoAllenamento(true);

    if (profilo?.giorni_allenamento_default) {
      setGiorniAllenamento(profilo.giorni_allenamento_default);
    }

    if (targetAllenamentoCorrente) {
      setKcalAllenamento(String(targetAllenamentoCorrente.kcal));
      setProteineAllenamento(String(targetAllenamentoCorrente.proteine_g));
      setCarboidratiAllenamento(String(targetAllenamentoCorrente.carboidrati_g));
      setGrassiAllenamento(String(targetAllenamentoCorrente.grassi_g));
    } else if (obiettivoCorrente) {
      setKcalAllenamento(String(obiettivoCorrente.kcal));
      setProteineAllenamento(String(obiettivoCorrente.proteine_g));
      setCarboidratiAllenamento(String(obiettivoCorrente.carboidrati_g));
      setGrassiAllenamento(String(obiettivoCorrente.grassi_g));
    }
  }

  // L'interruttore salva subito, non aspetta un bottone "Salva" (sezione 3:
  // è un'impostazione on/off, non un modulo da compilare). Se il profilo non
  // esiste ancora (utente che non ha mai salvato l'anagrafica) lo crea con i
  // valori di default già usati come stato iniziale dei campi qui sopra.
  async function alternaDifferenziaGiorni() {
    if (!userId) return;

    const nuovoValore = !(profilo?.differenzia_giorni ?? false);

    if (profilo) {
      await repositoryProfili.aggiorna(profilo.id, { differenzia_giorni: nuovoValore });
    } else {
      await repositoryProfili.crea({
        user_id: userId,
        nome: null,
        sesso: "non_indicato",
        data_nascita: null,
        altezza_cm: null,
        livello_attivita: "sedentario",
        differenzia_giorni: nuovoValore,
        giorni_allenamento_default: null,
      });
    }
  }

  function alternaGiorno(giorno: GiornoSettimana) {
    setGiorniAllenamento((attuali) =>
      attuali.includes(giorno) ? attuali.filter((g) => g !== giorno) : [...attuali, giorno]
    );
  }

  async function handleSubmitAllenamento(e: React.FormEvent) {
    e.preventDefault();
    setErroreAllenamento(null);

    if (!userId || !profilo || !obiettivoCorrente) {
      setErroreAllenamento("Salva prima i dati anagrafici e un obiettivo qui sopra.");
      return;
    }

    const kcalNum = Math.round(Number(kcalAllenamento));
    const proteineNum = Math.round(Number(proteineAllenamento));
    const carboidratiNum = Math.round(Number(carboidratiAllenamento));
    const grassiNum = Math.round(Number(grassiAllenamento));

    if (
      !kcalAllenamento ||
      !proteineAllenamento ||
      !carboidratiAllenamento ||
      !grassiAllenamento ||
      [kcalNum, proteineNum, carboidratiNum, grassiNum].some((n) => Number.isNaN(n) || n < 0)
    ) {
      setSalvataggioAllenamento("errore");
      return;
    }

    setSalvataggioAllenamento("in-corso");

    try {
      await repositoryProfili.aggiorna(profilo.id, {
        giorni_allenamento_default: giorniAllenamento.length > 0 ? giorniAllenamento : null,
      });

      await salvaTarget(
        userId,
        obiettivoCorrente.id,
        TIPO_GIORNO_ALLENAMENTO,
        {
          kcal: kcalNum,
          proteine_g: proteineNum,
          carboidrati_g: carboidratiNum,
          grassi_g: grassiNum,
        },
        obiettiviTarget ?? []
      );

      setSalvataggioAllenamento("salvato");
    } catch {
      setSalvataggioAllenamento("errore");
    }
  }

  // Riempie i quattro campi con una proposta calcolata: non salva niente.
  // "Sempre e solo una proposta" (sezione 3) — chi la vuole diversa la
  // corregge prima di premere "Salva obiettivo".
  function calcolaProposta() {
    setErroreCalcolo(null);

    if (!profilo) {
      setErroreCalcolo("Completa prima i dati anagrafici qui sopra.");
      return;
    }
    if (profilo.sesso === "non_indicato") {
      setErroreCalcolo(
        "Il calcolo automatico richiede di indicare il sesso, nella sezione qui sopra."
      );
      return;
    }
    if (!profilo.data_nascita || !profilo.altezza_cm || !profilo.livello_attivita) {
      setErroreCalcolo(
        "Completa data di nascita, altezza e livello di attività qui sopra per calcolare una proposta."
      );
      return;
    }

    const peso = Number(pesoAttuale);
    if (!pesoAttuale || Number.isNaN(peso) || peso <= 0) {
      setErroreCalcolo("Inserisci il tuo peso attuale per calcolare una proposta.");
      return;
    }

    const proposta = calcolaFabbisogno({
      sesso: profilo.sesso,
      eta: calcolaEta(profilo.data_nascita),
      altezzaCm: profilo.altezza_cm,
      pesoKg: peso,
      livelloAttivita: profilo.livello_attivita,
      tipoObiettivo,
    });

    setKcal(String(proposta.kcal));
    setProteine(String(proposta.proteine));
    setCarboidrati(String(proposta.carboidrati));
    setGrassi(String(proposta.grassi));
  }

  async function handleSubmitObiettivo(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    // Math.round: le colonne su Supabase sono "integer" (kcal, proteine_g,
    // carboidrati_g, grassi_g) — un valore con decimali farebbe fallire
    // l'insert con un errore di tipo, non solo di validazione nostra.
    const kcalNum = Math.round(Number(kcal));
    const proteineNum = Math.round(Number(proteine));
    const carboidratiNum = Math.round(Number(carboidrati));
    const grassiNum = Math.round(Number(grassi));

    if (
      !kcal ||
      !proteine ||
      !carboidrati ||
      !grassi ||
      [kcalNum, proteineNum, carboidratiNum, grassiNum].some((n) => Number.isNaN(n) || n < 0)
    ) {
      setSalvataggioObiettivo("errore");
      return;
    }

    setSalvataggioObiettivo("in-corso");

    try {
      // Il peso entra nello storico misurazioni, ma senza duplicare (vedi
      // src/lib/repository/misurazioni.ts).
      const pesoNum = Number(pesoAttuale);
      if (pesoAttuale && !Number.isNaN(pesoNum) && pesoNum > 0) {
        await registraPesoSenzaDuplicati(userId, pesoNum, misurazioniPeso ?? []);
      }

      // obiettivi è uno storico (sezione 4): si inserisce sempre una riga
      // nuova, non si sovrascrive mai quella corrente.
      const nuovoObiettivo = await repositoryObiettivi.crea({
        user_id: userId,
        valido_dal: new Date().toISOString().slice(0, 10),
        tipo: tipoObiettivo,
        kcal: kcalNum,
        proteine_g: proteineNum,
        carboidrati_g: carboidratiNum,
        grassi_g: grassiNum,
        peso_obiettivo: pesoObiettivo ? Number(pesoObiettivo) : null,
      });

      // Ogni obiettivo ha una riga "normale" in obiettivi_target (sezione 4:
      // "senza la differenziazione attiva esiste una sola riga per periodo,
      // con tipo_giorno = 'normale'"). Il backfill l'ha creata per gli
      // obiettivi che esistevano prima di questa modifica — da qui in poi
      // tocca a questo form, altrimenti l'invariante si rompe in silenzio per
      // ogni obiettivo nuovo.
      await repositoryObiettiviTarget.crea({
        user_id: userId,
        obiettivo_id: nuovoObiettivo.id,
        tipo_giorno: TIPO_GIORNO_NORMALE,
        kcal: kcalNum,
        proteine_g: proteineNum,
        carboidrati_g: carboidratiNum,
        grassi_g: grassiNum,
      });

      setSalvataggioObiettivo("salvato");
    } catch {
      setSalvataggioObiettivo("errore");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setErroreAnagrafica(null);

    // livello_attivita è NOT NULL sul database (a differenza di sesso, data
    // di nascita e altezza): senza questo controllo il salvataggio locale
    // "riuscirebbe" e la sync verso Supabase fallirebbe in silenzio dopo.
    if (!livelloAttivita) {
      setErroreAnagrafica("Seleziona il livello di attività prima di salvare.");
      return;
    }

    setSalvataggio("in-corso");

    const campi = {
      sesso,
      data_nascita: dataNascita || null,
      altezza_cm: altezzaCm ? Number(altezzaCm) : null,
      livello_attivita: livelloAttivita,
    };

    try {
      if (profilo) {
        await repositoryProfili.aggiorna(profilo.id, campi);
      } else {
        await repositoryProfili.crea({
          user_id: userId,
          nome: null,
          differenzia_giorni: false,
          giorni_allenamento_default: null,
          ...campi,
        });
      }
      setSalvataggio("salvato");
    } catch {
      setSalvataggio("errore");
    }
  }

  if (userId === undefined || profilo === undefined) {
    return (
      <main className="flex min-h-full items-center justify-center p-4">
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col items-center gap-10 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 pt-8">
        <h1 className="text-2xl font-display font-bold">Profilo</h1>

        <div>
          <span className="block text-sm font-medium mb-1">Sesso</span>
          <div className="flex gap-2">
            {OPZIONI_SESSO.map((opzione) => (
              <button
                key={opzione.valore}
                type="button"
                onClick={() => setSesso(opzione.valore)}
                aria-pressed={sesso === opzione.valore}
                className={`flex-1 rounded-lg border p-2 text-sm ${CLASSE_FOCUS} ${
                  sesso === opzione.valore
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground"
                }`}
              >
                {opzione.etichetta}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="profilo-data-nascita" className="block text-sm font-medium mb-1">
            Data di nascita
          </label>
          <input
            id="profilo-data-nascita"
            type="date"
            value={dataNascita}
            onChange={(e) => setDataNascita(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="profilo-altezza" className="block text-sm font-medium mb-1">
            Altezza (cm)
          </label>
          <input
            id="profilo-altezza"
            type="number"
            inputMode="numeric"
            min={0}
            max={280}
            value={altezzaCm}
            onChange={(e) => setAltezzaCm(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <label htmlFor="profilo-attivita" className="block text-sm font-medium mb-1">
            Livello di attività
          </label>
          <select
            id="profilo-attivita"
            value={livelloAttivita}
            onChange={(e) => setLivelloAttivita(e.target.value as LivelloAttivita)}
            className={`w-full rounded-lg border border-border p-2 bg-background ${CLASSE_FOCUS}`}
          >
            <option value="">Non impostato</option>
            {OPZIONI_ATTIVITA.map((opzione) => (
              <option key={opzione.valore} value={opzione.valore}>
                {opzione.etichetta}
              </option>
            ))}
          </select>
        </div>

        {erroreAnagrafica && <p className="text-sm text-warning">{erroreAnagrafica}</p>}

        <button
          type="submit"
          disabled={salvataggio === "in-corso"}
          className={`w-full rounded-lg bg-accent p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {salvataggio === "in-corso" ? "Salvataggio..." : "Salva"}
        </button>

        {salvataggio === "salvato" && (
          <p className="text-sm text-accent">Salvato.</p>
        )}
        {salvataggio === "errore" && (
          <p className="text-sm text-warning">Salvataggio non riuscito. Riprova.</p>
        )}
      </form>

      <form
        onSubmit={handleSubmitObiettivo}
        className="w-full max-w-sm space-y-6 border-t border-border pt-8 pb-8"
      >
        <h2 className="text-2xl font-display font-bold">Obiettivo</h2>

        <div>
          <span className="block text-sm font-medium mb-1">Obiettivo</span>
          <div className="flex gap-2">
            {OPZIONI_OBIETTIVO.map((opzione) => (
              <button
                key={opzione.valore}
                type="button"
                onClick={() => setTipoObiettivo(opzione.valore)}
                aria-pressed={tipoObiettivo === opzione.valore}
                className={`flex-1 rounded-lg border p-2 text-sm ${CLASSE_FOCUS} ${
                  tipoObiettivo === opzione.valore
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-foreground"
                }`}
              >
                {opzione.etichetta}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="profilo-peso-attuale" className="block text-sm font-medium mb-1">
            Peso attuale (kg)
          </label>
          <input
            id="profilo-peso-attuale"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            value={pesoAttuale}
            onChange={(e) => setPesoAttuale(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
          <p className="text-xs text-muted mt-1">
            Usato solo per calcolare la proposta qui sotto; se lo cambi, alla
            prossima registrazione aggiorna il tuo storico peso.
          </p>
        </div>

        <button
          type="button"
          onClick={calcolaProposta}
          className={`w-full rounded-lg border border-accent p-2 text-accent ${CLASSE_FOCUS}`}
        >
          Calcola proposta
        </button>

        {erroreCalcolo && <p className="text-sm text-warning">{erroreCalcolo}</p>}

        <div>
          <label htmlFor="profilo-peso-obiettivo" className="block text-sm font-medium mb-1">
            Peso obiettivo (kg, facoltativo)
          </label>
          <input
            id="profilo-peso-obiettivo"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            value={pesoObiettivo}
            onChange={(e) => setPesoObiettivo(e.target.value)}
            className={`w-full rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
          />
        </div>

        <div>
          <span className="block text-sm font-medium mb-2 uppercase tracking-wide text-muted text-xs">
            Target giornalieri
          </span>
          {/* Ordine come sulle etichette dei prodotti: Calorie, Grassi,
              Carboidrati, Proteine (NOTE_MODIFICHE voce 1). */}
          <div className="space-y-3">
            <CampoTarget id="profilo-kcal" etichetta="Calorie" valore={kcal} onChange={setKcal} />
            <CampoTarget id="profilo-grassi" etichetta="Grassi (g)" valore={grassi} onChange={setGrassi} />
            <CampoTarget
              id="profilo-carboidrati"
              etichetta="Carboidrati (g)"
              valore={carboidrati}
              onChange={setCarboidrati}
            />
            <CampoTarget
              id="profilo-proteine"
              etichetta="Proteine (g)"
              valore={proteine}
              onChange={setProteine}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={salvataggioObiettivo === "in-corso"}
          className={`w-full rounded-lg bg-accent p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {salvataggioObiettivo === "in-corso" ? "Salvataggio..." : "Salva obiettivo"}
        </button>

        {salvataggioObiettivo === "salvato" && <p className="text-sm text-accent">Salvato.</p>}
        {salvataggioObiettivo === "errore" && (
          <p className="text-sm text-warning">
            Salvataggio non riuscito: controlla che calorie e macro siano numeri validi.
          </p>
        )}
      </form>

      <div className="w-full max-w-sm space-y-6 border-t border-border pt-8 pb-8">
        <h2 className="text-2xl font-display font-bold">Giorni differenziati</h2>

        <div>
          <button
            type="button"
            onClick={alternaDifferenziaGiorni}
            aria-pressed={differenziaGiorni}
            className={`w-full rounded-lg border p-2 text-sm ${CLASSE_FOCUS} ${
              differenziaGiorni
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-foreground"
            }`}
          >
            {differenziaGiorni ? "Attivi" : "Non attivi"}
          </button>
          <p className="text-xs text-muted mt-1">
            Da spento l&apos;app resta identica a com&apos;è oggi. Da acceso si
            sbloccano i giorni di allenamento proposti qui sotto e un secondo
            set di target.
          </p>
        </div>

        {differenziaGiorni && (
          <form onSubmit={handleSubmitAllenamento} className="space-y-6">
            <div>
              <span className="block text-sm font-medium mb-1">
                Giorni di allenamento (proposta, non un vincolo)
              </span>
              <div className="flex gap-1">
                {OPZIONI_GIORNO.map((opzione) => (
                  <button
                    key={opzione.valore}
                    type="button"
                    onClick={() => alternaGiorno(opzione.valore)}
                    aria-pressed={giorniAllenamento.includes(opzione.valore)}
                    aria-label={opzione.nomeCompleto}
                    className={`flex-1 rounded-lg border p-2 text-xs ${CLASSE_FOCUS} ${
                      giorniAllenamento.includes(opzione.valore)
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-foreground"
                    }`}
                  >
                    {opzione.etichetta}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium mb-2 uppercase tracking-wide text-muted text-xs">
                Target giornalieri — Allenamento
              </span>
              <div className="space-y-3">
                <CampoTarget
                  id="profilo-kcal-allenamento"
                  etichetta="Calorie"
                  valore={kcalAllenamento}
                  onChange={setKcalAllenamento}
                />
                <CampoTarget
                  id="profilo-grassi-allenamento"
                  etichetta="Grassi (g)"
                  valore={grassiAllenamento}
                  onChange={setGrassiAllenamento}
                />
                <CampoTarget
                  id="profilo-carboidrati-allenamento"
                  etichetta="Carboidrati (g)"
                  valore={carboidratiAllenamento}
                  onChange={setCarboidratiAllenamento}
                />
                <CampoTarget
                  id="profilo-proteine-allenamento"
                  etichetta="Proteine (g)"
                  valore={proteineAllenamento}
                  onChange={setProteineAllenamento}
                />
              </div>
            </div>

            {erroreAllenamento && <p className="text-sm text-warning">{erroreAllenamento}</p>}

            <button
              type="submit"
              disabled={salvataggioAllenamento === "in-corso"}
              className={`w-full rounded-lg bg-accent p-2 text-background disabled:opacity-50 ${CLASSE_FOCUS}`}
            >
              {salvataggioAllenamento === "in-corso"
                ? "Salvataggio..."
                : "Salva giorni allenamento"}
            </button>

            {salvataggioAllenamento === "salvato" && (
              <p className="text-sm text-accent">Salvato.</p>
            )}
            {salvataggioAllenamento === "errore" && (
              <p className="text-sm text-warning">
                Salvataggio non riuscito: controlla che calorie e macro siano
                numeri validi.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

function CampoTarget(props: {
  id: string;
  etichetta: string;
  valore: string;
  onChange: (valore: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={props.id} className="text-sm">
        {props.etichetta}
      </label>
      <input
        id={props.id}
        type="number"
        inputMode="numeric"
        min={0}
        value={props.valore}
        onChange={(e) => props.onChange(e.target.value)}
        className={`w-28 rounded-lg border border-border p-2 text-right ${CLASSE_FOCUS}`}
      />
    </div>
  );
}
