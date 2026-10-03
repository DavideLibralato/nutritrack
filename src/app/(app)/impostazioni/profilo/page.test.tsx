import { describe, it, expect, vi, afterEach } from "vitest";
import { useState, useEffect } from "react";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import ProfiloPage from "./page";
import { repositoryProfili } from "@/lib/repository";
import { db } from "@/lib/db/database";

const USER_ID = "utente-test-refresh";

// Riproduce il timing vero di useUtenteId: al primo render torna undefined,
// poi (con un giro di microtask, come la vera supabase.auth.getUser()) si
// risolve con l'id dell'utente. È esattamente questo giro in più a scoprire
// il bug: se il componente segna "già inizializzato" nella finestra in cui
// userId è ancora undefined, i dati veri arrivati dopo non vengono più letti.
vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => {
    const [id, setId] = useState<string | undefined>(undefined);
    useEffect(() => {
      Promise.resolve().then(() => setId(USER_ID));
    }, []);
    return id;
  },
  useNomeUtente: () => null,
  useEmailUtente: () => null,
}));

// Il router di Next.js fuori dall'app vera non esiste: qui un finto vuoto.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, refresh: () => {} }),
}));

// Senza `globals` in vitest.config la pulizia automatica di Testing Library
// non parte: si smonta a mano, altrimenti la pagina del test prima resta
// nel documento e il test dopo legge i suoi campi.
afterEach(cleanup);

describe("Pagina Profilo dopo un refresh (F5)", () => {
  it("precompila i campi con i dati già presenti in IndexedDB, anche se userId arriva con un tick di ritardo", async () => {
    // Dati già in Dexie PRIMA del render: esattamente la situazione dopo un
    // F5 vero, dove IndexedDB sopravvive al refresh ma la sessione va
    // ricontrollata da capo.
    await repositoryProfili.crea({
      user_id: USER_ID,
      nome: null,
      sesso: "femmina",
      data_nascita: "1994-02-02",
      altezza_cm: 170,
      livello_attivita: "attivo",
      differenzia_giorni: false,
      giorni_allenamento_default: null,
    });

    render(<ProfiloPage />);

    // Primissimo render: userId ancora undefined, deve mostrare il caricamento.
    expect(screen.getByText("Caricamento...")).toBeTruthy();

    // Aspetta che lo stato "caricamento" sparisca (userId si è risolto).
    await waitFor(() => {
      expect(screen.queryByText("Caricamento...")).toBeNull();
    });

    const inputAltezza = (await screen.findByLabelText("Altezza")) as HTMLInputElement;
    await waitFor(() => {
      expect(inputAltezza.value).toBe("170");
    });

    const bottoneDonna = screen.getByRole("button", { name: "Donna" });
    expect(bottoneDonna.getAttribute("aria-pressed")).toBe("true");

    const selectAttivita = screen.getByLabelText("Livello di attività") as HTMLSelectElement;
    expect(selectAttivita.value).toBe("attivo");

    const inputData = screen.getByLabelText("Data di nascita") as HTMLInputElement;
    expect(inputData.value).toBe("1994-02-02");
  });
});

// La barra Salva compare solo quando ci sono modifiche da salvare
// (PUNTO_DI_PARTENZA.md, sezione 3, "Un solo Salva"): si controlla
// `data-visibile`, perché la classe `invisible` di Tailwind in jsdom non ha
// effetto (il CSS non c'è).
describe("Barra Salva del Profilo", () => {
  it("compare dopo una modifica e sparisce con «Annulla modifiche» e dopo il salvataggio", async () => {
    await db.profili.clear();
    await repositoryProfili.crea({
      user_id: USER_ID,
      nome: null,
      sesso: "maschio",
      data_nascita: "1990-05-05",
      altezza_cm: 180,
      livello_attivita: "moderato",
      differenzia_giorni: false,
      giorni_allenamento_default: null,
    });

    render(<ProfiloPage />);
    const altezza = (await screen.findByLabelText("Altezza")) as HTMLInputElement;
    await waitFor(() => expect(altezza.value).toBe("180"));
    const barra = () => document.querySelector("[data-visibile]");
    expect(barra()?.getAttribute("data-visibile")).toBe("false");

    fireEvent.change(altezza, { target: { value: "181" } });
    expect(barra()?.getAttribute("data-visibile")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Annulla modifiche" }));
    expect(altezza.value).toBe("180");
    expect(barra()?.getAttribute("data-visibile")).toBe("false");
    // Annullare non è salvare: niente "Salvato.".
    expect(screen.queryByText("Salvato.")).toBeNull();

    fireEvent.change(altezza, { target: { value: "182" } });
    expect(barra()?.getAttribute("data-visibile")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(barra()?.getAttribute("data-visibile")).toBe("false"));
    const salvato = await db.profili.filter((p) => p.user_id === USER_ID).first();
    expect(salvato?.altezza_cm).toBe(182);

    // Dopo il salvataggio la barra Salva sparisce e la conferma la dà una
    // BarraAnnulla senza azione (DURATE_BARRA.senzaAzione, 2500 ms), una sola, che se ne
    // va da sola.
    expect(screen.getAllByText("Salvato.")).toHaveLength(1);
    await waitFor(() => expect(screen.queryByText("Salvato.")).toBeNull(), {
      timeout: 4000,
    });
  }, 10000);
});
