// Le regole dello username (Amici, PUNTO_DI_PARTENZA.md §3). Test
// permanente: la stessa regola vive anche sul database (check su
// `nomi_utente`, `username_disponibile`, `imposta_username`). Se l'app
// accettasse un nome che il database rifiuta, l'utente vedrebbe
// "Disponibile" e poi un errore al salvataggio; se rifiutasse un nome che il
// database accetta, nessuno se ne accorgerebbe. I casi sono gli stessi
// delle prove sulla migration (T06, T11, T12).

import { describe, expect, it } from "vitest";
import {
  AIUTO_PASSWORD_NUOVA,
  LUNGHEZZA_MINIMA_PASSWORD,
  normalizzaUsername,
  passwordAbbastanzaLunga,
  usernameValido,
} from "./validazione";

// Il minimo della password nuova (audit #6, branch password-8): fallisce se
// qualcuno lo riporta a 6. Il numero è lo stesso della dashboard di Supabase.
describe("lunghezza minima della password", () => {
  it("è 8: 7 caratteri no, 8 sì, e il testo d'aiuto dice 8", () => {
    expect(LUNGHEZZA_MINIMA_PASSWORD).toBe(8);
    expect(passwordAbbastanzaLunga("1234567")).toBe(false);
    expect(passwordAbbastanzaLunga("12345678")).toBe(true);
    expect(AIUTO_PASSWORD_NUOVA).toBe("Almeno 8 caratteri");
  });
});

describe("normalizzaUsername", () => {
  it("toglie gli spazi ai bordi e mette tutto in minuscolo", () => {
    expect(normalizzaUsername("  Mario_T ")).toBe("mario_t");
    expect(normalizzaUsername("MARIO")).toBe("mario");
  });

  it("non tocca gli spazi in mezzo né gli altri caratteri: li rifiuta usernameValido", () => {
    expect(normalizzaUsername("ma rio")).toBe("ma rio");
    expect(normalizzaUsername("Àbc")).toBe("àbc");
  });
});

describe("usernameValido", () => {
  it("accetta lettere, cifre e _ dopo una lettera iniziale", () => {
    expect(usernameValido("mario_t")).toBe(true);
    expect(usernameValido("luigi2")).toBe(true);
    expect(usernameValido("a_1_b")).toBe(true);
  });

  it("vale sul valore scritto dall'utente, normalizzato", () => {
    expect(usernameValido("  Mario_T ")).toBe(true);
  });

  it("accetta i limiti: 3 e 20 caratteri", () => {
    expect(usernameValido("abc")).toBe(true);
    expect(usernameValido("b".repeat(20))).toBe(true);
  });

  it("rifiuta i formati che rifiuta anche il database", () => {
    for (const nome of [
      "1abc", // cifra in testa
      "_abc", // _ in testa
      "ab", // troppo corto
      "a".repeat(21), // troppo lungo
      "àbc", // accento
      "mario.t", // punto
      "ma rio", // spazio in mezzo
      "mario-t", // trattino
      "   ", // solo spazi
      "",
    ]) {
      expect(usernameValido(nome), nome).toBe(false);
    }
  });
});
