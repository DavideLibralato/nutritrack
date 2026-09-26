// Chi è l'utente quando la rete manca (utenteOffline.ts). Il caso che non
// fa rumore: offline con il token scaduto supabase-js dice "nessuna
// sessione" e l'app, senza userId, non mostra più i dati locali — che sono
// tutti lì in Dexie.

import { describe, expect, it } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
} from "@supabase/supabase-js";
import { createChunks, stringToBase64URL } from "@supabase/ssr";
import {
  chiaveSessione,
  classificaErroreVerifica,
  leggiSessioneSalvata,
  prossimoStatoUtente,
  STATO_UTENTE_INIZIALE,
  type SegnaleUtente,
  type StatoUtente,
} from "./utenteOffline";

const CHIAVE = chiaveSessione("https://ftpsepmneemrwgdbhlgo.supabase.co");
const ID = "7d3c9a4e-0000-4000-8000-000000000001";

// Scrive il cookie come fa @supabase/ssr: "base64-" + JSON in base64url,
// spezzato in più cookie se lungo (createChunks è la loro funzione).
function cookieSessione(sessione: object): string {
  const valore = "base64-" + stringToBase64URL(JSON.stringify(sessione));
  return createChunks(CHIAVE, valore)
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}

// Una sessione con il token scaduto da ore: la lettura non guarda la scadenza.
const SESSIONE_SCADUTA = {
  access_token: "x".repeat(900),
  refresh_token: "r",
  expires_at: Math.floor(Date.now() / 1000) - 6 * 3600,
  user: { id: ID, user_metadata: { nome: "Davide" } },
};

describe("leggiSessioneSalvata", () => {
  it("chiave predefinita di supabase-js", () => {
    expect(CHIAVE).toBe("sb-ftpsepmneemrwgdbhlgo-auth-token");
  });

  it("legge l'id da una sessione scaduta, anche spezzata in più cookie", () => {
    const grande = { ...SESSIONE_SCADUTA, access_token: "x".repeat(5000) };
    const cookie = `altro=1; ${cookieSessione(grande)}`;
    expect(cookie).toContain(`${CHIAVE}.1=`); // davvero spezzata
    expect(leggiSessioneSalvata(cookie, CHIAVE)).toEqual({ id: ID, metadati: { nome: "Davide" } });
  });

  it("cookie in un pezzo solo", () => {
    expect(leggiSessioneSalvata(cookieSessione(SESSIONE_SCADUTA), CHIAVE)?.id).toBe(ID);
  });

  it("nessun cookie, cookie di un altro progetto o illeggibile: null", () => {
    expect(leggiSessioneSalvata("", CHIAVE)).toBeNull();
    expect(leggiSessioneSalvata("sb-altro-auth-token=base64-e30", CHIAVE)).toBeNull();
    expect(leggiSessioneSalvata(`${CHIAVE}=base64-%%%`, CHIAVE)).toBeNull();
    expect(leggiSessioneSalvata(`${CHIAVE}=base64-${stringToBase64URL("{}")}`, CHIAVE)).toBeNull();
  });
});

describe("classificaErroreVerifica", () => {
  it("rete: offline, server irraggiungibile, errori imprevisti", () => {
    expect(classificaErroreVerifica(new AuthRetryableFetchError("Failed to fetch", 0))).toBe("rete");
    expect(classificaErroreVerifica(new AuthUnknownError("boh", new Error()))).toBe("rete");
    expect(classificaErroreVerifica(new AuthApiError("errore server", 500, undefined))).toBe("rete");
  });

  it("autenticazione: nessuna sessione, utente cancellato, sessione revocata", () => {
    expect(classificaErroreVerifica(new AuthSessionMissingError())).toBe("autenticazione");
    expect(classificaErroreVerifica(new AuthApiError("User not found", 403, "user_not_found"))).toBe("autenticazione");
    expect(classificaErroreVerifica(new AuthApiError("Session not found", 403, "session_not_found"))).toBe("autenticazione");
    expect(classificaErroreVerifica(new AuthApiError("invalid JWT", 401, "bad_jwt"))).toBe("autenticazione");
  });

  it("nessun errore: null", () => {
    expect(classificaErroreVerifica(null)).toBeNull();
  });
});

function applica(...segnali: SegnaleUtente[]): StatoUtente {
  return segnali.reduce(prossimoStatoUtente, STATO_UTENTE_INIZIALE);
}

const INIZIALE_NULL_CON_COOKIE: SegnaleUtente = {
  tipo: "evento",
  evento: "INITIAL_SESSION",
  idSessione: null,
  idSalvato: ID,
};
const VERIFICA_RETE: SegnaleUtente = { tipo: "verifica", idUtente: null, esito: "rete" };

describe("prossimoStatoUtente", () => {
  it("mattina, offline, token scaduto: l'id viene dal cookie, in qualunque ordine arrivino i segnali", () => {
    expect(applica(INIZIALE_NULL_CON_COOKIE, VERIFICA_RETE).userId).toBe(ID);
    expect(applica(VERIFICA_RETE, INIZIALE_NULL_CON_COOKIE).userId).toBe(ID);
  });

  it("un errore di rete non porta mai a null", () => {
    const entrato = applica({ tipo: "evento", evento: "INITIAL_SESSION", idSessione: ID, idSalvato: null });
    expect(prossimoStatoUtente(entrato, VERIFICA_RETE).userId).toBe(ID);
    // Prima di sapere qualcosa resta "non so ancora", non "nessuno"
    expect(applica(VERIFICA_RETE).userId).toBeUndefined();
  });

  it("mai entrati (nessun cookie): null", () => {
    expect(
      applica({ tipo: "evento", evento: "INITIAL_SESSION", idSessione: null, idSalvato: null }).userId
    ).toBeNull();
  });

  it("online: la verifica col server conferma l'utente", () => {
    expect(applica({ tipo: "verifica", idUtente: ID, esito: null }).userId).toBe(ID);
  });

  it("Esci (SIGNED_OUT): null", () => {
    expect(applica(INIZIALE_NULL_CON_COOKIE, { tipo: "evento", evento: "SIGNED_OUT", idSessione: null, idSalvato: null }).userId).toBeNull();
  });

  it("utente cancellato o sessione revocata: null, e il cookie ancora presente non lo fa rientrare", () => {
    const rifiuto: SegnaleUtente = { tipo: "verifica", idUtente: null, esito: "autenticazione" };
    // Il rifiuto arriva dopo la sessione iniziale...
    expect(applica(INIZIALE_NULL_CON_COOKIE, rifiuto).userId).toBeNull();
    // ...o prima: la sessione iniziale (anche valida) non lo annulla
    expect(applica(rifiuto, INIZIALE_NULL_CON_COOKIE).userId).toBeNull();
    expect(applica(rifiuto, { tipo: "evento", evento: "INITIAL_SESSION", idSessione: ID, idSalvato: null }).userId).toBeNull();
    // Rientrare con un login nuovo sì
    expect(applica(rifiuto, { tipo: "evento", evento: "SIGNED_IN", idSessione: ID, idSalvato: null }).userId).toBe(ID);
  });
});
