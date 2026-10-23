// Lo username (Amici, PUNTO_DI_PARTENZA.md §3 e §4, "Le tabelle di Amici"):
// le due funzioni del database `username_disponibile` e `imposta_username`.
// Solo online: `nomi_utente` non sta in Dexie. I componenti non chiamano
// Supabase: passano da qui.
//
// Il client Supabase si riceve come parametro (dal browser, quello di
// src/lib/supabase/client.ts): così i test lo sostituiscono senza toccare
// il modulo. Fino al branch username-dopo-accesso le chiamava anche la
// Server Action della registrazione, con il client del server; ora lo
// username si sceglie solo dopo l'accesso, da utente autenticato.

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

// Lo username di chi è entrato: la RLS fa leggere solo la propria riga, il
// filtro su user_id lo rende esplicito. `username: null` = non l'ha ancora
// scelto; "errore" = la risposta non è arrivata (offline, sessione
// scaduta), e allora non si sa. Un oggetto e non una stringa: "errore" è
// anche uno username valido.
export type LetturaUsername = { esito: "ok"; username: string | null } | { esito: "errore" };

export async function leggiMioUsername(
  supabase: SupabaseClient,
  userId: string
): Promise<LetturaUsername> {
  try {
    const { data, error } = await supabase
      .from("nomi_utente")
      .select("username")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { esito: "errore" };
    return { esito: "ok", username: typeof data?.username === "string" ? data.username : null };
  } catch {
    return { esito: "errore" };
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
