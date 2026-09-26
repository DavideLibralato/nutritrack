// Chi è l'utente anche senza rete (PUNTO_DI_PARTENZA.md §10.6: "la sessione
// che scade offline non deve buttare fuori l'utente").
//
// Il problema, verificato nel codice di @supabase/auth-js 2.115.0: offline e
// con il token scaduto (il caso tipico: apro l'app la mattina, il token è
// scaduto da ore) supabase-js prova a rinnovarlo, il rinnovo fallisce per
// rete e allora
//   - getSession() risponde session: null
//   - onAuthStateChange manda INITIAL_SESSION con sessione null
//   - getUser() risponde user: null (con un errore "di rete")
// ...ma la sessione salvata NON viene cancellata: è ancora nel cookie.
// supabase-js la cancella (ed emette SIGNED_OUT) solo quando il server la
// rifiuta davvero. Per leggere e scrivere in Dexie serve solo l'id
// dell'utente, non un token valido: quindi se supabase-js dice "nessuna
// sessione" ma il cookie c'è ancora, l'id si prende da lì.
//
// Regola: un errore di rete non porta MAI a "nessun utente". Solo un'uscita
// vera (SIGNED_OUT) o un rifiuto vero del server (utente cancellato,
// sessione revocata).

import type { AuthChangeEvent, AuthError } from "@supabase/supabase-js";
import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";
import { parseCookieHeader, stringFromBase64URL } from "@supabase/ssr";

// --- Lettura della sessione salvata -------------------------------------

// Il nome del cookie con la sessione: è il predefinito di supabase-js
// (`sb-<ref del progetto>-auth-token`), che il nostro createClient non
// cambia.
export function chiaveSessione(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

export type SessioneSalvata = {
  id: string;
  metadati: Record<string, unknown> | undefined;
};

// Legge la sessione dal cookie, senza rete e senza guardare la scadenza.
// Formato scritto da @supabase/ssr (createBrowserClient): il valore può
// essere spezzato in più cookie (`<chiave>.0`, `<chiave>.1`, ...) se è
// lungo, e inizia con "base64-" seguito dal JSON della sessione in base64url.
export function leggiSessioneSalvata(
  cookieHeader: string,
  chiave: string
): SessioneSalvata | null {
  const cookie = new Map(parseCookieHeader(cookieHeader).map((c) => [c.name, c.value ?? ""]));

  let valore = cookie.get(chiave);
  if (valore === undefined) {
    const pezzi: string[] = [];
    for (let i = 0; cookie.has(`${chiave}.${i}`); i++) pezzi.push(cookie.get(`${chiave}.${i}`)!);
    if (pezzi.length === 0) return null;
    valore = pezzi.join("");
  }

  try {
    const json = valore.startsWith("base64-") ? stringFromBase64URL(valore.slice(7)) : valore;
    const sessione = JSON.parse(json);
    const id = sessione?.user?.id;
    if (typeof id !== "string" || id === "") return null;
    return { id, metadati: sessione.user.user_metadata };
  } catch {
    // Cookie illeggibile: come se non ci fosse.
    return null;
  }
}

// --- Decidere chi è l'utente --------------------------------------------

// "rete": non si sa niente (offline, server che non risponde, errore
// imprevisto) — non cambia nulla. "autenticazione": il server ha detto di no.
export type EsitoVerifica = "rete" | "autenticazione" | null;

export function classificaErroreVerifica(errore: AuthError | null): EsitoVerifica {
  if (!errore) return null;
  if (isAuthRetryableFetchError(errore)) return "rete";
  // Nessuna sessione (mai entrati, o già cancellata da supabase-js).
  if (isAuthSessionMissingError(errore)) return "autenticazione";
  // Utente cancellato, sessione revocata, token rifiutato.
  if (isAuthApiError(errore) && [401, 403, 404].includes(errore.status ?? 0)) {
    return "autenticazione";
  }
  // Tutto il resto (es. un 500 del server): nel dubbio non si butta fuori.
  return "rete";
}

export type StatoUtente = {
  // undefined = non so ancora, null = nessun utente, stringa = l'id.
  userId: string | null | undefined;
  // Il server ha rifiutato l'utente: la sessione salvata non basta più,
  // finché non si rientra (SIGNED_IN).
  rifiutato: boolean;
};

export const STATO_UTENTE_INIZIALE: StatoUtente = { userId: undefined, rifiutato: false };

export type SegnaleUtente =
  // Da onAuthStateChange. idSalvato: l'id letto dal cookie, usato solo se
  // supabase-js non dà una sessione.
  | { tipo: "evento"; evento: AuthChangeEvent; idSessione: string | null; idSalvato: string | null }
  // Da getUser(): la verifica col server.
  | { tipo: "verifica"; idUtente: string | null; esito: EsitoVerifica };

// Funzione pura: dato lo stato attuale e un segnale, il nuovo stato. I
// segnali arrivano in ordine qualunque (getUser e INITIAL_SESSION corrono
// in parallelo), per questo "rete" non tocca mai lo stato.
export function prossimoStatoUtente(stato: StatoUtente, segnale: SegnaleUtente): StatoUtente {
  if (segnale.tipo === "verifica") {
    if (segnale.idUtente) return { userId: segnale.idUtente, rifiutato: false };
    if (segnale.esito === "autenticazione") return { userId: null, rifiutato: true };
    return stato;
  }

  const { evento, idSessione, idSalvato } = segnale;
  if (evento === "SIGNED_OUT") return { userId: null, rifiutato: false };
  if (evento === "SIGNED_IN" && idSessione) return { userId: idSessione, rifiutato: false };
  if (stato.rifiutato) return stato;
  if (idSessione) return { userId: idSessione, rifiutato: false };
  // Sessione null all'avvio: o non si è mai entrati (cookie assente → null)
  // o il rinnovo è fallito per rete (cookie presente → quell'id).
  if (evento === "INITIAL_SESSION") return { userId: idSalvato, rifiutato: false };
  return stato;
}
