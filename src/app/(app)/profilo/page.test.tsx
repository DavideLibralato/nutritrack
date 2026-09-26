import { describe, it, expect, vi } from "vitest";
import { useState, useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ProfiloPage from "./page";
import { repositoryProfili } from "@/lib/repository";

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
}));

// EsciAccount usa il router di Next.js, che fuori dall'app vera non esiste.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, refresh: () => {} }),
}));

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

    const inputAltezza = (await screen.findByLabelText("Altezza (cm)")) as HTMLInputElement;
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
