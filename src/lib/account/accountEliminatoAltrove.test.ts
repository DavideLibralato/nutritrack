// L'account eliminato da un altro dispositivo (accountEliminatoAltrove.ts).
// Casi fissati per sempre, quelli che non fanno rumore:
// - si pulisce SOLO l'utente della sessione: un altro utente nello stesso
//   Dexie resta intatto;
// - eliminazione partita da questo dispositivo (segno dello stesso
//   utente): il modulo non fa niente, ci pensa il flusso di Elimina account;
// - sei componenti che ricevono la risposta insieme: un solo signOut, una
//   sola navigazione; un "niente da fare" non blocca le chiamate dopo;
// - il segno di un altro utente non si sovrascrive;
// - sessione rimasta dopo il signOut: nessuna navigazione (il proxy
//   rimanderebbe indietro, e si ripartirebbe da capo);
// - le modifiche in coda si contano PRIMA della pulizia (perse=1);
// - una discesa partita prima finisce prima della pulizia.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";
import type { VoceOutbox } from "../sync/outbox";
import { leggiSegnoEliminazione, scriviSegnoEliminazione } from "./eliminazioneInCorso";
import {
  azzeraPerTest,
  gestisciAccountEliminatoAltrove,
  indirizzoDopoEliminazioneAltrove,
} from "./accountEliminatoAltrove";

const A = "utente-eliminato";
const B = "altro-utente";

// Supabase finto: la sessione salvata è di `sessioneDi` (null = nessuna);
// signOut la toglie, a meno che `sessioneResta`.
let sessioneDi: string | null = A;
let sessioneResta = false;
const signOut = vi.fn();

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: sessioneDi ? { user: { id: sessioneDi } } : null },
        error: null,
      }),
      signOut: async (...args: unknown[]) => {
        signOut(...args);
        if (!sessioneResta) sessioneDi = null;
        return { error: null };
      },
    },
  }),
}));

vi.mock("../serviceWorker", () => ({ svuotaPagineSalvate: vi.fn(async () => {}) }));

// L'attesa delle discese: di default non c'è niente in corso. Un test la
// usa per simulare una discesa partita prima che scrive una riga tardi.
let discesaInCorso: (() => Promise<void>) | null = null;
vi.mock("../sync/discesa", async (originale) => ({
  ...(await originale<typeof import("../sync/discesa")>()),
  attendiDiscesaInCorso: vi.fn(async () => {
    if (discesaInCorso) await discesaInCorso();
  }),
}));

function pasto(userId: string): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-10-26T08:00:00.000Z",
    deleted_at: null,
    nome: "Pranzo",
    ora_inizio: "12:30",
    ordine: 0,
  };
}

function voce(riga: Pasto, sospesa = false): VoceOutbox {
  return {
    id: `pasti:${riga.id}`,
    tabella: "pasti",
    record_id: riga.id,
    dati: riga,
    creato_il: new Date().toISOString(),
    tentativi: sospesa ? 5 : 0,
    ultimo_errore: sospesa ? "errore" : null,
    sospesa_il: sospesa ? new Date().toISOString() : null,
  };
}

const pastiDi = (userId: string) => db.pasti.where("user_id").equals(userId).count();

const naviga = vi.fn();

beforeEach(async () => {
  azzeraPerTest();
  sessioneDi = A;
  sessioneResta = false;
  discesaInCorso = null;
  signOut.mockClear();
  naviga.mockClear();
  localStorage.clear();
  await db.pasti.clear();
  await db.outbox.clear();
  await db.pasti.bulkPut([pasto(A), pasto(A), pasto(B)]);
});

describe("indirizzoDopoEliminazioneAltrove", () => {
  it("perse=1 solo se c'erano modifiche", () => {
    expect(indirizzoDopoEliminazioneAltrove(false)).toBe("/login?eliminato=altrove");
    expect(indirizzoDopoEliminazioneAltrove(true)).toBe("/login?eliminato=altrove&perse=1");
  });
});

describe("gestisciAccountEliminatoAltrove", () => {
  it("pulisce solo l'utente della sessione, chiude la sessione qui e va su Accedi", async () => {
    expect(await gestisciAccountEliminatoAltrove(naviga)).toBe("uscito");

    expect(await pastiDi(A)).toBe(0);
    expect(await pastiDi(B)).toBe(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(naviga).toHaveBeenCalledWith("/login?eliminato=altrove");
    // Lasciato per il secondo giro della ripresa all'avvio.
    expect(leggiSegnoEliminazione()).toEqual({ idUtente: A, fase: "confermata" });
  });

  it("nessuna sessione: niente da fare", async () => {
    sessioneDi = null;
    expect(await gestisciAccountEliminatoAltrove(naviga)).toBe("nessuna-sessione");
    expect(signOut).not.toHaveBeenCalled();
    expect(naviga).not.toHaveBeenCalled();
    expect(await pastiDi(A)).toBe(2);
  });

  it.each(["richiesta", "confermata"] as const)(
    "segno dello stesso utente (%s): nessun signOut, nessuna pulizia, nessuna navigazione",
    async (fase) => {
      scriviSegnoEliminazione(A, fase);
      expect(await gestisciAccountEliminatoAltrove(naviga)).toBe("segno-stesso-utente");
      expect(signOut).not.toHaveBeenCalled();
      expect(naviga).not.toHaveBeenCalled();
      expect(await pastiDi(A)).toBe(2);
      expect(leggiSegnoEliminazione()).toEqual({ idUtente: A, fase });
    }
  );

  it("un 'niente da fare' non blocca: tolto il segno, la chiamata dopo agisce", async () => {
    scriviSegnoEliminazione(A, "richiesta");
    expect(await gestisciAccountEliminatoAltrove(naviga)).toBe("segno-stesso-utente");
    localStorage.clear(); // la ripresa all'avvio ha finito e tolto il segno
    expect(await gestisciAccountEliminatoAltrove(naviga)).toBe("uscito");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(naviga).toHaveBeenCalledTimes(1);
  });

  it("sei chiamate insieme: un solo signOut e una sola navigazione", async () => {
    const esiti = await Promise.all(Array.from({ length: 6 }, () => gestisciAccountEliminatoAltrove(naviga)));
    expect(esiti).toEqual(Array(6).fill("uscito"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(naviga).toHaveBeenCalledTimes(1);
  });

  it("segno di un altro utente: non si sovrascrive, si pulisce lo stesso", async () => {
    scriviSegnoEliminazione(B, "richiesta");
    expect(await gestisciAccountEliminatoAltrove(naviga)).toBe("uscito");
    expect(leggiSegnoEliminazione()).toEqual({ idUtente: B, fase: "richiesta" });
    expect(await pastiDi(A)).toBe(0);
    expect(await pastiDi(B)).toBe(1);
    expect(naviga).toHaveBeenCalledTimes(1);
  });

  it("sessione rimasta dopo il signOut: pulito, ma nessuna navigazione", async () => {
    sessioneResta = true;
    expect(await gestisciAccountEliminatoAltrove(naviga)).toBe("sessione-rimasta");
    expect(naviga).not.toHaveBeenCalled();
    expect(await pastiDi(A)).toBe(0);
    expect(leggiSegnoEliminazione()).toEqual({ idUtente: A, fase: "confermata" });
  });

  it("modifiche in coda dell'utente, anche accantonate: perse=1 (contate prima della pulizia)", async () => {
    const [riga] = await db.pasti.where("user_id").equals(A).toArray();
    await db.outbox.put(voce(riga, true));
    await gestisciAccountEliminatoAltrove(naviga);
    expect(naviga).toHaveBeenCalledWith("/login?eliminato=altrove&perse=1");
    expect(await db.outbox.count()).toBe(0);
  });

  it("modifiche in coda solo di un altro utente: niente perse=1, la sua voce resta", async () => {
    const [riga] = await db.pasti.where("user_id").equals(B).toArray();
    await db.outbox.put(voce(riga));
    await gestisciAccountEliminatoAltrove(naviga);
    expect(naviga).toHaveBeenCalledWith("/login?eliminato=altrove");
    expect(await db.outbox.count()).toBe(1);
  });

  it("una discesa partita prima e finita tardi non lascia righe dopo la pulizia", async () => {
    discesaInCorso = async () => {
      await db.pasti.put(pasto(A)); // la riga scritta tardi dalla discesa
    };
    await gestisciAccountEliminatoAltrove(naviga);
    expect(await pastiDi(A)).toBe(0);
  });
});
