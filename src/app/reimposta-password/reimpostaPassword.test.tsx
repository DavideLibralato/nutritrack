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
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/client";
import ReimpostaPasswordPage from "./page";

const URL_SUPABASE = "https://progetto-finto.supabase.co";
const CHIAVE = "chiave-pubblica-finta";
const AUTH = `${URL_SUPABASE}/auth/v1`;

const CODICE_DEL_LINK = "codice-del-link";
const UTENTE_VERO = { id: "11111111-1111-4111-8111-111111111111", email: "vero@esempio.it" };
const UTENTE_PROVA = { id: "22222222-2222-4222-8222-222222222222", email: "prova@esempio.it" };

// --- La rete finta --------------------------------------------------------

// Come il server rifiuta il codice del link. I testi inglesi sono
// verosimili ma non documentati: la pagina decide dal codice.
const RIFIUTI = {
  flow_state_not_found: "invalid flow state, no valid flow state found",
  flow_state_expired: "flow state has expired",
  bad_code_verifier: "code challenge does not match previously saved code verifier",
} as const;

const server = {
  // Il codice d'errore con cui il server rifiuta il link, o null.
  rifiutaCodice: null as keyof typeof RIFIUTI | null,
  scambi: 0,
  passwordCambiate: [] as string[],
  impreviste: [] as string[],
  // Flusso implicito: ogni GET /user (setSession verifica così i token del
  // frammento), con il frammento dell'indirizzo in quel momento.
  verificheUtente: [] as { autorizzazione: string; hash: string }[],
  // La rete cade alla verifica dei token del frammento.
  reteGiuAllaVerifica: false,
  // Il rinnovo subito dopo setSession (POST /token?grant_type=refresh_token):
  // il refresh token ricevuto e se in quel momento il modulo era già a
  // schermo.
  rinnovi: [] as { refreshToken: string; moduloVisibile: boolean }[],
  // Come risponde il server al rinnovo.
  rinnovo: "ok" as "ok" | "rifiutato" | "rete giù",
  // Le uscite (POST /logout), con lo scope.
  uscite: [] as string[],
};

// Il refresh token che il server dà al rinnovo, diverso da quello del link.
function refreshRuotato(utente: { id: string }): string {
  return `ruotato-${utente.id}`;
}

// Un utente che il server non conosce: i suoi token vengono rifiutati.
const UTENTE_SCONOSCIUTO = { id: "33333333-3333-4333-8333-333333333333", email: "sconosciuto@esempio.it" };

// Il token del link implicito. setSession controlla che ogni pezzo del JWT
// sia base64url valido, e la firma "firma" di token() non lo è (5
// caratteri): lo scambio PKCE non la controllava, quindi token() resta
// com'è per i casi di prima. Qui la firma è codificata davvero.
function tokenDelLink(utente: { id: string }): string {
  return token(utente).replace(/\.firma$/, `.${base64url("firma")}`);
}

function base64url(testo: string): string {
  return Buffer.from(testo).toString("base64url");
}

// Un token con la forma di un JWT vero: auth-js ne legge la scadenza.
// L'ora è fissata una volta per il file: il fetch finto riconosce l'utente
// confrontando il token, che deve venire uguale in ogni momento del test.
const ORA = Math.floor(Date.now() / 1000);

function token(utente: { id: string }): string {
  const dati = { sub: utente.id, aud: "authenticated", role: "authenticated", iat: ORA, exp: ORA + 3600 };
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
    expires_at: ORA + 3600,
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
      return json({ code: 400, error_code: server.rifiutaCodice, msg: RIFIUTI[server.rifiutaCodice] }, 400);
    }
    if (corpo.auth_code === CODICE_DEL_LINK && corpo.code_verifier) return json(sessione(UTENTE_VERO));
  }

  if (metodo === "POST" && url === `${AUTH}/token?grant_type=password`) return json(sessione(UTENTE_PROVA));

  // Il rinnovo della sessione nata dal frammento: refresh token nuovo,
  // stesso access token (quello che la rete finta sa riconoscere).
  if (metodo === "POST" && url === `${AUTH}/token?grant_type=refresh_token`) {
    server.rinnovi.push({
      refreshToken: corpo.refresh_token,
      moduloVisibile: screen.queryByText("Imposta una nuova password") !== null,
    });
    if (server.rinnovo === "rete giù") throw new TypeError("Failed to fetch");
    if (server.rinnovo === "rifiutato") {
      return json({ code: 400, error_code: "refresh_token_already_used", msg: "Invalid Refresh Token: Already Used" }, 400);
    }
    for (const utente of [UTENTE_VERO, UTENTE_PROVA]) {
      if (corpo.refresh_token === `refresh-${utente.id}`) {
        return json({ ...sessione(utente), access_token: tokenDelLink(utente), refresh_token: refreshRuotato(utente) });
      }
    }
  }

  if (metodo === "POST" && url.split("?")[0] === `${AUTH}/logout`) {
    server.uscite.push(new URL(url).searchParams.get("scope") ?? "");
    if (server.rinnovo === "rete giù") throw new TypeError("Failed to fetch");
    return new Response(null, { status: 204 });
  }

  // GET: chi è l'utente. PUT: il salvataggio della password nuova
  // (updateUser), annotato con l'account su cui finisce.
  if ((metodo === "GET" || metodo === "PUT") && url === `${AUTH}/user`) {
    const autorizzazione = new Headers(init?.headers).get("Authorization") ?? "";
    if (metodo === "GET") {
      server.verificheUtente.push({ autorizzazione, hash: window.location.hash });
      if (server.reteGiuAllaVerifica) throw new TypeError("Failed to fetch");
      if (autorizzazione === `Bearer ${tokenDelLink(UTENTE_SCONOSCIUTO)}`) {
        return json({ code: 401, error_code: "bad_jwt", msg: "invalid JWT" }, 401);
      }
    }
    for (const utente of [UTENTE_VERO, UTENTE_PROVA]) {
      if (
        autorizzazione === `Bearer ${token(utente)}` ||
        autorizzazione === `Bearer ${tokenDelLink(utente)}`
      ) {
        if (metodo === "PUT") server.passwordCambiate.push(utente.email);
        return json(utenteSupabase(utente));
      }
    }
  }

  server.impreviste.push(`${metodo} ${url}`);
  throw new Error(`Richiesta non prevista dal test: ${metodo} ${url}`);
});

// --- Next.js e singleton --------------------------------------------------

// Come in Next: i parametri letti al caricamento non cambiano quando la
// libreria toglie ?code= dall'indirizzo (vedi page.tsx).
let parametriPagina = new URLSearchParams();

const routerFinto = { push: vi.fn(), replace: vi.fn(), refresh: () => {}, back: () => {} };

vi.mock("next/navigation", () => ({
  useRouter: () => routerFinto,
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
  server.rifiutaCodice = null;
  server.scambi = 0;
  server.passwordCambiate = [];
  server.impreviste = [];
  server.verificheUtente = [];
  server.reteGiuAllaVerifica = false;
  server.rinnovi = [];
  server.rinnovo = "ok";
  server.uscite = [];
  routerFinto.push.mockClear();
  routerFinto.replace.mockClear();
  cancellaCookie();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  expect(server.impreviste).toEqual([]);
});

const MODULO = "Imposta una nuova password";
const ERRORE = "Link non valido";
// I testi scritti per intero, non presi da erroriAuth.ts: il test deve
// accorgersi anche se un caso finisce sul testo dell'altro.
const TESTO_ALTRO_BROWSER =
  "Questo link funziona solo nel browser da cui l'hai chiesto. Richiedine uno nuovo qui sotto, da questo browser. Su iPhone i link delle email si aprono sempre in Safari, anche se hai l'app installata.";
const TESTO_SCADUTO = "Il link è scaduto, è già stato usato o ne hai chiesto uno più recente. Usa l'ultimo arrivato o richiedine uno nuovo.";
const TESTO_NON_VALIDO = "Link non valido o scaduto. Richiedine uno nuovo.";

// L'errore come lo scrive il server di Auth quando rifiuta un link già
// usato o scaduto (prepErrorRedirectURL in supabase/auth, verify.go): per
// il flusso PKCE nella query e nell'hash, e nell'hash anche "sb".
const ERRORE_SERVER =
  "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

function campoAccount(): HTMLInputElement {
  return screen.getByLabelText("Account") as HTMLInputElement;
}

// Lo stesso indirizzo ricaricato nella stessa scheda: pagina e client
// nuovi; i cookie e sessionStorage restano.
function ricarica() {
  cleanup();
  apriPagina(window.location.pathname + window.location.search + window.location.hash);
}

describe("/reimposta-password", () => {
  it("verifier presente: compare il modulo, una sola chiamata di scambio", async () => {
    await chiediIlLink();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);

    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(screen.queryByText(ERRORE)).toBeNull();
    expect(server.scambi).toBe(1);
    // Lo scambio l'ha fatto la libreria, che ha tolto il codice.
    expect(window.location.search).toBe("");
    // T7: il modulo dice a quale account si cambia la password.
    expect(campoAccount().value).toBe(UTENTE_VERO.email);
  });

  it("verifier presente e client creato prima della pagina (layout radice): compare il modulo", async () => {
    await chiediIlLink();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`, { clientPrimaDellaPagina: true });

    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(server.scambi).toBe(1);
  });

  it("verifier assente, nessuna sessione: errore col testo dell'altro browser", async () => {
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_ALTRO_BROWSER)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
    expect(server.scambi).toBe(0);
  });

  it("verifier assente ma sessione di un altro account nei cookie: errore, non il modulo", async () => {
    await entraConAccountDiProva();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_ALTRO_BROWSER)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
    expect(server.scambi).toBe(0);
  });

  // bad_code_verifier: il verifier di un'altra richiesta (il link della
  // prima email dopo averne chiesta una seconda). Il suo testo inglese
  // contiene "code verifier": dal testo finirebbe sul messaggio sbagliato.
  it.each(Object.keys(RIFIUTI) as (keyof typeof RIFIUTI)[])(
    "il server rifiuta il codice (%s): errore col testo del link scaduto",
    async (codice) => {
      server.rifiutaCodice = codice;
      await chiediIlLink();
      apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);

      expect(await screen.findByText(ERRORE)).toBeTruthy();
      expect(screen.getByText(TESTO_SCADUTO)).toBeTruthy();
      expect(screen.queryByText(MODULO)).toBeNull();
      expect(server.scambi).toBe(1);
    }
  );

  // T1–T4. Link già usato o scaduto: il server rimanda qui SENZA ?code=,
  // con l'errore nell'indirizzo. La prova sull'anteprima del 10/10: con
  // la sessione dell'account di prova aperta compariva il modulo, e la
  // password nuova sarebbe finita su quell'account.
  it("T1 errore nella query e nell'hash, nessuna sessione: testo del link scaduto", async () => {
    apriPagina(`/reimposta-password?${ERRORE_SERVER}#${ERRORE_SERVER}&sb=`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_SCADUTO)).toBeTruthy();
    expect(server.scambi).toBe(0);
  });

  it("T2 errore nella query e nell'hash con un'altra sessione aperta: testo del link scaduto, non il modulo", async () => {
    await entraConAccountDiProva();
    apriPagina(`/reimposta-password?${ERRORE_SERVER}#${ERRORE_SERVER}&sb=`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_SCADUTO)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
  });

  it("T3 errore solo nell'hash con un'altra sessione aperta: testo del link scaduto", async () => {
    await entraConAccountDiProva();
    apriPagina(`/reimposta-password#${ERRORE_SERVER}&sb=`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_SCADUTO)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
  });

  it("T4 errore solo nella query con un'altra sessione aperta: testo del link scaduto", async () => {
    await entraConAccountDiProva();
    apriPagina(`/reimposta-password?${ERRORE_SERVER}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_SCADUTO)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
  });

  it("T5 ricaricamento dopo uno scambio riuscito, stessa scheda: di nuovo il modulo, con l'email", async () => {
    await chiediIlLink();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);
    expect(await screen.findByText(MODULO)).toBeTruthy();

    ricarica();

    expect(await screen.findByText(MODULO)).toBeTruthy();
    // T7 anche qui.
    expect(campoAccount().value).toBe(UTENTE_VERO.email);
  });

  it("T6 senza codice né errore, sessione aperta ma nessuno scambio in questa scheda: errore", async () => {
    await entraConAccountDiProva();
    apriPagina("/reimposta-password");

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_NON_VALIDO)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
  });

  it("T8 dopo il salvataggio della password, indietro o ricaricamento non riaprono il modulo", async () => {
    await chiediIlLink();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);
    expect(await screen.findByText(MODULO)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "nuova-segreta" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "nuova-segreta" } });
    fireEvent.click(screen.getByText("Salva nuova password"));
    // replace: la pagina del reset esce dalla cronologia.
    await waitFor(() => expect(routerFinto.replace).toHaveBeenCalledWith("/"));
    expect(routerFinto.push).not.toHaveBeenCalled();
    expect(server.passwordCambiate).toEqual([UTENTE_VERO.email]);

    ricarica();

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_NON_VALIDO)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
  });

  it("T9 memoria della scheda non disponibile: il ricaricamento mostra l'errore, non il modulo", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Memoria non disponibile", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Memoria non disponibile", "SecurityError");
    });
    await chiediIlLink();
    apriPagina(`/reimposta-password?code=${CODICE_DEL_LINK}`);
    // Lo scambio del link vale comunque: il modulo compare.
    expect(await screen.findByText(MODULO)).toBeTruthy();

    ricarica();

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
  });
});

// --- Flusso implicito (dal 18/10/2026, branch reset-ovunque) --------------
//
// Il link chiesto da /password-dimenticata senza code_challenge
// (clientRichiestaReset.ts) torna qui con la sessione nel frammento:
// #access_token=...&refresh_token=...&type=recovery. Nessun verifier: vale
// in qualunque browser. Regole: il frammento si toglie prima di qualunque
// chiamata; la sessione nasce dai token del frammento (setSession) e
// finisce nei cookie; il modulo è dell'account del link, anche con un'altra
// sessione aperta.

const TESTO_CONNESSIONE = "Errore di connessione. Controlla la tua connessione e riprova.";

// Il frammento come lo scrive il server di Auth per un link implicito
// buono (i campi che auth-js legge dall'indirizzo).
function frammentoLink(utente: { id: string; email: string }): string {
  const s = sessione(utente);
  return (
    `#access_token=${tokenDelLink(utente)}&expires_at=${s.expires_at}&expires_in=${s.expires_in}` +
    `&refresh_token=${s.refresh_token}&token_type=bearer&type=recovery`
  );
}

// Le verifiche dei token del link (GET /user con il suo access token).
function verificheDelLink(utente: { id: string }) {
  return server.verificheUtente.filter((v) => v.autorizzazione === `Bearer ${tokenDelLink(utente)}`);
}

// La sessione salvata nei cookie, letta da un client nuovo: come la
// vedrebbero il middleware e il resto dell'app.
async function utenteNeiCookie(): Promise<string | undefined> {
  const lettore = createBrowserClient(URL_SUPABASE, CHIAVE, {
    isSingleton: false,
    auth: { detectSessionInUrl: false, autoRefreshToken: false },
  });
  const { data } = await lettore.auth.getSession();
  return data.session?.user.id;
}

describe("/reimposta-password, link con la sessione nel frammento", () => {
  it("nessuna sessione aperta: modulo dell'account del link, frammento tolto prima della verifica, sessione nei cookie", async () => {
    apriPagina(`/reimposta-password${frammentoLink(UTENTE_VERO)}`);

    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(campoAccount().value).toBe(UTENTE_VERO.email);
    expect(window.location.hash).toBe("");
    // Una sola verifica anche con StrictMode, e già senza token
    // nell'indirizzo quando è partita.
    expect(verificheDelLink(UTENTE_VERO)).toEqual([
      { autorizzazione: `Bearer ${tokenDelLink(UTENTE_VERO)}`, hash: "" },
    ]);
    expect(await utenteNeiCookie()).toBe(UTENTE_VERO.id);
    expect(server.scambi).toBe(0);
  });

  it("sessione di un altro account aperta: modulo e password nuova sull'account del link", async () => {
    await entraConAccountDiProva();
    apriPagina(`/reimposta-password${frammentoLink(UTENTE_VERO)}`);

    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(campoAccount().value).toBe(UTENTE_VERO.email);

    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "nuova-segreta" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "nuova-segreta" } });
    fireEvent.click(screen.getByText("Salva nuova password"));
    await waitFor(() => expect(routerFinto.replace).toHaveBeenCalledWith("/"));
    expect(server.passwordCambiate).toEqual([UTENTE_VERO.email]);
    expect(await utenteNeiCookie()).toBe(UTENTE_VERO.id);
  });

  // Il client nato prima della pagina vede i token nell'indirizzo e
  // rinuncia con "Not a valid PKCE flow url": la pagina deve ignorarlo.
  it("client creato prima della pagina (layout radice): modulo", async () => {
    apriPagina(`/reimposta-password${frammentoLink(UTENTE_VERO)}`, { clientPrimaDellaPagina: true });

    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(campoAccount().value).toBe(UTENTE_VERO.email);
    expect(window.location.hash).toBe("");
  });

  it("token rifiutati dal server: errore di link non valido, frammento tolto, nessuna sessione", async () => {
    apriPagina(`/reimposta-password${frammentoLink(UTENTE_SCONOSCIUTO)}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_NON_VALIDO)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
    expect(window.location.hash).toBe("");
    expect(await utenteNeiCookie()).toBeUndefined();
  });

  it("rete assente alla verifica: testo di connessione, frammento tolto", async () => {
    server.reteGiuAllaVerifica = true;
    apriPagina(`/reimposta-password${frammentoLink(UTENTE_VERO)}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_CONNESSIONE)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
    expect(window.location.hash).toBe("");
  });

  // Link implicito già usato o scaduto: l'errore arriva solo nel
  // frammento (con PKCE anche nella query, T1).
  it("errore otp_expired solo nel frammento, nessuna sessione: testo del link scaduto", async () => {
    apriPagina(`/reimposta-password#${ERRORE_SERVER}&sb=`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_SCADUTO)).toBeTruthy();
  });

  it("ricaricamento prima del salvataggio: modulo; dopo il salvataggio: errore", async () => {
    apriPagina(`/reimposta-password${frammentoLink(UTENTE_VERO)}`);
    expect(await screen.findByText(MODULO)).toBeTruthy();

    ricarica();
    expect(await screen.findByText(MODULO)).toBeTruthy();
    expect(campoAccount().value).toBe(UTENTE_VERO.email);

    fireEvent.change(screen.getByLabelText("Nuova password"), { target: { value: "nuova-segreta" } });
    fireEvent.change(screen.getByLabelText("Conferma password"), { target: { value: "nuova-segreta" } });
    fireEvent.click(screen.getByText("Salva nuova password"));
    await waitFor(() => expect(routerFinto.replace).toHaveBeenCalledWith("/"));
    expect(server.passwordCambiate).toEqual([UTENTE_VERO.email]);

    ricarica();
    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_NON_VALIDO)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
  });
});

// --- Il rinforzo: rinnovo subito dopo setSession (dal 18/10/2026) ---------
//
// Il refresh token passato dall'indirizzo non deve restare quello della
// sessione: subito dopo setSession la pagina chiede un rinnovo, e il
// server ne dà uno nuovo. Se il rinnovo fallisce, niente modulo e niente
// sessione in questo browser.

async function refreshTokenNeiCookie(): Promise<string | undefined> {
  const lettore = createBrowserClient(URL_SUPABASE, CHIAVE, {
    isSingleton: false,
    auth: { detectSessionInUrl: false, autoRefreshToken: false },
  });
  const { data } = await lettore.auth.getSession();
  return data.session?.refresh_token;
}

describe("/reimposta-password, rinnovo dopo il link con il frammento", () => {
  it("rinnovo dopo la verifica e prima del modulo; la sessione finale non ha il refresh token dell'indirizzo", async () => {
    apriPagina(`/reimposta-password${frammentoLink(UTENTE_VERO)}`);

    expect(await screen.findByText(MODULO)).toBeTruthy();
    // Prima la verifica dei token (setSession), poi il rinnovo, con il
    // refresh token dell'indirizzo, quando il modulo non c'era ancora.
    expect(verificheDelLink(UTENTE_VERO)).toHaveLength(1);
    expect(server.rinnovi).toEqual([{ refreshToken: `refresh-${UTENTE_VERO.id}`, moduloVisibile: false }]);
    const finale = await refreshTokenNeiCookie();
    expect(finale).toBe(refreshRuotato(UTENTE_VERO));
    expect(finale).not.toBe(`refresh-${UTENTE_VERO.id}`);
    expect(server.uscite).toEqual([]);
  });

  it("rinnovo rifiutato dal server: link non valido, nessuna sessione nei cookie, sessione chiusa sul server", async () => {
    server.rinnovo = "rifiutato";
    apriPagina(`/reimposta-password${frammentoLink(UTENTE_VERO)}`);

    expect(await screen.findByText(ERRORE)).toBeTruthy();
    expect(screen.getByText(TESTO_NON_VALIDO)).toBeTruthy();
    expect(screen.queryByText(MODULO)).toBeNull();
    expect(await utenteNeiCookie()).toBeUndefined();
    expect(server.uscite).toEqual(["local"]);
  });

  // La libreria ripete il rinnovo senza rete per una trentina di secondi
  // (200, 400, 800 ms...): orologio finto, fatto avanzare a mano.
  it("rete assente al rinnovo: testo di connessione, nessuna sessione nei cookie", async () => {
    vi.useFakeTimers();
    try {
      server.rinnovo = "rete giù";
      apriPagina(`/reimposta-password${frammentoLink(UTENTE_VERO)}`);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(screen.getByText(ERRORE)).toBeTruthy();
      expect(screen.getByText(TESTO_CONNESSIONE)).toBeTruthy();
      expect(screen.queryByText(MODULO)).toBeNull();
      expect(server.rinnovi.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
    expect(await utenteNeiCookie()).toBeUndefined();
  });
});
