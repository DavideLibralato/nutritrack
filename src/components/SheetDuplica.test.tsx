// Il foglio di Duplica non deve permettere giorni futuri (PUNTO_DI_PARTENZA.md,
// sezione 3, "Tieni premuto", passo E), e "oggi" è quello dell'orologio
// locale: alle 00:30 il giorno nuovo è già oggi, anche se in UTC è ancora
// ieri. Un `max` calcolato in UTC lo escluderebbe per un'ora o due ogni notte.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SheetDuplica from "./SheetDuplica";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const PASTI = [
  { id: "colazione", nome: "Colazione" },
  { id: "pranzo", nome: "Pranzo" },
];

function apri(onConferma = vi.fn()) {
  render(
    <SheetDuplica
      titolo="Duplica «Mela»"
      giornoIniziale="2026-10-06"
      pasti={PASTI}
      pastoIniziale="colazione"
      onAnnulla={() => {}}
      onConferma={onConferma}
    />
  );
  return {
    giorno: screen.getByLabelText("Giorno") as HTMLInputElement,
    pasto: screen.getByLabelText("Pasto") as HTMLSelectElement,
    duplica: screen.getByRole("button", { name: "Duplica" }) as HTMLButtonElement,
    onConferma,
  };
}

describe("SheetDuplica", () => {
  it("parte dal giorno che si guarda e dal pasto d'origine", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { giorno, pasto, duplica, onConferma } = apri();
    expect(giorno.value).toBe("2026-10-06");
    expect(pasto.value).toBe("colazione");
    fireEvent.click(duplica);
    expect(onConferma).toHaveBeenCalledWith("2026-10-06", "colazione");
  });

  it("dopo mezzanotte: il massimo è il giorno nuovo dell'orologio locale", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 7, 0, 30, 0)); // in UTC è ancora il 6
    const { giorno, duplica } = apri();
    expect(giorno.max).toBe("2026-10-07");
    fireEvent.change(giorno, { target: { value: "2026-10-07" } });
    expect(duplica.disabled).toBe(false);
  });

  it("un giorno futuro digitato a mano spegne Duplica", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { giorno, duplica, onConferma } = apri();
    fireEvent.change(giorno, { target: { value: "2026-10-07" } });
    expect(duplica.disabled).toBe(true);
    screen.getByText("Scegli oggi o un giorno passato.");
    fireEvent.click(duplica);
    expect(onConferma).not.toHaveBeenCalled();
  });

  it("senza giorno Duplica resta spento", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { giorno, duplica } = apri();
    fireEvent.change(giorno, { target: { value: "" } });
    expect(duplica.disabled).toBe(true);
  });
});
