// La pagina Accedi: dopo l'accesso si torna alla pagina da cui il
// middleware ci ha mandato qui (?redirectTo=/impostazioni), ma solo se è
// una pagina dell'app. Difetto trovato in revisione il 18/10, già in
// produzione: bastava che redirectTo iniziasse con "/", quindi passava
// anche "//esempio.com", che il browser legge come un altro sito.
// router.push di Next (16.3.3, app-router-instance.js) risolve l'indirizzo
// con new URL(href, location.href) e, se l'origine è diversa da quella
// dell'app, esce con una navigazione completa (location.assign). Qui il
// router è finto: la destinazione si calcola nello stesso modo.
// Finti anche il client Supabase (accesso sempre riuscito) e i parametri
// dell'indirizzo.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import LoginPage from "./page";

const finti = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: finti.push, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(finti.query),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword: async () => ({ error: null }) } }),
}));

beforeEach(() => {
  finti.push.mockReset();
});

afterEach(cleanup);

async function accediCon(query: string): Promise<URL> {
  finti.query = query;
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "giulia@esempio.it" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "segreta123" } });
  fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
  await waitFor(() => expect(finti.push).toHaveBeenCalledTimes(1));
  return new URL(finti.push.mock.calls[0][0], window.location.href);
}

describe("Accedi, destinazione dopo l'accesso", () => {
  it("torna alla pagina protetta da cui arrivava", async () => {
    const dest = await accediCon("redirectTo=%2Fimpostazioni");
    expect(dest.origin).toBe(window.location.origin);
    expect(dest.pathname).toBe("/impostazioni");
  });

  it("senza redirectTo va alla home", async () => {
    const dest = await accediCon("");
    expect(dest.origin).toBe(window.location.origin);
    expect(dest.pathname).toBe("/");
  });

  it.each(["//esempio.com", "/\\esempio.com", "https://esempio.com"])(
    "redirectTo=%s non porta fuori dall'app",
    async (redirectTo) => {
      const dest = await accediCon(`redirectTo=${encodeURIComponent(redirectTo)}`);
      expect(dest.origin).toBe(window.location.origin);
      expect(dest.pathname).toBe("/");
    }
  );
});
