// La pagina Registrati (dal 17/10, onboarding). Dopo "Crea account" con la
// sessione si va a /onboarding con un caricamento COMPLETO della pagina,
// non con la navigazione interna di Next.js: la sessione nasce sul server,
// nei cookie, e i componenti del layout radice montati qui senza utente
// (la sincronizzazione, le riprese) non ricevono nessun evento. Con la
// navigazione interna restavano senza utente, la discesa non riusciva mai
// e /onboarding restava su "Caricamento..." (prove su iPhone del 17/10).
// Finti: la Server Action, il caricamento completo, il router (spia, non
// deve servire) e il controllo dello username mentre si scrive.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import RegisterPage from "./page";
import type { StatoRegistrazione } from "@/lib/actions/auth";

const finti = vi.hoisted(() => ({
  risposta: null as unknown as StatoRegistrazione,
  registrati: vi.fn(),
  carica: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/lib/actions/auth", () => ({
  registrati: async (...args: unknown[]) => {
    finti.registrati(...args);
    return finti.risposta;
  },
}));
vi.mock("@/lib/caricamentoCompleto", () => ({ caricaPaginaDaCapo: (p: string) => finti.carica(p) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: finti.push, replace: finti.replace, refresh: () => {} }),
}));
vi.mock("@/lib/amici/useDisponibilitaUsername", () => ({ useDisponibilitaUsername: () => "disponibile" }));

const VALORI = { nome: "Giulia", username: "giulia_92", email: "giulia@esempio.it" };

beforeEach(() => {
  finti.registrati.mockReset();
  finti.carica.mockReset();
  finti.push.mockReset();
  finti.replace.mockReset();
});

afterEach(cleanup);

function creaAccount() {
  fireEvent.click(screen.getByRole("button", { name: "Crea account" }));
}

describe("Registrati", () => {
  it("registrato con la sessione: caricamento completo di /onboarding, niente router di Next", async () => {
    finti.risposta = { errore: null, messaggio: null, valori: VALORI, registrato: true };
    render(<RegisterPage />);

    creaAccount();

    await waitFor(() => expect(finti.carica).toHaveBeenCalledWith("/onboarding"));
    expect(finti.carica).toHaveBeenCalledTimes(1);
    expect(finti.push).not.toHaveBeenCalled();
    expect(finti.replace).not.toHaveBeenCalled();
    // Mentre la pagina si ricarica non si può inviare di nuovo.
    expect((screen.getByRole("button", { name: "Attendere..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("senza sessione: il messaggio, e nessun caricamento", async () => {
    finti.risposta = {
      errore: null,
      messaggio: "Account creato: controlla la tua email per confermarlo prima di accedere.",
      valori: VALORI,
    };
    render(<RegisterPage />);

    creaAccount();

    expect(
      await screen.findByText("Account creato: controlla la tua email per confermarlo prima di accedere.")
    ).toBeTruthy();
    expect(finti.carica).not.toHaveBeenCalled();
  });

  // Il controllo mentre si scrive (qui finto) ha detto "Disponibile", poi
  // all'invio la Server Action trova il nome preso. La riga sotto il campo
  // deve dire "già in uso", non restare su "Disponibile": per lo stesso
  // nome il controllo mentre si scrive non richiede (difetto trovato il
  // 18/10, branch login-ritocchi).
  it("username preso all'invio: la riga sotto il campo dice «già in uso» e Crea account si spegne", async () => {
    finti.risposta = {
      errore: "Questo username è già in uso.",
      messaggio: null,
      valori: VALORI,
      usernamePreso: "giulia_92",
    };
    render(<RegisterPage />);
    const campo = screen.getByLabelText("Username");
    fireEvent.change(campo, { target: { value: "Giulia_92" } });
    expect(screen.getByRole("status").textContent).toBe("Disponibile");

    creaAccount();

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Questo username è già in uso."));
    expect(campo.getAttribute("aria-invalid")).toBe("true");
    expect((screen.getByRole("button", { name: "Crea account" }) as HTMLButtonElement).disabled).toBe(true);

    // Cambiato il nome torna il controllo mentre si scrive.
    fireEvent.change(campo, { target: { value: "giulia_93" } });
    expect(screen.getByRole("status").textContent).toBe("Disponibile");
    expect((screen.getByRole("button", { name: "Crea account" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("con un errore: il messaggio, e nessun caricamento", async () => {
    finti.risposta = { errore: "Codice di invito non valido.", messaggio: null, valori: VALORI };
    render(<RegisterPage />);

    creaAccount();

    expect(await screen.findByText("Codice di invito non valido.")).toBeTruthy();
    expect(finti.carica).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crea account" })).toBeTruthy();
  });
});
