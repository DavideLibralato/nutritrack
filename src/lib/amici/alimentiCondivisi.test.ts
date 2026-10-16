// Cosa parte verso manda_alimenti (alimentiCondivisi.ts). Test permanente:
// un campo in più (user_id, verificato, le date del mittente) farebbe
// rifiutare l'invio o porterebbe all'amico dati che non deve avere; un
// campo in meno (zuccheri, sale...) lo farebbe arrivare diverso
// dall'originale, e "Hai già questo alimento, con gli stessi valori"
// diventerebbe "valori diversi".

import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Alimento } from "@/lib/db/tipi";
import { copiaPerInvio, mandaAlimenti, rispondiAlimentiCondivisi } from "./alimentiCondivisi";

const PANE: Alimento = {
  id: "pane",
  user_id: "io",
  updated_at: "2026-10-16T00:00:00.000Z",
  deleted_at: null,
  nome: "Pane",
  marca: "Mulino",
  barcode: "800",
  kcal_100g: 265,
  proteine_100g: 9,
  carboidrati_100g: 49,
  grassi_100g: 3.3,
  zuccheri_100g: 2,
  fibre_100g: null,
  saturi_100g: 0.5,
  sale_100g: 1.2,
  porzione_default_g: 50,
  fonte: "etichetta",
  verificato: false,
};

function clienteFinto(risposta: { data: unknown; error: unknown }) {
  const rpc = vi.fn(async () => risposta);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("copiaPerInvio", () => {
  it("solo i campi della copia: tutti i valori, niente user_id, verificato o date", () => {
    expect(copiaPerInvio(PANE)).toEqual({
      id: "pane",
      nome: "Pane",
      marca: "Mulino",
      barcode: "800",
      kcal_100g: 265,
      proteine_100g: 9,
      carboidrati_100g: 49,
      grassi_100g: 3.3,
      zuccheri_100g: 2,
      fibre_100g: null,
      saturi_100g: 0.5,
      sale_100g: 1.2,
      porzione_default_g: 50,
      fonte: "etichetta",
    });
  });
});

describe("le chiamate", () => {
  it("mandaAlimenti passa invio, destinatari e le copie", async () => {
    const { client, rpc } = clienteFinto({ data: "ok", error: null });
    expect(await mandaAlimenti(client, "invio-1", ["sara"], [PANE])).toBe("ok");
    expect(rpc).toHaveBeenCalledWith("manda_alimenti", {
      p_invio: "invio-1",
      p_destinatari: ["sara"],
      p_alimenti: [copiaPerInvio(PANE)],
    });
  });

  it("un esito che non conosce, o un errore, vale errore", async () => {
    expect(await mandaAlimenti(clienteFinto({ data: "boh", error: null }).client, "i", ["s"], [PANE])).toBe("errore");
    expect(
      await rispondiAlimentiCondivisi(clienteFinto({ data: null, error: { message: "x" } }).client, ["a"], "rifiuta")
    ).toBe("errore");
    expect(await rispondiAlimentiCondivisi(clienteFinto({ data: "non_trovata", error: null }).client, ["a"], "rifiuta")).toBe(
      "non_trovata"
    );
  });
});
