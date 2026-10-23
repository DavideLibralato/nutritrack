// La Server Action della registrazione (registrati, src/lib/actions/auth.ts;
// dal 17/10 porta all'onboarding). Sbaglia in silenzio: un segno mancante
// nei metadati e chi si registra non vede mai l'onboarding; un campo di
// troppo finisce nei metadati di ogni account; un "registrato" sbagliato con
// la conferma email accesa manda dentro chi non ha ancora una sessione.
//
// Con la sessione la Server Action NON fa redirect (dal 17/10): risponde
// "registrato", e la pagina Registrati fa un caricamento completo di
// /onboarding. Con redirect() la navigazione resta interna a Next.js e i
// componenti del layout radice restano senza utente ("Caricamento..." che
// non finisce, prove su iPhone del 17/10). redirect è finto proprio per
// controllare che non venga mai chiamato.
//
// Dal branch username-dopo-accesso la registrazione non tocca più lo
// username: niente chiave `username` nei metadati (il contratto con i
// trigger, migration registrazione_username_facoltativo) e nessuna
// chiamata a username_disponibile o imposta_username. Le due funzioni sono
// finte proprio per controllare che non vengano mai chiamate.
//
// Finti: il client Supabase del server, le due funzioni dello username e
// redirect di Next.js. Nessuna registrazione vera.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { registrati, type StatoRegistrazione } from "./auth";

const CODICE = "codice-di-prova";

const finti = vi.hoisted(() => ({
  signUp: vi.fn(),
  controllaDisponibilita: vi.fn(async () => "disponibile"),
  impostaUsername: vi.fn(async () => "ok"),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: (percorso: string) => finti.redirect(percorso) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: (...args: unknown[]) => finti.signUp(...args) } }),
}));
vi.mock("@/lib/amici/nomiUtente", () => ({
  controllaDisponibilita: (...args: unknown[]) => finti.controllaDisponibilita(...(args as [])),
  impostaUsername: (...args: unknown[]) => finti.impostaUsername(...(args as [])),
}));

const STATO_INIZIALE: StatoRegistrazione = {
  errore: null,
  messaggio: null,
  valori: { nome: "", email: "" },
};

function modulo(campi: Partial<Record<string, string>> = {}): FormData {
  const dati = new FormData();
  const tutti = {
    nome: "Giulia",
    email: "giulia@esempio.it",
    password: "segreta123",
    codiceInvito: CODICE,
    ...campi,
  };
  for (const [chiave, valore] of Object.entries(tutti)) if (valore !== undefined) dati.set(chiave, valore);
  return dati;
}

const CON_SESSIONE = { data: { user: { id: "u1" }, session: { access_token: "t" } }, error: null };
const SENZA_SESSIONE = { data: { user: { id: "u1" }, session: null }, error: null };
const VALORI = { nome: "Giulia", email: "giulia@esempio.it" };

beforeEach(() => {
  vi.stubEnv("CODICE_INVITO", CODICE);
  finti.signUp.mockReset();
  finti.signUp.mockResolvedValue(CON_SESSIONE);
  finti.controllaDisponibilita.mockClear();
  finti.impostaUsername.mockClear();
  finti.redirect.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function nessunaChiamataUsername() {
  expect(finti.controllaDisponibilita).not.toHaveBeenCalled();
  expect(finti.impostaUsername).not.toHaveBeenCalled();
}

describe("registrati", () => {
  it("signUp riceve nome, codice e segno dell'onboarding, senza username, e nient'altro", async () => {
    await registrati(STATO_INIZIALE, modulo());

    expect(finti.signUp).toHaveBeenCalledTimes(1);
    expect(finti.signUp).toHaveBeenCalledWith({
      email: "giulia@esempio.it",
      password: "segreta123",
      options: {
        data: {
          nome: "Giulia",
          codice_invito: CODICE,
          onboarding: "da_fare",
        },
      },
    });
  });

  it("uno username mandato da una pagina vecchia non arriva nei metadati", async () => {
    await registrati(STATO_INIZIALE, modulo({ nomeUtente: "giulia_92" }));

    const opzioni = finti.signUp.mock.calls[0][0].options.data;
    expect(opzioni).not.toHaveProperty("username");
    nessunaChiamataUsername();
  });

  it("con la sessione: risponde «registrato», senza redirect di Next e senza toccare lo username", async () => {
    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(stato).toEqual({ errore: null, messaggio: null, valori: VALORI, registrato: true });
    expect(finti.redirect).not.toHaveBeenCalled();
    nessunaChiamataUsername();
  });

  it("senza sessione (conferma email accesa): niente «registrato», lo stesso messaggio di prima", async () => {
    finti.signUp.mockResolvedValue(SENZA_SESSIONE);

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(stato).toEqual({
      errore: null,
      messaggio: "Account creato: controlla la tua email per confermarlo prima di accedere.",
      valori: VALORI,
    });
    expect(finti.redirect).not.toHaveBeenCalled();
    nessunaChiamataUsername();
  });

  it("con un errore di signUp: il messaggio tradotto di prima, niente «registrato»", async () => {
    finti.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(stato.errore).toBe("Esiste già un account con questa email.");
    expect(stato.messaggio).toBeNull();
    expect(stato.registrato).toBeUndefined();
    expect(finti.redirect).not.toHaveBeenCalled();
    nessunaChiamataUsername();
  });

  // Il trigger che rifiuta la registrazione (oggi solo per il codice di
  // invito cambiato nel Vault ma non in CODICE_INVITO): GoTrue manda
  // l'errore generico del database. Fino al branch username-dopo-accesso
  // qui si richiedeva se lo username era preso; ora non c'è più niente da
  // richiedere.
  it("errore del database: il messaggio generico, nessuna chiamata a username_disponibile", async () => {
    finti.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Database error saving new user", code: "unexpected_failure", status: 500 },
    });

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(stato).toEqual({
      errore: "Si è verificato un errore. Riprova tra poco.",
      messaggio: null,
      valori: VALORI,
    });
    nessunaChiamataUsername();
  });

  it("codice di invito sbagliato: niente signUp, come prima", async () => {
    const stato = await registrati(STATO_INIZIALE, modulo({ codiceInvito: "altro" }));
    expect(stato.errore).toBe("Codice di invito non valido.");
    expect(stato.registrato).toBeUndefined();
    expect(finti.signUp).not.toHaveBeenCalled();
    expect(finti.redirect).not.toHaveBeenCalled();
  });
});
