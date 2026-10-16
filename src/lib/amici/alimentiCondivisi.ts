// Gli alimenti mandati agli amici (PUNTO_DI_PARTENZA.md §3 "Amici",
// "Condividere un alimento"; §4 "alimenti_condivisi"): le chiamate alle tre
// funzioni del database e la lettura degli alimenti in arrivo. Solo online:
// `alimenti_condivisi` non sta in Dexie. I componenti non chiamano Supabase:
// passano da qui.
//
// Il client si riceve come parametro, come in amicizie.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alimento, AlimentoCondiviso } from "@/lib/db/tipi";
import { chiama } from "./amicizie";

// --- Gli esiti delle funzioni: solo testo. Più "errore" quando la risposta
// non arriva o la funzione fallisce. ---
export type EsitoMandaAlimenti = "ok" | "non_amici" | "non_valido" | "errore";
export type EsitoRispondiAlimenti = "ok" | "non_trovata" | "non_valido" | "errore";
export type EsitoRiapriAlimento = "ok" | "non_trovata" | "errore";

// Le quattro risposte di rispondi_alimenti_condivisi:
// - aggiungi: la copia nasce nel catalogo;
// - rifiuta: Rifiuta e Tieni i miei;
// - uguale: Ok su "Hai già questo alimento, con gli stessi valori";
// - valori_usati: dopo "Usa questi valori", che ha già aggiornato il
//   proprio alimento sul telefono.
export type RispostaAlimento = "aggiungi" | "rifiuta" | "uguale" | "valori_usati";

// La copia di un alimento come la manda il telefono: i campi che
// manda_alimenti si aspetta, presi dalla riga di Dexie (quello che il
// mittente vede, anche se non è ancora arrivato al server). `id` è l'id
// dell'alimento del mittente: il database lo usa per riconoscere lo stesso
// alimento mandato di nuovo.
export type CopiaPerInvio = Pick<
  Alimento,
  | "id"
  | "nome"
  | "marca"
  | "barcode"
  | "kcal_100g"
  | "proteine_100g"
  | "carboidrati_100g"
  | "grassi_100g"
  | "zuccheri_100g"
  | "fibre_100g"
  | "saturi_100g"
  | "sale_100g"
  | "porzione_default_g"
  | "fonte"
>;

// Solo i campi della copia, niente di più: user_id, verificato e le date
// del mittente non devono partire.
export function copiaPerInvio(a: Alimento): CopiaPerInvio {
  return {
    id: a.id,
    nome: a.nome,
    marca: a.marca,
    barcode: a.barcode,
    kcal_100g: a.kcal_100g,
    proteine_100g: a.proteine_100g,
    carboidrati_100g: a.carboidrati_100g,
    grassi_100g: a.grassi_100g,
    zuccheri_100g: a.zuccheri_100g,
    fibre_100g: a.fibre_100g,
    saturi_100g: a.saturi_100g,
    sale_100g: a.sale_100g,
    porzione_default_g: a.porzione_default_g,
    fonte: a.fonte,
  };
}

// Manda gli alimenti a tutti gli amici scelti, tutto o niente. `invio`: un
// uuid nuovo a ogni tocco su "Manda", lo STESSO nei tentativi dopo una
// risposta persa (il database non crea doppie righe).
export function mandaAlimenti(
  supabase: SupabaseClient,
  invio: string,
  destinatari: string[],
  alimenti: Alimento[]
): Promise<EsitoMandaAlimenti> {
  return chiama(
    supabase,
    "manda_alimenti",
    { p_invio: invio, p_destinatari: destinatari, p_alimenti: alimenti.map(copiaPerInvio) },
    ["ok", "non_amici", "non_valido"]
  );
}

// Risponde a uno o più alimenti ricevuti, tutto o niente. "non_trovata":
// almeno uno non c'è più (chiuso in un altro modo, amicizia finita): non è
// cambiato niente, la pagina rilegge l'elenco.
export function rispondiAlimentiCondivisi(
  supabase: SupabaseClient,
  ids: string[],
  risposta: RispostaAlimento
): Promise<EsitoRispondiAlimenti> {
  return chiama(
    supabase,
    "rispondi_alimenti_condivisi",
    { p_ids: ids, p_risposta: risposta },
    ["ok", "non_trovata", "non_valido"]
  );
}

// L'Annulla di "Usa questi valori": la condivisione torna in attesa.
export function riapriAlimentoCondiviso(
  supabase: SupabaseClient,
  id: string
): Promise<EsitoRiapriAlimento> {
  return chiama(supabase, "riapri_alimento_condiviso", { p_id: id }, ["ok", "non_trovata"]);
}

// --- Lettura ---

// Un testo solo, non spezzato con "+": la libreria di Supabase legge
// l'elenco per dedurre il tipo delle righe, e da un testo composto non ci
// riesce.
const COLONNE =
  "id, user_id, destinatario_id, alimento_origine_id, nome, marca, barcode, kcal_100g, proteine_100g, carboidrati_100g, grassi_100g, zuccheri_100g, fibre_100g, saturi_100g, sale_100g, porzione_default_g, fonte, stato, risposta_il, creato_il, updated_at, deleted_at";

// Gli alimenti in arrivo (la RLS manda solo le righe in attesa per me; i
// filtri qui sotto lo ripetono per non dipendere da lei), dal più recente,
// e gli username di chi li manda, in una seconda lettura come in
// leggiAmicizie: nomi_utente fa leggere quelli degli amici.
export type LetturaInArrivo =
  | { esito: "ok"; righe: AlimentoCondiviso[]; nomi: Record<string, string> }
  | { esito: "errore" };

export async function leggiAlimentiInArrivo(
  supabase: SupabaseClient,
  io: string
): Promise<LetturaInArrivo> {
  try {
    const { data: righe, error } = await supabase
      .from("alimenti_condivisi")
      .select(COLONNE)
      .eq("destinatario_id", io)
      .eq("stato", "in_attesa")
      .is("deleted_at", null)
      .order("creato_il", { ascending: false });
    if (error || !Array.isArray(righe)) return { esito: "errore" };

    const mittenti = [...new Set((righe as AlimentoCondiviso[]).map((r) => r.user_id))];
    const nomi: Record<string, string> = {};
    if (mittenti.length > 0) {
      const { data: righeNomi, error: erroreNomi } = await supabase
        .from("nomi_utente")
        .select("user_id, username")
        .in("user_id", mittenti);
      if (erroreNomi || !Array.isArray(righeNomi)) return { esito: "errore" };
      for (const r of righeNomi as { user_id: string; username: string }[]) {
        nomi[r.user_id] = r.username;
      }
    }
    return { esito: "ok", righe: (righe as AlimentoCondiviso[]).map(numeri), nomi };
  } catch {
    return { esito: "errore" };
  }
}

// Quanti alimenti mi aspettano: per il pallino e la riga Alimenti di
// Impostazioni (novita.ts). Solo il numero (head: true). null = la risposta
// non è arrivata.
export async function contaAlimentiInArrivo(
  supabase: SupabaseClient,
  io: string
): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from("alimenti_condivisi")
      .select("id", { count: "exact", head: true })
      .eq("destinatario_id", io)
      .eq("stato", "in_attesa")
      .is("deleted_at", null);
    if (error || typeof count !== "number") return null;
    return count;
  } catch {
    return null;
  }
}

// I valori come numeri JavaScript. Le colonne `numeric` di Postgres
// possono arrivare come testo ("3.30"), secondo come le serializza il
// server: il confronto in centesimi e la tabella vogliono numeri.
function numeri(r: AlimentoCondiviso): AlimentoCondiviso {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...r,
    kcal_100g: Number(r.kcal_100g),
    proteine_100g: Number(r.proteine_100g),
    carboidrati_100g: Number(r.carboidrati_100g),
    grassi_100g: Number(r.grassi_100g),
    zuccheri_100g: n(r.zuccheri_100g),
    fibre_100g: n(r.fibre_100g),
    saturi_100g: n(r.saturi_100g),
    sale_100g: n(r.sale_100g),
    porzione_default_g: Number(r.porzione_default_g),
  };
}
