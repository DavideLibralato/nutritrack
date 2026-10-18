// I passi dell'onboarding fuori dall'interfaccia (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"): quando un passo è completo, come si salva, da
// quali valori partono i campi. La pagina (src/app/onboarding/page.tsx) e i
// componenti dei passi mostrano e raccolgono; qui le regole, con le stesse
// funzioni di Impostazioni > Profilo e > Peso, senza copiarle.

import { repositoryObiettivi, repositoryObiettiviTarget, repositoryProfili } from "../repository";
import { oggiLocale } from "../dataGiorno";
import { periodoInCorso } from "../totaliDiario";
import { numeroPerCampo } from "../numeriDecimali";
import {
  salvaProfilo,
  validaModulo,
  valoriDaDati,
  type EsitoSalvataggioProfilo,
  type ValoriModulo,
  type ValoriTarget,
} from "../profilo/salvataggioProfilo";
import { leggiPesoKg } from "../profilo/letturaPeso";
import { propostaObiettivi } from "../profilo/propostaObiettivi";
import { ultimaMisurazione } from "../repository/misurazioni";
import { AGGIUSTAMENTO_KCAL_OBIETTIVO } from "../fabbisogno";
import type { LivelloAttivita, Misurazione, Profilo, Sesso, TipoObiettivo } from "../db/tipi";

// --- Passo 2, "Parlami un po' di te" ----------------------------------------

// Come i dati personali del modulo di Profilo, ma con il sesso che può non
// essere ancora scelto: nell'onboarding si parte senza scelta.
export interface ValoriSuDiTe {
  sesso: Sesso | null;
  dataNascita: string;
  altezzaCm: string;
  livelloAttivita: LivelloAttivita | "";
}

export const SU_DI_TE_VUOTO: ValoriSuDiTe = {
  sesso: null,
  dataNascita: "",
  altezzaCm: "",
  livelloAttivita: "",
};

const SOLO_DATI_PERSONALI = {
  datiPersonali: true,
  obiettivo: false,
  giorniProfilo: false,
  targetAllenamento: false,
};

// I quattro campi pieni e validi. In Profilo data di nascita e altezza si
// possono lasciare vuote; qui no, servono tutte e due al passo 5. I controlli
// sui valori (altezza fra 1 e 280, livello di attività) sono quelli di
// validaModulo, chiamata come la chiama il Salva di Profilo.
export function suDiTeCompleto(valori: ValoriSuDiTe): boolean {
  if (!valori.sesso || !valori.dataNascita || valori.altezzaCm.trim() === "" || !valori.livelloAttivita) {
    return false;
  }
  const attuali: ValoriModulo = {
    ...valoriDaDati(null, null, []),
    datiPersonali: { ...valori, sesso: valori.sesso },
  };
  return Object.keys(validaModulo(attuali, SOLO_DATI_PERSONALI, { profilo: null, periodo: null })).length === 0;
}

// Avanti del passo 2: salvaProfilo con la sola sezione "Dati personali", con
// i valori caricati riletti adesso da Dexie (come fa useModuloImpostazioni
// all'apertura di Profilo). salvaProfilo rilegge Dexie da sola per decidere
// se creare o aggiornare il profilo. Lancia se la scrittura fallisce.
export async function salvaSuDiTe(userId: string, valori: ValoriSuDiTe): Promise<EsitoSalvataggioProfilo> {
  if (!valori.sesso) throw new Error("Passo 2: il sesso non è scelto.");
  const giornoCorrente = oggiLocale();
  const [profili, obiettivi, righeTarget] = await Promise.all([
    repositoryProfili.ottieniTutti(userId),
    repositoryObiettivi.ottieniTutti(userId),
    repositoryObiettiviTarget.ottieniTutti(userId),
  ]);
  const periodo = periodoInCorso(obiettivi, giornoCorrente);
  const caricati = valoriDaDati(profili[0] ?? null, periodo, righeTarget);
  return salvaProfilo({
    userId,
    caricati,
    attuali: { ...caricati, datiPersonali: { ...valori, sesso: valori.sesso } },
    giornoCorrente,
    periodoVistoId: periodo?.id ?? null,
    scelta: null,
  });
}

// I campi del passo 2 all'apertura: dal profilo, se c'è (salvato con Avanti
// in questo onboarding); altrimenti vuoti, sesso compreso.
export function suDiTeIniziale(profilo: Profilo | null): ValoriSuDiTe {
  if (!profilo || profilo.deleted_at !== null) return SU_DI_TE_VUOTO;
  return {
    sesso: profilo.sesso,
    dataNascita: profilo.data_nascita ?? "",
    // Come la scrive Profilo ("172,5"), con la stessa funzione.
    altezzaCm: valoriDaDati(profilo, null, []).datiPersonali.altezzaCm,
    livelloAttivita: profilo.livello_attivita ?? "",
  };
}

// --- Passo 3, "Quanto pesi oggi?" -------------------------------------------

// Il peso da registrare, arrotondato a un decimale come "Registra peso", o
// null se il campo non è un peso valido. L'arrotondamento lo fa leggiPesoKg.
export function pesoDaRegistrare(valore: string): number | null {
  return leggiPesoKg(valore);
}

// Il campo del passo 3 all'apertura: la pesata di oggi, se c'è, con la
// virgola ("78,4"); altrimenti vuoto.
export function pesoIniziale(misurazioni: Misurazione[], giorno: string = oggiLocale()): string {
  const diOggi = misurazioni.find((m) => m.tipo === "peso" && m.data === giorno && m.deleted_at === null);
  return diOggi ? numeroPerCampo(diOggi.valore, 1) : "";
}

// --- Passo 4, "Cosa vuoi ottenere?" -------------------------------------------

// La riga sotto ogni obiettivo, dai numeri di calcolaFabbisogno
// (AGGIUSTAMENTO_KCAL_OBIETTIVO): "Circa 500 kcal sotto il tuo fabbisogno".
export function descrizioneObiettivo(tipo: TipoObiettivo): string {
  const kcal = AGGIUSTAMENTO_KCAL_OBIETTIVO[tipo];
  if (kcal < 0) return `Circa ${-kcal} kcal sotto il tuo fabbisogno`;
  if (kcal > 0) return `Circa ${kcal} kcal sopra il tuo fabbisogno`;
  return "Quanto consumi in una giornata normale";
}

// Un obiettivo scelto (si parte senza scelta) e il peso obiettivo vuoto,
// perché è facoltativo, o valido come una pesata (leggiPesoKg).
export function obiettivoCompleto(tipo: TipoObiettivo | null, pesoObiettivo: string): boolean {
  return tipo !== null && (pesoObiettivo.trim() === "" || leggiPesoKg(pesoObiettivo) !== null);
}

// --- Passo 5, "I tuoi obiettivi giornalieri" ----------------------------------

export const TARGET_VUOTO: ValoriTarget = { kcal: "", grassi: "", carboidrati: "", proteine: "" };

const SOLO_OBIETTIVO = {
  datiPersonali: false,
  obiettivo: true,
  giorniProfilo: false,
  targetAllenamento: false,
};

// I quattro numeri validi: gli stessi controlli del Salva di Obiettivi
// (validaModulo), quindi numeri, zero o più. Il peso obiettivo qui non
// conta: l'ha già controllato il passo 4.
export function targetCompleti(target: ValoriTarget): boolean {
  const base = valoriDaDati(null, null, []);
  const attuali: ValoriModulo = { ...base, obiettivo: { ...base.obiettivo, pesoObiettivo: "", target } };
  return Object.keys(validaModulo(attuali, SOLO_OBIETTIVO, { profilo: null, periodo: null })).length === 0;
}

// La proposta del passo 5 (propostaObiettivi, la stessa di "Calcola
// proposta"), dal profilo e dall'ultima pesata salvati e dall'obiettivo
// scelto al passo 4. Come i campi del modulo: stringhe.
export type PropostaPasso5 =
  | { esito: "proposta"; target: ValoriTarget }
  | { esito: "sesso-non-indicato" }
  | { esito: "dati-mancanti" };

export function propostaPasso5(
  profilo: Profilo | null,
  misurazioni: Misurazione[],
  tipo: TipoObiettivo
): PropostaPasso5 {
  const pesata = ultimaMisurazione(misurazioni.filter((m) => m.tipo === "peso" && m.deleted_at === null));
  const esito = propostaObiettivi(valoriDaDati(profilo, null, []).datiPersonali, pesata?.valore ?? null, tipo);
  if (esito.esito === "proposta") {
    const p = esito.proposta;
    return {
      esito: "proposta",
      target: {
        kcal: String(p.kcal),
        grassi: String(p.grassi),
        carboidrati: String(p.carboidrati),
        proteine: String(p.proteine),
      },
    };
  }
  return esito.esito === "sesso-non-indicato" ? esito : { esito: "dati-mancanti" };
}

// I numeri del passo 5: quelli scritti dall'utente se li ha toccati
// (`manuali` non null), altrimenti la proposta, altrimenti vuoti. Una regola
// sola per quello che si vede e quello che si salva.
export function targetDelPasso5(proposta: PropostaPasso5, manuali: ValoriTarget | null): ValoriTarget {
  return manuali ?? (proposta.esito === "proposta" ? proposta.target : TARGET_VUOTO);
}

// "Inizia a usare Libra": salvaProfilo con la sola sezione obiettivo (tipo,
// peso obiettivo, target "normale"), come il primo inserimento in
// Obiettivi: nessuna domanda "cambio vero o correzione". Il periodo visto è
// sempre nessuno, perché l'onboarding esiste solo senza obiettivi: se nel
// frattempo ne è arrivato uno da un altro dispositivo, salvaProfilo risponde
// "periodo-cambiato" e non scrive niente. Lancia se la scrittura fallisce.
export async function salvaObiettivo(
  userId: string,
  obiettivo: ValoriModulo["obiettivo"]
): Promise<EsitoSalvataggioProfilo> {
  const giornoCorrente = oggiLocale();
  const [profili, obiettivi, righeTarget] = await Promise.all([
    repositoryProfili.ottieniTutti(userId),
    repositoryObiettivi.ottieniTutti(userId),
    repositoryObiettiviTarget.ottieniTutti(userId),
  ]);
  const caricati = valoriDaDati(profili[0] ?? null, periodoInCorso(obiettivi, giornoCorrente), righeTarget);
  return salvaProfilo({
    userId,
    caricati,
    attuali: { ...caricati, obiettivo },
    giornoCorrente,
    periodoVistoId: null,
    scelta: null,
  });
}
