// Il link di ripristino della password (/reimposta-password?code=...).
//
// Bug corretto il 10/10/2026: alla prima apertura del link compariva "Link
// non valido", e solo ricaricando la pagina il modulo. Il client Supabase
// scambia da solo il codice appena nasce (detectSessionInUrl); la pagina
// lo scambiava una seconda volta, trovava il "code verifier" già usato e
// cancellato, e mostrava l'errore anche se l'accesso era riuscito.
//
// Regola che il test custodisce: con ?code= il modulo compare SOLO se la
// sessione è nata dallo scambio di quel link. Una sessione già aperta nel
// browser (per esempio l'account di prova in Safari) non basta: la
// password nuova finirebbe sull'account sbagliato.
//
// Client Supabase vero (@supabase/ssr + auth-js, quelli installati), con
// i cookie di jsdom; finta solo la rete. Il fetch finto conosce poche
// richieste: qualunque altra viene annotata e fa fallire il test, così
// nessuna chiamata può arrivare al Supabase vero (che comunque non è
// nemmeno l'indirizzo configurato qui).

import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { createBrowserClient } from "@supabase/ssr";
import { traduciErroreAuth } from "@/lib/erroriAuth";
import { createClient } from "@/lib/supabase/client";
import ReimpostaPasswordPage from "./page";

const URL_SUPABASE = "https://progetto-finto.supabase.co";
const CHIAVE = "chiave-pubblica-finta";
const AUTH = `${URL_SUPABASE}/auth/v1`;

const CODICE_DEL_LINK = "codice-del-link";
const UTENTE_VERO = { id: "11111111-1111-4111-8111-111111111111", email: "vero@esempio.it" };
const UTENTE_PROVA = { id: "22222222-2222-4222-8222-222222222222", email: "prova@esempio.it" };

// --- La rete finta --------------------------------------------------------

const server = {
  // true: il server rifiuta il codice (scaduto o già usato).
  rifiutaCodice: false,
  scambi: 0,
  impreviste: [] as string[],
};

function base64url(testo: string): string {
  return Buffer.from(testo).toString("base64url");
}

// Un token con la forma di un JWT vero: auth-js ne legge la scadenza.
function token(utente: { id: string }): string {
  const ora = Math.floor(Date.now() / 1000);
  const dati = { sub: utente.id, aud: "authenticated", role: "authenticated", iat: ora, exp: ora + 3600 };
  return `${base64url('{"alg":"HS256","typ":"JWT"}')}.${base64url(JSON.stringify(dati))}.firma`;
}

function utenteSupabase(utente: { id: string; email: string }) {
  return {
    id: utente.id,
    aud: "authenticated",
    role: "authenticated",
    email: utente.email,
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-10T00:00:00Z",
  };
}

function sessione(utente: { id: string; email: string }) {
  return {
    access_token: token(utente),
    refresh_token: `refresh-${utente.id}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: utenteSupabase(utente),
  };
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}

const fetchFinto = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const metodo = (init?.method ?? "GET").toUpperCase();
  const corpo = init?.body ? JSON.parse(String(init.body)) : {};

  // /recover porta anche ?redirect_to=...: conta il percorso.
  if (metodo === "POST" && url.split("?")[0] === `${AUTH}/recover`) return json({});

  if (metodo === "POST" && url === `${AUTH}/token?grant_type=pkce`) {
    server.scambi++;
    if (server.rifiutaCodice) {
      return json(
        { code: 404, error_code: "flow_state_not_found", msg: "invalid flow state, no valid flow state found" },
        404
      );
    }
    if (corpo.auth_code === CODICE_DEL_LINK && corpo.code_verifier) return json(sessione(UTENTE_VERO));
  }

  if (metodo === "POST" && url === `${AUTH}/token?grant_type=password`) return json(sessione(UTENTE_PROVA));

  if (metodo === "GET" && url === `${AUTH}/user`) {
    const autorizzazione = new Headers(init?.headers).get("Authorization") ?? "";
    for (const utente of [UTENTE_VERO, UTENTE_PROVA]) {
      if (autorizzazione === `Bearer ${token(utente)}`) return json(utenteSupabase(utente));
    }
  }

  server.impreviste.push(`${metodo} ${url}`);
  throw new Error(`Richiesta non prevista dal test: ${metodo} ${url}`);
});

// --- Next.js e singleton --------------------------------------------------

// Come in Next: i parametri letti al caricamento non cambiano quando la
// libreria toglie ?code= dall'indirizzo (vedi page.tsx).
let parametriPagina = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
  useSearchParams: () => parametriPagina,
}));

// Il singleton vero (createBrowserClient in @supabase/ssr) vive in
// node_modules, che vi.resetModules() non ricarica: resterebbe lo stesso
// per tutti i casi, nato con l'indirizzo del primo. Qui lo si rifà uguale,
// ma uno per ogni caricamento di pagina (apriPagina lo azzera). Il client
// dentro resta quello vero; le chiamate con isSingleton esplicito
// (clientPreparazione) passano dritte.
const singleton = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@supabase/ssr", async (importOriginal) => {
  const originale = await importOriginal<typeof import("@supabase/ssr")>();
  return {
    ...originale,
    createBrowserClient: ((url: string, chiave: string, opzioni?: Record<string, unknown>) => {
      if (opzioni && "isSingleton" in opzioni) return originale.createBrowserClient(url, chiave, opzioni);
      singleton.client ??= originale.createBrowserClient(url, chiave, { ...opzioni, isSingleton: false });
      return singleton.client;
    }) as typeof originale.createBrowserClient,
  };
});

// --- Aiuti ----------------------------------------------------------------

function vaiA(percorso: string) {
  window.history.replaceState(null, "", percorso);
}

function cancellaCookie() {
  for (const coppia of document.cookie.split(";")) {
    const nome = coppia.split("=")[0].trim();
    if (nome) document.cookie = `${nome}=; path=/; max-age=0`;
  }
}

// Un client a parte, nello stesso browser, per preparare la scena prima di
// aprire il link: è come la pagina /password-dimenticata o /login, aperta
// in un momento precedente. Scrive nei cookie veri di jsdom.
function clientPreparazione() {
  vaiA("/login");
  return createBrowserClient(URL_SUPABASE, CHIAVE, { isSingleton: false });
}

async function chiediIlLink() {
  const supabase = clientPreparazione();
  const { error } = await supabase.auth.resetPasswordForEmail(UTENTE_VERO.email, {
    redirectTo: `${window.location.origin}/reimposta-password`,
  });
  expect(error).toBeNull();
  expect(document.cookie).toContain("code-verifier");
}

async function entraConAccountDiProva() {
  const supabase = clientPreparazione();
  const { error } = await supabase.auth.signInWithPassword({ email: UTENTE_PROVA.email, password: "segreta" });
  expect(error).toBeNull();
}

let clientPrecedente: unknown = null;

// Il test vale solo se ogni caso ha il suo client: con quello del caso
// prima, nato con un altro indirizzo, lo scambio automatico non partirebbe.
function controllaClientNuovo() {
  const client = createClient();
  expect(client).not.toBe(clientPrecedente);
  clientPrecedente = client;
}

// Un caricamento di pagina nuovo: un client singleton nuovo, che nasce con
// l'indirizzo del link. `clientPrimaDellaPagina`: il client lo crea prima
// qualcun altro, come useUtenteId nel layout radice.
function apriPagina(percorso: string, { clientPrimaDellaPagina = false } = {}) {
  vaiA(percorso);
  parametriPagina = new URLSearchParams(new URL(window.location.href).search);
  singleton.client = null;
  if (clientPrimaDellaPagina) controllaClientNuovo();
  // StrictMode: come in `npm run dev`, gli effect girano due volte.
  render(
    <StrictMode>
      <ReimpostaPasswordPage />
    </StrictMode>
  );
  if (!clientPrimaDellaPagina) controllaClientNuovo();
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPABASE);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", CHIAVE);
  vi.stubGlobal("fetch", fetchFinto);
  // Le schede che si parlano: qui ogni caso è un browser a sé.
  vi.stubGlobal("BroadcastChannel", undefined);
  server.rifiutaCodice = false;
  server.scambi = 0;
  server.impreviste = [];
  cancellaCookie();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  expect(server.impreviste).toEqual([]);
});

const MODULO = "Imposta una nuova password";
const ERRORE = "Link non valido";

describe("/reimposta-password", () => {
  it("verifier presente: compare il modulo, una sola chiamata di scambio", async () => {
    await chiediIlLink();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);

    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(screen.queryByText(ERRORE)).toBeNull();
    expect(server.scambi).toBe(1);
    // Lo scambio l'ha fatto la libreria, che ha tolto il codice.
    expect(window.location.search).toBe("");
  });

  it("verifier presente e client creato prima della pagina (layout radice): compare il modulo", async () => {
    await chiediIlLink();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`, { clientPrimaDellaPagina: true });

    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(server.scambi).toBe(1);
  });

  it("verifier assente, nessuna sessione: errore", async () => {
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
    expect(server.scambi).toBe(0);
  });

  it("verifier assente ma sessione di un altro account nei cookie: errore, non il modulo", async () => {
    await entraConAccountDiProva();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
    expect(server.scambi).toBe(0);
  });

  it("il server rifiuta il codice (scaduto o già usato): errore tradotto", async () => {
    server.rifiutaCodice = true;
    await chiediIlLink();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    const atteso = traduciErroreAuth("invalid flow state, no valid flow state found");
    expect(atteso).not.toBe(traduciErroreAuth("messaggio sconosciuto"));
    expect(screen.getByText(atteso)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
    expect(server.scambi).toBe(1);
  });

  it("nessun ?code= e sessione presente (ricaricamento dopo lo scambio): modulo", async () => {
    await entraConAccountDiProva();
    apriPagina("/reimposta-password");

    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(screen.queryByText(ERRORE)).toBeNull();
  });
});
