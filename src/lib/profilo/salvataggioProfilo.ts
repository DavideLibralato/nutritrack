// Il Salva unico della pagina Profilo (PUNTO_DI_PARTENZA.md, sezione 3,
// "Profilo"): un solo pulsante per tutto il modulo, che scrive SOLO le
// tabelle delle sezioni cambiate rispetto ai valori caricati.
//
// Qui niente React: la pagina tiene due copie dei valori del modulo — quelli
// caricati da Dexie ("caricati") e quelli sullo schermo ("attuali") — e
// chiede a questo file tre cose:
//   1. quali sezioni sono cambiate (sezioniModificate);
//   2. se i valori sono salvabili (validaModulo) e se serve chiedere
//      "cambio vero o correzione?" (serveSceltaPeriodo, limitiDataInizio);
//   3. di scrivere (salvaProfilo).
// Separato dalla pagina perché è logica che sbaglia in silenzio (CLAUDE.md,
// test permanenti): un confronto sbagliato riscrive una tabella che l'utente
// non ha toccato, o apre un periodo nello storico obiettivi che non è mai
// esistito. Test in salvataggioProfilo.test.ts.
//
// Le tre sezioni e le tabelle che toccano:
//   - Dati personali      → profili (sesso, data di nascita, altezza, attività)
//   - Obiettivo           → obiettivi + obiettivi_target "normale"
//   - Giorni differenziati → profili (interruttore, giorni) + obiettivi_target
//                            "allenamento"
// Ordine delle scritture: profili → obiettivi → obiettivi_target (un target
// ha bisogno del suo periodo, non il contrario).

import {
  repositoryProfili,
  repositoryObiettivi,
  repositoryObiettiviTarget,
} from "../repository";
import { salvaTarget, targetPerTipo } from "../repository/obiettiviTarget";
import { giornoSuccessivo } from "../dataGiorno";
import { periodoInCorso } from "../totaliDiario";
import { TIPO_GIORNO_NORMALE, TIPO_GIORNO_ALLENAMENTO } from "../db/tipi";
import type {
  GiornoSettimana,
  LivelloAttivita,
  Obiettivo,
  ObiettivoTarget,
  Profilo,
  Sesso,
  TipoObiettivo,
} from "../db/tipi";

// --- I valori del modulo --------------------------------------------------
//
// Stringhe, come nei campi: "" vuol dire campo vuoto. La conversione in
// numeri avviene solo al salvataggio.

export interface ValoriTarget {
  kcal: string;
  grassi: string;
  carboidrati: string;
  proteine: string;
}

export interface ValoriModulo {
  datiPersonali: {
    sesso: Sesso;
    dataNascita: string;
    altezzaCm: string;
    livelloAttivita: LivelloAttivita | "";
  };
  obiettivo: {
    tipo: TipoObiettivo;
    pesoObiettivo: string;
    target: ValoriTarget;
  };
  giorni: {
    differenzia: boolean;
    giorniAllenamento: GiornoSettimana[];
    targetAllenamento: ValoriTarget;
  };
}

export type Sezione = keyof ValoriModulo;

export const ETICHETTE_SEZIONI: Record<Sezione, string> = {
  datiPersonali: "Dati personali",
  obiettivo: "Obiettivo",
  giorni: "Giorni differenziati",
};

const TARGET_VUOTO: ValoriTarget = { kcal: "", grassi: "", carboidrati: "", proteine: "" };

function targetDaRiga(riga: {
  kcal: number;
  proteine_g: number;
  carboidrati_g: number;
  grassi_g: number;
}): ValoriTarget {
  return {
    kcal: String(riga.kcal),
    grassi: String(riga.grassi_g),
    carboidrati: String(riga.carboidrati_g),
    proteine: String(riga.proteine_g),
  };
}

// I valori caricati, a partire da quello che c'è in Dexie. `periodo` è il
// periodo in corso (periodoInCorso in totaliDiario.ts), null se l'utente non
// ha ancora nessun obiettivo.
export function valoriDaDati(
  profilo: Profilo | null,
  periodo: Obiettivo | null,
  righeTarget: ObiettivoTarget[]
): ValoriModulo {
  const normale = periodo ? targetPerTipo(righeTarget, periodo.id, TIPO_GIORNO_NORMALE) : null;
  const allenamento = periodo
    ? targetPerTipo(righeTarget, periodo.id, TIPO_GIORNO_ALLENAMENTO)
    : null;

  // Il target "normale" si legge dalla sua riga in obiettivi_target (è
  // quella che usa Oggi); le colonne sulla riga di obiettivi restano il
  // ripiego per un periodo a cui la riga mancasse.
  const targetNormale = normale ? targetDaRiga(normale) : periodo ? targetDaRiga(periodo) : TARGET_VUOTO;

  return {
    datiPersonali: {
      sesso: profilo?.sesso ?? "non_indicato",
      dataNascita: profilo?.data_nascita ?? "",
      altezzaCm: profilo?.altezza_cm != null ? String(profilo.altezza_cm) : "",
      livelloAttivita: profilo?.livello_attivita ?? "",
    },
    obiettivo: {
      tipo: periodo?.tipo ?? "mantenere",
      pesoObiettivo: periodo?.peso_obiettivo != null ? String(periodo.peso_obiettivo) : "",
      target: targetNormale,
    },
    giorni: {
      // ?? false: un profilo locale salvato prima della versione 3 dello
      // schema Dexie può non avere il campo (vedi database.ts).
      differenzia: profilo?.differenzia_giorni ?? false,
      giorniAllenamento: profilo?.giorni_allenamento_default ?? [],
      // Senza una riga "allenamento" si parte dai valori del giorno normale:
      // una proposta da correggere, non un vincolo. Se l'utente non la
      // tocca, non viene scritta nessuna riga (e Oggi ripiega comunque su
      // "normale", con gli stessi numeri).
      targetAllenamento: allenamento ? targetDaRiga(allenamento) : targetNormale,
    },
  };
}

// --- Confronto ------------------------------------------------------------

// "Stringa" → numero, con la virgola accettata come separatore decimale.
// NaN per un campo vuoto o non numerico.
export function numeroDaCampo(valore: string): number {
  const pulito = valore.trim().replace(",", ".");
  return pulito === "" ? NaN : Number(pulito);
}

// Due valori numerici sono uguali se lo sono come numeri ("2500" e "2500.0"),
// altrimenti se sono uguali come testo (due campi vuoti). Senza questo,
// riscrivere lo stesso numero in un altro modo segnerebbe la sezione come
// modificata.
export function numeriUguali(a: string, b: string): boolean {
  const na = numeroDaCampo(a);
  const nb = numeroDaCampo(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  return a.trim() === b.trim();
}

function targetUguali(a: ValoriTarget, b: ValoriTarget): boolean {
  return (
    numeriUguali(a.kcal, b.kcal) &&
    numeriUguali(a.grassi, b.grassi) &&
    numeriUguali(a.carboidrati, b.carboidrati) &&
    numeriUguali(a.proteine, b.proteine)
  );
}

// I giorni sono un insieme: l'ordine dei tocchi non conta.
export function giorniUguali(a: GiornoSettimana[], b: GiornoSettimana[]): boolean {
  return a.length === b.length && a.every((g) => b.includes(g));
}

// Le parti di ogni sezione. Servono separate perché "Giorni differenziati"
// tocca due tabelle diverse, e solo una delle due può essere cambiata.
export interface Modifiche {
  datiPersonali: boolean;
  obiettivo: boolean;
  // Interruttore e giorni della settimana (tabella profili).
  giorniProfilo: boolean;
  // Target "allenamento" (tabella obiettivi_target). Conta solo se la
  // differenziazione resta accesa: da spenta i campi sono nascosti, e un
  // valore ritoccato prima di spegnerla non si salva.
  targetAllenamento: boolean;
}

export function modifiche(caricati: ValoriModulo, attuali: ValoriModulo): Modifiche {
  const dp = { a: caricati.datiPersonali, b: attuali.datiPersonali };
  const ob = { a: caricati.obiettivo, b: attuali.obiettivo };
  const gi = { a: caricati.giorni, b: attuali.giorni };

  return {
    datiPersonali:
      dp.a.sesso !== dp.b.sesso ||
      dp.a.dataNascita !== dp.b.dataNascita ||
      !numeriUguali(dp.a.altezzaCm, dp.b.altezzaCm) ||
      dp.a.livelloAttivita !== dp.b.livelloAttivita,
    obiettivo:
      ob.a.tipo !== ob.b.tipo ||
      !numeriUguali(ob.a.pesoObiettivo, ob.b.pesoObiettivo) ||
      !targetUguali(ob.a.target, ob.b.target),
    // Da spenta i giorni della settimana sono nascosti: conta solo
    // l'interruttore.
    giorniProfilo:
      gi.a.differenzia !== gi.b.differenzia ||
      (gi.b.differenzia && !giorniUguali(gi.a.giorniAllenamento, gi.b.giorniAllenamento)),
    targetAllenamento:
      gi.b.differenzia && !targetUguali(gi.a.targetAllenamento, gi.b.targetAllenamento),
  };
}

export function sezioniModificate(caricati: ValoriModulo, attuali: ValoriModulo): Sezione[] {
  const m = modifiche(caricati, attuali);
  const sezioni: Sezione[] = [];
  if (m.datiPersonali) sezioni.push("datiPersonali");
  if (m.obiettivo) sezioni.push("obiettivo");
  if (m.giorniProfilo || m.targetAllenamento) sezioni.push("giorni");
  return sezioni;
}

// --- Cambio vero o correzione ---------------------------------------------

// La domanda "cambio vero o correzione?" serve solo se è cambiato un target
// del periodo (normale o allenamento) o l'obiettivo, E un periodo esiste
// già. Al primo inserimento non c'è storia da preservare: si crea il primo
// periodo e basta.
export function serveSceltaPeriodo(m: Modifiche, periodo: Obiettivo | null): boolean {
  return periodo !== null && (m.obiettivo || m.targetAllenamento);
}

// Le date ammesse per l'inizio di un periodo nuovo ("È un cambio vero").
//   - Massimo: il giorno corrente (il giorno logico, come in Oggi). Un
//     periodo che parte domani non sarebbe il periodo in corso: dopo il
//     Salva la pagina tornerebbe a mostrare i valori vecchi.
//   - Minimo: il giorno DOPO l'inizio del periodo in corso. Prima non
//     funzionerebbe (il periodo nuovo coprirebbe solo i giorni fino al
//     vecchio, e da oggi resterebbe valido quello vecchio); lo stesso giorno
//     lascerebbe il periodo vecchio senza nemmeno un giorno di validità — una
//     correzione travestita da cambio.
// null se nessuna data è ammessa: il periodo in corso è iniziato oggi, e si
// può solo correggerlo.
export function limitiDataInizio(
  periodo: Obiettivo,
  giornoCorrente: string
): { min: string; max: string } | null {
  const min = giornoSuccessivo(periodo.valido_dal);
  return min <= giornoCorrente ? { min, max: giornoCorrente } : null;
}

export type SceltaPeriodo =
  | { tipo: "nuovo"; validoDal: string }
  | { tipo: "correzione" };

// --- Validazione ----------------------------------------------------------

export type ErroriModulo = Partial<Record<Sezione, string>>;

function targetValido(t: ValoriTarget): boolean {
  return [t.kcal, t.grassi, t.carboidrati, t.proteine].every((v) => {
    const n = numeroDaCampo(v);
    return !Number.isNaN(n) && n >= 0;
  });
}

// Controlla solo le sezioni che verranno scritte: un campo vuoto in una
// sezione non toccata non blocca il salvataggio delle altre.
export function validaModulo(
  attuali: ValoriModulo,
  m: Modifiche,
  contesto: { profilo: Profilo | null; periodo: Obiettivo | null }
): ErroriModulo {
  const errori: ErroriModulo = {};
  const scriveProfilo = m.datiPersonali || m.giorniProfilo;

  // livello_attivita è NOT NULL su Supabase: senza, il salvataggio locale
  // "riuscirebbe" e la sync fallirebbe in silenzio dopo. Serve anche quando
  // si crea il profilo dalla sola sezione "Giorni differenziati": l'app non
  // inventa un livello di attività al posto dell'utente.
  if (scriveProfilo && !attuali.datiPersonali.livelloAttivita) {
    errori.datiPersonali = "Seleziona il livello di attività.";
  } else if (m.datiPersonali) {
    const altezza = attuali.datiPersonali.altezzaCm;
    const n = numeroDaCampo(altezza);
    if (altezza.trim() !== "" && (Number.isNaN(n) || n <= 0 || n > 280)) {
      errori.datiPersonali = "L'altezza deve essere un numero di centimetri fra 1 e 280.";
    }
  }

  if (m.obiettivo) {
    const peso = attuali.obiettivo.pesoObiettivo;
    const n = numeroDaCampo(peso);
    if (!targetValido(attuali.obiettivo.target)) {
      errori.obiettivo = "Calorie e macro devono essere numeri, zero o più.";
    } else if (peso.trim() !== "" && (Number.isNaN(n) || n <= 0)) {
      errori.obiettivo = "Il peso obiettivo deve essere un numero maggiore di zero.";
    }
  }

  if (m.targetAllenamento) {
    if (!targetValido(attuali.giorni.targetAllenamento)) {
      errori.giorni = "Calorie e macro dei giorni di allenamento devono essere numeri, zero o più.";
    } else if (!contesto.periodo && !m.obiettivo) {
      // I target di allenamento appartengono a un periodo, e il primo
      // periodo nasce dai target della sezione Obiettivo.
      errori.giorni = "Compila anche i target giornalieri nella sezione Obiettivo.";
    }
  }

  return errori;
}

// --- Scrittura ------------------------------------------------------------

function targetNumerico(t: ValoriTarget) {
  // Math.round: su Supabase le colonne sono integer — un decimale farebbe
  // fallire la sync, non solo la nostra validazione.
  return {
    kcal: Math.round(numeroDaCampo(t.kcal)),
    proteine_g: Math.round(numeroDaCampo(t.proteine)),
    carboidrati_g: Math.round(numeroDaCampo(t.carboidrati)),
    grassi_g: Math.round(numeroDaCampo(t.grassi)),
  };
}

function numeroONull(valore: string): number | null {
  const n = numeroDaCampo(valore);
  return Number.isNaN(n) ? null : n;
}

// I valori come li vedrà il modulo dopo il salvataggio (numeri arrotondati,
// virgola → punto): la pagina li usa come nuovi "caricati" e come nuovi
// valori dei campi, così dopo il Salva la barra torna inerte.
export function normalizza(v: ValoriModulo): ValoriModulo {
  const t = (x: ValoriTarget): ValoriTarget => {
    const n = targetNumerico(x);
    return targetValido(x)
      ? {
          kcal: String(n.kcal),
          grassi: String(n.grassi_g),
          carboidrati: String(n.carboidrati_g),
          proteine: String(n.proteine_g),
        }
      : x;
  };
  const numero = (s: string) => {
    const n = numeroDaCampo(s);
    return Number.isNaN(n) ? s : String(n);
  };
  return {
    datiPersonali: { ...v.datiPersonali, altezzaCm: numero(v.datiPersonali.altezzaCm) },
    obiettivo: {
      ...v.obiettivo,
      pesoObiettivo: numero(v.obiettivo.pesoObiettivo),
      target: t(v.obiettivo.target),
    },
    giorni: { ...v.giorni, targetAllenamento: t(v.giorni.targetAllenamento) },
  };
}

// I nuovi "caricati" dopo un Salva riuscito: i valori del modulo
// normalizzati, tranne i campi dei giorni di allenamento quando la
// differenziazione è spenta — erano nascosti e non sono stati scritti,
// quindi restano quelli di prima (riaccendendo si ritrovano i valori salvati,
// non un ritocco mai salvato).
export function dopoSalvataggio(caricati: ValoriModulo, attuali: ValoriModulo): ValoriModulo {
  const n = normalizza(attuali);
  if (attuali.giorni.differenzia) return n;
  return {
    ...n,
    giorni: {
      differenzia: false,
      giorniAllenamento: caricati.giorni.giorniAllenamento,
      targetAllenamento: caricati.giorni.targetAllenamento,
    },
  };
}

// --- Scrittura: decisioni sempre su Dexie riletto ---------------------------
//
// Crea-o-aggiorna, il periodo in corso e i limiti della data si decidono
// rileggendo Dexie QUI DENTRO, mai da uno stato React della pagina
// (useLiveQuery) che può essere indietro di un giro di ridisegno: con uno
// stato vecchio si creerebbe un secondo profilo, o salvaTarget una seconda
// riga "normale". Stessa regola di salvaPastoComeComposizione
// (src/lib/repository/composizioni.ts).
//
// Dalla pagina arrivano solo i valori del modulo, il giorno corrente, la
// scelta dell'utente e — per riconoscere un cambiamento arrivato nel
// frattempo — l'id del periodo che l'utente aveva davanti.

export interface RichiestaSalvataggio {
  userId: string;
  caricati: ValoriModulo;
  attuali: ValoriModulo;
  // Il giorno logico corrente: data del primo periodo e limite massimo di
  // un periodo nuovo.
  giornoCorrente: string;
  // L'id del periodo in corso che la pagina mostrava quando l'utente ha
  // premuto Salva (e risposto alla domanda, se c'era). null se non ne
  // mostrava nessuno (primo inserimento).
  periodoVistoId: string | null;
  // Obbligatoria se serveSceltaPeriodo è vera, ignorata altrimenti.
  scelta: SceltaPeriodo | null;
}

export type EsitoSalvataggioProfilo =
  | { esito: "salvato"; sezioni: Sezione[] }
  // I dati riletti non permettono il salvataggio (per esempio: la pagina
  // credeva che il profilo esistesse, Dexie dice di no, e manca il livello
  // di attività). Niente è stato scritto.
  | { esito: "da-correggere"; errori: ErroriModulo }
  // Il periodo in corso non è più quello che l'utente aveva davanti
  // (arrivato da un altro dispositivo, o cambiato giorno). Niente è stato
  // scritto: la risposta "cambio vero / correzione" valeva per un altro
  // periodo. `caricati` sono i valori riletti, per ribasare il modulo
  // (ribasaModulo) e far ripetere il Salva.
  | { esito: "periodo-cambiato"; caricati: ValoriModulo };

interface StatoLocale {
  profilo: Profilo | null;
  periodo: Obiettivo | null;
  righeTarget: ObiettivoTarget[];
}

async function leggiStatoLocale(userId: string, giornoCorrente: string): Promise<StatoLocale> {
  const [profili, obiettivi, righeTarget] = await Promise.all([
    repositoryProfili.ottieniTutti(userId),
    repositoryObiettivi.ottieniTutti(userId),
    repositoryObiettiviTarget.ottieniTutti(userId),
  ]);
  return {
    profilo: profili[0] ?? null,
    periodo: periodoInCorso(obiettivi, giornoCorrente),
    righeTarget,
  };
}

// Scrive le sezioni cambiate, in quest'ordine: profili → obiettivi →
// obiettivi_target. Controlli prima di scrivere, voluti in quest'ordine:
// 1. se tocca obiettivo o target e il periodo in corso riletto non è quello
//    visto → "periodo-cambiato";
// 2. validazione sui dati riletti → "da-correggere";
// 3. si scrive.
// Un'eccezione resta solo per gli errori di programmazione (scelta mancante
// quando serve, data fuori dai limiti): la pagina non deve poterli produrre.
export async function salvaProfilo(r: RichiestaSalvataggio): Promise<EsitoSalvataggioProfilo> {
  const m = modifiche(r.caricati, r.attuali);
  const stato = await leggiStatoLocale(r.userId, r.giornoCorrente);
  const toccaPeriodo = m.obiettivo || m.targetAllenamento;

  if (toccaPeriodo && (stato.periodo?.id ?? null) !== r.periodoVistoId) {
    return {
      esito: "periodo-cambiato",
      caricati: valoriDaDati(stato.profilo, stato.periodo, stato.righeTarget),
    };
  }

  const errori = validaModulo(r.attuali, m, stato);
  if (Object.keys(errori).length > 0) return { esito: "da-correggere", errori };

  if (toccaPeriodo && stato.periodo) {
    if (!r.scelta) {
      throw new Error("Obiettivo cambiato: serve la scelta fra cambio vero e correzione.");
    }
    if (r.scelta.tipo === "nuovo") {
      const limiti = limitiDataInizio(stato.periodo, r.giornoCorrente);
      if (!limiti || r.scelta.validoDal < limiti.min || r.scelta.validoDal > limiti.max) {
        throw new Error(`Data d'inizio fuori dai limiti: ${r.scelta.validoDal}.`);
      }
    }
  }

  // 1. profili: un solo aggiorna con i campi di entrambe le sezioni che lo
  //    toccano, solo quelli cambiati.
  if (m.datiPersonali || m.giorniProfilo) {
    await scriviProfilo(r, stato, m);
  }

  // 2 e 3. obiettivi e obiettivi_target.
  if (toccaPeriodo) {
    if (!stato.periodo) {
      await creaPeriodo(r, stato, r.giornoCorrente);
    } else if (r.scelta?.tipo === "nuovo") {
      await creaPeriodo(r, stato, r.scelta.validoDal);
    } else {
      await correggiPeriodo(r, stato, stato.periodo, m);
    }
  }

  return { esito: "salvato", sezioni: sezioniModificate(r.caricati, r.attuali) };
}

async function scriviProfilo(r: RichiestaSalvataggio, stato: StatoLocale, m: Modifiche) {
  const { attuali } = r;
  const campi: Partial<Profilo> = {};
  if (m.datiPersonali) {
    campi.sesso = attuali.datiPersonali.sesso;
    campi.data_nascita = attuali.datiPersonali.dataNascita || null;
    campi.altezza_cm = numeroONull(attuali.datiPersonali.altezzaCm);
    campi.livello_attivita = attuali.datiPersonali.livelloAttivita as LivelloAttivita;
  }
  if (m.giorniProfilo) {
    campi.differenzia_giorni = attuali.giorni.differenzia;
    // Da spenta i giorni restano quelli di prima: riaccendendo, si
    // ritrova il proprio pattern.
    if (attuali.giorni.differenzia) {
      campi.giorni_allenamento_default =
        attuali.giorni.giorniAllenamento.length > 0 ? attuali.giorni.giorniAllenamento : null;
    }
  }

  if (stato.profilo) {
    await repositoryProfili.aggiorna(stato.profilo.id, campi);
    return;
  }

  // Profilo nuovo: i campi non toccati prendono i valori del modulo, che
  // per un profilo inesistente sono quelli iniziali.
  await repositoryProfili.crea({
    user_id: r.userId,
    nome: null,
    sesso: attuali.datiPersonali.sesso,
    data_nascita: attuali.datiPersonali.dataNascita || null,
    altezza_cm: numeroONull(attuali.datiPersonali.altezzaCm),
    livello_attivita: attuali.datiPersonali.livelloAttivita as LivelloAttivita,
    differenzia_giorni: attuali.giorni.differenzia,
    giorni_allenamento_default:
      attuali.giorni.differenzia && attuali.giorni.giorniAllenamento.length > 0
        ? attuali.giorni.giorniAllenamento
        : null,
    ...campi,
  });
}

// Un periodo nuovo in obiettivi, con la sua riga "normale" (esiste sempre
// per costruzione, sezione 4) e — se la differenziazione è accesa, o il
// periodo precedente aveva già dei target di allenamento — la sua riga
// "allenamento". Così un cambio d'obiettivo non lascia più i giorni di
// allenamento senza target fino al prossimo salvataggio a mano (il ripiego
// descritto in sezione 4 resta, ma non nasce più da qui).
async function creaPeriodo(
  r: RichiestaSalvataggio,
  stato: StatoLocale,
  validoDal: string
): Promise<void> {
  const { attuali } = r;
  const normale = targetNumerico(attuali.obiettivo.target);

  const periodo = await repositoryObiettivi.crea({
    user_id: r.userId,
    valido_dal: validoDal,
    tipo: attuali.obiettivo.tipo,
    ...normale,
    peso_obiettivo: numeroONull(attuali.obiettivo.pesoObiettivo),
  });

  await repositoryObiettiviTarget.crea({
    user_id: r.userId,
    obiettivo_id: periodo.id,
    tipo_giorno: TIPO_GIORNO_NORMALE,
    ...normale,
  });

  const allenamentoPrecedente = stato.periodo
    ? targetPerTipo(stato.righeTarget, stato.periodo.id, TIPO_GIORNO_ALLENAMENTO)
    : null;
  if (attuali.giorni.differenzia || allenamentoPrecedente) {
    // Da spenta, i campi allenamento sono nascosti e valgono quelli caricati
    // (un ritocco fatto prima di spegnere non si salva).
    const sorgente = attuali.giorni.differenzia
      ? attuali.giorni.targetAllenamento
      : r.caricati.giorni.targetAllenamento;
    await repositoryObiettiviTarget.crea({
      user_id: r.userId,
      obiettivo_id: periodo.id,
      tipo_giorno: TIPO_GIORNO_ALLENAMENTO,
      ...targetNumerico(sorgente),
    });
  }
}

// "Avevo sbagliato a inserirlo": aggiorna il periodo in corso, senza
// crearne uno nuovo. valido_dal non cambia; i target corretti valgono per
// tutti i giorni del periodo, anche quelli passati — è il significato di
// "correzione". Si tocca solo ciò che è cambiato; gli altri tipi di giorno
// (un eventuale terzo set) restano come sono.
async function correggiPeriodo(
  r: RichiestaSalvataggio,
  stato: StatoLocale,
  periodo: Obiettivo,
  m: Modifiche
): Promise<void> {
  const { attuali } = r;

  if (m.obiettivo) {
    const normale = targetNumerico(attuali.obiettivo.target);
    // Le colonne kcal/macro su obiettivi restano allineate al target
    // "normale" (vedi il commento sul tipo Obiettivo in tipi.ts).
    await repositoryObiettivi.aggiorna(periodo.id, {
      tipo: attuali.obiettivo.tipo,
      ...normale,
      peso_obiettivo: numeroONull(attuali.obiettivo.pesoObiettivo),
    });
    await salvaTarget(r.userId, periodo.id, TIPO_GIORNO_NORMALE, normale, stato.righeTarget);
  }

  if (m.targetAllenamento) {
    await salvaTarget(
      r.userId,
      periodo.id,
      TIPO_GIORNO_ALLENAMENTO,
      targetNumerico(attuali.giorni.targetAllenamento),
      stato.righeTarget
    );
  }
}

// --- Dopo un "periodo-cambiato" -------------------------------------------

function uguali(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return giorniUguali(a as GiornoSettimana[], b as GiornoSettimana[]);
  }
  if (typeof a === "string" && typeof b === "string") return numeriUguali(a, b);
  return a === b;
}

// Il modulo ribasato sui valori riletti, campo per campo: dove l'utente non
// aveva toccato niente (attuale uguale al vecchio caricato) prende il valore
// nuovo — arrivato da un altro dispositivo, non va riportato indietro dal
// prossimo Salva; dove l'aveva toccato, resta il suo valore. Come un
// "rebase" di git: le modifiche dell'utente, riapplicate sopra lo stato nuovo.
export function ribasaModulo(
  vecchiCaricati: ValoriModulo,
  nuoviCaricati: ValoriModulo,
  attuali: ValoriModulo
): ValoriModulo {
  function ribasa<T extends object>(vecchio: T, nuovo: T, attuale: T): T {
    const risultato = { ...attuale };
    for (const chiave of Object.keys(attuale) as (keyof T)[]) {
      const v = vecchio[chiave];
      const n = nuovo[chiave];
      const a = attuale[chiave];
      if (a !== null && typeof a === "object" && !Array.isArray(a)) {
        risultato[chiave] = ribasa(v as object, n as object, a as object) as T[keyof T];
      } else if (uguali(a, v)) {
        risultato[chiave] = n;
      }
    }
    return risultato;
  }
  return ribasa(vecchiCaricati, nuoviCaricati, attuali);
}
