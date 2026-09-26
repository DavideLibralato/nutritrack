"use client";

// La pagina Profilo (PUNTO_DI_PARTENZA.md, sezione 3, "Profilo").
//
// Dexie vive solo nel browser (IndexedDB), quindi questa pagina è client.
// useLiveQuery (dexie-react-hooks) esegue la query e ridisegna da solo il
// componente ogni volta che i dati in Dexie cambiano.
//
// UN SOLO SALVA per tutto il modulo (Dati personali, Obiettivo, Giorni
// differenziati), nella barra in fondo. La pagina tiene due copie dei valori:
//   - `caricati`: com'erano in Dexie quando la pagina li ha letti (o
//     all'ultimo Salva riuscito);
//   - `attuali`: quello che c'è sullo schermo.
// La differenza fra le due dice quali sezioni sono cambiate: quelle hanno il
// bordo d'accento e "Modificato", sotto i campi toccati c'è il valore di
// prima, e il Salva scrive SOLO le loro tabelle (la logica sta in
// src/lib/profilo/salvataggioProfilo.ts, con i suoi test).
//
// Fuori dal Salva, con i loro pulsanti: "Registra peso" (una misurazione,
// non un'impostazione) e la sezione "Dati su questo dispositivo" (Ricarica,
// Esci).

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId, useNomeUtente } from "@/lib/supabase/useUtente";
import {
  repositoryProfili,
  repositoryObiettivi,
  repositoryObiettiviTarget,
  repositoryMisurazioni,
  repositoryPasti,
} from "@/lib/repository";
import { ultimaMisurazione } from "@/lib/repository/misurazioni";
import type { LivelloAttivita, Sesso, TipoObiettivo, GiornoSettimana } from "@/lib/db/tipi";
import { calcolaEta, calcolaFabbisogno } from "@/lib/fabbisogno";
import { periodoInCorso } from "@/lib/totaliDiario";
import { giornoLogico, oggiLocale, formattaDataBreve } from "@/lib/dataGiorno";
import { oraInizioPrimoPasto } from "@/lib/inserimento/propostaPasto";
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
  numeriUguali,
  giorniUguali,
  numeroDaCampo,
  type ValoriModulo,
  type ValoriTarget,
  type ErroriModulo,
  type SceltaPeriodo,
} from "@/lib/profilo/salvataggioProfilo";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import RicaricaDatiAccount from "@/components/RicaricaDatiAccount";
import EsciAccount from "@/components/EsciAccount";
import IntestazioneProfilo from "@/components/IntestazioneProfilo";
import RegistraPeso from "@/components/RegistraPeso";
import SezioneProfilo from "@/components/SezioneProfilo";
import ValorePrecedente from "@/components/ValorePrecedente";
import CampoTarget from "@/components/CampoTarget";
import BarraSalvaProfilo from "@/components/BarraSalvaProfilo";
import SheetCambioObiettivo from "@/components/SheetCambioObiettivo";

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

// Le righe dei target, nell'ordine delle etichette dei prodotti: Calorie,
// Grassi, Carboidrati, Proteine (PUNTO_DI_PARTENZA.md §7, "Le barre macro").
const CAMPI_TARGET: { chiave: keyof ValoriTarget; etichetta: string }[] = [
  { chiave: "kcal", etichetta: "Calorie" },
  { chiave: "grassi", etichetta: "Grassi (g)" },
  { chiave: "carboidrati", etichetta: "Carboidrati (g)" },
  { chiave: "proteine", etichetta: "Proteine (g)" },
];

const CLASSE_CAMPO = `w-full rounded-lg border border-border bg-background p-2 text-base ${CLASSE_FOCUS}`;

function classeScelta(attiva: boolean, dimensione = "text-sm") {
  return `flex-1 rounded-lg border p-2 ${dimensione} ${CLASSE_FOCUS} ${
    attiva ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground"
  }`;
}

function etichettaDi<T extends string>(opzioni: { valore: T; etichetta: string }[], valore: T | "") {
  return opzioni.find((o) => o.valore === valore)?.etichetta ?? "Non impostato";
}

function elencoGiorni(giorni: GiornoSettimana[]): string {
  const scelti = OPZIONI_GIORNO.filter((o) => giorni.includes(o.valore));
  return scelti.length > 0 ? scelti.map((o) => o.etichetta).join(" ") : "nessuno";
}

// La pagina tiene il <main> e la sezione "Dati su questo dispositivo"; il
// modulo sta in ModuliProfilo, qui sotto. Separati per un motivo preciso: i
// valori del modulo si leggono UNA volta sola da Dexie. Dopo "Ricarica i dati
// dal tuo account" cambiare la `key` di ModuliProfilo lo fa ripartire da zero
// (React ricrea il componente e tutto il suo stato), quindi rilegge i dati
// appena scaricati. La sezione del ripristino resta fuori da quella `key`,
// così il suo messaggio di esito non sparisce.
//
// ModuliProfilo restituisce un frammento: i suoi elementi sono figli diretti
// del <main>, e la barra del Salva (sticky, `order-last`) resta attaccata al
// fondo dell'area visibile per tutta la pagina e finisce per ultima, sotto
// "Dati su questo dispositivo".
export default function ProfiloPage() {
  const userId = useUtenteId();
  const [versioneDati, setVersioneDati] = useState(0);
  // Se il modulo ha modifiche non salvate: Ricarica ed Esci lo dicono nella
  // loro conferma, invece di farle sparire in silenzio.
  const [moduloModificato, setModuloModificato] = useState(false);

  return (
    <main className="flex min-h-full flex-col items-center gap-8 p-4 pb-0">
      <ModuliProfilo key={versioneDati} onModificatoCambiato={setModuloModificato} />
      {userId && (
        <RicaricaDatiAccount
          userId={userId}
          onRipristinato={() => setVersioneDati((v) => v + 1)}
          modificheModuloNonSalvate={moduloModificato}
        >
          <EsciAccount userId={userId} modificheModuloNonSalvate={moduloModificato} />
        </RicaricaDatiAccount>
      )}
    </main>
  );
}

function ModuliProfilo({
  onModificatoCambiato,
}: {
  onModificatoCambiato: (modificato: boolean) => void;
}) {
  const userId = useUtenteId();
  const nome = useNomeUtente();

  // Attenzione al valore restituito quando userId non c'è ancora: deve
  // essere `undefined` (= "non so ancora"), mai `null`/`[]` (= "so che non
  // c'è niente"). Al primo render, subito dopo un F5, userId è sempre
  // undefined per un istante (useUtenteId legge la sessione in modo
  // asincrono) — se qui rispondessimo "niente", il modulo verrebbe
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

  // Servono solo per il giorno logico (l'ora del primo pasto).
  const pasti = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryPasti.ottieniTutti(userId);
  }, [userId]);

  // Il giorno corrente è il giorno logico, lo stesso "oggi" della pagina
  // Oggi: fra mezzanotte e il primo pasto è ancora ieri.
  const giornoCorrente = giornoLogico(oraInizioPrimoPasto(pasti ?? []));
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
  // Effect") — il controllo `caricati === null` lo fa scattare una volta sola.
  if (
    caricati === null &&
    profilo !== undefined &&
    obiettivi !== undefined &&
    obiettiviTarget !== undefined &&
    pasti !== undefined
  ) {
    const valori = valoriDaDati(profilo, periodo, obiettiviTarget);
    setCaricati(valori);
    setAttuali(valori);
  }

  const sezioni = caricati && attuali ? sezioniModificate(caricati, attuali) : [];
  const modificato = sezioni.length > 0;

  // Avvisa la pagina (Ricarica, Esci) e il browser (ricarica o chiusura
  // della scheda) quando ci sono modifiche non salvate.
  useEffect(() => {
    onModificatoCambiato(modificato);
  }, [modificato, onModificatoCambiato]);

  useEffect(() => {
    if (!modificato) return;
    // "beforeunload": il browser chiede conferma prima di ricaricare o
    // chiudere la pagina. Il testo della domanda lo decide il browser, non
    // si può personalizzare. Non scatta cambiando scheda dalla tab bar
    // (navigazione interna di Next.js): quel caso è accettato per ora.
    function avvisa(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, [modificato]);

  const [errori, setErrori] = useState<ErroriModulo>({});
  const [erroreCalcolo, setErroreCalcolo] = useState<string | null>(null);
  const [sheetAperto, setSheetAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<
    "salvato" | "errore" | "da-correggere" | "periodo-cambiato" | null
  >(null);

  if (userId === undefined || caricati === null || attuali === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Caricamento...</p>
      </div>
    );
  }

  // Da qui in poi caricati e attuali ci sono sempre: copie locali non
  // nullable, per non ripetere il controllo in ogni funzione.
  const prima = caricati;
  const ora = attuali;
  const m = modifiche(prima, ora);

  function aggiorna(nuovi: ValoriModulo) {
    setAttuali(nuovi);
    // Appena si ricomincia a modificare, l'esito dell'ultimo Salva non vale
    // più.
    setEsito(null);
  }

  function aggiornaDati(campi: Partial<ValoriModulo["datiPersonali"]>) {
    aggiorna({ ...ora, datiPersonali: { ...ora.datiPersonali, ...campi } });
  }
  function aggiornaObiettivo(campi: Partial<ValoriModulo["obiettivo"]>) {
    aggiorna({ ...ora, obiettivo: { ...ora.obiettivo, ...campi } });
  }
  function aggiornaGiorni(campi: Partial<ValoriModulo["giorni"]>) {
    aggiorna({ ...ora, giorni: { ...ora.giorni, ...campi } });
  }

  function alternaGiorno(giorno: GiornoSettimana) {
    const attivi = ora.giorni.giorniAllenamento;
    aggiornaGiorni({
      giorniAllenamento: attivi.includes(giorno)
        ? attivi.filter((g) => g !== giorno)
        : [...attivi, giorno],
    });
  }

  // Riempie i quattro campi con una proposta calcolata: non salva niente
  // ("sempre e solo una proposta", sezione 3). Usa i dati personali SUL
  // MODULO, anche se non ancora salvati, e l'ultima pesata registrata.
  function calcolaProposta() {
    setErroreCalcolo(null);
    const dati = ora.datiPersonali;

    if (!ultimaPesata) return; // il pulsante è già disattivato
    if (dati.sesso === "non_indicato") {
      setErroreCalcolo(
        "Il calcolo automatico richiede di indicare il sesso, in Dati personali. Altrimenti scrivi i target a mano."
      );
      return;
    }
    const altezza = numeroDaCampo(dati.altezzaCm);
    if (!dati.dataNascita || Number.isNaN(altezza) || altezza <= 0 || !dati.livelloAttivita) {
      setErroreCalcolo(
        "Per calcolare una proposta servono data di nascita, altezza e livello di attività, in Dati personali."
      );
      return;
    }

    const proposta = calcolaFabbisogno({
      sesso: dati.sesso,
      eta: calcolaEta(dati.dataNascita),
      altezzaCm: altezza,
      pesoKg: ultimaPesata.valore,
      livelloAttivita: dati.livelloAttivita,
      tipoObiettivo: ora.obiettivo.tipo,
    });

    aggiornaObiettivo({
      target: {
        kcal: String(proposta.kcal),
        grassi: String(proposta.grassi),
        carboidrati: String(proposta.carboidrati),
        proteine: String(proposta.proteine),
      },
    });
  }

  function annullaModifiche() {
    setAttuali(prima);
    setErrori({});
    setErroreCalcolo(null);
    setEsito(null);
  }

  function avviaSalvataggio() {
    const erroriTrovati = validaModulo(ora, m, { profilo: profilo ?? null, periodo });
    setErrori(erroriTrovati);
    if (Object.keys(erroriTrovati).length > 0) {
      setEsito("da-correggere");
      return;
    }
    // La domanda "cambio vero o correzione?" solo se serve: al primo
    // inserimento, o se l'obiettivo non è cambiato, si salva direttamente.
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
    if (!userId) return;
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
          setEsito("salvato");
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
      console.error("Salvataggio del profilo non riuscito.", errore);
      setEsito("errore");
    } finally {
      setInCorso(false);
    }
  }

  const messaggioBarra =
    esito === "salvato"
      ? { testo: "Salvato.", avviso: false }
      : esito === "errore"
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

  const dp = { prima: prima.datiPersonali, ora: ora.datiPersonali };
  const ob = { prima: prima.obiettivo, ora: ora.obiettivo };
  const gi = { prima: prima.giorni, ora: ora.giorni };

  return (
    <>
      <IntestazioneProfilo
        nome={nome}
        pesoKg={ultimaPesata?.valore ?? null}
        altezzaCm={profilo?.altezza_cm ?? null}
      />

      <SezioneProfilo
        titolo="Dati personali"
        modificata={m.datiPersonali}
        errore={errori.datiPersonali}
      >
        <div>
          <span className="block text-sm font-medium mb-1">Sesso</span>
          <div className="flex gap-2">
            {OPZIONI_SESSO.map((opzione) => (
              <button
                key={opzione.valore}
                type="button"
                onClick={() => aggiornaDati({ sesso: opzione.valore })}
                aria-pressed={dp.ora.sesso === opzione.valore}
                className={classeScelta(dp.ora.sesso === opzione.valore)}
              >
                {opzione.etichetta}
              </button>
            ))}
          </div>
          <ValorePrecedente
            visibile={dp.prima.sesso !== dp.ora.sesso}
            valore={etichettaDi(OPZIONI_SESSO, dp.prima.sesso)}
          />
        </div>

        <div>
          <label htmlFor="profilo-data-nascita" className="block text-sm font-medium mb-1">
            Data di nascita
          </label>
          <input
            id="profilo-data-nascita"
            type="date"
            value={dp.ora.dataNascita}
            onChange={(e) => aggiornaDati({ dataNascita: e.target.value })}
            max={oggiLocale()}
            className={CLASSE_CAMPO}
          />
          <ValorePrecedente
            visibile={dp.prima.dataNascita !== dp.ora.dataNascita}
            valore={dp.prima.dataNascita ? formattaDataBreve(dp.prima.dataNascita) : ""}
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
            value={dp.ora.altezzaCm}
            onChange={(e) => aggiornaDati({ altezzaCm: e.target.value })}
            className={CLASSE_CAMPO}
          />
          <ValorePrecedente
            visibile={!numeriUguali(dp.prima.altezzaCm, dp.ora.altezzaCm)}
            valore={dp.prima.altezzaCm}
          />
        </div>

        <div>
          <label htmlFor="profilo-attivita" className="block text-sm font-medium mb-1">
            Livello di attività
          </label>
          <select
            id="profilo-attivita"
            value={dp.ora.livelloAttivita}
            onChange={(e) =>
              aggiornaDati({ livelloAttivita: e.target.value as LivelloAttivita | "" })
            }
            className={CLASSE_CAMPO}
          >
            <option value="">Non impostato</option>
            {OPZIONI_ATTIVITA.map((opzione) => (
              <option key={opzione.valore} value={opzione.valore}>
                {opzione.etichetta}
              </option>
            ))}
          </select>
          <ValorePrecedente
            visibile={dp.prima.livelloAttivita !== dp.ora.livelloAttivita}
            valore={etichettaDi(OPZIONI_ATTIVITA, dp.prima.livelloAttivita)}
          />
        </div>
      </SezioneProfilo>

      {userId && <RegistraPeso userId={userId} misurazioniPeso={misurazioniPeso ?? []} />}

      <SezioneProfilo titolo="Obiettivo" modificata={m.obiettivo} errore={errori.obiettivo}>
        <div>
          <span className="block text-sm font-medium mb-1">Obiettivo</span>
          <div className="flex gap-2">
            {OPZIONI_OBIETTIVO.map((opzione) => (
              <button
                key={opzione.valore}
                type="button"
                onClick={() => aggiornaObiettivo({ tipo: opzione.valore })}
                aria-pressed={ob.ora.tipo === opzione.valore}
                className={classeScelta(ob.ora.tipo === opzione.valore)}
              >
                {opzione.etichetta}
              </button>
            ))}
          </div>
          <ValorePrecedente
            visibile={ob.prima.tipo !== ob.ora.tipo}
            valore={etichettaDi(OPZIONI_OBIETTIVO, ob.prima.tipo)}
          />
        </div>

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
            value={ob.ora.pesoObiettivo}
            onChange={(e) => aggiornaObiettivo({ pesoObiettivo: e.target.value })}
            className={CLASSE_CAMPO}
          />
          <ValorePrecedente
            visibile={!numeriUguali(ob.prima.pesoObiettivo, ob.ora.pesoObiettivo)}
            valore={ob.prima.pesoObiettivo}
          />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={calcolaProposta}
            disabled={!ultimaPesata}
            className={`w-full rounded-lg border border-accent p-2 text-accent disabled:border-border disabled:text-muted ${CLASSE_FOCUS}`}
          >
            Calcola proposta
          </button>
          {!ultimaPesata && (
            <p className="text-sm text-muted">Registra prima il tuo peso, qui sopra.</p>
          )}
          {erroreCalcolo && <p className="text-sm text-warning">{erroreCalcolo}</p>}
        </div>

        <div>
          <span className="block text-xs font-medium uppercase tracking-wide text-muted mb-2">
            Target giornalieri
          </span>
          <div className="space-y-3">
            {CAMPI_TARGET.map((campo) => (
              <CampoTarget
                key={campo.chiave}
                id={`profilo-${campo.chiave}`}
                etichetta={campo.etichetta}
                valore={ob.ora.target[campo.chiave]}
                precedente={ob.prima.target[campo.chiave]}
                cambiato={!numeriUguali(ob.prima.target[campo.chiave], ob.ora.target[campo.chiave])}
                onChange={(valore) =>
                  aggiornaObiettivo({ target: { ...ob.ora.target, [campo.chiave]: valore } })
                }
              />
            ))}
          </div>
        </div>
      </SezioneProfilo>

      <SezioneProfilo
        titolo="Giorni differenziati"
        modificata={m.giorniProfilo || m.targetAllenamento}
        errore={errori.giorni}
      >
        <div>
          <button
            type="button"
            onClick={() => aggiornaGiorni({ differenzia: !gi.ora.differenzia })}
            aria-pressed={gi.ora.differenzia}
            className={`w-full ${classeScelta(gi.ora.differenzia)}`}
          >
            {gi.ora.differenzia ? "Attivi" : "Non attivi"}
          </button>
          <ValorePrecedente
            visibile={gi.prima.differenzia !== gi.ora.differenzia}
            valore={gi.prima.differenzia ? "Attivi" : "Non attivi"}
          />
          <p className="text-sm text-muted mt-1">
            Da spenti l&apos;app resta com&apos;è. Da accesi si sbloccano i giorni di allenamento
            proposti qui sotto e un secondo set di target.
          </p>
        </div>

        {gi.ora.differenzia && (
          <>
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
                    aria-pressed={gi.ora.giorniAllenamento.includes(opzione.valore)}
                    aria-label={opzione.nomeCompleto}
                    className={classeScelta(
                      gi.ora.giorniAllenamento.includes(opzione.valore),
                      "text-xs"
                    )}
                  >
                    {opzione.etichetta}
                  </button>
                ))}
              </div>
              <ValorePrecedente
                visibile={!giorniUguali(gi.prima.giorniAllenamento, gi.ora.giorniAllenamento)}
                valore={elencoGiorni(gi.prima.giorniAllenamento)}
              />
            </div>

            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-muted mb-2">
                Target giornalieri — Allenamento
              </span>
              <div className="space-y-3">
                {CAMPI_TARGET.map((campo) => (
                  <CampoTarget
                    key={campo.chiave}
                    id={`profilo-${campo.chiave}-allenamento`}
                    etichetta={campo.etichetta}
                    valore={gi.ora.targetAllenamento[campo.chiave]}
                    precedente={gi.prima.targetAllenamento[campo.chiave]}
                    cambiato={
                      !numeriUguali(
                        gi.prima.targetAllenamento[campo.chiave],
                        gi.ora.targetAllenamento[campo.chiave]
                      )
                    }
                    onChange={(valore) =>
                      aggiornaGiorni({
                        targetAllenamento: { ...gi.ora.targetAllenamento, [campo.chiave]: valore },
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </SezioneProfilo>

      <BarraSalvaProfilo
        sezioni={sezioni}
        inCorso={inCorso}
        messaggio={messaggioBarra}
        onAnnulla={annullaModifiche}
        onSalva={avviaSalvataggio}
      />

      {sheetAperto && periodo && (
        <SheetCambioObiettivo
          inizioPeriodo={periodo.valido_dal}
          limiti={limitiDataInizio(periodo, giornoCorrente)}
          inCorso={inCorso}
          errore={esito === "errore" ? "Salvataggio non riuscito. Riprova." : null}
          onAnnulla={() => setSheetAperto(false)}
          onConferma={(scelta) => void esegui(scelta)}
        />
      )}
    </>
  );
}
