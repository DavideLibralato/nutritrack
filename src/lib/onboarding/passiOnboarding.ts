// I passi dell'onboarding fuori dall'interfaccia (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"): quando un passo è completo, come si salva, da
// quali valori partono i campi. La pagina (src/app/onboarding/page.tsx) e i
// componenti dei passi mostrano e raccolgono; qui le regole, con le stesse
// funzioni di Impostazioni > Profilo e > Peso, senza copiarle.

import { repositoryObiettivi, repositoryObiettiviTarget, repositoryProfili } from "../repository";
import { oggiLocale } from "../dataGiorno";
import { periodoInCorso } from "../totaliDiario";
import {
  salvaProfilo,
  validaModulo,
  valoriDaDati,
  type EsitoSalvataggioProfilo,
  type ValoriModulo,
} from "../profilo/salvataggioProfilo";
import { leggiPesoKg } from "../profilo/letturaPeso";
import type { LivelloAttivita, Misurazione, Profilo, Sesso } from "../db/tipi";

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
    altezzaCm: profilo.altezza_cm != null ? String(profilo.altezza_cm) : "",
    livelloAttivita: profilo.livello_attivita ?? "",
  };
}

// --- Passo 3, "Quanto pesi oggi?" -------------------------------------------

// Il peso da registrare, arrotondato a un decimale come "Registra peso", o
// null se il campo non è un peso valido (leggiPesoKg).
export function pesoDaRegistrare(valore: string): number | null {
  const kg = leggiPesoKg(valore);
  return kg === null ? null : Math.round(kg * 10) / 10;
}

// Il campo del passo 3 all'apertura: la pesata di oggi, se c'è, con la
// virgola ("78,4"); altrimenti vuoto.
export function pesoIniziale(misurazioni: Misurazione[], giorno: string = oggiLocale()): string {
  const diOggi = misurazioni.find((m) => m.tipo === "peso" && m.data === giorno && m.deleted_at === null);
  return diOggi ? diOggi.valore.toLocaleString("it-IT", { maximumFractionDigits: 1, useGrouping: false }) : "";
}
