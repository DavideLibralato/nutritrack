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
  finti.controllaDisponibilita.mockClear();
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

  it("codice di invito sbagliato: niente signUp, come prima", async () => {
    const stato = await registrati(STATO_INIZIALE, modulo({ codiceInvito: "altro" }));
    expect(stato.errore).toBe("Codice di invito non valido.");
    expect(stato.registrato).toBeUndefined();
    expect(finti.signUp).not.toHaveBeenCalled();
    expect(finti.redirect).not.toHaveBeenCalled();
  });
});
