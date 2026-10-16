// "Scegli il tuo username" con lo username dei metadati già scritto
// (PUNTO_DI_PARTENZA.md §3 "Amici", decisione del 15/10). Test permanente:
// il suggerimento arriva dalla sessione, a volte un attimo dopo il primo
// disegno; deve riempire il campo e mostrarne subito l'esito, ma mai
// scrivere sopra quello che l'utente ha già cominciato a scrivere.

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
  it("parte con lo username dei metadati, in minuscolo, e ne mostra subito l'esito", async () => {
    render(<SceltaUsername suggerito="Davide_L" onScelto={() => {}} />);
    expect(campo().value).toBe("davide_l");
    await waitFor(() => expect(screen.getByText("Disponibile")).toBeTruthy());
    expect(controllaDisponibilita).toHaveBeenCalledWith("davide_l");
  });

  it("un suggerimento arrivato dopo il primo disegno riempie il campo vuoto", async () => {
    const { rerender } = render(<SceltaUsername suggerito={null} onScelto={() => {}} />);
    expect(campo().value).toBe("");
    rerender(<SceltaUsername suggerito="davide_l" onScelto={() => {}} />);
    expect(campo().value).toBe("davide_l");
    await waitFor(() => expect(screen.getByText("Disponibile")).toBeTruthy());
  });

  it("un suggerimento arrivato dopo non scrive sopra quello che l'utente ha scritto", () => {
    const { rerender } = render(<SceltaUsername suggerito={null} onScelto={() => {}} />);
    fireEvent.change(campo(), { target: { value: "Mio_Nome" } });
    rerender(<SceltaUsername suggerito="davide_l" onScelto={() => {}} />);
    expect(campo().value).toBe("mio_nome");
  });

  it("Continua salva il nome normalizzato e apre la pagina", async () => {
    const onScelto = vi.fn();
    render(<SceltaUsername suggerito="davide_l" onScelto={onScelto} />);
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    await waitFor(() => expect(onScelto).toHaveBeenCalledWith("davide_l"));
    expect(impostaUsername).toHaveBeenCalledWith("davide_l");
  });

  it("con il nome preso nel frattempo resta qui e lo dice sotto il campo", async () => {
    impostaUsername.mockResolvedValueOnce("occupato");
    const onScelto = vi.fn();
    render(<SceltaUsername suggerito="davide_l" onScelto={onScelto} />);
    fireEvent.click(screen.getByRole("button", { name: "Continua" }));
    await waitFor(() => expect(screen.getByText("Questo username è già in uso.")).toBeTruthy());
    expect(onScelto).not.toHaveBeenCalled();
  });
});
