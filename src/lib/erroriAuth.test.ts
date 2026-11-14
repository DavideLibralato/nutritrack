// I testi per una password nuova rifiutata (audit #6, branch password-8).
// Fino a 6 caratteri la frase del server si riconosceva solo se diceva "at
// least 6 characters": con il minimo a 8 sarebbe diventata "Si è verificato
// un errore" in Registrati e Reimposta. Ora conta il tipo dell'errore, e il
// testo inglese vale con qualunque numero.

import { describe, expect, it } from "vitest";
import { AuthApiError, AuthWeakPasswordError } from "@supabase/supabase-js";
import {
  PASSWORD_DEBOLE,
  PASSWORD_TROPPO_CORTA,
  traduciErroreAuth,
  traduciErrorePasswordNuova,
} from "./erroriAuth";

describe("password nuova rifiutata dal server", () => {
  it("il testo dice 8", () => {
    expect(PASSWORD_TROPPO_CORTA).toBe("La password deve avere almeno 8 caratteri.");
  });

  it("weak_password: «length» → troppo corta, altri motivi → troppo facile", () => {
    const corta = new AuthWeakPasswordError("Password should be at least 8 characters.", 422, [
      "length",
    ]);
    const nota = new AuthWeakPasswordError("Password is known to be weak.", 422, ["pwned"]);
    expect(traduciErrorePasswordNuova(corta)).toBe(PASSWORD_TROPPO_CORTA);
    expect(traduciErrorePasswordNuova(nota)).toBe(PASSWORD_DEBOLE);
  });

  it("gli altri errori passano dalla mappa", () => {
    const giaRegistrato = new AuthApiError("User already registered", 422, "user_already_exists");
    expect(traduciErrorePasswordNuova(giaRegistrato)).toBe(
      "Esiste già un account con questa email."
    );
  });

  it("la frase inglese della lunghezza si riconosce con qualunque numero", () => {
    expect(traduciErroreAuth("Password should be at least 8 characters.")).toBe(
      PASSWORD_TROPPO_CORTA
    );
  });
});
