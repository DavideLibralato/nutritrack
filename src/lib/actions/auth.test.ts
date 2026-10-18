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
  valori: { nome: "", username: "", email: "" },
};

function modulo(campi: Partial<Record<string, string>> = {}): FormData {
  const dati = new FormData();
  const tutti = {
    nome: "Giulia",
    nomeUtente: "Giulia_92",
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

beforeEach(() => {
  vi.stubEnv("CODICE_INVITO", CODICE);
  finti.signUp.mockReset();
  finti.signUp.mockResolvedValue(CON_SESSIONE);
  // mockReset e non mockClear: svuota anche le risposte "Once" rimaste da
  // un test, che altrimenti passerebbero al test dopo.
  finti.controllaDisponibilita.mockReset();
  finti.controllaDisponibilita.mockResolvedValue("disponibile");
  finti.impostaUsername.mockClear();
  finti.redirect.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("registrati", () => {
  it("signUp riceve il segno dell'onboarding insieme agli altri metadati, e nient'altro", async () => {
    await registrati(STATO_INIZIALE, modulo());

    expect(finti.signUp).toHaveBeenCalledTimes(1);
    expect(finti.signUp).toHaveBeenCalledWith({
      email: "giulia@esempio.it",
      password: "segreta123",
      options: {
        data: {
          nome: "Giulia",
          username: "giulia_92",
          codice_invito: CODICE,
          onboarding: "da_fare",
        },
      },
    });
  });

  it("con la sessione: dopo impostaUsername risponde «registrato», senza redirect di Next", async () => {
    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(finti.impostaUsername).toHaveBeenCalledTimes(1);
    expect(stato).toEqual({
      errore: null,
      messaggio: null,
      valori: { nome: "Giulia", username: "giulia_92", email: "giulia@esempio.it" },
      registrato: true,
    });
    expect(finti.redirect).not.toHaveBeenCalled();
  });

  it("con la sessione, se impostaUsername non risponde «ok», si entra lo stesso", async () => {
    finti.impostaUsername.mockResolvedValueOnce("errore");
    const stato = await registrati(STATO_INIZIALE, modulo());
    expect(stato.registrato).toBe(true);
  });

  it("senza sessione (conferma email accesa): niente «registrato», lo stesso messaggio di prima", async () => {
    finti.signUp.mockResolvedValue(SENZA_SESSIONE);

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(stato).toEqual({
      errore: null,
      messaggio: "Account creato: controlla la tua email per confermarlo prima di accedere.",
      valori: { nome: "Giulia", username: "giulia_92", email: "giulia@esempio.it" },
    });
    expect(finti.redirect).not.toHaveBeenCalled();
    expect(finti.impostaUsername).not.toHaveBeenCalled();
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
    expect(finti.impostaUsername).not.toHaveBeenCalled();
  });

  // Lo username preso fra il controllo e signUp: il trigger rifiuta la
  // registrazione e GoTrue manda solo l'errore generico del database
  // (verificato sulla funzione `crea_nome_utente_registrazione` e sulla
  // migration trigger_registrazione.sql, 18/10).
  const ERRORE_DATABASE = {
    data: { user: null, session: null },
    error: { message: "Database error saving new user", code: "unexpected_failure", status: 500 },
  };

  it("username preso fra il controllo e signUp: il testo dello username, con il nome preso", async () => {
    finti.controllaDisponibilita.mockResolvedValueOnce("disponibile").mockResolvedValueOnce("in_uso");
    finti.signUp.mockResolvedValue(ERRORE_DATABASE);

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(finti.controllaDisponibilita).toHaveBeenCalledTimes(2);
    expect(stato).toEqual({
      errore: "Questo username è già in uso.",
      messaggio: null,
      valori: { nome: "Giulia", username: "giulia_92", email: "giulia@esempio.it" },
      usernamePreso: "giulia_92",
    });
    expect(finti.impostaUsername).not.toHaveBeenCalled();
  });

  // Anche il codice di invito rifiutato dal trigger (cambiato nel Vault ma
  // non in CODICE_INVITO) arriva come errore generico: lo username è
  // libero, e non va detto che è preso.
  it("errore generico del database con lo username libero: il messaggio generico", async () => {
    finti.controllaDisponibilita.mockResolvedValueOnce("disponibile").mockResolvedValueOnce("disponibile");
    finti.signUp.mockResolvedValue(ERRORE_DATABASE);

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(finti.controllaDisponibilita).toHaveBeenCalledTimes(2);
    expect(stato.errore).toBe("Si è verificato un errore. Riprova tra poco.");
    expect(stato.usernamePreso).toBeUndefined();
  });

  it("errore generico del database senza risposta al secondo controllo: il messaggio generico", async () => {
    finti.controllaDisponibilita.mockResolvedValueOnce("disponibile").mockResolvedValueOnce("errore");
    finti.signUp.mockResolvedValue(ERRORE_DATABASE);

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(stato.errore).toBe("Si è verificato un errore. Riprova tra poco.");
    expect(stato.usernamePreso).toBeUndefined();
  });

  it("un altro errore di signUp: nessun secondo controllo dello username", async () => {
    finti.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "User already registered", code: "user_already_exists", status: 422 },
    });

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(finti.controllaDisponibilita).toHaveBeenCalledTimes(1);
    expect(stato.errore).toBe("Esiste già un account con questa email.");
    expect(stato.usernamePreso).toBeUndefined();
  });

  it("username già preso al primo controllo: niente signUp, con il nome preso", async () => {
    finti.controllaDisponibilita.mockResolvedValueOnce("in_uso");

    const stato = await registrati(STATO_INIZIALE, modulo());

    expect(finti.signUp).not.toHaveBeenCalled();
    expect(stato.errore).toBe("Questo username è già in uso.");
    expect(stato.usernamePreso).toBe("giulia_92");
  });

  it("codice di invito sbagliato: niente signUp, come prima", async () => {
    const stato = await registrati(STATO_INIZIALE, modulo({ codiceInvito: "altro" }));
    expect(stato.errore).toBe("Codice di invito non valido.");
    expect(stato.registrato).toBeUndefined();
    expect(finti.signUp).not.toHaveBeenCalled();
    expect(finti.redirect).not.toHaveBeenCalled();
  });
});
