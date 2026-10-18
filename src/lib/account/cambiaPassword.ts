// "Cambia password" per chi ha già fatto l'accesso (Impostazioni > Profilo >
// Password, mockup docs/mockups/cambia-password.html): password attuale e
// nuova, senza passare dall'email. Il componente (CambiaPassword.tsx)
// mostra l'esito; qui non c'è interfaccia.
//
// La chiamata è updateUser({ password, current_password }). Il nome è
// `current_password`, non `currentPassword` come nella guida "Password-based
// Auth": auth-js 2.115.0 manda gli attributi così come sono nel corpo di
// PUT /user, e il server legge solo `current_password`.
//
// Cosa fa il server (supabase/auth, internal/api/user.go), verificato il
// 18/10/2026:
// - la password attuale si controlla SOLO con "Require current password
//   when updating" accesa sulla dashboard (lo è, controllata da Davide il
//   18/10): spenta, il campo verrebbe ignorato senza errori. Le sessioni
//   nate da un link di Reimposta sono esentate;
// - "attuale mancante" e "attuale sbagliata" hanno lo STESSO testo
//   inglese: si decide dal codice, mai dal testo;
// - la sessione di questo dispositivo resta, con gli stessi token (niente
//   refreshSession); quelle degli altri dispositivi le chiude il server
//   (LogoutAllExceptMe), che lì finiscono in "sessione scaduta" entro
//   un'ora circa, senza perdere le modifiche in coda.
//
// L'ordine:
// 1. controlli sul dispositivo (campi vuoti, lunghezza, nuova = attuale);
// 2. il server risponde ed è ancora questo utente (getUser)? Se no, la
//    richiesta non parte: "rete" vuol dire con certezza "non cambiata";
// 3. la chiamata. Senza risposta non si sa se è arrivata: "risposta-persa".

import type { AuthError } from "@supabase/supabase-js";
import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  isAuthWeakPasswordError,
} from "@supabase/supabase-js";
import { createClient } from "../supabase/client";
import { classificaErroreVerifica } from "../supabase/utenteOffline";
import { conTempoMassimo, SCADUTA } from "../sync/tempoMassimo";
import { ATTUALE_SBAGLIATA_DOPO_RISPOSTA_PERSA, TESTI_CAMBIO_PASSWORD } from "../erroriAuth";

export type EsitoCambio = "ok" | keyof typeof TESTI_CAMBIO_PASSWORD;

// Lo stesso minimo del server (Auth > Password, 6 caratteri).
export const LUNGHEZZA_MINIMA_PASSWORD = 6;

// 1. Prima di chiamare il server. Le password non si accorciano agli spazi
// ai bordi: uno spazio può far parte della password.
export function controllaPrimaDellInvio(
  attuale: string,
  nuova: string
): Exclude<EsitoCambio, "ok"> | null {
  if (!attuale) return "attuale-mancante";
  if (!nuova) return "nuova-mancante";
  if (nuova.length < LUNGHEZZA_MINIMA_PASSWORD) return "troppo-corta";
  if (nuova === attuale) return "uguale";
  return null;
}

// L'errore di updateUser, tradotto in un esito.
export function classificaErroreCambio(errore: AuthError): EsitoCambio {
  // Rete caduta o server momentaneamente giù (status 0, 502-504): la
  // richiesta può essere arrivata o no.
  if (isAuthRetryableFetchError(errore)) return "risposta-persa";
  // reasons: "length" (troppo corta), "characters", "pwned".
  if (isAuthWeakPasswordError(errore)) {
    return errore.reasons.includes("length") ? "troppo-corta" : "debole";
  }
  if (isAuthSessionMissingError(errore)) return "sessione";

  switch (errore.code) {
    case "current_password_mismatch":
      return "attuale-sbagliata";
    case "current_password_required":
      return "attuale-mancante";
    case "same_password":
      return "uguale";
    case "weak_password":
      return "troppo-corta";
    // Solo con "Secure password change" accesa (è spenta) e la sessione
    // nata più di 24 ore prima.
    case "reauthentication_needed":
      return "riautenticazione";
  }

  // Sessione chiusa (anche dal cambio password su un altro dispositivo),
  // token rifiutato, utente cancellato.
  if (isAuthApiError(errore) && [401, 403, 404].includes(errore.status ?? 0)) return "sessione";
  return "errore";
}

export async function cambiaPassword(attuale: string, nuova: string): Promise<EsitoCambio> {
  const primaDellInvio = controllaPrimaDellInvio(attuale, nuova);
  if (primaDellInvio) return primaDellInvio;

  const supabase = createClient();

  // 2. Il server risponde ed è ancora questo utente?
  try {
    const verifica = await conTempoMassimo(supabase.auth.getUser());
    if (verifica === SCADUTA) return "rete";
    if (verifica.error) {
      return classificaErroreVerifica(verifica.error) === "autenticazione" ? "sessione" : "rete";
    }
  } catch {
    return "rete";
  }

  // 3. La chiamata. Un errore lanciato invece che restituito arriva dopo
  // l'invio: come una risposta persa.
  try {
    const risposta = await conTempoMassimo(
      supabase.auth.updateUser({ password: nuova, current_password: attuale })
    );
    if (risposta === SCADUTA) return "risposta-persa";
    if (!risposta.error) return "ok";
    return classificaErroreCambio(risposta.error);
  } catch {
    return "risposta-persa";
  }
}

// Il testo da mostrare sotto il modulo. `precedente`: l'esito del tentativo
// prima di questo, sulla stessa pagina.
export function testoEsitoCambio(
  esito: Exclude<EsitoCambio, "ok">,
  precedente: EsitoCambio | null
): string {
  if (esito === "attuale-sbagliata" && precedente === "risposta-persa") {
    return ATTUALE_SBAGLIATA_DOPO_RISPOSTA_PERSA;
  }
  return TESTI_CAMBIO_PASSWORD[esito];
}
