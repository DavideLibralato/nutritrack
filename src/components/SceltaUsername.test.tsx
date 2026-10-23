// "Scegli il tuo nome su Libra" in Amici (PUNTO_DI_PARTENZA.md §3 "Amici").
// Il salvataggio con imposta_username: si apre la pagina solo con "ok", con
// il nome normalizzato; con il nome preso nel frattempo si resta qui. Fino al
// 23/10 qui c'erano anche i test del suggerimento dai metadati, tolto con il
// branch username-dopo-accesso.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SceltaUsername from "./SceltaUsername";

const controllaDisponibilita = vi.fn<(nome: string) => Promise<string>>(async () => "disponibile");
const impostaUsername = vi.fn<(nome: string) => Promise<string>>(async () => "ok");

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/amici/nomiUtente", () => ({
  controllaDisponibilita: (_client: unknown, nome: string) => controllaDisponibilita(nome),
  impostaUsername: (_client: unknown, nome: string) => impostaUsername(nome),
}));

afterEach(() => {
  cleanup();
  controllaDisponibilita.mockClear();
  impostaUsername.mockClear();
});

function campo() {
  return screen.getByLabelText("Il tuo nome su Libra") as HTMLInputElement;
}

describe("SceltaUsername", () => {
  it("parte con il campo vuoto", () => {
    render(<SceltaUsername onScelto={() => {}} />);
    expect(campo().value).toBe("");
  });

  it("Continua salva il nome normalizzato e apre la pagina", async () => {
    const onScelto = vi.fn();
    render(<SceltaUsername onScelto={onScelto} />);
    fireEvent.change(campo(), { target: { value: "Davide_L" } });
    expect(campo().value).toBe("davide_l");
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    await waitFor(() => expect(onScelto).toHaveBeenCalledWith("davide_l"));
    expect(impostaUsername).toHaveBeenCalledWith("davide_l");
  });

  it("con il nome preso nel frattempo resta qui e lo dice sotto il campo", async () => {
    impostaUsername.mockResolvedValueOnce("occupato");
    const onScelto = vi.fn();
    render(<SceltaUsername onScelto={onScelto} />);
    fireEvent.change(campo(), { target: { value: "davide_l" } });
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    await waitFor(() => expect(screen.getByText("Questo nome è già in uso.")).toBeTruthy());
    expect(onScelto).not.toHaveBeenCalled();
  });
});
