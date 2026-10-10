// La scadenza delle richieste (fetchConScadenza.ts, dal 10/10/2026). Il
// rischio che copre non fa rumore: una richiesta appesa e solo
// abbandonata può arrivare al server dopo una correzione e riscriverla
// con il valore vecchio (100 g sopra 150 g), con la coda ormai vuota. Qui
// si verifica che la richiesta venga annullata davvero, che la libreria
// Supabase la tratti come status 0 (rete assente: nessun tentativo
// contato) e che non la ripeta da sola.
//
// La seconda parte usa il client Supabase VERO (client.ts), non un client
// finto: solo la fetch del browser è sostituita, da una che non risponde
// mai finché non viene annullata — come una rete appesa.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { creaFetchConScadenza, MESSAGGIO_ANNULLATA, SCADENZA_FETCH_MS } from "./fetchConScadenza";
import { createClient } from "./client";
import { db } from "../db/database";
import { sincronizzaOutbox } from "../sync/sincronizza";
import type { VoceOutbox } from "../sync/outbox";

// Una fetch che non risponde mai: si chiude solo se il segnale la annulla,
// come fa il browser (rifiuta con il motivo dell'annullamento).
function fetchAppesa() {
  const chiamate: { url: string; metodo: string }[] = [];
  let segnalaPartita: () => void = () => {};
  const partita = new Promise<void>((r) => (segnalaPartita = r));
  const finta = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    chiamate.push({ url: String(input), metodo: init?.method ?? "GET" });
    segnalaPartita();
    return new Promise<Response>((_, rifiuta) => {
      init?.signal?.addEventListener("abort", () => rifiuta(init.signal!.reason));
    });
  });
  return { finta, chiamate, partita };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("creaFetchConScadenza", () => {
  it("una richiesta senza risposta viene annullata allo scadere, con un AbortError", async () => {
    const { finta } = fetchAppesa();
    const risposta = creaFetchConScadenza(1000, finta)("https://esempio.test/x");
    const esito = expect(risposta).rejects.toMatchObject({
      name: "AbortError",
      message: MESSAGGIO_ANNULLATA,
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(finta.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await esito;
  });

  it("una richiesta che risponde in tempo passa così com'è", async () => {
    const finta = vi.fn<typeof fetch>(async () => new Response("ok", { status: 201 }));
    const risposta = await creaFetchConScadenza(1000, finta)("https://esempio.test/x", {
      method: "POST",
    });
    expect(risposta.status).toBe(201);
    expect(finta.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("un segnale già passato da chi chiama annulla ancora la richiesta", async () => {
    const { finta } = fetchAppesa();
    const proprio = new AbortController();
    const risposta = creaFetchConScadenza(1000, finta)("https://esempio.test/x", {
      signal: proprio.signal,
    });
    const esito = expect(risposta).rejects.toBeDefined();
    proprio.abort();
    await esito;
  });

  it("senza AbortSignal.any (iOS prima della 17.4) unisce i segnali a mano", async () => {
    const originale = AbortSignal.any;
    Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true, writable: true });
    try {
      // Vince la scadenza...
      const primo = fetchAppesa();
      const esito1 = expect(
        creaFetchConScadenza(1000, primo.finta)("https://esempio.test/x", {
          signal: new AbortController().signal,
        })
      ).rejects.toMatchObject({ name: "AbortError", message: MESSAGGIO_ANNULLATA });
      await vi.advanceTimersByTimeAsync(1000);
      await esito1;

      // ...oppure il segnale di chi chiama, prima della scadenza.
      const secondo = fetchAppesa();
      const proprio = new AbortController();
      const esito2 = expect(
        creaFetchConScadenza(1000, secondo.finta)("https://esempio.test/x", {
          signal: proprio.signal,
        })
      ).rejects.toBe("annullata da chi chiama");
      proprio.abort("annullata da chi chiama");
      await esito2;
    } finally {
      Object.defineProperty(AbortSignal, "any", { value: originale, configurable: true, writable: true });
    }
  });
});

describe("il client Supabase vero con una rete appesa", () => {
  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://esempio.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "chiave-finta");
    await db.outbox.clear();
  });

  it("un invio appeso torna come status 0, senza ripetizioni", async () => {
    const { finta, chiamate, partita } = fetchAppesa();
    vi.stubGlobal("fetch", finta);

    const risposta = createClient().from("pasti").upsert({ id: "p1" });
    const esito = Promise.resolve(risposta);
    await partita;
    await vi.advanceTimersByTimeAsync(SCADENZA_FETCH_MS);

    const { status, error } = await esito;
    expect(status).toBe(0);
    expect(error?.message).toContain("AbortError");
    expect(chiamate).toHaveLength(1);
  });

  // La libreria ripete da sola le letture fallite, salvo un AbortError:
  // con AbortSignal.timeout() (errore "TimeoutError") una pagina della
  // discesa scaduta sarebbe ripartita fino a tre volte.
  it("una lettura appesa (discesa) torna come status 0 e non viene ripetuta", async () => {
    const { finta, chiamate, partita } = fetchAppesa();
    vi.stubGlobal("fetch", finta);

    const esito = Promise.resolve(createClient().from("pasti").select("*").eq("user_id", "u1"));
    await partita;
    await vi.advanceTimersByTimeAsync(SCADENZA_FETCH_MS);
    // Un'eventuale ripetizione partirebbe dopo una pausa: si lascia tempo.
    await vi.advanceTimersByTimeAsync(SCADENZA_FETCH_MS * 4);

    const { status } = await esito;
    expect(status).toBe(0);
    expect(chiamate.filter((c) => c.metodo === "GET")).toHaveLength(1);
  });

  it("nella sincronizzazione un invio annullato non consuma tentativi", async () => {
    const { finta, partita } = fetchAppesa();
    vi.stubGlobal("fetch", finta);
    const voce: VoceOutbox = {
      id: "pasti:p1",
      tabella: "pasti",
      record_id: "p1",
      dati: { id: "p1", user_id: "u1", updated_at: "2026-10-10T09:00:00.000Z", deleted_at: null },
      creato_il: "2026-10-10T09:00:00.000Z",
      tentativi: 4, // a un passo dalla soglia: se contasse, verrebbe accantonata
      ultimo_errore: null,
      sospesa_il: null,
    };
    await db.outbox.put(voce);

    const giro = sincronizzaOutbox();
    await partita;
    await vi.advanceTimersByTimeAsync(SCADENZA_FETCH_MS);

    expect(await giro).toEqual({ inviate: 0, fallite: 1, sospese: 0 });
    const dopo = await db.outbox.get("pasti:p1");
    expect(dopo?.tentativi).toBe(4);
    expect(dopo?.sospesa_il).toBeNull();
    expect(dopo?.ultimo_errore).toContain(MESSAGGIO_ANNULLATA);
  });
});
