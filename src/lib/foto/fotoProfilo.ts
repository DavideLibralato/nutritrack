// La foto profilo sul server e la sua copia sul telefono
// (PUNTO_DI_PARTENZA.md §3 "Profilo", "La foto profilo"; §4 "La foto
// profilo: solo online"). Solo logica: le schermate arrivano dopo.
//
// Tutto qui parla con Supabase: lo Storage (bucket `foto-profilo`), la
// tabella `foto_profilo` e la funzione `imposta_foto_profilo`. I
// componenti non chiamano Supabase: passano da qui. Il client si riceve
// come parametro, come in nomiUtente.ts e amicizie.ts, così i test lo
// sostituiscono.
//
// Il tempo massimo: ogni chiamata, Storage compreso, passa dalla fetch con
// la scadenza di 30 s (fetchConScadenza.ts). supabase-js dà allo Storage la
// stessa fetch del resto (`new StorageClient(…, this.fetch, …)`, e
// this.fetch avvolge `global.fetch` di client.ts; letto il 25/10 in
// @supabase/supabase-js). Una chiamata scaduta risponde con un errore,
// quindi qui diventa uno dei fallimenti previsti.
//
// Non passa dalla coda (decisione del 25/10): la coda porta righe, non
// file, e il cambio ha tre passi in un ordine preciso. Chiamate dirette,
// solo online, come Cambia password.

import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "../db/database";

export const BUCKET_FOTO = "foto-profilo";

// Quanto vale un indirizzo firmato della foto di un amico. Rischio
// accettato (§4): un indirizzo dato prima che l'amicizia venga tolta resta
// valido fino alla sua scadenza.
export const SCADENZA_URL_FIRMATI_S = 3600;

// La copia della propria foto sul telefono (tabella Dexie `foto_locale`,
// version(9)). Solo locale: non si sincronizza, si riscarica dal server.
// I byte e non un Blob: un Blob salvato in IndexedDB su WebKit vecchi dava
// problemi, e nel finto IndexedDB dei test torna indietro vuoto; i byte
// passano ovunque. Il Blob si ricostruisce leggendo (blobDaFotoLocale).
export interface FotoLocale {
  user_id: string; // la chiave: una riga per utente
  percorso: string; // `<user_id>/<uuid>.jpg`, lo stesso di foto_profilo
  byte: ArrayBuffer;
  tipo: string; // "image/jpeg"
}

export function blobDaFotoLocale(foto: FotoLocale): Blob {
  return new Blob([foto.byte], { type: foto.tipo });
}

export function leggiFotoLocale(userId: string): Promise<FotoLocale | undefined> {
  return db.foto_locale.get(userId);
}

async function fotoLocaleDa(userId: string, percorso: string, file: Blob): Promise<FotoLocale> {
  return {
    user_id: userId,
    percorso,
    byte: await file.arrayBuffer(),
    tipo: file.type || "image/jpeg",
  };
}

// Un nome nuovo a ogni cambio: un indirizzo nuovo non è mai in cache.
export function percorsoNuovo(userId: string): string {
  return `${userId}/${crypto.randomUUID()}.jpg`;
}

// --- La cartella sul server ---------------------------------------------------

// Cancella dalla propria cartella tutti i file tranne `tieni` (null = tutti).
// true = la cartella è come deve essere; false = non si è riusciti a
// leggerla o a cancellare: restano avanzi, che pulisce la volta dopo.
// Non tocca mai `tieni`: è il file che foto_profilo indica adesso.
export async function pulisciCartella(
  supabase: SupabaseClient,
  userId: string,
  tieni: string | null
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_FOTO).list(userId);
    if (error || !Array.isArray(data)) return false;
    const daTogliere = data
      .map((f) => `${userId}/${f.name}`)
      .filter((percorso) => percorso !== tieni);
    if (daTogliere.length === 0) return true;
    const { error: erroreRemove } = await supabase.storage.from(BUCKET_FOTO).remove(daTogliere);
    return !erroreRemove;
  } catch {
    return false;
  }
}

// --- Cambiare la foto -----------------------------------------------------

export type EsitoCambioFoto =
  // Foto cambiata sul server e copiata sul telefono. `avanziRimasti`: la
  // pulizia dei file vecchi non è riuscita; restano sul server finché non
  // li toglie il cambio successivo. Per l'utente è comunque fatto.
  | { esito: "ok"; percorso: string; avanziRimasti: boolean }
  // Il file non è arrivato: non è cambiato niente.
  | { esito: "caricamento-fallito" }
  // Il file è arrivato ma la foto non risulta cambiata (rifiuto, rete, o
  // risposta persa). Resta un file in più, che pulisce il cambio
  // successivo. Se si è persa solo la risposta la foto può essere cambiata
  // lo stesso: la si vede al prossimo aggiornamento (aggiornaMiaFoto).
  | { esito: "impostazione-fallita" };

// I tre passi, in quest'ordine (§3, "Chiamata diretta, non dalla coda"):
// 1. si carica il file nuovo, con un nome nuovo e upsert spento;
// 2. imposta_foto_profilo con il percorso nuovo;
// 3. si cancellano il file vecchio e ogni avanzo della cartella.
// Dopo il 2, prima del 3, si salva subito la copia sul telefono, con lo
// stesso file: niente da riscaricare.
//
// Dopo un passo 2 fallito il file nuovo NON si cancella: se si è persa
// solo la risposta, quel file è già la foto valida, e cancellarlo la
// romperebbe. Lo toglie il passo 3 del prossimo cambio, che tiene solo il
// file appena impostato.
export async function cambiaFoto(
  supabase: SupabaseClient,
  userId: string,
  file: Blob
): Promise<EsitoCambioFoto> {
  const percorso = percorsoNuovo(userId);

  try {
    const { error } = await supabase.storage
      .from(BUCKET_FOTO)
      .upload(percorso, file, { upsert: false, contentType: "image/jpeg" });
    if (error) return { esito: "caricamento-fallito" };
  } catch {
    return { esito: "caricamento-fallito" };
  }

  try {
    const { data, error } = await supabase.rpc("imposta_foto_profilo", { p_percorso: percorso });
    if (error || data !== "ok") return { esito: "impostazione-fallita" };
  } catch {
    return { esito: "impostazione-fallita" };
  }

  await db.foto_locale.put(await fotoLocaleDa(userId, percorso, file));

  const pulita = await pulisciCartella(supabase, userId, percorso);
  return { esito: "ok", percorso, avanziRimasti: !pulita };
}

// --- Eliminare la foto ----------------------------------------------------

export type EsitoEliminaFoto =
  // Foto tolta dal server e dal telefono. `avanziRimasti`: il file non si
  // è cancellato; nessuno lo vede più indicato da foto_profilo, e lo toglie
  // il prossimo cambio o Elimina account.
  | { esito: "ok"; avanziRimasti: boolean }
  // Il server non ha tolto la foto (rete, rifiuto): non è cambiato niente.
  | { esito: "fallito" };

// imposta_foto_profilo(null), poi i file, poi la copia sul telefono. La
// copia si toglie anche se la cancellazione dei file fallisce: per il
// server la foto non c'è più.
export async function eliminaFoto(
  supabase: SupabaseClient,
  userId: string
): Promise<EsitoEliminaFoto> {
  try {
    const { data, error } = await supabase.rpc("imposta_foto_profilo", { p_percorso: null });
    if (error || data !== "ok") return { esito: "fallito" };
  } catch {
    return { esito: "fallito" };
  }

  const pulita = await pulisciCartella(supabase, userId, null);
  await db.foto_locale.delete(userId);
  return { esito: "ok", avanziRimasti: !pulita };
}

// --- Aggiornare la copia della propria foto ---------------------------------

export type EsitoAggiornaFoto =
  | "aggiornata" // scaricata la foto nuova
  | "invariata" // il server indica la stessa della copia
  | "nessuna" // il server dice che non c'è foto: copia tolta
  | "non-letta" // il server non ha risposto: copia intatta
  | "non-scaricata" // la foto nuova non è arrivata: copia vecchia intatta
  | "cambiata-nel-frattempo"; // un cambio da questo telefono è arrivato prima: vince lui

// Scrive (o toglie, con null) la copia solo se è ancora quella letta
// all'inizio. Serve contro questo caso: l'aggiornamento legge il percorso
// vecchio e comincia a scaricarlo; intanto un cambio da questo telefono
// salva la copia nuova; poi arriva il download vecchio e la
// riscriverebbe. La lettura e la scrittura stanno in una transazione:
// niente si infila in mezzo.
async function scriviSeInvariata(
  userId: string,
  attesa: string | null,
  nuova: FotoLocale | null
): Promise<boolean> {
  return db.transaction("rw", db.foto_locale, async () => {
    const ora = await db.foto_locale.get(userId);
    if ((ora?.percorso ?? null) !== attesa) return false;
    if (nuova) await db.foto_locale.put(nuova);
    else await db.foto_locale.delete(userId);
    return true;
  });
}

// All'apertura con la rete e al ritorno in primo piano: se il server
// indica una foto diversa dalla copia, la si scarica; se non ne indica
// nessuna, la copia si toglie (foto tolta da un altro telefono). Senza
// risposta non si tocca niente.
export async function aggiornaMiaFoto(
  supabase: SupabaseClient,
  userId: string
): Promise<EsitoAggiornaFoto> {
  const copia = await db.foto_locale.get(userId);
  const percorsoCopia = copia?.percorso ?? null;

  let percorsoServer: string | null;
  try {
    const { data, error } = await supabase
      .from("foto_profilo")
      .select("percorso")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return "non-letta";
    percorsoServer = typeof data?.percorso === "string" ? data.percorso : null;
  } catch {
    return "non-letta";
  }

  if (percorsoServer === percorsoCopia) return "invariata";

  if (percorsoServer === null) {
    return (await scriviSeInvariata(userId, percorsoCopia, null))
      ? "nessuna"
      : "cambiata-nel-frattempo";
  }

  let file: Blob;
  try {
    const { data, error } = await supabase.storage.from(BUCKET_FOTO).download(percorsoServer);
    if (error || !data) return "non-scaricata";
    file = data;
  } catch {
    return "non-scaricata";
  }

  const nuova = await fotoLocaleDa(userId, percorsoServer, file);
  return (await scriviSeInvariata(userId, percorsoCopia, nuova))
    ? "aggiornata"
    : "cambiata-nel-frattempo";
}

// --- Le foto degli amici ----------------------------------------------------

// Per ogni amico con la foto, un indirizzo firmato valido un'ora: { id
// dell'amico → indirizzo }. Una lettura della tabella e UNA chiamata allo
// Storage per tutti. La RLS restituisce solo gli amici con amicizia
// accettata: per gli altri id passati non arriva niente. Qualunque errore
// → {} (o solo gli indirizzi riusciti): restano le iniziali, mai un errore
// nella pagina.
export async function indirizziFotoAmici(
  supabase: SupabaseClient,
  amici: string[]
): Promise<Record<string, string>> {
  if (amici.length === 0) return {};
  try {
    const { data: righe, error } = await supabase
      .from("foto_profilo")
      .select("user_id, percorso")
      .in("user_id", amici);
    if (error || !Array.isArray(righe)) return {};

    const proprietario = new Map<string, string>();
    for (const r of righe as { user_id: string; percorso: string | null }[]) {
      if (typeof r.percorso === "string") proprietario.set(r.percorso, r.user_id);
    }
    if (proprietario.size === 0) return {};

    const { data: firmati, error: erroreFirma } = await supabase.storage
      .from(BUCKET_FOTO)
      .createSignedUrls([...proprietario.keys()], SCADENZA_URL_FIRMATI_S);
    if (erroreFirma || !Array.isArray(firmati)) return {};

    const indirizzi: Record<string, string> = {};
    for (const f of firmati) {
      const amico = f.path ? proprietario.get(f.path) : undefined;
      if (amico && !f.error && f.signedUrl) indirizzi[amico] = f.signedUrl;
    }
    return indirizzi;
  } catch {
    return {};
  }
}
