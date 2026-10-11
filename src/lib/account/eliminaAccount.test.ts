// Il flusso di "Elimina il mio account" (PUNTO_DI_PARTENZA.md §9.6): i dati
// del dispositivo si cancellano SOLO quando l'account sul server è
// cancellato, e un esito incerto non diventa mai "eliminato" né "niente
// toccato" per sbaglio. Casi fissati per sempre:
// - senza rete prima della chiamata: niente toccato, nessuna chiamata;
// - sessione non riconosciuta: niente toccato;
// - ok del server: dispositivo pulito, segno "confermata" lasciato per il
//   prossimo avvio, ora dell'ultimo contatto tolta, sessione chiusa;
// - rifiuto del server: niente toccato, segno tolto;
// - risposta persa: si chiede al server; utente sparito → come un ok;
//   utente ancora lì → "rete", segno tolto; non si sa → "risposta-persa",
//   dati intatti e segno "richiesta" lasciato;
// - utente già cancellato prima del tentativo: solo la pulizia.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";
import { CHIAVE_ULTIMO_SUCCESSO } from "../sync/statoSincronizzazione";
import { leggiSegnoEliminazione } from "./eliminazioneInCorso";
import { eliminaAccount, parolaDiConfermaGiusta } from "./eliminaAccount";

type RispostaUtente = { data: { user: { id: string } | null }; error: unknown };

// Supabase finto: getUser risponde, in ordine, con le voci di `utenti`
// (l'ultima si ripete); rpc con `rispostaRpc`.
let utenti: RispostaUtente[] = [];
let rispostaRpc: { error: unknown; status: number } = { error: null, status: 204 };
const rpc = vi.fn();
const signOut = vi.fn();

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => (utenti.length > 1 ? utenti.shift()! : utenti[0]),
      signOut: async (...args: unknown[]) => {
        signOut(...args);
        return { error: null };
      },
    },
    rpc: async (...args: unknown[]) => {
      rpc(...args);
      return rispostaRpc;
    },
  }),
}));

vi.mock("../serviceWorker", () => ({ svuotaPagineSalvate: vi.fn(async () => {}) }));

const ID = "utente-che-elimina";
const ALTRO = "altro-utente";

const conUtente = (id: string): RispostaUtente => ({ data: { user: { id } }, error: null });
const nonTrovato: RispostaUtente = {
  data: { user: null },
  error: new AuthApiError("User from sub claim in JWT does not exist", 403, "user_not_found"),
};
const senzaRete: RispostaUtente = { data: { user: null }, error: new AuthRetryableFetchError("Failed to fetch", 0) };
const sessioneScaduta: RispostaUtente = {
  data: { user: null },
  error: new AuthApiError("Session not found", 403, "session_not_found"),
};

function pasto(userId: string): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-09-10T08:00:00.000Z",
    deleted_at: null,
    nome: "Pranzo",
    ora_inizio: "12:30",
    ordine: 0,
  };
}

const pastiDi = (userId: string) => db.pasti.where("user_id").equals(userId).count();

beforeEach(async () => {
  utenti = [conUtente(ID)];
  rispostaRpc = { error: null, status: 204 };
  rpc.mockClear();
  signOut.mockClear();
  localStorage.clear();
  await db.pasti.clear();
  await db.pasti.bulkPut([pasto(ID), pasto(ALTRO)]);
  localStorage.setItem(CHIAVE_ULTIMO_SUCCESSO, "2026-10-11T10:00:00.000Z");
});

describe("eliminaAccount", () => {
  it("ok del server: pulisce, lascia il segno confermata, toglie l'ora salvata, chiude la sessione", async () => {
    expect(await eliminaAccount(ID)).toBe("eliminato");

    expect(rpc).toHaveBeenCalledWith("elimina_mio_account");
    expect(await pastiDi(ID)).toBe(0);
    expect(await pastiDi(ALTRO)).toBe(1);
    expect(leggiSegnoEliminazione()).toEqual({ idUtente: ID, fase: "confermata" });
    expect(localStorage.getItem(CHIAVE_ULTIMO_SUCCESSO)).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("senza rete prima della chiamata: niente chiamata, niente toccato", async () => {
    utenti = [senzaRete];

    expect(await eliminaAccount(ID)).toBe("rete");
    expect(rpc).not.toHaveBeenCalled();
    expect(await pastiDi(ID)).toBe(1);
    expect(leggiSegnoEliminazione()).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("sessione non riconosciuta, o un altro utente: niente chiamata, niente toccato", async () => {
    for (const risposta of [sessioneScaduta, conUtente(ALTRO)]) {
      utenti = [risposta];
      expect(await eliminaAccount(ID)).toBe("sessione");
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(await pastiDi(ID)).toBe(1);
    expect(leggiSegnoEliminazione()).toBeNull();
  });

  it("rifiuto del server: niente toccato, segno tolto", async () => {
    rispostaRpc = { error: { message: "permission denied" }, status: 403 };

    expect(await eliminaAccount(ID)).toBe("rifiutato");
    expect(await pastiDi(ID)).toBe(1);
    expect(leggiSegnoEliminazione()).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("risposta persa e utente sparito: come un ok", async () => {
    utenti = [conUtente(ID), nonTrovato];
    rispostaRpc = { error: { message: "TypeError: Failed to fetch" }, status: 0 };

    expect(await eliminaAccount(ID)).toBe("eliminato");
    expect(await pastiDi(ID)).toBe(0);
    expect(leggiSegnoEliminazione()?.fase).toBe("confermata");
  });

  it("risposta persa e utente ancora lì: la chiamata non era arrivata, niente toccato", async () => {
    utenti = [conUtente(ID), conUtente(ID)];
    rispostaRpc = { error: { message: "TypeError: Failed to fetch" }, status: 0 };

    expect(await eliminaAccount(ID)).toBe("rete");
    expect(await pastiDi(ID)).toBe(1);
    expect(leggiSegnoEliminazione()).toBeNull();
  });

  it("risposta persa e server che non risponde: dati intatti, segno richiesta lasciato", async () => {
    utenti = [conUtente(ID), senzaRete];
    rispostaRpc = { error: { message: "TypeError: Failed to fetch" }, status: 0 };

    expect(await eliminaAccount(ID)).toBe("risposta-persa");
    expect(await pastiDi(ID)).toBe(1);
    expect(leggiSegnoEliminazione()).toEqual({ idUtente: ID, fase: "richiesta" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("utente già cancellato prima del tentativo: niente chiamata, solo la pulizia", async () => {
    utenti = [nonTrovato];

    expect(await eliminaAccount(ID)).toBe("eliminato");
    expect(rpc).not.toHaveBeenCalled();
    expect(await pastiDi(ID)).toBe(0);
    expect(signOut).toHaveBeenCalled();
  });
});

describe("parolaDiConfermaGiusta", () => {
  it("ELIMINA con maiuscole e minuscole indifferenti e spazi ai bordi", () => {
    for (const testo of ["ELIMINA", "elimina", "Elimina", " Elimina ", "eLiMiNa"]) {
      expect(parolaDiConfermaGiusta(testo), testo).toBe(true);
    }
  });

  it("qualunque altra cosa no", () => {
    for (const testo of ["", "ELIMIN", "ELIMINA!", "EL IMINA", "elimina account", "cancella"]) {
      expect(parolaDiConfermaGiusta(testo), testo).toBe(false);
    }
  });
});
