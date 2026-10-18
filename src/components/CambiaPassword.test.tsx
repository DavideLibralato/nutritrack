// Cambia password (CambiaPassword.tsx). Casi fissati per sempre:
// - senza rete: il riquadro "Serve la connessione", pulsante spento, e
//   nessuna richiesta parte nemmeno inviando il modulo;
// - la richiesta vera (PUT /user, quella che auth-js manda al server)
//   porta la password attuale come `current_password`;
// - dopo l'ok si torna a Profilo con ?password=aggiornata, con replace;
// - "attuale sbagliata" dopo una risposta persa ha il suo testo, e un
//   controllo sul dispositivo in mezzo (campo vuoto) non lo cancella: non
//   ha parlato col server.
//
// Client Supabase vero (supabase-js installato) con la sessione già salvata
// in una memoria finta; finta solo la rete. Qualunque richiesta non
// prevista viene annotata e fa fallire il test.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { createClient as creaClientSupabase, type SupabaseClient } from "@supabase/supabase-js";
import CambiaPassword from "./CambiaPassword";

const URL_SUPABASE = "https://progetto-finto.supabase.co";
const AUTH = `${URL_SUPABASE}/auth/v1`;
const UTENTE = { id: "11111111-1111-4111-8111-111111111111", email: "prova@esempio.it" };

const ORA = Math.floor(Date.now() / 1000);
const base64url = (testo: string) => Buffer.from(testo).toString("base64url");
const TOKEN = [
  base64url('{"alg":"HS256","typ":"JWT"}'),
  base64url(JSON.stringify({ sub: UTENTE.id, aud: "authenticated", role: "authenticated", iat: ORA, exp: ORA + 3600 })),
  base64url("firma"),
].join(".");
const UTENTE_SUPABASE = {
  id: UTENTE.id,
  aud: "authenticated",
  role: "authenticated",
  email: UTENTE.email,
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-18T00:00:00Z",
};
const SESSIONE = {
  access_token: TOKEN,
  refresh_token: "refresh-prova",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: ORA + 3600,
  user: UTENTE_SUPABASE,
};

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

// --- La rete finta --------------------------------------------------------

// Come risponde il server a PUT /user, una voce per richiesta (l'ultima si
// ripete): "ok", il codice d'errore, o "rete giù".
let risposteCambio: ("ok" | "current_password_mismatch" | "rete giù")[] = [];
const cambi: Record<string, unknown>[] = [];
const impreviste: string[] = [];

const fetchFinto = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const metodo = (init?.method ?? "GET").toUpperCase();

  if (metodo === "GET" && url === `${AUTH}/user`) return json(UTENTE_SUPABASE);
  if (metodo === "PUT" && url.split("?")[0] === `${AUTH}/user`) {
    cambi.push(JSON.parse(String(init?.body)));
    const risposta = risposteCambio.length > 1 ? risposteCambio.shift()! : risposteCambio[0];
    if (risposta === "rete giù") throw new TypeError("Load failed");
    if (risposta === "ok") return json(UTENTE_SUPABASE);
    return json({ code: 400, error_code: risposta, msg: "Current password required when setting new password." }, 400);
  }
  impreviste.push(`${metodo} ${url}`);
  return json({}, 500);
});

// Il client dell'app, sostituito da uno vero con la sessione già salvata.
let client: SupabaseClient;
vi.mock("@/lib/supabase/client", () => ({ createClient: () => client }));

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));

function impostaOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
}

beforeEach(() => {
  const memoria = new Map<string, string>([["sb-progetto-finto-auth-token", JSON.stringify(SESSIONE)]]);
  client = creaClientSupabase(URL_SUPABASE, "chiave-pubblica-finta", {
    auth: {
      storage: {
        getItem: (k) => memoria.get(k) ?? null,
        setItem: (k, v) => void memoria.set(k, v),
        removeItem: (k) => void memoria.delete(k),
      },
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: fetchFinto },
  });
  risposteCambio = ["ok"];
  cambi.length = 0;
  impreviste.length = 0;
  replace.mockClear();
  impostaOnline(true);
});

afterEach(() => {
  cleanup();
  expect(impreviste).toEqual([]);
});

const campo = (etichetta: string) => screen.getByLabelText(etichetta) as HTMLInputElement;
const pulsante = () => screen.getByRole("button", { name: "Salva nuova password" }) as HTMLButtonElement;

function compila(attuale: string, nuova: string) {
  fireEvent.change(campo("Password attuale"), { target: { value: attuale } });
  fireEvent.change(campo("Nuova password"), { target: { value: nuova } });
}

describe("CambiaPassword", () => {
  it("senza rete: avviso, pulsante spento, nessuna richiesta anche inviando il modulo", async () => {
    impostaOnline(false);
    render(<CambiaPassword />);

    expect(screen.getByText("Serve la connessione")).toBeTruthy();
    expect(pulsante().disabled).toBe(true);
    expect(screen.queryByText("Reimpostala via email")).toBeNull();

    compila("vecchia1", "nuova123");
    fireEvent.submit(pulsante().form!);
    // Lascia il tempo a una richiesta, se partisse.
    await new Promise((r) => setTimeout(r, 50));
    expect(cambi).toEqual([]);
  });

  it("con la rete: manda current_password, poi torna a Profilo con replace", async () => {
    render(<CambiaPassword />);
    expect(screen.queryByText("Serve la connessione")).toBeNull();
    // L'email per il gestore delle password, e quella scritta.
    await waitFor(() => expect(screen.getByText(UTENTE.email)).toBeTruthy());

    compila("vecchia1", "nuova123");
    fireEvent.click(pulsante());

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/impostazioni/profilo?password=aggiornata"));
    expect(cambi).toHaveLength(1);
    expect(cambi[0]).toMatchObject({ password: "nuova123", current_password: "vecchia1" });
    expect(cambi[0]).not.toHaveProperty("currentPassword");
  });

  it("password attuale sbagliata: il messaggio, si resta sulla pagina", async () => {
    risposteCambio = ["current_password_mismatch"];
    render(<CambiaPassword />);

    compila("sbagliata", "nuova123");
    fireEvent.click(pulsante());

    expect((await screen.findByRole("alert")).textContent).toBe("La password attuale non è corretta.");
    expect(replace).not.toHaveBeenCalled();
    expect(pulsante().disabled).toBe(false);
  });

  it("risposta persa, poi campo vuoto, poi attuale sbagliata: il testo che spiega", async () => {
    risposteCambio = ["rete giù", "current_password_mismatch"];
    render(<CambiaPassword />);

    compila("vecchia1", "nuova123");
    fireEvent.click(pulsante());
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/^Non so se è andata/));

    // Un controllo sul dispositivo: nessuna richiesta, il ricordo resta.
    compila("", "nuova123");
    fireEvent.click(pulsante());
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Inserisci la password attuale."));
    expect(cambi).toHaveLength(1);

    compila("vecchia1", "nuova123");
    fireEvent.click(pulsante());
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "La password attuale non è corretta. Il tentativo di prima forse è riuscito: prova a scrivere come attuale quella nuova."
      )
    );
    expect(cambi).toHaveLength(2);
  });
});
