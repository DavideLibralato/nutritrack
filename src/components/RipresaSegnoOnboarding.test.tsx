// La ripresa del segno dell'onboarding nel layout principale (dal 17/10).
// La regola che non deve rompersi in silenzio: per gli utenti di prima,
// senza nessun segno, il componente non aggiunge nessuna chiamata di rete,
// né all'avvio, né al ritorno della rete, né durante i giri della
// sincronizzazione. Ogni metodo del client Supabase finto è una spia.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { stringToBase64URL } from "@supabase/ssr";
import RipresaSegnoOnboarding from "./RipresaSegnoOnboarding";
import { chiaveSessione } from "@/lib/supabase/utenteOffline";
import { chiaveSegnoLocale } from "@/lib/onboarding/segnoOnboarding";
import { azzeraStatoGiri, segnaFineGiro, segnaInizioGiro } from "@/lib/sync/statoSincronizzazione";

const URL_SUPABASE = "https://progetto.supabase.co";

const rete = vi.hoisted(() => ({ chiamate: [] as string[], updateUserFallisce: false }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: new Proxy(
      {},
      {
        get: (_bersaglio, metodo: string) => async () => {
          rete.chiamate.push(`auth.${metodo}`);
          if (metodo === "getSession") return { data: { session: { user: { id: "u1" } } } };
          if (metodo === "updateUser" && rete.updateUserFallisce) {
            return { data: { user: null }, error: { message: "Failed to fetch" } };
          }
          return { data: { user: {} }, error: null };
        },
      }
    ),
    from: (tabella: string) => {
      rete.chiamate.push(`from.${tabella}`);
      throw new Error("nessuna tabella da leggere qui");
    },
    rpc: (nome: string) => {
      rete.chiamate.push(`rpc.${nome}`);
      throw new Error("nessuna funzione da chiamare qui");
    },
  }),
}));

function cookieSessione(metadati: Record<string, unknown>) {
  const valore = "base64-" + stringToBase64URL(JSON.stringify({ user: { id: "u1", user_metadata: metadati } }));
  document.cookie = `${chiaveSessione(URL_SUPABASE)}=${valore}; path=/`;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPABASE);
  rete.chiamate = [];
  rete.updateUserFallisce = false;
  window.localStorage.clear();
  azzeraStatoGiri();
});

afterEach(() => {
  document.cookie = `${chiaveSessione(URL_SUPABASE)}=; path=/; max-age=0`;
  vi.unstubAllEnvs();
});

describe("RipresaSegnoOnboarding", () => {
  it("utente senza segno: nessuna chiamata, all'avvio, al ritorno della rete e durante un giro", async () => {
    cookieSessione({ nome: "Giulia", username: "giulia" });
    render(<RipresaSegnoOnboarding />);

    act(() => {
      window.dispatchEvent(new Event("online"));
      segnaInizioGiro("discesa");
      segnaFineGiro("discesa", "ok", { parlatoColServer: true, tabelleNonScaricate: [] });
    });
    // Lascia finire qualunque lavoro asincrono partito.
    await new Promise((fine) => setTimeout(fine, 20));

    expect(rete.chiamate).toEqual([]);
  });

  it("nessuna sessione salvata: nessuna chiamata", async () => {
    render(<RipresaSegnoOnboarding />);
    act(() => window.dispatchEvent(new Event("online")));
    await new Promise((fine) => setTimeout(fine, 20));
    expect(rete.chiamate).toEqual([]);
  });

  it("con un esito in sospeso lo manda all'avvio (il test sa vedere le chiamate)", async () => {
    cookieSessione({ onboarding: "da_fare" });
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "fatto");
    render(<RipresaSegnoOnboarding />);
    await waitFor(() => expect(rete.chiamate).toContain("auth.updateUser"));
  });
});

describe("RipresaSegnoOnboarding — dopo un invio fallito", () => {
  it("i giri non ritentano: avvio fallito, poi due giri → una sola chiamata a updateUser", async () => {
    // Si parte da un avvio, che ritenta sempre: il ricordo dei fallimenti
    // lasciato dagli altri test non conta.
    cookieSessione({ onboarding: "da_fare" });
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "fatto");
    rete.updateUserFallisce = true;

    render(<RipresaSegnoOnboarding />);
    await waitFor(() => expect(rete.chiamate).toContain("auth.updateUser"));

    act(() => {
      segnaInizioGiro("discesa");
      segnaFineGiro("discesa", "ok", { parlatoColServer: true, tabelleNonScaricate: [] });
    });
    await new Promise((fine) => setTimeout(fine, 20));

    expect(rete.chiamate.filter((c) => c === "auth.updateUser")).toHaveLength(1);
  });
});
