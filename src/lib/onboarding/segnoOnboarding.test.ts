// Il segno dell'onboarding fuori dalla logica pura (segnoOnboarding.ts, dal
// 17/10). Sbaglia in silenzio: una chiave che vale per l'utente sbagliato
// gli conclude l'onboarding, una chiave tolta prima della risposta del
// server perde un "fatto" scritto offline (e l'onboarding ricompare), una
// chiamata in più per gli utenti di prima non si vede finché il server non
// rifiuta. Finto solo il client Supabase; cookie, localStorage e Dexie sono
// quelli veri di jsdom e fake-indexeddb.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { stringToBase64URL } from "@supabase/ssr";
import { db } from "../db/database";
import type { Obiettivo } from "../db/tipi";
import { chiaveSessione } from "../supabase/utenteOffline";
import { azzeraStatoGiri, segnaDiscesaRiuscita } from "../sync/statoSincronizzazione";
import {
  chiaveSegnoLocale,
  concludiOnboarding,
  inviaSegnoInSospeso,
  leggiSegnoLocale,
  riprendiSegnoOnboarding,
  segnoDellaSessione,
  togliSegnoLocale,
} from "./segnoOnboarding";

const URL_SUPABASE = "https://progetto.supabase.co";

// Il server finto: chi è nella sessione e come risponde updateUser.
const server = vi.hoisted(() => ({
  utenteSessione: "u1" as string | null,
  updateUser: vi.fn<(attributi: unknown) => Promise<{ data: { user: unknown }; error: unknown }>>(
    async () => ({ data: { user: {} }, error: null })
  ),
  getSession: vi.fn(),
}));

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => {
        server.getSession();
        return {
          data: { session: server.utenteSessione ? { user: { id: server.utenteSessione } } : null },
        };
      },
      updateUser: (attributi: unknown) => server.updateUser(attributi),
    },
  }),
}));

// La sessione salvata nel cookie, come la scrive @supabase/ssr.
function cookieSessione(userId: string, metadati: Record<string, unknown>) {
  const valore = "base64-" + stringToBase64URL(JSON.stringify({ user: { id: userId, user_metadata: metadati } }));
  document.cookie = `${chiaveSessione(URL_SUPABASE)}=${valore}; path=/`;
}

function togliCookie() {
  document.cookie = `${chiaveSessione(URL_SUPABASE)}=; path=/; max-age=0`;
}

function obiettivo(userId: string): Obiettivo {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-10-17T08:00:00.000Z",
    deleted_at: null,
    valido_dal: "2026-10-17",
    tipo: "mantenere",
    kcal: 2500,
    proteine_g: 180,
    carboidrati_g: 250,
    grassi_g: 80,
    peso_obiettivo: null,
  };
}

const RIUSCITO = async () => ({ data: { user: {} }, error: null });
const SENZA_RETE = async () => ({ data: { user: null }, error: { message: "Failed to fetch", status: 0 } });

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPABASE);
  window.localStorage.clear();
  togliCookie();
  azzeraStatoGiri();
  server.utenteSessione = "u1";
  server.updateUser.mockReset();
  server.updateUser.mockImplementation(RIUSCITO);
  server.getSession.mockReset();
  await db.obiettivi.clear();
  await db.profili.clear();
  await db.misurazioni.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("la chiave locale", () => {
  it("vale per un utente solo: quella di A non vale per B", async () => {
    server.updateUser.mockImplementation(SENZA_RETE);
    await concludiOnboarding("u1", "fatto");
    expect(leggiSegnoLocale("u1")).toBe("fatto");
    expect(leggiSegnoLocale("u2")).toBeNull();
    togliSegnoLocale("u2");
    expect(leggiSegnoLocale("u1")).toBe("fatto");
  });

  it("un valore rovinato vale «niente in sospeso»", () => {
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "FATTO");
    expect(leggiSegnoLocale("u1")).toBeNull();
  });

  it("localStorage che lancia errori non rompe niente", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage non disponibile");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("localStorage non disponibile");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("localStorage non disponibile");
    });

    expect(leggiSegnoLocale("u1")).toBeNull();
    expect(() => togliSegnoLocale("u1")).not.toThrow();
    // Il server risponde: l'esito arriva lo stesso.
    expect(await concludiOnboarding("u1", "fatto")).toBe("confermato");
    expect(server.updateUser).toHaveBeenCalledTimes(1);
  });
});

describe("segnoDellaSessione", () => {
  it("legge il segno dal cookie, solo per l'utente della sessione", () => {
    cookieSessione("u1", { nome: "Giulia", onboarding: "da_fare" });
    expect(segnoDellaSessione("u1")).toBe("da_fare");
    expect(segnoDellaSessione("u2")).toBeNull();
  });

  it("senza cookie, o senza segno nei metadati: null", () => {
    expect(segnoDellaSessione("u1")).toBeNull();
    cookieSessione("u1", { nome: "Giulia" });
    expect(segnoDellaSessione("u1")).toBeNull();
  });
});

describe("concludiOnboarding", () => {
  it("updateUser riuscito: manda l'esito nei metadati e la chiave sparisce", async () => {
    expect(await concludiOnboarding("u1", "rimandato")).toBe("confermato");
    expect(server.updateUser).toHaveBeenCalledWith({ data: { onboarding: "rimandato" } });
    expect(leggiSegnoLocale("u1")).toBeNull();
  });

  it("updateUser con un errore: la chiave resta e non lancia", async () => {
    server.updateUser.mockImplementation(SENZA_RETE);
    expect(await concludiOnboarding("u1", "fatto")).toBe("in-sospeso");
    expect(leggiSegnoLocale("u1")).toBe("fatto");
  });

  it("updateUser che lancia: la chiave resta e non lancia", async () => {
    server.updateUser.mockImplementation(async () => {
      throw new Error("rete caduta");
    });
    await expect(concludiOnboarding("u1", "fatto")).resolves.toBe("in-sospeso");
    expect(leggiSegnoLocale("u1")).toBe("fatto");
  });

  it("la sessione è di un altro utente: niente updateUser, la chiave resta", async () => {
    server.utenteSessione = "u2";
    expect(await concludiOnboarding("u1", "fatto")).toBe("in-sospeso");
    expect(server.updateUser).not.toHaveBeenCalled();
    expect(leggiSegnoLocale("u1")).toBe("fatto");
  });
});

describe("inviaSegnoInSospeso (Esci)", () => {
  it("senza chiave: nessuna chiamata", async () => {
    await inviaSegnoInSospeso("u1");
    expect(server.updateUser).not.toHaveBeenCalled();
    expect(server.getSession).not.toHaveBeenCalled();
  });

  it("con la chiave: la manda; riuscito, la toglie", async () => {
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "fatto");
    await inviaSegnoInSospeso("u1");
    expect(server.updateUser).toHaveBeenCalledWith({ data: { onboarding: "fatto" } });
    expect(leggiSegnoLocale("u1")).toBeNull();
  });
});

describe("riprendiSegnoOnboarding", () => {
  it("utente senza segno: nessuna chiamata di rete, nemmeno con obiettivi e chiave", async () => {
    cookieSessione("u1", { nome: "Giulia" });
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "fatto");
    await db.obiettivi.put(obiettivo("u1"));
    segnaDiscesaRiuscita("u1");

    await riprendiSegnoOnboarding("u1");

    expect(server.updateUser).not.toHaveBeenCalled();
    expect(server.getSession).not.toHaveBeenCalled();
  });

  it("nessuna sessione salvata: nessuna chiamata", async () => {
    await riprendiSegnoOnboarding("u1");
    expect(server.updateUser).not.toHaveBeenCalled();
    expect(server.getSession).not.toHaveBeenCalled();
  });

  it("chiave diversa dai metadati: la manda e la toglie", async () => {
    cookieSessione("u1", { onboarding: "da_fare" });
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "rimandato");
    await riprendiSegnoOnboarding("u1");
    expect(server.updateUser).toHaveBeenCalledWith({ data: { onboarding: "rimandato" } });
    expect(leggiSegnoLocale("u1")).toBeNull();
  });

  it("chiave uguale ai metadati: la toglie senza chiamare il server", async () => {
    cookieSessione("u1", { onboarding: "fatto" });
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "fatto");
    await riprendiSegnoOnboarding("u1");
    expect(server.updateUser).not.toHaveBeenCalled();
    expect(leggiSegnoLocale("u1")).toBeNull();
  });

  it("rete di sicurezza: da_fare con un obiettivo in Dexie → manda fatto", async () => {
    cookieSessione("u1", { onboarding: "da_fare" });
    await db.obiettivi.put(obiettivo("u1"));
    await riprendiSegnoOnboarding("u1");
    expect(server.updateUser).toHaveBeenCalledWith({ data: { onboarding: "fatto" } });
  });

  it("telefono nuovo: Dexie vuoto e nessuna discesa riuscita → non conclude niente", async () => {
    cookieSessione("u1", { onboarding: "da_fare" });
    await riprendiSegnoOnboarding("u1");
    expect(server.updateUser).not.toHaveBeenCalled();
  });

  it("discesa riuscita con 0 obiettivi: niente da mandare", async () => {
    cookieSessione("u1", { onboarding: "rimandato" });
    segnaDiscesaRiuscita("u1");
    await riprendiSegnoOnboarding("u1");
    expect(server.updateUser).not.toHaveBeenCalled();
  });

  it("gli obiettivi di un altro utente non contano", async () => {
    cookieSessione("u1", { onboarding: "da_fare" });
    await db.obiettivi.put(obiettivo("u2"));
    segnaDiscesaRiuscita("u1");
    await riprendiSegnoOnboarding("u1");
    expect(server.updateUser).not.toHaveBeenCalled();
  });

  it("updateUser fallito: non lancia, e la chiave resta per la prossima ripresa", async () => {
    cookieSessione("u1", { onboarding: "da_fare" });
    window.localStorage.setItem(chiaveSegnoLocale("u1"), "fatto");
    server.updateUser.mockImplementation(SENZA_RETE);
    await expect(riprendiSegnoOnboarding("u1")).resolves.toBeUndefined();
    expect(leggiSegnoLocale("u1")).toBe("fatto");
  });
});

describe("riprendiSegnoOnboarding — quando ritenta", () => {
  // Il ricordo degli invii falliti vive in memoria per tutta la durata del
  // file: ogni test usa un utente suo.
  function utenteConEsitoInSospeso() {
    const userId = `utente-${crypto.randomUUID()}`;
    server.utenteSessione = userId;
    cookieSessione(userId, { onboarding: "da_fare" });
    window.localStorage.setItem(chiaveSegnoLocale(userId), "fatto");
    return userId;
  }

  it("due avvisi di giro di fila con updateUser che fallisce → una sola chiamata", async () => {
    const userId = utenteConEsitoInSospeso();
    server.updateUser.mockImplementation(SENZA_RETE);

    await riprendiSegnoOnboarding(userId, "giro");
    await riprendiSegnoOnboarding(userId, "giro");

    expect(server.updateUser).toHaveBeenCalledTimes(1);
    expect(leggiSegnoLocale(userId)).toBe("fatto");
  });

  it("dopo un fallimento ritentano il ritorno della rete e l'avvio, non i giri", async () => {
    const userId = utenteConEsitoInSospeso();
    server.updateUser.mockImplementation(SENZA_RETE);

    await riprendiSegnoOnboarding(userId, "avvio");
    await riprendiSegnoOnboarding(userId, "giro");
    expect(server.updateUser).toHaveBeenCalledTimes(1);

    await riprendiSegnoOnboarding(userId, "online");
    expect(server.updateUser).toHaveBeenCalledTimes(2);
    await riprendiSegnoOnboarding(userId, "giro");
    expect(server.updateUser).toHaveBeenCalledTimes(2);

    await riprendiSegnoOnboarding(userId, "avvio");
    expect(server.updateUser).toHaveBeenCalledTimes(3);
  });

  it("al massimo una chiamata alla volta: due riprese insieme ne fanno una", async () => {
    const userId = utenteConEsitoInSospeso();
    let rispondi: () => void = () => {};
    server.updateUser.mockImplementation(
      () =>
        new Promise((fine) => {
          rispondi = () => fine({ data: { user: null }, error: { message: "Failed to fetch" } });
        })
    );

    const prima = riprendiSegnoOnboarding(userId, "online");
    const seconda = riprendiSegnoOnboarding(userId, "online");
    await vi.waitFor(() => expect(server.updateUser).toHaveBeenCalledTimes(1));
    rispondi();
    await Promise.all([prima, seconda]);

    expect(server.updateUser).toHaveBeenCalledTimes(1);
  });

  it("senza fallimenti un giro manda: è così che la prima discesa fa scattare la rete di sicurezza", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    server.utenteSessione = userId;
    cookieSessione(userId, { onboarding: "da_fare" });
    await db.obiettivi.put(obiettivo(userId));

    await riprendiSegnoOnboarding(userId, "giro");
    expect(server.updateUser).toHaveBeenCalledWith({ data: { onboarding: "fatto" } });
  });
});
