// Lo username (Amici, PUNTO_DI_PARTENZA.md §3 e §4, "Le tabelle di Amici"):
// le due funzioni del database `username_disponibile` e `imposta_username`.
// Solo online: `nomi_utente` non sta in Dexie. I componenti non chiamano
// Supabase: passano da qui.
//
// Il client Supabase si riceve come parametro perché queste funzioni
// servono da due parti: dal browser (il controllo mentre si scrive, con il
// client di src/lib/supabase/client.ts) e dalla Server Action della
// registrazione (con il client del server, che ha i cookie della sessione
// appena nata).

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizzaUsername, usernameValido } from "@/lib/validazione";

export type Disponibilita = "disponibile" | "in_uso" | "non_valido" | "errore";

// Sì o no sul nome esatto. "non_valido" senza chiedere niente al server: il
// formato si controlla prima. "errore" = la risposta non è arrivata (rete,
// server): non vuol dire né libero né preso.
export async function controllaDisponibilita(
  supabase: SupabaseClient,
  valore: string
): Promise<Disponibilita> {
  if (!usernameValido(valore)) return "non_valido";
  try {
    const { data, error } = await supabase.rpc("username_disponibile", {
      p_username: normalizzaUsername(valore),
    });
    if (error || typeof data !== "boolean") return "errore";
    return data ? "disponibile" : "in_uso";
  } catch {
    return "errore";
  }
}

// Gli esiti di `imposta_username` sul database, più "errore" quando la
// risposta non arriva o la funzione fallisce (per esempio senza sessione).
export type EsitoImpostaUsername = "ok" | "non_valido" | "occupato" | "errore";

export async function impostaUsername(
  supabase: SupabaseClient,
  valore: string
): Promise<EsitoImpostaUsername> {
  if (!usernameValido(valore)) return "non_valido";
  try {
    const { data, error } = await supabase.rpc("imposta_username", {
      p_username: normalizzaUsername(valore),
    });
    if (error) return "errore";
    if (data === "ok" || data === "non_valido" || data === "occupato") return data;
    return "errore";
  } catch {
    return "errore";
  }
}
