// Integrazione: useUtenteId con il modulo VERO dell'account eliminato
// (accountEliminatoAltrove.ts). Su Oggi si montano 6 componenti che usano
// l'hook (layout, pagina, barra), e tutti ricevono `user_not_found`
// insieme: il dispositivo si pulisce, la sessione si chiude e si va su
// Accedi UNA volta sola.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { AuthApiError } from "@supabase/supabase-js";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";
import { azzeraPerTest } from "../account/accountEliminatoAltrove";
import { useUtenteId } from "./useUtente";

const A = "utente-eliminato";

// Supabase finto: la sessione salvata è di A finché signOut non la toglie;
// il server risponde user_not_found.
let sessioneDi: string | null = A;
const signOut = vi.fn();

vi.mock("./client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: new AuthApiError("User from sub claim in JWT does not exist", 403, "user_not_found"),
      }),
      getSession: async () => ({
        data: { session: sessioneDi ? { user: { id: sessioneDi } } : null },
        error: null,
      }),
      signOut: async (...args: unknown[]) => {
        signOut(...args);
        sessioneDi = null;
        return { error: null };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }),
}));

vi.mock("../serviceWorker", () => ({ svuotaPagineSalvate: vi.fn(async () => {}) }));

// window.location.replace in jsdom non naviga: lo sostituiamo per contarlo.
const replace = vi.fn();
const locationVera = window.location;

function pasto(userId: string): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-10-26T08:00:00.000Z",
    deleted_at: null,
    nome: "Pranzo",
    ora_inizio: "12:30",
    ordine: 0,
  };
}

beforeEach(async () => {
  azzeraPerTest();
  sessioneDi = A;
  signOut.mockClear();
  replace.mockClear();
  localStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...locationVera, replace },
  });
  await db.pasti.clear();
  await db.pasti.bulkPut([pasto(A), pasto(A)]);
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: locationVera });
});

describe("useUtenteId + account eliminato (integrazione)", () => {
  it("6 hook montati insieme: un solo signOut, una sola navigazione, dati tolti", async () => {
    for (let i = 0; i < 6; i++) renderHook(() => useUtenteId());

    await waitFor(() => expect(replace).toHaveBeenCalled());
    // Lasciamo finire eventuali chiamate in ritardo.
    await new Promise((r) => setTimeout(r, 20));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/login?eliminato=altrove");
    expect(await db.pasti.where("user_id").equals(A).count()).toBe(0);
  });
});
