// Le amicizie (PUNTO_DI_PARTENZA.md §3 "Amici", "Le amicizie"; §4 "Le
// tabelle di Amici"): lettura delle righe e chiamate alle quattro funzioni
// del database. Solo online: `amicizie` non sta in Dexie. I componenti non
// chiamano Supabase: passano da qui.
//
// Il client si riceve come parametro, come in nomiUtente.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Amicizia, StatoAmicizia } from "@/lib/db/tipi";
import { normalizzaUsername, usernameValido } from "@/lib/validazione";

// --- Gli esiti delle funzioni del database: solo testo, mai dati. Più
// "errore" quando la risposta non arriva o la funzione fallisce (senza
// sessione le funzioni danno un errore, non un esito). ---
export type EsitoChiediAmicizia =
  | "inviata"
  | "non_trovato"
  | "sei_tu"
  | "gia_amici"
  | "gia_chiesta"
  | "accettata"
  | "troppo_presto"
  | "senza_username"
  | "errore";
export type EsitoRispondiAmicizia = "ok" | "non_trovata" | "senza_username" | "errore";
export type EsitoAnnullaORimuoviAmicizia = "ok" | "non_trovata" | "errore";
export type EsitoChiudiRifiuto = "ok" | "non_trovata" | "errore";

const ESITI_CHIEDI: readonly string[] = [
  "inviata",
  "non_trovato",
  "sei_tu",
  "gia_amici",
  "gia_chiesta",
  "accettata",
  "troppo_presto",
  "senza_username",
];

// Una chiamata a una funzione del database che risponde con un testo: un
// testo fra quelli attesi, altrimenti "errore". La usa anche
// alimentiCondivisi.ts.
export async function chiama<E extends string>(
  supabase: SupabaseClient,
  funzione: string,
  argomenti: Record<string, unknown>,
  ammessi: readonly string[]
): Promise<E | "errore"> {
  try {
    const { data, error } = await supabase.rpc(funzione, argomenti);
    if (error || typeof data !== "string" || !ammessi.includes(data)) return "errore";
    return data as E;
  } catch {
    return "errore";
  }
}

// Il formato si controlla prima: un nome che non può esistere non va al
// server. Chi chiama mostra il messaggio sul formato senza chiamare.
export async function chiediAmicizia(
  supabase: SupabaseClient,
  valore: string
): Promise<EsitoChiediAmicizia> {
  if (!usernameValido(valore)) return "non_trovato";
  return chiama(supabase, "chiedi_amicizia", { p_username: normalizzaUsername(valore) }, ESITI_CHIEDI);
}

export function rispondiAmicizia(
  supabase: SupabaseClient,
  id: string,
  accetta: boolean
): Promise<EsitoRispondiAmicizia> {
  return chiama(supabase, "rispondi_amicizia", { p_id: id, p_accetta: accetta }, [
    "ok",
    "non_trovata",
    "senza_username",
  ]);
}

export function annullaORimuoviAmicizia(
  supabase: SupabaseClient,
  id: string
): Promise<EsitoAnnullaORimuoviAmicizia> {
  return chiama(supabase, "annulla_o_rimuovi_amicizia", { p_id: id }, ["ok", "non_trovata"]);
}

export function chiudiRifiuto(supabase: SupabaseClient, id: string): Promise<EsitoChiudiRifiuto> {
  return chiama(supabase, "chiudi_rifiuto", { p_id: id }, ["ok", "non_trovata"]);
}

// --- Lettura ---

// Le righe di amicizie che posso vedere (la RLS filtra già: chi chiede, chi
// riceve, i rifiuti nascosti) e gli username degli altri, in una seconda
// lettura: nomi_utente fa leggere solo quelli di chi ha una riga con me.
export type LetturaAmicizie =
  | { esito: "ok"; righe: Amicizia[]; nomi: Record<string, string> }
  | { esito: "errore" };

export async function leggiAmicizie(
  supabase: SupabaseClient,
  io: string
): Promise<LetturaAmicizie> {
  try {
    const { data: righe, error } = await supabase
      .from("amicizie")
      .select(
        "id, user_id, amico_id, stato, risposta_il, rifiuto_visto, creato_il, updated_at, deleted_at"
      )
      .is("deleted_at", null);
    if (error || !Array.isArray(righe)) return { esito: "errore" };

    const altri = [
      ...new Set(
        (righe as Amicizia[]).map((r) => (r.user_id === io ? r.amico_id : r.user_id))
      ),
    ];
    const nomi: Record<string, string> = {};
    if (altri.length > 0) {
      const { data: righeNomi, error: erroreNomi } = await supabase
        .from("nomi_utente")
        .select("user_id, username")
        .in("user_id", altri);
      if (erroreNomi || !Array.isArray(righeNomi)) return { esito: "errore" };
      for (const r of righeNomi as { user_id: string; username: string }[]) {
        nomi[r.user_id] = r.username;
      }
    }
    return { esito: "ok", righe: righe as Amicizia[], nomi };
  } catch {
    return { esito: "errore" };
  }
}

// Quante richieste di amicizia ho ricevuto e aspettano una risposta: per il
// pallino (novita.ts). Solo il numero (head: true, nessuna riga scaricata):
// la tab bar lo chiede su ogni pagina. "Non accettata" non conta: è una
// risposta a una richiesta mia, non qualcosa da fare. null = la risposta
// non è arrivata.
export async function contaRichiesteRicevute(
  supabase: SupabaseClient,
  io: string
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from("amicizie")
      .select("id", { count: "exact", head: true })
      .eq("amico_id", io)
      .eq("stato", "in_attesa")
      .is("deleted_at", null);
    if (error || typeof count !== "number") return null;
    return count;
  } catch {
    return null;
  }
}

// --- Divisione per la pagina (funzione pura, con test) ---

// Una riga come la mostra la pagina. `username` null: il nome dell'altro non
// è arrivato (vedi dividiAmicizie).
export interface VoceAmicizia {
  id: string;
  altroId: string;
  username: string | null;
  stato: StatoAmicizia;
  creatoIl: string;
}

export interface AmicizieDivise {
  // Richieste ricevute, in attesa: Rifiuta / Accetta.
  ricevute: VoceAmicizia[];
  // Richieste mandate, in attesa: "In attesa che accetti", Annulla.
  inviate: VoceAmicizia[];
  // Richieste mandate e rifiutate, prima dell'Ok: "Non accettata", Ok.
  nonAccettate: VoceAmicizia[];
  // Amicizie accettate, chiunque abbia chiesto.
  amici: VoceAmicizia[];
}

// Divide le righe per la pagina. Le richieste dalla più recente (creato_il),
// gli amici in ordine alfabetico di username.
//
// La RLS manda già solo le righe giuste; qui si scarta comunque ciò che non
// deve comparire, per non dipendere da lei: righe cancellate, righe in cui
// non ci sono io, una richiesta che ho rifiutato io (chi rifiuta non vede
// altro) e un rifiuto già chiuso con Ok.
//
// Username mancante (in pratica non succede: chi è in una riga ha uno
// username, e chi elimina l'account si porta via anche la riga; può capitare
// solo se il nome cambia o sparisce fra le due letture): la riga resta, con
// username null, e la pagina mostra "Nome non disponibile". Nasconderla
// lascerebbe una richiesta a cui non si può rispondere e un numero di amici
// che non torna con l'elenco. Fra gli amici, quelli senza nome vanno in
// fondo.
export function dividiAmicizie(
  righe: Amicizia[],
  nomi: Record<string, string>,
  io: string
): AmicizieDivise {
  const divise: AmicizieDivise = { ricevute: [], inviate: [], nonAccettate: [], amici: [] };

  for (const r of righe) {
    if (r.deleted_at !== null) continue;
    const hoChiestoIo = r.user_id === io;
    if (!hoChiestoIo && r.amico_id !== io) continue;
    const altroId = hoChiestoIo ? r.amico_id : r.user_id;
    const voce: VoceAmicizia = {
      id: r.id,
      altroId,
      username: nomi[altroId] ?? null,
      stato: r.stato,
      creatoIl: r.creato_il,
    };

    if (r.stato === "accettata") divise.amici.push(voce);
    else if (r.stato === "in_attesa") (hoChiestoIo ? divise.inviate : divise.ricevute).push(voce);
    else if (hoChiestoIo && !r.rifiuto_visto) divise.nonAccettate.push(voce);
  }

  const piuRecente = (a: VoceAmicizia, b: VoceAmicizia) =>
    new Date(b.creatoIl).getTime() - new Date(a.creatoIl).getTime();
  divise.ricevute.sort(piuRecente);
  divise.inviate.sort(piuRecente);
  divise.nonAccettate.sort(piuRecente);
  divise.amici.sort((a, b) => {
    if (a.username === null || b.username === null) {
      return (a.username === null ? 1 : 0) - (b.username === null ? 1 : 0);
    }
    return a.username.localeCompare(b.username, "it");
  });

  return divise;
}

// Le iniziali nel cerchio, dallo username: le prime lettere delle prime due
// parti separate da "_" ("marco_b" → "mb"), altrimenti le prime due lettere
// ("luigi2" → "lu"). Minuscole come lo username; senza nome "?".
export function inizialiUsername(username: string | null): string {
  if (!username) return "?";
  const parti = username.split("_").filter((p) => p !== "");
  if (parti.length >= 2) return parti[0][0] + parti[1][0];
  return username.slice(0, 2);
}
