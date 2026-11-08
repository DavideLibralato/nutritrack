// Tutto quello che la pagina Esporta prepara all'apertura (PUNTO_DI_PARTENZA.md
// §10.4): il file si compone PRIMA del tocco, perché la condivisione vuole
// un tocco appena fatto (condividiFile.ts). Qui stanno anche le sole
// chiamate a Supabase della pagina (la foto, in sola lettura): la UI non
// chiama Supabase direttamente (CLAUDE.md).
//
// L'ordine:
// 1. la copia locale è completa? (statoCopiaLocale) Se no, ci si ferma
//    subito: nessuna chiamata di rete;
// 2. la foto, con il suo tempo massimo (fotoEsportazione.ts);
// 3. la raccolta da Dexie e i due testi, JSON e CSV.

import { createClient } from "../supabase/client";
import { statoCopiaLocale, type StatoCopiaLocale } from "../sync/discesaCompleta";
import { fotoPerEsportazione } from "./fotoEsportazione";
import {
  fusoOrarioLocale,
  raccogliEsportazione,
  ultimoContattoServer,
  versioneEBuild,
} from "./raccoltaDati";
import { nomeFileDati, testoJson, type EsportazioneDati } from "./formatoEsportazione";
import { nomeFileDiario, testoCsv } from "./diarioCsv";

export interface FilePronti {
  esportazione: EsportazioneDati;
  json: { nome: string; testo: string; byte: number };
  csv: { nome: string; testo: string };
}

export type EsitoPreparazione =
  | { esito: "copia-incompleta"; manca: Exclude<StatoCopiaLocale, "completa"> }
  | { esito: "pronti"; file: FilePronti };

function byteDi(testo: string): number {
  return new TextEncoder().encode(testo).length;
}

export async function preparaEsportazione(
  userId: string,
  adesso: () => Date = () => new Date()
): Promise<EsitoPreparazione> {
  const copia = await statoCopiaLocale(userId);
  if (copia !== "completa") return { esito: "copia-incompleta", manca: copia };

  const { statoFoto, foto } = await fotoPerEsportazione(createClient(), userId);
  const momento = adesso();
  const raccolta = await raccogliEsportazione(userId, {
    adesso: momento,
    ...versioneEBuild(),
    fusoOrario: fusoOrarioLocale(),
    ultimoContattoServer: ultimoContattoServer(),
    statoFoto,
    foto,
  });
  // Fra il primo controllo e la raccolta il profilo può essere sparito
  // (Esci da un'altra scheda): vale l'esito della raccolta.
  if (raccolta.esito !== "pronta") return raccolta;

  const json = testoJson(raccolta.esportazione);
  return {
    esito: "pronti",
    file: {
      esportazione: raccolta.esportazione,
      json: { nome: nomeFileDati(momento), testo: json, byte: byteDi(json) },
      csv: { nome: nomeFileDiario(momento), testo: testoCsv(raccolta.esportazione.dati) },
    },
  };
}
