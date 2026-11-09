import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import AlimentiPage from "./page";
import { db } from "@/lib/db/database";

// «Apri» nella barra dopo «Aggiungi» nel catalogo (PUNTO_DI_PARTENZA.md
// §10.1). Il difetto trovato il 09/11 (un test caduto 1 volta su 30): la
// pagina cercava la copia appena nata nel proprio elenco, che arriva dalla
// lettura live di Dexie e si aggiorna un attimo DOPO la scrittura. Un
// tocco su «Apri» arrivato prima non trovava la copia: la barra spariva e
// non si apriva niente.
//
// Qui la lettura live della pagina è rallentata apposta (catalogoLocale
// risponde con 300 ms di ritardo), così il tocco arriva sempre prima del
// suo aggiornamento: senza la correzione il test fallisce ogni volta, non
// una volta su trenta. aggiungiDalCatalogo usa catalogoLocale dentro il suo
// modulo, non questo finto: la scrittura resta quella vera.

const USER_ID = "utente-test-apri-dopo-aggiungi";

vi.mock("@/lib/repository/alimenti", async (importOriginal) => {
  const vero = await importOriginal<typeof import("@/lib/repository/alimenti")>();
  return {
    ...vero,
    catalogoLocale: async (userId: string) => {
      const letto = await vero.catalogoLocale(userId);
      await new Promise((r) => setTimeout(r, 300));
      return letto;
    },
  };
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
  useNomeUtente: () => "Prova",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => parametriIndirizzo.valore,
}));

// I parametri dell'indirizzo (?scheda=catalogo&cerca=…), per i test di
// «Vedi tutto il catalogo» da Aggiungi.
const parametriIndirizzo = vi.hoisted(() => ({ valore: new URLSearchParams() }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

vi.mock("@/lib/amici/useAlimentiInArrivo", () => ({
  useAlimentiInArrivo: () => ({ stato: { esito: "errore" }, ricarica: async () => {} }),
}));

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

afterEach(() => {
  cleanup();
});

describe("Catalogo precaricato: «Apri» subito dopo «Aggiungi»", () => {
  it("apre la modifica della copia anche se l'elenco della pagina non l'ha ancora", async () => {
    render(<AlimentiPage />);
    fireEvent.click(await screen.findByRole("button", { name: /^Catalogo/ }));
    fireEvent.change(await screen.findByRole("searchbox", { name: "Cerca nel catalogo" }), {
      target: { value: "mandorle" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi Mandorle ai tuoi alimenti" }));

    // Il tocco appena compare la barra: la lettura live è ancora indietro.
    fireEvent.click(await screen.findByRole("button", { name: "Apri" }));

    expect(await screen.findByText("Modifica alimento")).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Mandorle");
  });

  it("una copia cancellata intanto non si apre", async () => {
    render(<AlimentiPage />);
    fireEvent.click(await screen.findByRole("button", { name: /^Catalogo/ }));
    fireEvent.change(await screen.findByRole("searchbox", { name: "Cerca nel catalogo" }), {
      target: { value: "mandorle" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi Mandorle ai tuoi alimenti" }));
    const apri = await screen.findByRole("button", { name: "Apri" });

    // Cancellata da un altro dispositivo prima del tocco (arrivata con la sync).
    const copia = (await db.alimenti.filter((a) => a.catalogo_id === "ciqual:15000").first())!;
    await db.alimenti.put({ ...copia, deleted_at: "2026-11-09T10:00:00.000Z" });
    fireEvent.click(apri);

    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByText("Modifica alimento")).toBeNull();
    expect(screen.queryByRole("button", { name: "Apri" })).toBeNull();
  });
});
