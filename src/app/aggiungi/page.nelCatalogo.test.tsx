import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import AggiungiPage from "./page";
import { db } from "@/lib/db/database";
import { repositoryPasti } from "@/lib/repository";

// Il «+» del riquadro «Nel catalogo» in Aggiungi (PUNTO_DI_PARTENZA.md
// §10.1). Lo stesso rischio del difetto del 09/11 in Impostazioni >
// Alimenti: la copia appena nata non è ancora nell'elenco della pagina,
// che arriva dalla lettura live di Dexie e si aggiorna un attimo dopo. Il
// «+» deve aprire lo sheet quantità con l'alimento restituito da
// aggiungiDalCatalogo, non cercandolo lì.
//
// Qui la lettura live della pagina è rallentata apposta (catalogoLocale
// risponde con 1 secondo di ritardo): lo sheet deve aprirsi lo stesso, subito.
// aggiungiDalCatalogo usa catalogoLocale dentro il suo modulo, non questo
// finto: la scrittura resta quella vera.

const USER_ID = "utente-test-aggiungi-nel-catalogo";

vi.mock("@/lib/repository/alimenti", async (importOriginal) => {
  const vero = await importOriginal<typeof import("@/lib/repository/alimenti")>();
  return {
    ...vero,
    catalogoLocale: async (userId: string) => {
      const letto = await vero.catalogoLocale(userId);
      await new Promise((r) => setTimeout(r, 1000));
      return letto;
    },
  };
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {}, back: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await repositoryPasti.crea({ user_id: USER_ID, nome: "Pranzo", ora_inizio: "12:30", ordine: 0 });
});

afterEach(cleanup);

describe("Aggiungi: il «+» del riquadro «Nel catalogo»", () => {
  it("apre lo sheet della copia appena nata anche se l'elenco della pagina non l'ha ancora", async () => {
    render(<AggiungiPage />);
    const campo = await screen.findByRole(
      "searchbox",
      { name: "Cerca alimento o pasto" },
      { timeout: 5000 }
    );
    fireEvent.change(campo, { target: { value: "mandorle" } });
    const riquadro = screen.getByRole("heading", { name: "Nel catalogo" }).closest("section")!;
    fireEvent.click(
      within(riquadro).getByRole("button", {
        name: "Aggiungi Mandorle ai tuoi alimenti e scegli i grammi",
      })
    );

    // Entro 800 ms: prima che la lettura live (1 s di ritardo) porti la copia.
    const sheet = await screen.findByRole(
      "dialog",
      { name: "Quantità di Mandorle" },
      { timeout: 800 }
    );
    expect((within(sheet).getByLabelText("Quantità (g)") as HTMLInputElement).value).toBe("30");
    expect(within(sheet).getByText("Aggiunto ai tuoi alimenti: Mandorle")).toBeTruthy();
  });
});
