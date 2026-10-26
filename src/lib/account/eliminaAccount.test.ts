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
import { chiaveNovita } from "../amici/novita";
import { chiaveSegnoLocale } from "../onboarding/segnoOnboarding";
import { leggiSegnoEliminazione } from "./eliminazioneInCorso";
import { eliminaAccount, parolaDiConfermaGiusta } from "./eliminaAccount";

type RispostaUtente = { data: { user: { id: string } | null }; error: unknown };

// Supabase finto: getUser risponde, in ordine, con le voci di `utenti`
// (l'ultima si ripete); rpc("elimina_mio_account") con `rispostaRpc`,
// rpc("imposta_foto_profilo") con `rispostaImposta`. Lo Storage (dal
// branch foto-profilo): la cartella dell'utente è `cartella` (vuota di
// default, come per chi non ha mai avuto una foto), con i guasti di
// elenco e cancellazione.
let utenti: RispostaUtente[] = [];
let rispostaRpc: { error: unknown; status: number } = { error: null, status: 204 };
let rispostaImposta: { data: unknown; error: unknown; status: number } = {
  data: "ok",
  error: null,
  status: 200,
};
let cartella: string[] = [];
let elencoFallisce = false;
let cancellazioneFallisce = false;
const rpc = vi.fn();
const elenco = vi.fn();
const cancellazione = vi.fn();
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
      return args[0] === "imposta_foto_profilo" ? rispostaImposta : rispostaRpc;
    },
    storage: {
      from: () => ({
        list: async (prefisso: string) => {
          elenco(prefisso);
          if (elencoFallisce) return { data: null, error: { message: "Failed to fetch" } };
          return { data: cartella.map((nome) => ({ name: nome })), error: null };
        },
        remove: async (percorsi: string[]) => {
          cancellazione(percorsi);
          if (cancellazioneFallisce) return { data: null, error: { message: "Failed to fetch" } };
          cartella = [];
          return { data: [], error: null };
        },
      }),
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
  rispostaImposta = { data: "ok", error: null, status: 200 };
  cartella = [];
  elencoFallisce = false;
  cancellazioneFallisce = false;
  rpc.mockClear();
  elenco.mockClear();
  cancellazione.mockClear();
  signOut.mockClear();
  await db.foto_locale.clear();
  localStorage.clear();
  await db.pasti.clear();
  await db.pasti.bulkPut([pasto(ID), pasto(ALTRO)]);
  localStorage.setItem(CHIAVE_ULTIMO_SUCCESSO, "2026-10-11T10:00:00.000Z");
  localStorage.setItem(chiaveNovita(ID), JSON.stringify({ richiesteRicevute: 2 }));
});

describe("eliminaAccount", () => {
  it("ok del server: toglie l'esito dell'onboarding in sospeso di questo utente, non di un altro", async () => {
    localStorage.setItem(chiaveSegnoLocale(ID), "fatto");
    localStorage.setItem(chiaveSegnoLocale(ALTRO), "rimandato");
    expect(await eliminaAccount(ID)).toBe("eliminato");
    expect(localStorage.getItem(chiaveSegnoLocale(ID))).toBeNull();
    expect(localStorage.getItem(chiaveSegnoLocale(ALTRO))).toBe("rimandato");
  });

  it("ok del server: pulisce, lascia il segno confermata, toglie l'ora salvata, chiude la sessione", async () => {
    expect(await eliminaAccount(ID)).toBe("eliminato");

    expect(rpc).toHaveBeenCalledWith("elimina_mio_account");
    expect(await pastiDi(ID)).toBe(0);
    expect(await pastiDi(ALTRO)).toBe(1);
    expect(leggiSegnoEliminazione()).toEqual({ idUtente: ID, fase: "confermata" });
    expect(localStorage.getItem(CHIAVE_ULTIMO_SUCCESSO)).toBeNull();
    // Le novità di Amici salvate per il pallino offline (dal 15/10).
    expect(localStorage.getItem(chiaveNovita(ID))).toBeNull();
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

// La foto profilo prima della funzione (branch foto-profilo, §9.6 "File in
// Storage"): da SQL i file non si cancellano, e la funzione rifiuta se ne
// resta uno. Casi fissati per sempre:
// - cartella vuota: il percorso di prima, con un solo elenco in più e
//   nessuna chiamata a imposta_foto_profilo;
// - file cancellati e funzione ok: eliminato;
// - elenco o impostazione falliti: "rete", niente toccato, funzione mai
//   chiamata, nessun segno;
// - cancellazione dei file fallita: "foto-tolta", funzione MAI chiamata,
//   nessun segno;
// - file tolti e funzione rifiutata (o non arrivata): "foto-tolta";
// - risposta persa dopo la cancellazione dei file: "risposta-persa" e il
//   segno "richiesta" lasciato, come prima.
describe("eliminaAccount con la foto profilo", () => {
  const FILE = ["11111111-1111-4111-8111-111111111111.jpg"];
  const chiamateFunzione = () => rpc.mock.calls.filter((c) => c[0] === "elimina_mio_account");
  const chiamateImposta = () => rpc.mock.calls.filter((c) => c[0] === "imposta_foto_profilo");

  async function conCopiaDellaFoto() {
    await db.foto_locale.put({
      user_id: ID,
      percorso: `${ID}/${FILE[0]}`,
      byte: new Uint8Array([255, 216]).buffer,
      tipo: "image/jpeg",
    });
  }

  it("cartella vuota: come prima, con un solo elenco in più e niente imposta_foto_profilo", async () => {
    expect(await eliminaAccount(ID)).toBe("eliminato");
    expect(elenco).toHaveBeenCalledTimes(1);
    expect(elenco).toHaveBeenCalledWith(ID);
    expect(chiamateImposta()).toHaveLength(0);
    expect(cancellazione).not.toHaveBeenCalled();
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["elimina_mio_account"]);
  });

  it("file cancellati e funzione ok: prima la foto tolta, poi i file, poi la funzione; eliminato", async () => {
    cartella = [...FILE];
    await conCopiaDellaFoto();

    expect(await eliminaAccount(ID)).toBe("eliminato");
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["imposta_foto_profilo", "elimina_mio_account"]);
    expect(chiamateImposta()[0][1]).toEqual({ p_percorso: null });
    expect(cancellazione).toHaveBeenCalledWith([`${ID}/${FILE[0]}`]);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(cancellazione.mock.invocationCallOrder[0]);
    expect(cancellazione.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[1]);
    expect(await db.foto_locale.get(ID)).toBeUndefined();
  });

  it("elenco o impostazione falliti: rete, niente toccato, funzione mai chiamata", async () => {
    for (const guasto of ["elenco", "imposta-errore", "imposta-rifiuto"] as const) {
      rpc.mockClear();
      cartella = [...FILE];
      elencoFallisce = guasto === "elenco";
      rispostaImposta =
        guasto === "imposta-errore"
          ? { data: null, error: { message: "Failed to fetch" }, status: 0 }
          : guasto === "imposta-rifiuto"
            ? { data: "non_valido", error: null, status: 200 }
            : { data: "ok", error: null, status: 200 };
      await conCopiaDellaFoto();

      expect(await eliminaAccount(ID), guasto).toBe("rete");
      expect(chiamateFunzione(), guasto).toHaveLength(0);
      expect(cancellazione, guasto).not.toHaveBeenCalled();
      expect(cartella, guasto).toEqual(FILE);
      expect(await db.foto_locale.get(ID), guasto).not.toBeUndefined();
      expect(await pastiDi(ID), guasto).toBe(1);
      expect(leggiSegnoEliminazione(), guasto).toBeNull();
    }
  });

  it("cancellazione dei file fallita: foto-tolta, account intatto, funzione MAI chiamata, nessun segno", async () => {
    cartella = [...FILE];
    cancellazioneFallisce = true;
    await conCopiaDellaFoto();

    expect(await eliminaAccount(ID)).toBe("foto-tolta");
    expect(chiamateFunzione()).toHaveLength(0);
    expect(await pastiDi(ID)).toBe(1);
    expect(leggiSegnoEliminazione()).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    // La foto è già stata tolta dal profilo, e la copia dal telefono.
    expect(chiamateImposta()).toHaveLength(1);
    expect(await db.foto_locale.get(ID)).toBeUndefined();
  });

  it("file tolti e funzione rifiutata, o non arrivata: foto-tolta, dati intatti, segno tolto", async () => {
    for (const caso of ["rifiutata", "non-arrivata"] as const) {
      cartella = [...FILE];
      if (caso === "rifiutata") {
        utenti = [conUtente(ID)];
        rispostaRpc = { error: { message: "la foto profilo non è ancora stata cancellata" }, status: 400 };
      } else {
        utenti = [conUtente(ID), conUtente(ID)];
        rispostaRpc = { error: { message: "TypeError: Failed to fetch" }, status: 0 };
      }

      expect(await eliminaAccount(ID), caso).toBe("foto-tolta");
      expect(await pastiDi(ID), caso).toBe(1);
      expect(leggiSegnoEliminazione(), caso).toBeNull();
      expect(signOut, caso).not.toHaveBeenCalled();
    }
  });

  it("risposta persa dopo la cancellazione dei file: risposta-persa, segno richiesta lasciato, dati intatti", async () => {
    cartella = [...FILE];
    utenti = [conUtente(ID), senzaRete];
    rispostaRpc = { error: { message: "TypeError: Failed to fetch" }, status: 0 };

    expect(await eliminaAccount(ID)).toBe("risposta-persa");
    expect(cartella).toEqual([]);
    expect(await pastiDi(ID)).toBe(1);
    expect(leggiSegnoEliminazione()).toEqual({ idUtente: ID, fase: "richiesta" });
  });

  it("riprovare dopo foto-tolta: si finisce di svuotare la cartella e l'account si elimina", async () => {
    cartella = [...FILE];
    cancellazioneFallisce = true;
    expect(await eliminaAccount(ID)).toBe("foto-tolta");

    cancellazioneFallisce = false;
    rpc.mockClear();
    expect(await eliminaAccount(ID)).toBe("eliminato");
    expect(cartella).toEqual([]);
    expect(chiamateFunzione()).toHaveLength(1);
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
