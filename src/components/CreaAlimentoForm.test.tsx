// Il form dell'alimento in modifica parte dai valori salvati: con
// String() un alimento con 0,9 g di proteine si apriva con "0.9". Qui: i
// campi si aprono con la virgola, e un Salva senza toccare niente scrive
// gli stessi numeri di prima, non 9 né 0.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CreaAlimentoForm from "./CreaAlimentoForm";
import type { Alimento } from "@/lib/db/tipi";

const salvaAlimento = vi.fn();

// Niente Dexie: il catalogo è vuoto (nessun doppione) e il Salva si spia.
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => [] }));
vi.mock("@/lib/repository/alimenti", () => ({
  catalogoLocale: async () => [],
  salvaAlimento: (...argomenti: unknown[]) => salvaAlimento(...argomenti),
}));
vi.mock("@/lib/repository/composizioni", () => ({ eliminaAlimenti: vi.fn() }));

afterEach(() => {
  cleanup();
  salvaAlimento.mockReset();
});

const MELA: Alimento = {
  id: "mela",
  user_id: "u1",
  updated_at: "2026-10-01T00:00:00.000Z",
  deleted_at: null,
  nome: "Mela",
  marca: null,
  barcode: null,
  kcal_100g: 52.5,
  proteine_100g: 0.9,
  carboidrati_100g: 12.25,
  grassi_100g: 0.2,
  zuccheri_100g: null,
  fibre_100g: null,
  saturi_100g: null,
  sale_100g: null,
  porzione_default_g: 12500.5,
  fonte: "manuale",
  verificato: false,
};

function valore(etichetta: string) {
  return (screen.getByLabelText(etichetta) as HTMLInputElement).value;
}

describe("CreaAlimentoForm, valori precompilati in modifica", () => {
  it("si apre con la virgola e un Salva senza toccare riscrive gli stessi numeri", async () => {
    salvaAlimento.mockResolvedValue({ esito: "salvato", alimento: MELA });
    const onModificato = vi.fn();
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Alimenti"
        etichettaCrea="Crea"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={() => {}}
        puoAprire={() => true}
        alimentoDaModificare={MELA}
        onModificato={onModificato}
      />
    );

    expect(valore("Calorie (kcal)")).toBe("52,5");
    expect(valore("Grassi (g)")).toBe("0,2");
    expect(valore("Carboidrati (g)")).toBe("12,25");
    expect(valore("Proteine (g)")).toBe("0,9");
    // Niente punto delle migliaia: "12.500,5" non si rileggerebbe.
    expect(valore("Porzione predefinita (g)")).toBe("12500,5");

    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(onModificato).toHaveBeenCalled());
    expect(salvaAlimento).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        kcal_100g: 52.5,
        grassi_100g: 0.2,
        carboidrati_100g: 12.25,
        proteine_100g: 0.9,
        porzione_default_g: 12500.5,
      }),
      "mela"
    );
  });

  it("valori interi: identici a prima", () => {
    render(
      <CreaAlimentoForm
        userId="u1"
        nomeIniziale=""
        etichettaIndietro="Alimenti"
        etichettaCrea="Crea"
        onAnnulla={() => {}}
        onCreato={() => {}}
        onApriEsistente={() => {}}
        puoAprire={() => true}
        alimentoDaModificare={{ ...MELA, kcal_100g: 52, proteine_100g: 1, porzione_default_g: 100 }}
      />
    );
    expect(valore("Calorie (kcal)")).toBe("52");
    expect(valore("Proteine (g)")).toBe("1");
    expect(valore("Porzione predefinita (g)")).toBe("100");
  });
});
