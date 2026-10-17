// Esci svuota i dati locali (PUNTO_DI_PARTENZA.md §9.6). Regola che non fa
// rumore se si rompe, fissata qui per sempre: il segno nutritrack:uscita si
// scrive SOLO quando si svuota (coda vuota, oppure perdita confermata).
// Con la coda non vuota e la sessione non valida i dati restano apposta,
// perché rientrando le modifiche partano: un segno scritto lì li farebbe
// cancellare alla ripresa del prossimo avvio, senza che nessuno lo veda.
// Fissati anche: offline non si tocca niente; una sessione che non se ne
// va non svuota niente; una pulizia fallita lascia il segno.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthApiError, AuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";
import type { VoceOutbox } from "../sync/outbox";
import { decidiUscita, eseguiUscita, preparaUscita } from "./esci";
import { CHIAVE_USCITA, leggiSegnoUscita, riprendiUscitaInSospeso } from "./uscitaInCorso";
import { CHIAVE_ULTIMO_SUCCESSO } from "../sync/statoSincronizzazione";
import { chiaveNovita } from "../amici/novita";
import { chiaveSegnoLocale, leggiSegnoLocale } from "../onboarding/segnoOnboarding";
import { chiaveSessione } from "../supabase/utenteOffline";
import { stringToBase64URL } from "@supabase/ssr";

// Il server finto: chi risponde getUser, e se dopo signOut la sessione
// c'è ancora.
const server = vi.hoisted(() => ({
  getUser: null as unknown as () => { data: { user: { id: string } | null }; error: AuthError | null },
  sessioneDopoSignOut: false,
  signOut: vi.fn(),
  // updateUser: solo per l'esito dell'onboarding in sospeso (dal 17/10).
  updateUser: vi.fn<(attributi: unknown) => Promise<{ data: { user: null }; error: unknown }>>(
    async () => ({ data: { user: null }, error: { message: "Failed to fetch" } })
  ),
}));

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => server.getUser(),
      signOut: async (...args: unknown[]) => {
        server.signOut(...args);
        return { error: null };
      },
      getSession: async () => ({ data: { session: server.sessioneDopoSignOut ? { user: {} } : null } }),
      updateUser: (attributi: unknown) => server.updateUser(attributi),
    },
  }),
}));

// La salita: non manda niente (la coda resta com'è), si controlla solo se
// viene chiamata.
const salita = vi.hoisted(() => ({ sincronizzaOutbox: vi.fn(async () => ({ inviate: 0, fallite: 0, sospese: 0 })) }));
vi.mock("../sync/sincronizza", () => salita);

vi.mock("../serviceWorker", () => ({ svuotaPagineSalvate: vi.fn(async () => {}) }));

function pasto(userId: string): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-10-10T08:00:00.000Z",
    deleted_at: null,
    nome: "Pranzo",
    ora_inizio: "12:30",
    ordine: 0,
  };
}

function voceInCoda(riga: Pasto): VoceOutbox {
  return {
    id: `pasti:${riga.id}`,
    tabella: "pasti",
    record_id: riga.id,
    dati: riga,
    creato_il: "2026-10-11T09:00:00.000Z",
    tentativi: 0,
    ultimo_errore: null,
    sospesa_il: null,
  };
}

// Un utente con un pasto e il suo cursore, con o senza una modifica in
// coda; accanto un altro utente che non va mai toccato.
async function dispositivo({ conCoda }: { conCoda: boolean }) {
  const utente = `utente-${crypto.randomUUID()}`;
  const altro = `utente-${crypto.randomUUID()}`;
  const suo = pasto(utente);
  const dellAltro = pasto(altro);
  await db.pasti.bulkPut([suo, dellAltro]);
  await db.outbox.bulkPut([...(conCoda ? [voceInCoda(suo)] : []), voceInCoda(dellAltro)]);
  await db.sync_cursori.bulkPut([
    { id: `pasti:${utente}`, tabella: "pasti", user_id: utente, ultimo_aggiornamento: suo.updated_at },
    { id: `pasti:${altro}`, tabella: "pasti", user_id: altro, ultimo_aggiornamento: dellAltro.updated_at },
  ]);
  return { utente, altro };
}

async function contaDi(userId: string) {
  return {
    pasti: await db.pasti.where("user_id").equals(userId).count(),
    coda: (await db.outbox.toArray()).filter((v) => v.dati.user_id === userId).length,
    cursori: await db.sync_cursori.where("user_id").equals(userId).count(),
  };
}

const VUOTO = { pasti: 0, coda: 0, cursori: 0 };

const valida = (id: string) => () => ({ data: { user: { id } }, error: null });
const scaduta = () => ({ data: { user: null }, error: new AuthApiError("Session not found", 403, "session_not_found") });
const senzaRete = () => ({ data: { user: null }, error: new AuthRetryableFetchError("Failed to fetch", 0) });

// Ogni scrittura del segno, anche se poi viene tolto.
let scrittureSegno: string[];

beforeEach(async () => {
  localStorage.clear();
  await db.outbox.clear();
  server.sessioneDopoSignOut = false;
  server.signOut.mockReset();
  salita.sincronizzaOutbox.mockClear();
  scrittureSegno = [];
  const originale = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, chiave: string, valore: string) {
    if (chiave === CHIAVE_USCITA) scrittureSegno.push(valore);
    return originale.call(this, chiave, valore);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decidiUscita", () => {
  it("coda vuota svuota sempre; coda non vuota: conferma con la sessione valida, tieni senza", () => {
    expect(decidiUscita(0, true)).toBe("svuota");
    expect(decidiUscita(0, false)).toBe("svuota");
    expect(decidiUscita(2, true)).toBe("conferma-perdita");
    expect(decidiUscita(2, false)).toBe("tieni");
  });
});

describe("Esci — il segno di uscita solo quando si svuota", () => {
  it("coda non vuota e sessione non valida: tieni, il segno non si scrive mai, i dati restano anche dopo il prossimo avvio", async () => {
    const { utente } = await dispositivo({ conCoda: true });
    server.getUser = scaduta;
    localStorage.setItem(chiaveNovita(utente), JSON.stringify({ richiesteRicevute: 2 }));

    const preparazione = await preparaUscita(utente);
    expect(preparazione).toMatchObject({ esito: "pronta", decisione: "tieni" });
    if (preparazione.esito !== "pronta") return;
    // Con la sessione non valida non si prova nemmeno a inviare.
    expect(salita.sincronizzaOutbox).not.toHaveBeenCalled();

    expect(await eseguiUscita(utente, preparazione.decisione, preparazione.modifiche.firme)).toBe("uscito");
    expect(server.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(scrittureSegno).toEqual([]);
    expect(leggiSegnoUscita()).toBeNull();
    expect(await contaDi(utente)).toEqual({ pasti: 1, coda: 1, cursori: 1 });
    // I dati restano, le novità di Amici no: non sono modifiche da salvare.
    expect(localStorage.getItem(chiaveNovita(utente))).toBeNull();

    // Il prossimo avvio, senza nessuno dentro: niente da riprendere.
    expect(await riprendiUscitaInSospeso(async () => null)).toBe("niente");
    expect(await contaDi(utente)).toEqual({ pasti: 1, coda: 1, cursori: 1 });
  });

  it("coda vuota: svuota senza chiedere, il segno si scrive e a pulizia riuscita si toglie", async () => {
    const { utente, altro } = await dispositivo({ conCoda: false });
    server.getUser = valida(utente);
    localStorage.setItem(CHIAVE_ULTIMO_SUCCESSO, "2026-10-11T08:00:00.000Z");
    localStorage.setItem(chiaveNovita(utente), JSON.stringify({ richiesteRicevute: 2 }));

    const preparazione = await preparaUscita(utente);
    expect(preparazione).toMatchObject({ esito: "pronta", decisione: "svuota" });
    if (preparazione.esito !== "pronta") return;
    expect(salita.sincronizzaOutbox).toHaveBeenCalled();

    expect(await eseguiUscita(utente, preparazione.decisione, preparazione.modifiche.firme)).toBe("uscito");
    expect(scrittureSegno).toHaveLength(1);
    expect(leggiSegnoUscita()).toBeNull();
    expect(await contaDi(utente)).toEqual(VUOTO);
    expect(await contaDi(altro)).toEqual({ pasti: 1, coda: 1, cursori: 1 });
    expect(localStorage.getItem(CHIAVE_ULTIMO_SUCCESSO)).toBeNull();
    // Le novità di Amici salvate per il pallino offline (dal 15/10).
    expect(localStorage.getItem(chiaveNovita(utente))).toBeNull();
  });

  it("coda non vuota e sessione valida: conferma; confermata, svuota anche la coda", async () => {
    const { utente, altro } = await dispositivo({ conCoda: true });
    server.getUser = valida(utente);

    const preparazione = await preparaUscita(utente);
    expect(preparazione).toMatchObject({ esito: "pronta", decisione: "conferma-perdita" });
    if (preparazione.esito !== "pronta") return;

    expect(await eseguiUscita(utente, preparazione.decisione, preparazione.modifiche.firme)).toBe("uscito");
    expect(scrittureSegno).toHaveLength(1);
    expect(await contaDi(utente)).toEqual(VUOTO);
    expect(await contaDi(altro)).toEqual({ pasti: 1, coda: 1, cursori: 1 });
  });

  it("la pulizia fallisce: si esce lo stesso, il segno resta per il prossimo avvio", async () => {
    const { utente } = await dispositivo({ conCoda: false });
    server.getUser = valida(utente);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("IndexedDB non disponibile"));

    expect(await eseguiUscita(utente, "svuota", [])).toBe("uscito");
    expect(leggiSegnoUscita()).toEqual({ idUtente: utente, firme: [] });
    expect(await contaDi(utente)).toEqual({ pasti: 1, coda: 0, cursori: 1 });

    expect(await riprendiUscitaInSospeso(async () => null)).toBe("pulito");
    expect(await contaDi(utente)).toEqual(VUOTO);
  });
});

describe("Esci — quando non si esce", () => {
  it("offline: niente inviato, niente signOut, niente toccato", async () => {
    const { utente } = await dispositivo({ conCoda: true });
    server.getUser = senzaRete;

    expect(await preparaUscita(utente)).toEqual({ esito: "rete" });
    expect(salita.sincronizzaOutbox).not.toHaveBeenCalled();
    expect(server.signOut).not.toHaveBeenCalled();
    expect(await contaDi(utente)).toEqual({ pasti: 1, coda: 1, cursori: 1 });
  });

  it("la sessione resta dopo signOut: si resta dentro, niente svuotato e nessun segno", async () => {
    const { utente } = await dispositivo({ conCoda: false });
    server.sessioneDopoSignOut = true;

    expect(await eseguiUscita(utente, "svuota", [])).toBe("sessione-rimasta");
    expect(scrittureSegno).toEqual([]);
    expect(await contaDi(utente)).toEqual({ pasti: 1, coda: 0, cursori: 1 });
  });
});

describe("Esci — l'esito dell'onboarding in sospeso (dal 17/10)", () => {
  const URL_SUPABASE = "https://progetto.supabase.co";

  afterEach(() => {
    document.cookie = `${chiaveSessione(URL_SUPABASE)}=; path=/; max-age=0`;
    vi.unstubAllEnvs();
  });

  it("updateUser fallisce: l'uscita avviene e la chiave resta per il prossimo accesso", async () => {
    const { utente } = await dispositivo({ conCoda: false });
    // La sessione salvata nel cookie: è da lì che concludiOnboarding sa chi
    // è l'utente, perché il getSession finto non risponde con una sessione.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPABASE);
    const sessione = "base64-" + stringToBase64URL(JSON.stringify({ user: { id: utente } }));
    document.cookie = `${chiaveSessione(URL_SUPABASE)}=${sessione}; path=/`;
    localStorage.setItem(chiaveSegnoLocale(utente), "fatto");
    server.updateUser.mockClear();

    expect(await eseguiUscita(utente, "svuota", [])).toBe("uscito");

    // Il tentativo c'è stato, prima di signOut.
    expect(server.updateUser).toHaveBeenCalledWith({ data: { onboarding: "fatto" } });
    expect(server.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      server.signOut.mock.invocationCallOrder[0]
    );
    expect(server.signOut).toHaveBeenCalledWith({ scope: "local" });
    // La chiave sopravvive a Esci.
    expect(leggiSegnoLocale(utente)).toBe("fatto");
    expect(await contaDi(utente)).toEqual(VUOTO);
  });

  it("senza chiave in sospeso: nessuna chiamata a updateUser", async () => {
    const { utente } = await dispositivo({ conCoda: false });
    server.updateUser.mockClear();
    expect(await eseguiUscita(utente, "svuota", [])).toBe("uscito");
    expect(server.updateUser).not.toHaveBeenCalled();
  });
});
