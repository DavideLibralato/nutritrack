import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import PreferitiPage from "./page";
import { db } from "@/lib/db/database";
import { repositoryAlimenti, repositoryPreferiti } from "@/lib/repository";
import type { Alimento } from "@/lib/db/tipi";

// Impostazioni > Preferiti e pasti salvati: la stella sulla riga di un
// alimento, "Tolto dai preferiti" e l'"Annulla" della barra. Il rischio è
// silenzioso: rimettere un preferito creando una riga NUOVA invece di
// rimettere in vita quella cancellata. A schermo tutto sembra a posto, ma
// sul server la seconda riga collide col vincolo unico (user_id,
// alimento_id) e la sync si ferma senza dirlo (lo stesso bug già corretto
// in togglePreferito, src/lib/repository/preferiti.test.ts).

const USER_ID = "utente-test-pagina-preferiti";

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
  useNomeUtente: () => "Prova",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

afterEach(cleanup);

function creaAlimento(nome: string): Promise<Alimento> {
  return repositoryAlimenti.crea({
    user_id: USER_ID, nome, marca: null, barcode: null,
    kcal_100g: 52, proteine_100g: 1, carboidrati_100g: 10, grassi_100g: 1,
    zuccheri_100g: null, fibre_100g: null, saturi_100g: null, sale_100g: null,
    porzione_default_g: 100, fonte: "manuale", verificato: false,
  });
}

// Tutte le righe di `preferiti` di questo alimento, vive o cancellate.
function righeDi(alimentoId: string) {
  return db.preferiti
    .filter((p) => p.user_id === USER_ID && p.alimento_id === alimentoId)
    .toArray();
}

describe("Preferiti e pasti salvati — togliere e rimettere un alimento", () => {
  it("stella → tolto, riga sbiadita e barra; Annulla → la stessa riga rimessa in vita", async () => {
    const mela = await creaAlimento("Mela");
    const { id: idPreferito } = await repositoryPreferiti.crea({ user_id: USER_ID, alimento_id: mela.id });
    render(<PreferitiPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Togli Mela dai preferiti" }));

    // Tolto davvero, ma la riga resta a schermo con la stella vuota.
    expect(await screen.findByRole("button", { name: "Rimetti Mela nei preferiti" })).toBeTruthy();
    await waitFor(async () => expect((await righeDi(mela.id))[0].deleted_at).not.toBeNull());
    expect(await screen.findByText(/Tolto dai preferiti:/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

    expect(await screen.findByRole("button", { name: "Togli Mela dai preferiti" })).toBeTruthy();
    const righe = await righeDi(mela.id);
    expect(righe).toHaveLength(1);
    expect(righe[0].id).toBe(idPreferito);
    expect(righe[0].deleted_at).toBeNull();
  });

  it("ritoccare la stella di una riga tolta la rimette, sempre con la stessa riga", async () => {
    const pane = await creaAlimento("Pane");
    const { id: idPreferito } = await repositoryPreferiti.crea({ user_id: USER_ID, alimento_id: pane.id });
    render(<PreferitiPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Togli Pane dai preferiti" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rimetti Pane nei preferiti" }));

    expect(await screen.findByRole("button", { name: "Togli Pane dai preferiti" })).toBeTruthy();
    await waitFor(async () => expect((await righeDi(pane.id))[0].deleted_at).toBeNull());
    const righe = await righeDi(pane.id);
    expect(righe).toHaveLength(1);
    expect(righe[0].id).toBe(idPreferito);
  });
});
