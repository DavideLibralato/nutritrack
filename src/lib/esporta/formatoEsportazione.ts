// Il formato del file `libra-dati-AAAA-MM-GG.json` (PUNTO_DI_PARTENZA.md
// §10.4, "Esporta i miei dati"). È il backup completo, l'unico file che
// Importa ("Ripristina in un account vuoto", il lavoro dopo questo) leggerà:
// ogni cambio di forma alza VERSIONE_FORMATO, e Importa decide da quel
// numero come leggere il file.
//
// Le righe stanno nel file così come sono in Dexie, con tutte le colonne
// (id, user_id, updated_at, i collegamenti fra tabelle): sono gli stessi
// nomi delle colonne su Supabase (tipi.ts), quindi Importa le può
// riscrivere senza tradurre niente.
//
// Solo tipi e funzioni pure: chi legge Dexie è raccoltaDati.ts.

import type {
  Alimento,
  Composizione,
  ComposizioneVoce,
  Giorno,
  Misurazione,
  NomeTabella,
  Obiettivo,
  ObiettivoTarget,
  Pasto,
  Preferito,
  Profilo,
  VoceDiario,
} from "../db/tipi";
import { oggiLocale } from "../dataGiorno";

export const NOME_FORMATO = "libra-dati";
export const VERSIONE_FORMATO = 1;

// Il tipo delle righe di ogni tabella, per scrivere `dati` con i tipi veri.
export interface RighePerTabella {
  profili: Profilo[];
  obiettivi: Obiettivo[];
  obiettivi_target: ObiettivoTarget[];
  giorni: Giorno[];
  pasti: Pasto[];
  alimenti: Alimento[];
  voci_diario: VoceDiario[];
  composizioni: Composizione[];
  composizioni_voci: ComposizioneVoce[];
  misurazioni: Misurazione[];
  preferiti: Preferito[];
}

// Se in tipi.ts entra una tabella nuova e qui no, TypeScript si ferma:
// le chiavi di RighePerTabella devono essere esattamente NomeTabella.
type _ControlloTabelle = [NomeTabella] extends [keyof RighePerTabella]
  ? [keyof RighePerTabella] extends [NomeTabella]
    ? true
    : never
  : never;
const _tabelleAllineate: _ControlloTabelle = true;
void _tabelleAllineate;

// Le tre sezioni in più, fuori dalle tabelle normali. Servono alle foreign
// key di Supabase: Importa riscrive le righe così come sono, e una riga che
// punta a una riga assente dal file verrebbe rifiutata.
// - alimenti_cancellati_citati: gli alimenti propri cancellati a cui punta
//   una voce viva del diario (§4, "Alimenti cancellati": restano nel
//   diario) o un pasto salvato vivo (composizioni.alimento_id, usato dalle
//   ricette, oggi nessuna). Il loro deleted_at resta quello che è;
// - pasti_cancellati_citati: i pasti propri cancellati a cui punta una voce
//   viva. Succede con una voce aggiunta da un altro telefono non ancora
//   allineato su un pasto eliminato (PUNTO §3, "Elimina pasto"): resta
//   viva, e Oggi la mostra con la rete di sicurezza ("Non più in uso",
//   pastiDaMostrare in src/lib/pasti/validitaPasti.ts). Con il loro
//   deleted_at;
// - alimenti_comuni_citati: gli alimenti del catalogo comune (user_id null)
//   a cui punta una riga esportata. Oggi il catalogo comune è vuoto; sono
//   dati pubblici, non di un altro utente.
export interface DatiEsportati extends RighePerTabella {
  alimenti_cancellati_citati: Alimento[];
  pasti_cancellati_citati: Pasto[];
  alimenti_comuni_citati: Alimento[];
}

export type SezioneDati = keyof DatiEsportati;

// La foto profilo. Nell'intestazione solo lo stato; i byte stanno a parte,
// in `foto`, per non appesantire l'intestazione.
// - inclusa: `origine` dice se è stata verificata col server in questa
//   esportazione o se è la copia sul telefono (server senza risposta);
// - assente: l'utente non ha la foto, e lo ha detto il server;
// - non-inclusa: server senza risposta e nessuna copia sul telefono: non si
//   sa se la foto c'è. Serve la rete.
export type StatoFoto =
  | { stato: "inclusa"; origine: "server" | "telefono" }
  | { stato: "assente" }
  | { stato: "non-inclusa" };

export interface FotoEsportata {
  tipo: string; // "image/jpeg"
  base64: string;
}

export interface IntestazioneEsportazione {
  app: { versione: string; build: string };
  // L'istante con il fuso esplicito ("2026-11-07T20:45:12.345+01:00") e il
  // nome del fuso ("Europe/Rome"): le date del diario sono giorni del
  // calendario locale (§4, "Il giorno è quello del calendario").
  esportato_il: string;
  fuso_orario: string;
  giorno_locale: string; // "YYYY-MM-DD", lo stesso del nome del file
  // L'utente del file. Serve a Importa anche per riconoscere i 5 pasti di
  // base, il cui id è calcolato da utente e nome (idPastoPredefinito).
  user_id: string;
  // L'ultimo contatto riuscito col server (ISO 8601), null se non noto: le
  // modifiche fatte da un altro dispositivo dopo quest'ora non ci sono.
  ultimo_contatto_server: string | null;
  foto: StatoFoto;
  conteggi: Record<SezioneDati, number>;
}

export interface EsportazioneDati {
  formato: { nome: typeof NOME_FORMATO; versione: number };
  intestazione: IntestazioneEsportazione;
  dati: DatiEsportati;
  foto: FotoEsportata | null;
}

// --- Funzioni pure ------------------------------------------------------------

// L'ora locale con il fuso scritto in fondo, al millisecondo:
// "2026-11-07T20:45:12.345+01:00". toISOString() darebbe l'ora UTC con la
// "Z", che per chi apre il file a mano non è l'ora che vedeva sul telefono.
export function istanteConFuso(d: Date): string {
  const due = (n: number) => String(n).padStart(2, "0");
  const scarto = -d.getTimezoneOffset(); // minuti a est di UTC
  const segno = scarto >= 0 ? "+" : "-";
  const assoluto = Math.abs(scarto);
  return (
    `${oggiLocale(d)}T${due(d.getHours())}:${due(d.getMinutes())}:${due(d.getSeconds())}` +
    `.${String(d.getMilliseconds()).padStart(3, "0")}` +
    `${segno}${due(Math.floor(assoluto / 60))}:${due(assoluto % 60)}`
  );
}

export function nomeFileDati(adesso: Date): string {
  return `libra-dati-${oggiLocale(adesso)}.json`;
}

// Indentato: il file resta leggibile anche aperto a mano. Costa circa un
// terzo di spazio in più, su qualche centinaio di KB.
export function testoJson(esportazione: EsportazioneDati): string {
  return JSON.stringify(esportazione, null, 2);
}
