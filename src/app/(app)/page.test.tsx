// Test permanente sulla pagina Oggi: "Elimina" dallo sheet quantità deve
// passare dalla stessa fotografia di Elimina dal menu contestuale
// (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto"), cioè mostrare la
// barra con "Annulla" e, al tocco, riportare la voce identica. Prima del
// passo B lo sheet cancellava e basta: niente barra, niente modo di
// tornare indietro. Il test passa dalla pagina vera (tocco sulla voce,
// Elimina, Annulla) e non solo dalla funzione sotto, perché quello
// che si può rompere in silenzio è il collegamento fra i due.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import OggiPage from "./page";
import { repositoryPasti, repositoryVociDiario } from "@/lib/repository";
import { idVoceRicreata } from "@/lib/repository/vociDiario";
import { oggiLocale } from "@/lib/dataGiorno";
import type { VoceDiario } from "@/lib/db/tipi";

const USER_ID = `utente-oggi-${crypto.randomUUID()}`;

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => USER_ID,
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

// Il router di Next.js fuori dall'app vera non esiste: qui un finto vuoto.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

// Rete assente: si esercita solo la parte locale (Dexie + outbox).
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

// Senza `globals` in vitest.config la pulizia automatica di Testing Library
// non parte: si smonta a mano.
afterEach(cleanup);

function contenutoVisibile(v: VoceDiario) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, updated_at, deleted_at, ...resto } = v;
  return resto;
}

describe("Oggi: Elimina dallo sheet quantità", () => {
  it("mostra «Eliminato» con Annulla, e Annulla riporta la voce identica", async () => {
    const pasto = await repositoryPasti.crea({
      user_id: USER_ID,
      nome: "Pranzo",
      ora_inizio: "12:30",
      ordine: 0,
    });
    const voce = await repositoryVociDiario.crea({
      user_id: USER_ID,
      alimento_id: "alimento-pane",
      pasto_id: pasto.id,
      gruppo_id: null,
      quantita_g: 80,
      data: oggiLocale(),
      creato_il: "2026-10-06T12:00:00.000Z",
      consumato_alle: "2026-10-06T12:05:00.000Z",
      nome_alimento: "Pane",
      kcal_100g: 250,
      proteine_100g: 8,
      carboidrati_100g: 50,
      grassi_100g: 1,
    });

    render(<OggiPage />);

    // Tocco sulla voce: si apre lo sheet in modifica.
    fireEvent.click((await screen.findByText("Pane")).closest("button")!);
    // Un tocco solo: niente conferma, c'è "Annulla" dopo.
    fireEvent.click(await screen.findByRole("button", { name: "Elimina" }));
    expect(screen.queryByRole("button", { name: "Sì, elimina" })).toBeNull();

    // La barra, come per Elimina dal menu.
    await screen.findByText("Eliminato:");
    await waitFor(async () => {
      expect(await repositoryVociDiario.ottieniTutti(USER_ID)).toHaveLength(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

    await screen.findByText("Annullato.");
    const vive = await repositoryVociDiario.ottieniTutti(USER_ID);
    expect(vive).toHaveLength(1);
    // Stesso contenuto (quantità, pasto, giorno, valori), riga ricreata
    // con l'id deterministico dell'annullo.
    expect(contenutoVisibile(vive[0])).toEqual(contenutoVisibile(voce));
    expect(vive[0].id).toBe(idVoceRicreata(voce.id));
  });
});
