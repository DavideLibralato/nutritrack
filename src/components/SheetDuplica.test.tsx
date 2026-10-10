// Il foglio di Duplica arriva fino a oggi + 7 e non oltre (PUNTO_DI_PARTENZA.md,
// sezione 3, "Inserimento retroattivo"), e "oggi" è quello dell'orologio
// locale: alle 00:30 il limite si è già spostato di un giorno, anche se in
// UTC è ancora ieri. Un `max` calcolato in UTC lo terrebbe indietro per
// un'ora o due ogni notte.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SheetDuplica from "./SheetDuplica";
import type { Pasto } from "@/lib/db/tipi";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function pasto(id: string, nome: string, ora_inizio: string, date: Partial<Pasto> = {}): Pasto {
  return {
    id, nome, ora_inizio, ordine: 0, user_id: "u1",
    updated_at: "2026-10-01T00:00:00.000Z", deleted_at: null, ...date,
  };
}

// La Colazione esiste solo dal 5 ottobre: il 4 ci sono solo Pranzo e la
// "Colazione vecchia", chiusa il 4.
const PASTI: Pasto[] = [
  pasto("colazione", "Colazione", "07:00", { valido_dal: "2026-10-05" }),
  pasto("colazione-vecchia", "Colazione vecchia", "06:00", { valido_al: "2026-10-04" }),
  pasto("pranzo", "Pranzo", "12:30"),
  pasto("cena-cancellata", "Cena", "19:30", { deleted_at: "2026-10-01T00:00:00.000Z" }),
];

function opzioni(select: HTMLSelectElement) {
  return [...select.options].map((o) => o.textContent);
}

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

  it("dopo mezzanotte: il massimo è oggi + 7 dell'orologio locale", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 7, 0, 30, 0)); // in UTC è ancora il 6
    const { giorno, duplica } = apri();
    expect(giorno.max).toBe("2026-10-14");
    fireEvent.change(giorno, { target: { value: "2026-10-14" } });
    expect(duplica.disabled).toBe(false);
  });

  it("oggi + 7 si può scegliere", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { giorno, duplica, onConferma } = apri();
    expect(giorno.max).toBe("2026-10-13");
    fireEvent.change(giorno, { target: { value: "2026-10-13" } });
    expect(duplica.disabled).toBe(false);
    fireEvent.click(duplica);
    expect(onConferma).toHaveBeenCalledWith("2026-10-13", "colazione");
  });

  it("oggi + 8 digitato a mano spegne Duplica, e il messaggio dice il limite", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { giorno, duplica, onConferma } = apri();
    fireEvent.change(giorno, { target: { value: "2026-10-14" } });
    expect(duplica.disabled).toBe(true);
    screen.getByText("Scegli un giorno fino a mar 13 ott.");
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

describe("SheetDuplica: i pasti del giorno di destinazione", () => {
  it("l'elenco segue la data scelta, e un pasto cancellato non c'è mai", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { giorno, pasto } = apri();
    expect(opzioni(pasto)).toEqual(["Colazione", "Pranzo"]);

    fireEvent.change(giorno, { target: { value: "2026-10-04" } });
    expect(opzioni(pasto)).toEqual(["Scegli un pasto", "Colazione vecchia", "Pranzo"]);
  });

  it("il pasto d'origine non esiste quel giorno: «Scegli un pasto», Duplica spento; tornando indietro torna selezionato", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { giorno, pasto, duplica, onConferma } = apri();

    fireEvent.change(giorno, { target: { value: "2026-10-04" } });
    expect(pasto.value).toBe("");
    expect(duplica.disabled).toBe(true);
    fireEvent.click(duplica);
    expect(onConferma).not.toHaveBeenCalled();

    fireEvent.change(giorno, { target: { value: "2026-10-05" } });
    expect(pasto.value).toBe("colazione");
    expect(duplica.disabled).toBe(false);
  });

  it("scelto un pasto valido quel giorno, Duplica parte con quello", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
    const { giorno, pasto, duplica, onConferma } = apri();

    fireEvent.change(giorno, { target: { value: "2026-10-04" } });
    fireEvent.change(pasto, { target: { value: "colazione-vecchia" } });
    fireEvent.click(duplica);
    expect(onConferma).toHaveBeenCalledWith("2026-10-04", "colazione-vecchia");
  });
});
