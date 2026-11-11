// RipresaEliminazioneAccount passa alla ripresa le tre azioni vere (dal
// 01/11/2026). Se ne mancasse una, o fosse finta, la ripresa dopo
// un'eliminazione interrotta non chiuderebbe la sessione dell'account
// eliminato e non porterebbe su Accedi, senza che nient'altro se ne
// accorga: l'app resterebbe ferma su "Caricamento...".

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { AzioniRipresa } from "@/lib/account/eliminazioneInCorso";
import RipresaEliminazioneAccount from "./RipresaEliminazioneAccount";

const riprendi = vi.fn<(...argomenti: unknown[]) => Promise<"niente">>(async () => "niente");
vi.mock("@/lib/account/eliminazioneInCorso", () => ({
  riprendiEliminazioneInSospeso: (...argomenti: unknown[]) => riprendi(...argomenti),
}));

const verificaUtenteSulServer = vi.fn();
const chiudiSessioneQui = vi.fn(async () => true);
vi.mock("@/lib/account/eliminaAccount", () => ({
  verificaUtenteSulServer: (...a: unknown[]) => verificaUtenteSulServer(...a),
  chiudiSessioneQui: () => chiudiSessioneQui(),
}));

vi.mock("@/lib/supabase/utenteDellaSessione", () => ({
  idUtenteDellaSessione: async () => "utente-della-sessione",
}));

// window.location.replace in jsdom non naviga: lo sostituiamo per contarlo.
const replace = vi.fn();
const locationVera = window.location;

beforeEach(() => {
  riprendi.mockClear();
  verificaUtenteSulServer.mockClear();
  chiudiSessioneQui.mockClear();
  replace.mockClear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...locationVera, replace },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: locationVera });
});

// Monta il componente e restituisce le azioni che ha passato alla ripresa.
async function azioniPassate(): Promise<AzioniRipresa> {
  render(<RipresaEliminazioneAccount />);
  await waitFor(() => expect(riprendi).toHaveBeenCalledTimes(1));
  const azioni = riprendi.mock.calls[0][1] as AzioniRipresa | undefined;
  expect(azioni).toBeDefined();
  return azioni!;
}

describe("RipresaEliminazioneAccount", () => {
  it("passa la verifica col server", async () => {
    render(<RipresaEliminazioneAccount />);
    await waitFor(() => expect(riprendi).toHaveBeenCalledTimes(1));
    const verifica = riprendi.mock.calls[0][0] as (id: string) => unknown;
    await verifica("utente-1");
    expect(verificaUtenteSulServer).toHaveBeenCalledWith("utente-1");
  });

  it("utenteAttuale: l'utente della sessione salvata", async () => {
    const azioni = await azioniPassate();
    expect(await azioni.utenteAttuale()).toBe("utente-della-sessione");
  });

  it("chiudiSessione: chiude davvero la sessione (chiudiSessioneQui)", async () => {
    const azioni = await azioniPassate();
    expect(await azioni.chiudiSessione()).toBe(true);
    expect(chiudiSessioneQui).toHaveBeenCalledTimes(1);
  });

  it("naviga: ricaricamento completo sull'indirizzo dato", async () => {
    const azioni = await azioniPassate();
    azioni.naviga("/login?eliminato=1");
    expect(replace).toHaveBeenCalledWith("/login?eliminato=1");
  });
});
