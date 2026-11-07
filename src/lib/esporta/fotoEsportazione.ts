// La foto profilo dentro il file JSON (PUNTO_DI_PARTENZA.md §10.4,
// "Esporta i miei dati"). Prima si chiede al server se la copia sul
// telefono è quella giusta (aggiornaMiaFoto, la stessa dell'apertura
// dell'app: se serve scarica la foto nuova nella copia), con un tempo
// massimo di 8 secondi; poi si legge la copia (foto_locale). Così la foto
// entra anche offline, e quando il server risponde è quella verificata.
//
// Conta l'esito della richiesta, mai navigator.onLine (su iPhone è in
// ritardo, lezione del 23/10). Sul server non si scrive niente: la foto si
// legge soltanto.
//
// I tre casi (StatoFoto in formatoEsportazione.ts):
// - inclusa, origine "server": il server ha risposto e la copia è quella
//   che indica;
// - inclusa, origine "telefono": il server non ha risposto entro il tempo
//   massimo, o la foto nuova non è arrivata, e c'è una copia sul telefono
//   (forse non l'ultima);
// - assente: il server ha risposto che non c'è foto;
// - non-inclusa: il server non ha risposto e sul telefono non c'è copia.
//   Non si sa se la foto c'è: serve la rete.

import type { SupabaseClient } from "@supabase/supabase-js";
import { aggiornaMiaFoto, leggiFotoLocale, type EsitoAggiornaFoto } from "../foto/fotoProfilo";
import type { FotoEsportata, StatoFoto } from "./formatoEsportazione";

export const TEMPO_MASSIMO_FOTO_MS = 8_000;

export interface FotoPerEsportazione {
  statoFoto: StatoFoto;
  foto: FotoEsportata | null;
}

// Gli esiti di aggiornaMiaFoto in cui il server ha risposto e la copia (o
// la sua assenza) è quella giusta. "cambiata-nel-frattempo": un cambio da
// questo telefono è arrivato durante la verifica, la copia è la sua.
const VERIFICATA: readonly EsitoAggiornaFoto[] = [
  "aggiornata",
  "invariata",
  "nessuna",
  "cambiata-nel-frattempo",
];

export async function fotoPerEsportazione(
  supabase: SupabaseClient,
  userId: string,
  tempoMassimoMs: number = TEMPO_MASSIMO_FOTO_MS
): Promise<FotoPerEsportazione> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scaduta = new Promise<"scaduta">((risolvi) => {
    timer = setTimeout(() => risolvi("scaduta"), tempoMassimoMs);
  });
  // Scaduto il tempo, aggiornaMiaFoto può finire dopo e aggiornare la
  // copia: va bene, è quello che fa anche all'apertura. Qui non la si
  // aspetta.
  const esito = await Promise.race([
    aggiornaMiaFoto(supabase, userId).catch((): EsitoAggiornaFoto => "non-letta"),
    scaduta,
  ]);
  clearTimeout(timer);

  const verificata = esito !== "scaduta" && VERIFICATA.includes(esito);
  const copia = await leggiFotoLocale(userId);

  if (copia) {
    return {
      statoFoto: { stato: "inclusa", origine: verificata ? "server" : "telefono" },
      foto: { tipo: copia.tipo, base64: base64DaByte(copia.byte) },
    };
  }
  return { statoFoto: { stato: verificata ? "assente" : "non-inclusa" }, foto: null };
}

// btoa vuole una stringa con un carattere per byte. A pezzi, perché
// String.fromCharCode con mezzo megabyte di argomenti in una volta sola
// supera il limite degli argomenti di una funzione su alcuni browser.
export function base64DaByte(byte: ArrayBuffer): string {
  const array = new Uint8Array(byte);
  const PEZZO = 0x8000;
  let binario = "";
  for (let i = 0; i < array.length; i += PEZZO) {
    binario += String.fromCharCode(...array.subarray(i, i + PEZZO));
  }
  return btoa(binario);
}
