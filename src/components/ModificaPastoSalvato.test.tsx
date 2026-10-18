// La modifica di un pasto salvato: i grammi delle righe si aprono con la
// virgola, e il "Prima: …" sotto una riga cambiata li scrive come il resto
// dell'app con formattaGrammi ("12,5 g", e "12.500 g" da 10.000 in su).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ModificaPastoSalvato from "./ModificaPastoSalvato";
import type { Alimento } from "@/lib/db/tipi";
import type { ModuloPasto } from "@/lib/inserimento/modificaPastoSalvato";

// Il modulo come lo leggerebbe Dexie, con i grammi già come li scrive
// grammiPerCampo (moduloDaDati, coperto in modificaPastoSalvato.test.ts).
const MODULO: ModuloPasto = {
  nome: "Merenda",
  righe: [
    { chiave: "r1", voceId: "r1", alimentoId: "burro", nomeAlimento: "Burro", grammi: "12,5" },
    { chiave: "r2", voceId: "r2", alimentoId: "acqua", nomeAlimento: "Acqua", grammi: "12500" },
  ],
};

vi.mock("@/lib/inserimento/modificaPastoSalvato", async (originale) => ({
  ...(await originale<typeof import("@/lib/inserimento/modificaPastoSalvato")>()),
  caricaModuloPasto: async () => MODULO,
}));

afterEach(cleanup);

function alimento(id: string, nome: string, kcal_100g: number): Alimento {
  return {
    id,
    user_id: "u1",
    updated_at: "2026-10-01T00:00:00.000Z",
    deleted_at: null,
    nome,
    marca: null,
    barcode: null,
    kcal_100g,
    proteine_100g: 0,
    carboidrati_100g: 0,
    grassi_100g: 0,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
  };
}

async function apri() {
  const { container } = render(
    <ModificaPastoSalvato
      userId="u1"
      composizioneId="c1"
      catalogo={[alimento("burro", "Burro", 717), alimento("acqua", "Acqua", 0)]}
      onChiudi={() => {}}
    />
  );
  await screen.findByDisplayValue("12,5");
  return (chiave: string) => container.querySelector(`#grammi-${chiave}`) as HTMLInputElement;
}

describe("ModificaPastoSalvato, grammi con la virgola", () => {
  it("la riga si apre con «12,5»; cambiata, sotto c'è «Prima: 12,5 g»", async () => {
    const campo = await apri();
    expect(campo("r1").value).toBe("12,5");
    expect(screen.queryByText(/^Prima:/)).toBeNull();

    fireEvent.change(campo("r1"), { target: { value: "20" } });
    expect(screen.getByText("Prima: 12,5 g")).toBeTruthy();
  });

  it("da 10.000 g in su: il campo senza punto, il «Prima» come il resto dell'app", async () => {
    const campo = await apri();
    expect(campo("r2").value).toBe("12500");

    fireEvent.change(campo("r2"), { target: { value: "100" } });
    expect(screen.getByText("Prima: 12.500 g")).toBeTruthy();
  });
});
