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
import {
  creaFetchConScadenza,
  MESSAGGIO_ANNULLATA,
  RITARDO_RIPETIZIONE_MS,
  SCADENZA_FETCH_MS,
} from "./fetchConScadenza";
import { createClient } from "./client";
import { db } from "../db/database";
import { sincronizzaOutbox } from "../sync/sincronizza";
import { scaricaTutto } from "../sync/discesa";
import { azzeraStatoGiri, leggiStatoGiri, statoDaMostrare } from "../sync/statoSincronizzazione";
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
  vi.restoreAllMocks();
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
    // La salita manda solo le voci dell'utente della sessione: qui non ce
    // n'è una vera, se ne finge una (il client del browser è uno solo).
    vi.spyOn(createClient().auth, "getSession").mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
      error: null,
    } as never);

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

// --- La ripetizione su 401 PGRST303 (dal 01/11/2026) ------------------------
//
// Il 01/11 PostgREST ha rifiutato due volte un token appena emesso con 401
// PGRST303 "JWT issued at future" (bug di PostgREST prima della 14.18, vedi
// fetchConScadenza.ts): una tabella su 11 e la pagina Sincronizzazione
// mostrava "Accesso scaduto", con "Esci e rientra" come unica scelta. Lo
// stesso token, un attimo dopo, passava. Qui: si ripete una volta sola,
// dopo un secondo, solo per PostgREST e solo per quel codice; il corpo
// resta leggibile; la scadenza resta una sola.

const REST = "https://esempio.supabase.co/rest/v1/composizioni?select=*";

function risposta401(codice: string, metodo = "GET"): Response {
  if (metodo === "HEAD") return new Response(null, { status: 401 });
  return new Response(
    JSON.stringify({ code: codice, details: null, hint: null, message: "JWT issued at future" }),
    { status: 401, headers: { "content-type": "application/json; charset=utf-8" } }
  );
}

function rispostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Fa avanzare il tempo finto a piccoli passi finché la promessa non è
// finita: fra un passo e l'altro girano le letture di Dexie e dei corpi.
async function finoAllaFine<T>(promessa: Promise<T>, passoMs = 100, passiMassimi = 600): Promise<T> {
  let finita = false;
  const seguita = promessa.finally(() => (finita = true));
  seguita.catch(() => {});
  for (let i = 0; i < passiMassimi && !finita; i++) {
    await vi.advanceTimersByTimeAsync(passoMs);
  }
  return seguita;
}

describe("creaFetchConScadenza, 401 PGRST303", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("401 PGRST303 poi 200: chi chiama riceve il 200, la seconda prova parte dopo un secondo", async () => {
    const finta = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(risposta401("PGRST303"))
      .mockResolvedValueOnce(rispostaJson([]));
    const promessa = creaFetchConScadenza(SCADENZA_FETCH_MS, finta)(REST, { method: "GET" });

    await vi.advanceTimersByTimeAsync(RITARDO_RIPETIZIONE_MS - 1);
    expect(finta).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    const risposta = await promessa;
    expect(risposta.status).toBe(200);
    expect(await risposta.json()).toEqual([]);
    expect(finta).toHaveBeenCalledTimes(2);
  });

  it("due PGRST303 di fila: il secondo 401 arriva a chi chiama, nessuna terza prova", async () => {
    const finta = vi.fn<typeof fetch>(async () => risposta401("PGRST303"));
    const risposta = await finoAllaFine(creaFetchConScadenza(SCADENZA_FETCH_MS, finta)(REST));
    await vi.advanceTimersByTimeAsync(RITARDO_RIPETIZIONE_MS * 10);

    expect(risposta.status).toBe(401);
    expect(await risposta.json()).toMatchObject({ code: "PGRST303" });
    expect(finta).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["401 con un altro codice (PGRST301)", REST, 401, "PGRST301"],
    ["403 anche con code PGRST303 (si ripete solo il 401)", REST, 403, "PGRST303"],
    ["401 PGRST303 da Supabase Auth, non da PostgREST", "https://esempio.supabase.co/auth/v1/user", 401, "PGRST303"],
  ])("%s: nessuna ripetizione, corpo ancora leggibile", async (_nome, url, status, codice) => {
    const finta = vi.fn<typeof fetch>(async () => rispostaJson({ code: codice }, status));
    const risposta = await finoAllaFine(creaFetchConScadenza(SCADENZA_FETCH_MS, finta)(url));
    await vi.advanceTimersByTimeAsync(RITARDO_RIPETIZIONE_MS * 5);

    expect(risposta.status).toBe(status);
    expect(await risposta.json()).toEqual({ code: codice });
    expect(finta).toHaveBeenCalledTimes(1);
  });

  it("401 senza corpo (HEAD, i conteggi) o non JSON: nessuna ripetizione", async () => {
    const senzaCorpo = vi.fn<typeof fetch>(async () => risposta401("PGRST303", "HEAD"));
    const r1 = await finoAllaFine(creaFetchConScadenza(SCADENZA_FETCH_MS, senzaCorpo)(REST, { method: "HEAD" }));
    const testo = vi.fn<typeof fetch>(async () => new Response("non autorizzato", { status: 401 }));
    const r2 = await finoAllaFine(creaFetchConScadenza(SCADENZA_FETCH_MS, testo)(REST));
    await vi.advanceTimersByTimeAsync(RITARDO_RIPETIZIONE_MS * 5);

    expect(r1.status).toBe(401);
    expect(r2.status).toBe(401);
    expect(await r2.text()).toBe("non autorizzato");
    expect(senzaCorpo).toHaveBeenCalledTimes(1);
    expect(testo).toHaveBeenCalledTimes(1);
  });

  it("una richiesta non arrivata (status 0) non si ripete", async () => {
    const finta = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(creaFetchConScadenza(SCADENZA_FETCH_MS, finta)(REST)).rejects.toThrow("Failed to fetch");
    await vi.advanceTimersByTimeAsync(RITARDO_RIPETIZIONE_MS * 5);
    expect(finta).toHaveBeenCalledTimes(1);
  });

  it("un invio (POST) riparte uguale: stesso metodo, stesso corpo, stesse intestazioni", async () => {
    const finta = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(risposta401("PGRST303"))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    const corpo = JSON.stringify({ id: "p1", nome: "Pranzo" });
    const intestazioni = { Authorization: "Bearer token-di-prova" };
    const risposta = await finoAllaFine(
      creaFetchConScadenza(SCADENZA_FETCH_MS, finta)(REST, { method: "POST", body: corpo, headers: intestazioni })
    );

    expect(risposta.status).toBe(201);
    expect(finta).toHaveBeenCalledTimes(2);
    for (const [, init] of finta.mock.calls) {
      expect(init).toMatchObject({ method: "POST", body: corpo, headers: intestazioni });
    }
  });

  it("la scadenza è una sola: se scade durante l'attesa, AbortError e nessuna seconda prova", async () => {
    // La prima risposta arriva a 29,5 s: l'attesa di un secondo supera i 30.
    const finta = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((r) =>
          setTimeout(() => r(risposta401("PGRST303")), SCADENZA_FETCH_MS - 500)
        )
    );
    const esito = expect(creaFetchConScadenza(SCADENZA_FETCH_MS, finta)(REST)).rejects.toMatchObject({
      name: "AbortError",
      message: MESSAGGIO_ANNULLATA,
    });
    await vi.advanceTimersByTimeAsync(SCADENZA_FETCH_MS + RITARDO_RIPETIZIONE_MS);
    await esito;
    expect(finta).toHaveBeenCalledTimes(1);
  });
});

describe("il client Supabase vero con un 401 PGRST303", () => {
  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://esempio.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "chiave-finta");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await db.outbox.clear();
    await db.sync_cursori.clear();
    azzeraStatoGiri();
  });

  // Il caso del 01/11: lo scarico completo dopo l'accesso, 11 tabelle in
  // parallelo, una sola rifiutata.
  it("discesa: una tabella rifiutata una volta non rende il giro \"sessione\", il giro è ok", async () => {
    let rifiutate = 0;
    const chiamate: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        chiamate.push(new URL(url).pathname);
        if (url.includes("/rest/v1/composizioni?") && rifiutate === 0) {
          rifiutate++;
          return risposta401("PGRST303");
        }
        return rispostaJson([]);
      })
    );

    const nonScaricate = await finoAllaFine(scaricaTutto("u-pgrst303"));

    expect(nonScaricate).toEqual([]);
    expect(leggiStatoGiri().discesa.esito).toBe("ok");
    expect(chiamate.filter((p) => p === "/rest/v1/composizioni")).toHaveLength(2);
  });

  function voceDiProva(): VoceOutbox {
    return {
      id: "pasti:p1",
      tabella: "pasti",
      record_id: "p1",
      dati: { id: "p1", user_id: "u1", updated_at: "2026-11-01T10:33:51.000Z", deleted_at: null },
      creato_il: "2026-11-01T10:33:51.000Z",
      tentativi: 0,
      ultimo_errore: null,
      sospesa_il: null,
    };
  }

  function sessioneFinta() {
    vi.spyOn(createClient().auth, "getSession").mockResolvedValue({
      data: { session: { user: { id: "u1" } } },
      error: null,
    } as never);
  }

  it("salita: un invio rifiutato una volta parte alla seconda prova, coda vuota, giro ok", async () => {
    const corpi: (string | null)[] = [];
    let rifiutate = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method !== "POST") return rispostaJson([]);
        corpi.push((init.body as string) ?? null);
        if (rifiutate++ === 0) return risposta401("PGRST303");
        return new Response(null, { status: 201 });
      })
    );
    await db.outbox.put(voceDiProva());
    sessioneFinta();

    expect(await finoAllaFine(sincronizzaOutbox())).toEqual({ inviate: 1, fallite: 0, sospese: 0 });
    expect(await db.outbox.count()).toBe(0);
    expect(leggiStatoGiri().salita.esito).toBe("ok");
    expect(corpi).toHaveLength(2);
    expect(corpi[1]).toBe(corpi[0]);
  });

  it("salita: rifiutato anche alla seconda prova, la voce resta con tentativi 0 (regola del 401 invariata)", async () => {
    let invii = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method !== "POST") return rispostaJson([]);
        invii++;
        return risposta401("PGRST303");
      })
    );
    await db.outbox.put(voceDiProva());
    sessioneFinta();

    expect(await finoAllaFine(sincronizzaOutbox())).toEqual({ inviate: 0, fallite: 1, sospese: 0 });
    const dopo = await db.outbox.get("pasti:p1");
    expect(dopo?.tentativi).toBe(0);
    expect(dopo?.sospesa_il).toBeNull();
    expect(leggiStatoGiri().salita.esito).toBe("sessione");
    expect(invii).toBe(2);
    // Il codice arriva fino allo stato (dal 02/11, "Dettagli tecnici").
    expect(leggiStatoGiri().salita.dettagli).toEqual([
      { verso: "salita", tabella: "pasti", status: 401, codice: "PGRST303", messaggio: "JWT issued at future" },
    ]);
  });

  // Dal 02/11/2026: per "Dettagli tecnici" il codice dell'errore deve
  // arrivare dalla risposta vera di PostgREST (letta dalla libreria
  // Supabase) fino allo stato dell'indicatore.
  it("discesa: rifiutata anche alla seconda prova, nello stato c'è la riga con tabella, 401 e PGRST303", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/rest/v1/composizioni?") ? risposta401("PGRST303") : rispostaJson([])
      )
    );

    const nonScaricate = await finoAllaFine(scaricaTutto("u-pgrst303"));

    expect(nonScaricate).toEqual([
      {
        tabella: "composizioni",
        esito: "sessione",
        status: 401,
        codice: "PGRST303",
        messaggio: "JWT issued at future",
      },
    ]);
    const stato = statoDaMostrare(
      { inAttesa: 0, inAttesaDal: null, accantonate: 0 },
      leggiStatoGiri(),
      Date.now()
    );
    expect(stato).toMatchObject({
      tipo: "sessione",
      dettagli: [
        {
          verso: "discesa",
          tabella: "composizioni",
          status: 401,
          codice: "PGRST303",
          messaggio: "JWT issued at future",
        },
      ],
    });
  });
});
