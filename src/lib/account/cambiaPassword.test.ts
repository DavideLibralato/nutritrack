// "Cambia password" (cambiaPassword.ts). Casi fissati per sempre:
// - l'esito si decide dal CODICE del server: "attuale mancante" e "attuale
//   sbagliata" hanno lo stesso testo inglese;
// - la password attuale parte come `current_password` (il nome che legge il
//   server), non `currentPassword` (quello della guida);
// - senza risposta del server prima della chiamata la richiesta non parte
//   ("rete" = sicuramente non cambiata); senza risposta dopo, "non so";
// - "attuale sbagliata" subito dopo una risposta persa ha il suo testo: la
//   password può essere già cambiata.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthWeakPasswordError,
  type AuthError,
} from "@supabase/supabase-js";
import {
  cambiaPassword,
  classificaErroreCambio,
  controllaPrimaDellInvio,
  testoEsitoCambio,
  type EsitoCambio,
} from "./cambiaPassword";

type Risposta = { data: unknown; error: AuthError | null };

// Supabase finto: getUser e updateUser rispondono con quello che c'è qui;
// `lancia` fa lanciare updateUser invece di rispondere.
let rispostaUtente: Risposta;
let rispostaCambio: Risposta;
let lancia = false;
const updateUser = vi.fn();

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => rispostaUtente,
      updateUser: async (...args: unknown[]) => {
        updateUser(...args);
        if (lancia) throw new TypeError("Load failed");
        return rispostaCambio;
      },
    },
  }),
}));

const UTENTE: Risposta = { data: { user: { id: "utente" } }, error: null };
const senzaRete = () => new AuthRetryableFetchError("Failed to fetch", 0);
// Il testo che il server usa per entrambi i casi (internal/api/user.go).
const TESTO_ATTUALE = "Current password required when setting new password.";

beforeEach(() => {
  rispostaUtente = UTENTE;
  rispostaCambio = { data: { user: { id: "utente" } }, error: null };
  lancia = false;
  updateUser.mockClear();
});

describe("controllaPrimaDellInvio", () => {
  it.each<[string, string, EsitoCambio | null]>([
    ["", "nuovapass", "attuale-mancante"],
    ["vecchia1", "", "nuova-mancante"],
    ["vecchia1", "12345", "troppo-corta"],
    ["vecchia1", "123456", null],
    ["vecchia1", "vecchia1", "uguale"],
    // Gli spazi contano: non sono la stessa password.
    ["vecchia1", " vecchia1", null],
  ])("attuale %j, nuova %j → %s", (attuale, nuova, atteso) => {
    expect(controllaPrimaDellInvio(attuale, nuova)).toBe(atteso);
  });
});

describe("classificaErroreCambio", () => {
  it("stesso testo, codici diversi: sbagliata e mancante restano distinte", () => {
    expect(classificaErroreCambio(new AuthApiError(TESTO_ATTUALE, 400, "current_password_mismatch"))).toBe(
      "attuale-sbagliata"
    );
    expect(classificaErroreCambio(new AuthApiError(TESTO_ATTUALE, 400, "current_password_required"))).toBe(
      "attuale-mancante"
    );
  });

  it.each<[string, AuthError, EsitoCambio]>([
    [
      "nuova uguale",
      new AuthApiError("New password should be different from the old password.", 422, "same_password"),
      "uguale",
    ],
    [
      "troppo corta",
      new AuthWeakPasswordError("Password should be at least 6 characters.", 422, ["length"]),
      "troppo-corta",
    ],
    [
      "nota e facile",
      new AuthWeakPasswordError("Password is known to be weak and easy to guess.", 422, ["pwned"]),
      "debole",
    ],
    [
      "riautenticazione",
      new AuthApiError("Password update requires reauthentication", 400, "reauthentication_needed"),
      "riautenticazione",
    ],
    ["sessione chiusa", new AuthApiError("Session not found", 403, "session_not_found"), "sessione"],
    ["nessuna sessione", new AuthSessionMissingError(), "sessione"],
    ["rete", senzaRete(), "risposta-persa"],
    ["errore del server", new AuthApiError("Internal Server Error", 500, "unexpected_failure"), "errore"],
  ])("%s", (_, errore, atteso) => {
    expect(classificaErroreCambio(errore)).toBe(atteso);
  });
});

describe("cambiaPassword", () => {
  it("manda la nuova e l'attuale come current_password", async () => {
    expect(await cambiaPassword("vecchia1", "nuova123")).toBe("ok");
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({ password: "nuova123", current_password: "vecchia1" });
  });

  it("controllo sul dispositivo fallito: nessuna chiamata", async () => {
    expect(await cambiaPassword("vecchia1", "corta")).toBe("troppo-corta");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("il server non risponde prima della chiamata: rete, nessuna chiamata", async () => {
    rispostaUtente = { data: { user: null }, error: senzaRete() };
    expect(await cambiaPassword("vecchia1", "nuova123")).toBe("rete");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("sessione non più valida prima della chiamata: sessione, nessuna chiamata", async () => {
    rispostaUtente = { data: { user: null }, error: new AuthApiError("Session not found", 403, "session_not_found") };
    expect(await cambiaPassword("vecchia1", "nuova123")).toBe("sessione");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rete caduta dopo l'invio: risposta persa", async () => {
    rispostaCambio = { data: { user: null }, error: senzaRete() };
    expect(await cambiaPassword("vecchia1", "nuova123")).toBe("risposta-persa");
  });

  it("updateUser lancia invece di rispondere: risposta persa", async () => {
    lancia = true;
    expect(await cambiaPassword("vecchia1", "nuova123")).toBe("risposta-persa");
  });

  it("password attuale sbagliata: l'esito dal codice", async () => {
    rispostaCambio = {
      data: { user: null },
      error: new AuthApiError(TESTO_ATTUALE, 400, "current_password_mismatch"),
    };
    expect(await cambiaPassword("sbagliata", "nuova123")).toBe("attuale-sbagliata");
  });
});

describe("testoEsitoCambio", () => {
  // Scritti per intero: il test si accorge se un caso finisce sul testo
  // dell'altro.
  const SBAGLIATA = "La password attuale non è corretta.";
  const DOPO_PERSA =
    "La password attuale non è corretta. Il tentativo di prima forse è riuscito: prova a scrivere come attuale quella nuova.";

  it("attuale sbagliata dopo una risposta persa: il testo che spiega", () => {
    expect(testoEsitoCambio("attuale-sbagliata", "risposta-persa")).toBe(DOPO_PERSA);
  });

  it.each<EsitoCambio | null>([null, "attuale-sbagliata", "rete", "errore"])(
    "attuale sbagliata dopo %s: il testo normale",
    (precedente) => {
      expect(testoEsitoCambio("attuale-sbagliata", precedente)).toBe(SBAGLIATA);
    }
  );

  it("errore sconosciuto: testo generico in italiano", () => {
    expect(testoEsitoCambio("errore", null)).toBe("Si è verificato un errore. Riprova tra poco.");
  });
});
