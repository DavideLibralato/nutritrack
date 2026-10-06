// Test permanente sulla pagina Oggi: "Elimina" dallo sheet quantità deve
// passare dalla stessa fotografia di Elimina dal menu contestuale
// (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni premuto"), cioè mostrare la
// barra con "Annulla" e, al tocco, riportare la voce identica. Prima del
// passo B lo sheet cancellava e basta: niente barra, niente modo di
// tornare indietro. Il test passa dalla pagina vera (tocco sulla voce,
// Elimina, Annulla) e non solo dalla funzione sotto, perché quello
// che si può rompere in silenzio è il collegamento fra i due.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import OggiPage from "./page";
import { repositoryPasti, repositoryVociDiario } from "@/lib/repository";
import { idVoceRicreata } from "@/lib/repository/vociDiario";
import { oggiLocale } from "@/lib/dataGiorno";
import type { VoceDiario } from "@/lib/db/tipi";

// Un utente nuovo per ogni test: il database finto è lo stesso per tutto il
// file, e i test contano le voci dell'utente.
let utenteTest = "";
beforeEach(() => {
  utenteTest = `utente-oggi-${crypto.randomUUID()}`;
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => utenteTest,
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
      user_id: utenteTest,
      nome: "Pranzo",
      ora_inizio: "12:30",
      ordine: 0,
    });
    const voce = await repositoryVociDiario.crea({
      user_id: utenteTest,
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
      expect(await repositoryVociDiario.ottieniTutti(utenteTest)).toHaveLength(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));

    await screen.findByText("Annullato.");
    const vive = await repositoryVociDiario.ottieniTutti(utenteTest);
    expect(vive).toHaveLength(1);
    // Stesso contenuto (quantità, pasto, giorno, valori), riga ricreata
    // con l'id deterministico dell'annullo.
    expect(contenutoVisibile(vive[0])).toEqual(contenutoVisibile(voce));
    expect(vive[0].id).toBe(idVoceRicreata(voce.id));
  });
});

// Bug del 6/10 su iPhone: tieni premuto un alimento, si apre il menu, un
// tocco fuori lo chiude — e da lì la lista non scorreva più e il
// tieni-premuto non riapriva il menu, fino a ricaricare la pagina. Lo stato
// che dà esattamente questo: il gesto rimasto "aperto" nell'hook (touchmove
// bloccati, lista con overflow hidden, ogni nuovo tocco scartato come
// "secondo dito"), perché la fine del tocco che aveva aperto il menu —
// comparso sotto il dito ancora appoggiato — non arrivava alla lista.
// Qui la fine di quel tocco non arriva mai, come su Safari: dopo il tocco
// fuori tutto deve tornare a funzionare lo stesso.
describe("Oggi: menu del tieni-premuto chiuso con un tocco fuori", () => {
  function puntatore(tipo: string, el: Element, pointerId: number) {
    fireEvent(
      el,
      new PointerEvent(tipo, {
        bubbles: true,
        cancelable: true,
        pointerId,
        isPrimary: true,
        pointerType: "touch",
        button: 0,
        clientX: 50,
        clientY: 50,
      })
    );
  }

  async function preparaPane() {
    const pasto = await repositoryPasti.crea({
      user_id: utenteTest,
      nome: "Pranzo",
      ora_inizio: "12:30",
      ordine: 0,
    });
    await repositoryVociDiario.crea({
      user_id: utenteTest,
      alimento_id: "alimento-pane",
      pasto_id: pasto.id,
      gruppo_id: null,
      quantita_g: 80,
      data: oggiLocale(),
      creato_il: "2026-10-06T12:00:00.000Z",
      consumato_alle: null,
      nome_alimento: "Pane",
      kcal_100g: 250,
      proteine_100g: 8,
      carboidrati_100g: 50,
      grassi_100g: 1,
    });
    render(<OggiPage />);
    const riga = (await screen.findByText("Pane")).closest("button")!;
    // La lista che scorre: quella con gli ascoltatori del gesto.
    const lista = riga.closest("ul")!.parentElement!.closest("ul")!;
    return { riga, lista };
  }

  // Tieni premuto fermo: dopo 450 + 160 ms il menu si apre, dito ancora giù.
  // Si aspetta che compaia invece di un tempo fisso: con tutto il file in
  // esecuzione i timer di jsdom possono scattare in ritardo.
  async function tieniPremuto(riga: Element, pointerId: number) {
    puntatore("pointerdown", riga, pointerId);
    await screen.findByRole("menu", undefined, { timeout: 3000 });
  }

  async function toccaFuori() {
    const sfondo = screen.getByRole("menu").parentElement!;
    puntatore("pointerdown", sfondo, 99);
    puntatore("pointerup", sfondo, 99);
    fireEvent.click(sfondo, { detail: 1 });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  }

  function touchmoveBloccato(el: Element): boolean {
    const ev = new Event("touchmove", { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }

  it("la fine del tocco non arriva: dopo il tocco fuori lista e gesto tornano liberi", async () => {
    const { riga, lista } = await preparaPane();

    await tieniPremuto(riga, 1);
    // Nessun pointerup per il dito 1: è il caso di Safari.

    await toccaFuori();

    expect(lista.style.overflowY).toBe("");
    expect(touchmoveBloccato(riga)).toBe(false);

    // Un nuovo tieni-premuto riapre il menu.
    await tieniPremuto(riga, 2);
    puntatore("pointerup", lista, 2);
  });

  it("la fine del tocco arriva (il caso normale): stesso risultato", async () => {
    const { riga, lista } = await preparaPane();

    await tieniPremuto(riga, 1);
    puntatore("pointerup", lista, 1);

    await toccaFuori();

    expect(lista.style.overflowY).toBe("");
    expect(touchmoveBloccato(riga)).toBe(false);
    await tieniPremuto(riga, 2);
    puntatore("pointerup", lista, 2);
  });
});
