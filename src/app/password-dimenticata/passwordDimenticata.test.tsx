// La richiesta del link di ripristino (/password-dimenticata), dal
// 18/10/2026 con il flusso implicito (clientRichiestaReset.ts).
//
// Regole che il test custodisce:
// - la richiesta parte SENZA code_challenge: è questo che rende il link
//   valido in qualunque browser (con PKCE il link funziona solo nel
//   browser che ha il "code verifier");
// - nessun cookie code-verifier scritto;
// - la sessione già aperta nel browser resta identica: il client della
//   richiesta non ha memoria e non tocca i cookie dell'app.
//
// Si passa dalla pagina vera: se un domani tornasse al client dell'app
// (PKCE), il test se ne accorge. Rete finta: qualunque richiesta non
// prevista fa fallire il test, nessuna chiamata arriva al Supabase vero.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { createBrowserClient } from "@supabase/ssr";
import PasswordDimenticataPage from "./page";

const URL_SUPABASE = "https://progetto-finto.supabase.co";
const CHIAVE = "chiave-pubblica-finta";
const AUTH = `${URL_SUPABASE}/auth/v1`;

const UTENTE_VERO = { id: "11111111-1111-4111-8111-111111111111", email: "vero@esempio.it" };
const UTENTE_PROVA = { id: "22222222-2222-4222-8222-222222222222", email: "prova@esempio.it" };

// --- La rete finta --------------------------------------------------------

type RichiestaRecover = { corpo: Record<string, unknown>; redirectTo: string | null };

const server = {
  recover: [] as RichiestaRecover[],
  impreviste: [] as string[],
};

function base64url(testo: string): string {
  return Buffer.from(testo).toString("base64url");
}

const ORA = Math.floor(Date.now() / 1000);

// Un token con la forma di un JWT vero: auth-js ne legge la scadenza.
function token(utente: { id: string }): string {
  const dati = { sub: utente.id, aud: "authenticated", role: "authenticated", iat: ORA, exp: ORA + 3600 };
  return `${base64url('{"alg":"HS256","typ":"JWT"}')}.${base64url(JSON.stringify(dati))}.firma`;
}

function sessione(utente: { id: string; email: string }) {
  return {
    access_token: token(utente),
    refresh_token: `refresh-${utente.id}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: ORA + 3600,
    user: {
      id: utente.id,
      aud: "authenticated",
      role: "authenticated",
      email: utente.email,
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-10-18T00:00:00Z",
    },
  };
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

const fetchFinto = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const metodo = (init?.method ?? "GET").toUpperCase();
  const corpo = init?.body ? JSON.parse(String(init.body)) : {};

  // /recover porta il redirectTo nell'indirizzo: ?redirect_to=...
  if (metodo === "POST" && url.split("?")[0] === `${AUTH}/recover`) {
    server.recover.push({ corpo, redirectTo: new URL(url).searchParams.get("redirect_to") });
    return json({});
  }

  if (metodo === "POST" && url === `${AUTH}/token?grant_type=password`) return json(sessione(UTENTE_PROVA));

  server.impreviste.push(`${metodo} ${url}`);
  throw new Error(`Richiesta non prevista dal test: ${metodo} ${url}`);
});

// --- Aiuti ----------------------------------------------------------------

function cancellaCookie() {
  for (const coppia of document.cookie.split(";")) {
    const nome = coppia.split("=")[0].trim();
    if (nome) document.cookie = `${nome}=; path=/; max-age=0`;
  }
}

// La sessione di un altro account già aperta in questo browser, scritta
// nei cookie veri di jsdom dal client dell'app (@supabase/ssr), come
// farebbe /login.
async function entraConAccountDiProva() {
  const supabase = createBrowserClient(URL_SUPABASE, CHIAVE, { isSingleton: false });
  const { error } = await supabase.auth.signInWithPassword({ email: UTENTE_PROVA.email, password: "segreta" });
  expect(error).toBeNull();
  expect(document.cookie).toContain("auth-token");
}

async function chiediIlLink(email: string) {
  render(<PasswordDimenticataPage />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByText("Invia link"));
  expect(await screen.findByText("Controlla la tua email")).toBeTruthy();
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPABASE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", CHIAVE);
  vi.stubGlobal("fetch", fetchFinto);
  vi.stubGlobal("BroadcastChannel", undefined);
  window.history.replaceState(null, "", "/password-dimenticata");
  server.recover = [];
  server.impreviste = [];
  cancellaCookie();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  expect(server.impreviste).toEqual([]);
});

describe("/password-dimenticata", () => {
  it("la richiesta parte senza code_challenge e con il redirectTo di sempre", async () => {
    await chiediIlLink(UTENTE_VERO.email);

    expect(server.recover).toHaveLength(1);
    const [richiesta] = server.recover;
    expect(richiesta.corpo.email).toBe(UTENTE_VERO.email);
    // Senza code_challenge il server non lega il link a questo browser.
    expect(richiesta.corpo.code_challenge ?? null).toBeNull();
    expect(richiesta.corpo.code_challenge_method ?? null).toBeNull();
    expect(richiesta.redirectTo).toBe(`${window.location.origin}/reimposta-password`);
  });

  it("nessun code verifier scritto, né nei cookie né in localStorage", async () => {
    await chiediIlLink(UTENTE_VERO.email);

    expect(document.cookie).not.toContain("code-verifier");
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it("con la sessione di un altro account aperta: i suoi cookie restano identici", async () => {
    await entraConAccountDiProva();
    const cookiePrima = document.cookie;

    await chiediIlLink(UTENTE_VERO.email);

    expect(server.recover).toHaveLength(1);
    expect(document.cookie).toBe(cookiePrima);
    expect(document.cookie).not.toContain("code-verifier");
  });
});
