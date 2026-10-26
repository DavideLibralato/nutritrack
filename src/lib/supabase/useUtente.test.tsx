// useUtenteId e l'account eliminato da un altro dispositivo (dal
// 26/10/2026). L'hook fa partire la pulizia e l'uscita
// (accountEliminatoAltrove.ts) SOLO con `user_not_found`: è l'unica
// risposta che dice "questo account non esiste più". Tutto il resto — rete,
// errore del server, token rifiutato, sessione revocata, un altro 403 —
// non deve mai cancellare i dati del telefono (utenteOffline.ts: "un errore
// di rete non porta MAI a nessun utente"). Lo stato dell'hook resta quello
// di prima: con un rifiuto del server, nessun utente.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  AuthApiError,
  AuthRetryableFetchError,
  type AuthError,
} from "@supabase/supabase-js";
import { useUtenteId } from "./useUtente";

const gestisci = vi.fn(async () => "uscito" as const);
vi.mock("../account/accountEliminatoAltrove", () => ({
  gestisciAccountEliminatoAltrove: () => gestisci(),
}));

// Supabase finto: getUser risponde con `errore` (null = utente valido).
let errore: AuthError | null = null;
const ID = "utente-1";

vi.mock("./client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: errore ? null : { id: ID } }, error: errore }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }),
}));

beforeEach(() => {
  errore = null;
  gestisci.mockClear();
});

// Monta l'hook e aspetta che la verifica col server sia arrivata.
async function verifica() {
  const hook = renderHook(() => useUtenteId());
  await waitFor(() => expect(hook.result.current).not.toBeUndefined());
  return hook;
}

describe("useUtenteId e l'account eliminato", () => {
  it("user_not_found: parte la pulizia, e l'utente diventa null come prima", async () => {
    errore = new AuthApiError("User from sub claim in JWT does not exist", 403, "user_not_found");
    const { result } = await verifica();
    expect(result.current).toBeNull();
    await waitFor(() => expect(gestisci).toHaveBeenCalledTimes(1));
  });

  it("utente valido: nessuna pulizia", async () => {
    const { result } = await verifica();
    expect(result.current).toBe(ID);
    expect(gestisci).not.toHaveBeenCalled();
  });

  it.each([
    ["rete", () => new AuthRetryableFetchError("Failed to fetch", 0)],
    ["errore del server (500)", () => new AuthApiError("errore server", 500, undefined)],
    ["token rifiutato (401)", () => new AuthApiError("invalid JWT", 401, "bad_jwt")],
    ["sessione revocata (403 session_not_found)", () => new AuthApiError("Session not found", 403, "session_not_found")],
    ["un altro 403", () => new AuthApiError("Forbidden", 403, "not_admin")],
  ])("%s: la pulizia non parte mai", async (_nome, crea) => {
    errore = crea();
    renderHook(() => useUtenteId());
    // Il getUser finto risponde subito: lasciamo passare qualche giro.
    await new Promise((r) => setTimeout(r, 20));
    expect(gestisci).not.toHaveBeenCalled();
  });
});
