// Primo avvio senza rete (PUNTO_DI_PARTENZA.md, sezione 9.2, "Seed dei
// pasti predefiniti"): su un dispositivo vuoto i 5 pasti si creano solo
// dopo aver letto il server. Se la lettura fallisce, Oggi e Aggiungi
// mostrano "Serve la connessione" con "Riprova", e riprovano da sole quando
// il browser torna online. Prima della correzione del 2026-10-07 c'era
// "Preparo i tuoi pasti…" all'infinito, e in Aggiungi toccare un alimento
// non faceva niente.
//
// Test permanente: la logica che può rompersi in silenzio è il
// collegamento fra l'esito del seed (garantisciPastiPredefiniti), lo stato
// della pagina (usePastiIniziali) e l'evento `online` — un errore lì non
// fa crashare niente, lascia solo l'utente davanti a una pagina ferma.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import OggiPage from "./(app)/page";
import AggiungiPage from "./aggiungi/page";
import { idPastoPredefinito, PASTI_PREDEFINITI } from "@/lib/repository/pasti";
import type { Pasto } from "@/lib/db/tipi";

// Un utente nuovo per ogni test: Dexie (finta) è la stessa per tutto il file.
let utenteTest = "";

// Il server finto. `conteggio` e `scarico`: se le due letture del seed
// rispondono (il conteggio delle righe e lo scarico paginato). Le
// scritture dalla coda outbox falliscono sempre: il server non cambia.
const server = {
  righe: [] as Pasto[],
  conteggio: false,
  scarico: false,
};

beforeEach(() => {
  utenteTest = `utente-avvio-${crypto.randomUUID()}`;
  server.righe = [];
  server.conteggio = false;
  server.scarico = false;
});

vi.mock("@/lib/supabase/useUtente", () => ({
  useUtenteId: () => utenteTest,
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
      let soloConteggio = false;
      let scrittura = false;
      const builder: Record<string, unknown> = {
        select: (_colonne: string, opzioni?: { head?: boolean }) => {
          soloConteggio = Boolean(opzioni?.head);
          return builder;
        },
        upsert: () => {
          scrittura = true;
          return builder;
        },
        then: (risolvi: (v: unknown) => void) => {
          const errore = { message: "Rete non disponibile (finta)." };
          const righe = server.righe.filter((r) => r.user_id === utenteTest);
          if (scrittura) risolvi({ data: null, error: errore });
          else if (soloConteggio)
            risolvi(server.conteggio ? { count: righe.length, error: null } : { count: null, error: errore });
          else risolvi(server.scarico ? { data: righe, error: null } : { data: null, error: errore });
        },
      };
      for (const metodo of ["eq", "gte", "order", "range", "or", "is"]) builder[metodo] = () => builder;
      return builder;
    },
  }),
}));

afterEach(cleanup);

// Il browser torna online: l'evento si rimanda finché compare `atteso`.
// La pagina si mette in ascolto di `online` in un effetto, che React fa
// partire un attimo DOPO aver disegnato "Serve la connessione": un evento
// mandato in quell'attimo non lo sente nessuno. Sul telefono la rete torna
// secondi dopo, non in quell'attimo; nel test il riquadro e l'evento sono
// a pochi microsecondi, e un evento solo rendeva il test instabile.
async function tornaLaRete(atteso: string) {
  await waitFor(() => {
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByText(atteso)).toBeTruthy();
  });
}

function reteAccesa() {
  server.conteggio = true;
  server.scarico = true;
}

// I 5 pasti di questo utente come sono sul server, con il Pranzo rinominato:
// se a schermo compare "Pranzo 1", i pasti sono quelli scaricati e non
// quelli creati dal seed.
function pastiSulServer(): Pasto[] {
  return PASTI_PREDEFINITI.map((p) => ({
    id: idPastoPredefinito(utenteTest, p.nome),
    user_id: utenteTest,
    nome: p.nome === "Pranzo" ? "Pranzo 1" : p.nome,
    ora_inizio: `${p.ora_inizio}:00`,
    ordine: p.ordine,
    updated_at: "2026-09-20T20:11:00.000000+00:00",
    deleted_at: null,
  }));
}

describe("Primo avvio senza rete: Oggi", () => {
  it("lettura fallita: «Serve la connessione», non «Preparo i tuoi pasti…»", async () => {
    render(<OggiPage />);

    expect(await screen.findByText("Serve la connessione")).toBeTruthy();
    expect(screen.queryByText("Preparo i tuoi pasti…")).toBeNull();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeTruthy();
  });

  it("torna la rete (evento online): riprova da sola e mostra i pasti", async () => {
    render(<OggiPage />);
    await screen.findByText("Serve la connessione");

    reteAccesa();
    // Server vuoto: i 5 predefiniti creati dal seed.
    await tornaLaRete("Colazione");
    expect(screen.queryByText("Serve la connessione")).toBeNull();
  });

  it("Riprova senza rete: di nuovo il riquadro; Riprova con la rete: i pasti", async () => {
    render(<OggiPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Riprova" }));
    expect(await screen.findByText("Serve la connessione")).toBeTruthy();

    reteAccesa();
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    expect(await screen.findByText("Cena")).toBeTruthy();
  });

  it("conteggio riuscito ma scarico fallito: «Serve la connessione», poi i pasti del server", async () => {
    server.righe = pastiSulServer();
    server.conteggio = true;
    render(<OggiPage />);

    expect(await screen.findByText("Serve la connessione")).toBeTruthy();
    expect(screen.queryByText("Preparo i tuoi pasti…")).toBeNull();

    server.scarico = true;
    await tornaLaRete("Pranzo 1");
  });
});

describe("Primo avvio senza rete: Aggiungi", () => {
  it("stesso riquadro con Riprova; con la rete compare la scelta del pasto", async () => {
    render(<AggiungiPage />);

    expect(await screen.findByText("Serve la connessione")).toBeTruthy();

    reteAccesa();
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    await waitFor(() => expect(screen.getByRole("combobox", { name: "Pasto" })).toBeTruthy());
  });
});
