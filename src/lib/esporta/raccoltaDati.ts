// La raccolta dei dati per il file JSON (PUNTO_DI_PARTENZA.md §10.4,
// "Esporta i miei dati"). Due pezzi:
// - costruisciEsportazione: funzione pura. Riceve TUTTE le righe delle
//   tabelle di Dexie, anche di altri utenti e anche cancellate, e decide
//   cosa entra nel file. Tutte le regole stanno qui, così i test le
//   provano senza database;
// - raccogliEsportazione: legge Dexie in una transazione sola (una
//   fotografia coerente, senza scritture che si infilano a metà) e chiama
//   la prima. Prima controlla che la copia locale sia completa
//   (copiaLocaleCompleta, il segno "discesa completa"): senza, non parte.
//
// Le regole:
// - solo righe dell'utente e solo righe vive (deleted_at null);
// - le 7 foreign key fra le tabelle su Supabase decidono il resto: ogni
//   riferimento di una riga esportata deve trovare la sua riga nel file
//   (lo prova raccoltaDati.test.ts, "integrità"). Quando il riferimento
//   porta a una riga cancellata:
//   - preferiti.alimento_id, composizioni_voci.alimento_id: la riga resta
//     fuori. L'interfaccia già non la mostra (alimentiPreferiti e
//     pastiSalvati guardano solo il catalogo vivo, catalogoLocale);
//   - composizioni_voci.composizione_id: fuori, il pasto salvato non c'è
//     più;
//   - obiettivi_target.obiettivo_id: fuori. Oggi e Obiettivi leggono i
//     target solo dell'obiettivo vivo in vigore (periodoInCorso);
//   - voci_diario.alimento_id, composizioni.alimento_id: la riga resta, e
//     l'alimento va in alimenti_cancellati_citati;
//   - voci_diario.pasto_id: la voce resta, e il pasto va in
//     pasti_cancellati_citati;
//   (sezioni citate: vedi formatoEsportazione.ts).
// - UNICA ECCEZIONE, che Importa dovrà gestire: il telefono condiviso. In
//   Dexie possono restare le righe di un altro utente, e una propria voce
//   può puntare a un suo alimento (non dovrebbe succedere, ma la discesa
//   non lo impedisce). Quell'alimento è dati di un altro: non entra, e la
//   voce resta con un alimento_id che nel file non c'è. Importa dovrà
//   metterlo a null (la voce ha già la sua copia di nome e valori) o
//   scartarlo, non rifiutare la voce. Lo stesso vale, in teoria, per un
//   pasto_id verso un pasto di un altro utente: stessa cura, pasto_id a
//   null.
//
// Dentro Dexie non ci sono amicizie, alimenti_condivisi, username né la
// coda: non stanno in TABELLE_DISCESA, quindi qui non arrivano mai.

import type { Table } from "dexie";
import { db } from "../db/database";
import type { Alimento, RigaBase } from "../db/tipi";
import { TABELLE_DISCESA } from "../sync/discesa";
import { copiaLocaleCompleta } from "../sync/discesaCompleta";
import { leggiStatoGiri } from "../sync/statoSincronizzazione";
import { oggiLocale } from "../dataGiorno";
import {
  NOME_FORMATO,
  VERSIONE_FORMATO,
  istanteConFuso,
  type DatiEsportati,
  type EsportazioneDati,
  type FotoEsportata,
  type RighePerTabella,
  type SezioneDati,
  type StatoFoto,
} from "./formatoEsportazione";

// Quello che non sta in Dexie e arriva da fuori: chi chiama lo raccoglie
// (la pagina Esporta), i test lo inventano.
export interface DatiContorno {
  adesso: Date;
  versioneApp: string;
  build: string;
  fusoOrario: string;
  ultimoContattoServer: string | null;
  statoFoto: StatoFoto;
  foto: FotoEsportata | null;
}

// Ordine stabile per id: due esportazioni degli stessi dati danno lo
// stesso file.
function perId<T extends RigaBase>(righe: T[]): T[] {
  return [...righe].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function costruisciEsportazione(
  tutte: RighePerTabella,
  userId: string,
  contorno: DatiContorno
): EsportazioneDati {
  const vive = <T extends RigaBase>(righe: T[]): T[] =>
    perId(righe.filter((r) => r.user_id === userId && r.deleted_at === null));

  const alimenti = vive(tutte.alimenti);
  const voci_diario = vive(tutte.voci_diario);
  const composizioni = vive(tutte.composizioni);

  // Gli alimenti a cui un preferito o un pasto salvato può puntare: i propri
  // vivi e quelli vivi del catalogo comune — lo stesso insieme di
  // catalogoLocale, cioè di quello che l'interfaccia mostra.
  const comuniVivi = tutte.alimenti.filter((a) => a.user_id === null && a.deleted_at === null);
  const idUsabili = new Set([...alimenti, ...comuniVivi].map((a) => a.id));
  const idComposizioni = new Set(composizioni.map((c) => c.id));

  const preferiti = vive(tutte.preferiti).filter((p) => idUsabili.has(p.alimento_id));
  const composizioni_voci = vive(tutte.composizioni_voci).filter(
    (v) => idUsabili.has(v.alimento_id) && idComposizioni.has(v.composizione_id)
  );

  const obiettivi = vive(tutte.obiettivi);
  const idObiettivi = new Set(obiettivi.map((o) => o.id));
  const obiettivi_target = vive(tutte.obiettivi_target).filter((t) => idObiettivi.has(t.obiettivo_id));

  // Gli alimenti che restano citati anche se cancellati: dalle voci vive del
  // diario e dai pasti salvati vivi (composizioni.alimento_id).
  const nonNulli = (ids: (string | null)[]) => ids.filter((id): id is string => id !== null);
  const alimentiCitatiDaStoria = new Set([
    ...nonNulli(voci_diario.map((v) => v.alimento_id)),
    ...nonNulli(composizioni.map((c) => c.alimento_id)),
  ]);
  const alimenti_cancellati_citati = perId(
    tutte.alimenti.filter(
      (a) => a.user_id === userId && a.deleted_at !== null && alimentiCitatiDaStoria.has(a.id)
    )
  );

  // I pasti cancellati citati dalle voci vive.
  const pastiCitati = new Set(nonNulli(voci_diario.map((v) => v.pasto_id)));
  const pasti_cancellati_citati = perId(
    tutte.pasti.filter((p) => p.user_id === userId && p.deleted_at !== null && pastiCitati.has(p.id))
  );

  // Gli alimenti del catalogo comune citati da una riga esportata (vivi o
  // cancellati: una voce del diario può puntare a uno cancellato).
  const citati = new Set<string>([
    ...alimentiCitatiDaStoria,
    ...preferiti.map((p) => p.alimento_id),
    ...composizioni_voci.map((v) => v.alimento_id),
  ]);
  const alimenti_comuni_citati: Alimento[] = perId(
    tutte.alimenti.filter((a) => a.user_id === null && citati.has(a.id))
  );

  const dati: DatiEsportati = {
    profili: vive(tutte.profili),
    obiettivi,
    obiettivi_target,
    giorni: vive(tutte.giorni),
    pasti: vive(tutte.pasti),
    alimenti,
    voci_diario,
    composizioni,
    composizioni_voci,
    misurazioni: vive(tutte.misurazioni),
    preferiti,
    alimenti_cancellati_citati,
    pasti_cancellati_citati,
    alimenti_comuni_citati,
  };

  const conteggi = Object.fromEntries(
    (Object.keys(dati) as SezioneDati[]).map((sezione) => [sezione, dati[sezione].length])
  ) as Record<SezioneDati, number>;

  return {
    formato: { nome: NOME_FORMATO, versione: VERSIONE_FORMATO },
    intestazione: {
      app: { versione: contorno.versioneApp, build: contorno.build },
      esportato_il: istanteConFuso(contorno.adesso),
      fuso_orario: contorno.fusoOrario,
      giorno_locale: oggiLocale(contorno.adesso),
      user_id: userId,
      ultimo_contatto_server: contorno.ultimoContattoServer,
      foto: contorno.statoFoto,
      conteggi,
    },
    dati,
    foto: contorno.foto,
  };
}

// --- Dal dispositivo ------------------------------------------------------------

// Versione e Build, le stesse di Impostazioni > Informazioni (next.config.ts).
export function versioneEBuild(): { versioneApp: string; build: string } {
  return {
    versioneApp: process.env.VERSIONE_APP ?? "sconosciuta",
    build: process.env.COMMIT_APP ?? "sconosciuta",
  };
}

export function fusoOrarioLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "sconosciuto";
  } catch {
    return "sconosciuto";
  }
}

export function ultimoContattoServer(): string | null {
  return leggiStatoGiri().ultimoSuccesso;
}

// Tutte le righe delle tabelle di TABELLE_DISCESA, in una lettura sola.
async function leggiTutteLeRighe(): Promise<RighePerTabella> {
  const tabelle = TABELLE_DISCESA.map((t) => t.tabella as Table<RigaBase, string>);
  return db.transaction("r", tabelle, async () => {
    const coppie = await Promise.all(
      TABELLE_DISCESA.map(async (t) => [t.nome, await t.tabella.toArray()] as const)
    );
    return Object.fromEntries(coppie) as unknown as RighePerTabella;
  });
}

export type EsitoRaccolta =
  // Il segno "discesa completa" manca, o in Dexie non c'è il profilo vivo:
  // la copia locale potrebbe non avere tutto. Esporta non parte.
  | { esito: "copia-incompleta" }
  | { esito: "pronta"; esportazione: EsportazioneDati };

export async function raccogliEsportazione(
  userId: string,
  contorno: DatiContorno
): Promise<EsitoRaccolta> {
  if (!(await copiaLocaleCompleta(userId))) return { esito: "copia-incompleta" };
  const tutte = await leggiTutteLeRighe();
  return { esito: "pronta", esportazione: costruisciEsportazione(tutte, userId, contorno) };
}
