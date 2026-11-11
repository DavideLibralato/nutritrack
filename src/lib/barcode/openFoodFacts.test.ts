// Test permanenti per cercaSuOpenFoodFacts (openFoodFacts.ts), con una
// fetch finta. Proteggono le distinzioni che la schermata usa e che non
// fanno rumore se sbagliate: un 404 preso per rete assente direbbe "Non
// riesco a raggiungere Open Food Facts" per ogni prodotto sconosciuto; un
// tempo massimo che non scatta lascerebbe l'utente ad aspettare; un
// annullamento preso per errore mostrerebbe un messaggio dopo la chiusura;
// senza X-User-Agent Open Food Facts può bloccare l'app.

import { describe, it, expect, vi, afterEach } from "vitest";
import { cercaSuOpenFoodFacts, SCADENZA_OPEN_FOOD_FACTS_MS, userAgentLibra } from "./openFoodFacts";

const CODICE = "3017620422003";

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Una fetch che non risponde mai, ma si ferma quando il segnale si annulla,
// come quella vera.
function fetchAppesa(): typeof fetch {
  return (_input, init) =>
    new Promise<Response>((_, rifiuta) => {
      init?.signal?.addEventListener("abort", () => rifiuta(init.signal!.reason), { once: true });
    });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("cercaSuOpenFoodFacts", () => {
  it("chiama l'API v3 con i soli campi che servono e l'X-User-Agent di Libra", async () => {
    const fetchFinta = vi.fn<typeof fetch>(async () =>
      json({ product: { product_name: "Nutella" } })
    );

    await cercaSuOpenFoodFacts(CODICE, { fetchBase: fetchFinta });

    expect(fetchFinta).toHaveBeenCalledTimes(1);
    const [indirizzo, init] = fetchFinta.mock.calls[0];
    expect(indirizzo).toBe(
      "https://world.openfoodfacts.org/api/v3/product/3017620422003?fields=product_name,product_name_it,brands,nutriments"
    );
    expect(new Headers(init?.headers).get("X-User-Agent")).toBe(userAgentLibra());
    expect(userAgentLibra()).toMatch(/^Libra\/\S+ \(libra\.app\.supporto@gmail\.com\)$/);
  });

  it("un prodotto trovato arriva già letto", async () => {
    const esito = await cercaSuOpenFoodFacts(CODICE, {
      fetchBase: async () =>
        json({
          product: {
            product_name: "Nutella",
            brands: "Nutella, Ferrero",
            nutriments: { "energy-kcal_100g": 539 },
          },
        }),
    });
    expect(esito).toEqual({
      esito: "trovato",
      prodotto: expect.objectContaining({ nome: "Nutella", marca: "Nutella", kcal_100g: 539 }),
    });
  });

  it("404 = non trovato, non rete assente", async () => {
    const esito = await cercaSuOpenFoodFacts(CODICE, {
      fetchBase: async () => json({ result: { id: "product_not_found" }, status: "failure" }, 404),
    });
    expect(esito).toEqual({ esito: "non-trovato" });
  });

  it("un prodotto senza nome, marca né valori conta come non trovato", async () => {
    const esito = await cercaSuOpenFoodFacts(CODICE, {
      fetchBase: async () => json({ product: { brands: "", nutriments: {} } }),
    });
    expect(esito).toEqual({ esito: "non-trovato" });
  });

  it("429 e 503 = occupato, un altro errore del server = errore", async () => {
    for (const status of [429, 503]) {
      const esito = await cercaSuOpenFoodFacts(CODICE, { fetchBase: async () => json({}, status) });
      expect(esito).toEqual({ esito: "occupato" });
    }
    const esito = await cercaSuOpenFoodFacts(CODICE, { fetchBase: async () => json({}, 500) });
    expect(esito).toEqual({ esito: "errore" });
  });

  it("un corpo che non è JSON = errore", async () => {
    const esito = await cercaSuOpenFoodFacts(CODICE, {
      fetchBase: async () => new Response("<html>manutenzione</html>", { status: 200 }),
    });
    expect(esito).toEqual({ esito: "errore" });
  });

  it("una fetch fallita (rete assente) = rete", async () => {
    const esito = await cercaSuOpenFoodFacts(CODICE, {
      fetchBase: async () => {
        throw new TypeError("Load failed");
      },
    });
    expect(esito).toEqual({ esito: "rete" });
  });

  it("dopo 10 secondi senza risposta la richiesta si annulla e vale rete", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let finito = false;
    const promessa = cercaSuOpenFoodFacts(CODICE, { fetchBase: fetchAppesa() }).then((e) => {
      finito = true;
      return e;
    });

    await vi.advanceTimersByTimeAsync(SCADENZA_OPEN_FOOD_FACTS_MS - 1);
    expect(finito).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await promessa).toEqual({ esito: "rete" });
    expect(SCADENZA_OPEN_FOOD_FACTS_MS).toBe(10_000);
  });

  it("annullata da chi chiama (schermata chiusa) = annullata, non errore", async () => {
    const controller = new AbortController();
    const promessa = cercaSuOpenFoodFacts(CODICE, {
      fetchBase: fetchAppesa(),
      segnale: controller.signal,
    });
    controller.abort();
    expect(await promessa).toEqual({ esito: "annullata" });
  });
});
