// Il segno "eliminazione in corso" (PUNTO_DI_PARTENZA.md §9.6) decide se
// all'avvio si cancellano i dati di un utente dal dispositivo: un errore
// qui o cancella dati di un account che esiste ancora, o lascia sul
// telefono i dati di un account cancellato. Casi fissati per sempre:
// - "confermata": si pulisce senza chiedere al server, anche offline, e
//   si tolgono anche le righe riscritte dopo la prima pulizia;
// - "richiesta": si pulisce solo se il server dice che l'utente non
//   esiste più; se esiste si toglie il segno e basta; nel dubbio (rete,
//   sessione scaduta, altro utente) non si tocca niente e il segno resta;
// - un segno illeggibile non cancella niente.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { db } from "../db/database";
import type { Pasto } from "../db/tipi";
import { cancellaDatiUtente } from "../sync/ripristino";
import {
  CHIAVE_ELIMINAZIONE,
  classificaVerificaUtente,
  leggiSegnoEliminazione,
  riprendiEliminazioneInSospeso,
  scriviSegnoEliminazione,
  type VerificaUtente,
} from "./eliminazioneInCorso";

function pasto(userId: string, nome: string): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-09-10T08:00:00.000Z",
    deleted_at: null,
    nome,
    ora_inizio: "12:30",
    ordine: 0,
  };
}

async function pastiDi(userId: string) {
  return db.pasti.where("user_id").equals(userId).toArray();
}

// Un utente con un pasto sul dispositivo, e un altro utente accanto che
// non va mai toccato.
async function dispositivo() {
  const utente = `utente-${crypto.randomUUID()}`;
  const altro = `utente-${crypto.randomUUID()}`;
  await db.pasti.bulkPut([pasto(utente, "Pranzo"), pasto(altro, "Cena dell'altro")]);
  return { utente, altro };
}

beforeEach(() => {
  localStorage.clear();
});

describe("riprendiEliminazioneInSospeso", () => {
  it("senza segno non fa niente e non chiede al server", async () => {
    const { utente } = await dispositivo();
    const verifica = vi.fn();

    expect(await riprendiEliminazioneInSospeso(verifica)).toBe("niente");
    expect(verifica).not.toHaveBeenCalled();
    expect(await pastiDi(utente)).toHaveLength(1);
  });

  it("segno confermata: pulisce senza chiedere al server e toglie il segno", async () => {
    const { utente, altro } = await dispositivo();
    scriviSegnoEliminazione(utente, "confermata");
    const verifica = vi.fn();

    expect(await riprendiEliminazioneInSospeso(verifica)).toBe("pulito");
    expect(verifica).not.toHaveBeenCalled();
    expect(await pastiDi(utente)).toHaveLength(0);
    expect(await pastiDi(altro)).toHaveLength(1);
    expect(leggiSegnoEliminazione()).toBeNull();
  });

  it("segno confermata: toglie anche le righe riscritte dopo la prima pulizia (discesa in ritardo)", async () => {
    const { utente } = await dispositivo();
    scriviSegnoEliminazione(utente, "confermata");

    // Il flusso pulisce e lascia il segno; poi una discesa partita prima
    // dell'eliminazione riscrive una riga vecchia.
    await cancellaDatiUtente(utente);
    await db.pasti.put(pasto(utente, "Riscritto dalla discesa"));
    expect(leggiSegnoEliminazione()).not.toBeNull();

    expect(await riprendiEliminazioneInSospeso(vi.fn())).toBe("pulito");
    expect(await pastiDi(utente)).toHaveLength(0);
  });

  it("segno richiesta e utente che non esiste più: pulisce e toglie il segno", async () => {
    const { utente, altro } = await dispositivo();
    scriviSegnoEliminazione(utente, "richiesta");
    const verifica = vi.fn(async (): Promise<VerificaUtente> => "non-esiste");

    expect(await riprendiEliminazioneInSospeso(verifica)).toBe("pulito");
    expect(verifica).toHaveBeenCalledWith(utente);
    expect(await pastiDi(utente)).toHaveLength(0);
    expect(await pastiDi(altro)).toHaveLength(1);
    expect(leggiSegnoEliminazione()).toBeNull();
  });

  it("segno richiesta e utente che esiste ancora: dati intatti, segno tolto", async () => {
    const { utente } = await dispositivo();
    scriviSegnoEliminazione(utente, "richiesta");

    expect(await riprendiEliminazioneInSospeso(async () => "esiste")).toBe("annullato");
    expect(await pastiDi(utente)).toHaveLength(1);
    expect(leggiSegnoEliminazione()).toBeNull();
  });

  it("segno richiesta e risposta che non si capisce: dati intatti, segno lasciato", async () => {
    const { utente } = await dispositivo();
    scriviSegnoEliminazione(utente, "richiesta");

    expect(await riprendiEliminazioneInSospeso(async () => "sconosciuto")).toBe("in-attesa");
    expect(await pastiDi(utente)).toHaveLength(1);
    expect(leggiSegnoEliminazione()).toEqual({ idUtente: utente, fase: "richiesta" });
  });

  it("segno richiesta e verifica che lancia un errore: come una risposta che non si capisce", async () => {
    const { utente } = await dispositivo();
    scriviSegnoEliminazione(utente, "richiesta");

    const esito = await riprendiEliminazioneInSospeso(async () => {
      throw new Error("rete giù");
    });
    expect(esito).toBe("in-attesa");
    expect(await pastiDi(utente)).toHaveLength(1);
    expect(leggiSegnoEliminazione()).not.toBeNull();
  });

  it("segno illeggibile: non cancella niente", async () => {
    const { utente } = await dispositivo();
    localStorage.setItem(CHIAVE_ELIMINAZIONE, JSON.stringify({ idUtente: utente, fase: "boh" }));

    expect(await riprendiEliminazioneInSospeso(async () => "non-esiste")).toBe("niente");
    expect(await pastiDi(utente)).toHaveLength(1);
  });
});

describe("classificaVerificaUtente", () => {
  const id = "utente-1";

  it("utente non trovato dal server → non-esiste", () => {
    const errore = new AuthApiError("User from sub claim in JWT does not exist", 403, "user_not_found");
    expect(classificaVerificaUtente(id, null, errore)).toBe("non-esiste");
  });

  it("lo stesso utente riconosciuto → esiste", () => {
    expect(classificaVerificaUtente(id, { id }, null)).toBe("esiste");
  });

  it("un altro utente entrato nel frattempo → sconosciuto", () => {
    expect(classificaVerificaUtente(id, { id: "utente-2" }, null)).toBe("sconosciuto");
  });

  it("rete, sessione mancante, sessione rifiutata per altri motivi → sconosciuto", () => {
    expect(classificaVerificaUtente(id, null, new AuthRetryableFetchError("Failed to fetch", 0))).toBe(
      "sconosciuto"
    );
    expect(classificaVerificaUtente(id, null, new AuthSessionMissingError())).toBe("sconosciuto");
    expect(classificaVerificaUtente(id, null, new AuthApiError("JWT expired", 401, "bad_jwt"))).toBe(
      "sconosciuto"
    );
    expect(
      classificaVerificaUtente(id, null, new AuthApiError("Session not found", 403, "session_not_found"))
    ).toBe("sconosciuto");
  });
});
