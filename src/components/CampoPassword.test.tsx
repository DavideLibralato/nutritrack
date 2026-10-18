// L'occhio dei campi password (CampoPassword.tsx). Sbaglia in silenzio:
// - senza type="button" il tocco sull'occhio invia il modulo (in Accedi
//   parte l'accesso, in Registrati la registrazione);
// - se all'invio la password resta visibile, il gestore delle password
//   trova un campo di testo e può non proporre di salvarla;
// - con un campo non controllato (Registrati) il valore scritto deve
//   restare quando si cambia tipo, e non deve passare dallo stato di React.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import CampoPassword from "./CampoPassword";

afterEach(cleanup);

function campo(): HTMLInputElement {
  return screen.getByLabelText("Password") as HTMLInputElement;
}

function occhio(): HTMLElement {
  return screen.getByRole("button", { name: "Mostra password" });
}

function Controllato() {
  const [valore, setValore] = useState("");
  return (
    <CampoPassword id="p" etichetta="Password" autoComplete="current-password" value={valore} onChange={setValore} />
  );
}

describe("CampoPassword", () => {
  it("l'occhio mostra e nasconde, con aria-pressed e l'etichetta fissa, senza inviare il modulo", () => {
    const invio = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={invio}>
        <Controllato />
      </form>
    );

    expect(campo().type).toBe("password");
    expect(occhio().getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(occhio());
    expect(campo().type).toBe("text");
    expect(occhio().getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(occhio());
    expect(campo().type).toBe("password");
    expect(occhio().getAttribute("aria-pressed")).toBe("false");

    expect(invio).not.toHaveBeenCalled();
  });

  it("all'invio del modulo la password torna nascosta, prima che l'invio della pagina la veda", () => {
    let tipoAllInvio: string | null = null;
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          tipoAllInvio = campo().type;
        }}
      >
        <Controllato />
        <button type="submit">Accedi</button>
      </form>
    );

    fireEvent.click(occhio());
    expect(campo().type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));
    expect(tipoAllInvio).toBe("password");
    expect(campo().type).toBe("password");
    expect(occhio().getAttribute("aria-pressed")).toBe("false");
  });

  it("non controllato (Registrati): il valore scritto resta cambiando tipo e arriva nel modulo", () => {
    let inviato: FormDataEntryValue | null = null;
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          inviato = new FormData(e.currentTarget).get("password");
        }}
      >
        <CampoPassword id="p" name="password" etichetta="Password" autoComplete="new-password" />
        <button type="submit">Crea account</button>
      </form>
    );

    fireEvent.change(campo(), { target: { value: "segreta123" } });
    fireEvent.click(occhio());
    expect(campo().type).toBe("text");
    expect(campo().value).toBe("segreta123");

    fireEvent.click(screen.getByRole("button", { name: "Crea account" }));
    expect(inviato).toBe("segreta123");
    expect(campo().type).toBe("password");
  });
});
