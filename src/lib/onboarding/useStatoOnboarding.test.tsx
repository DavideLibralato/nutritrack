// useStatoOnboarding (dal 17/10): mette insieme i cinque ingressi di
// statoSegno. Le regole sono testate in statoOnboarding.test.ts; qui che
// gli ingressi arrivino giusti e che l'hook si aggiorni quando cambiano.
// Sbaglia in silenzio: un "non ancora noto" scambiato per "niente" fa
// decidere su dati non letti (l'utente di prima mandato all'onboarding, o un
// telefono vuoto che scrive prima della discesa). Finti solo utente,
// metadati e client Supabase; Dexie, chiave locale e discesa sono veri.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { db } from "../db/database";
import { repositoryObiettivi } from "../repository";
import { azzeraStatoGiri, segnaDiscesaRiuscita } from "../sync/statoSincronizzazione";
import { concludiOnboarding } from "./segnoOnboarding";
import { useStatoOnboarding } from "./useStatoOnboarding";

const finti = vi.hoisted(() => ({
  userId: "u1" as string | null | undefined,
  metadati: undefined as Record<string, unknown> | null | undefined,
}));

vi.mock("../supabase/useUtente", () => ({
  useUtenteId: () => finti.userId,
  useMetadatiUtente: () => finti.metadati,
}));

// concludiOnboarding senza sessione: la chiave locale si scrive e resta.
vi.mock("../supabase/client", () => ({
  createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));

beforeEach(async () => {
  finti.userId = "u1";
  finti.metadati = { onboarding: "da_fare" };
  window.localStorage.clear();
  azzeraStatoGiri();
  await Promise.all([db.profili.clear(), db.misurazioni.clear(), db.obiettivi.clear(), db.outbox.clear()]);
});

async function obiettivo(userId: string) {
  await repositoryObiettivi.crea({
    user_id: userId,
    valido_dal: "2026-10-17",
    tipo: "mantenere",
    kcal: 2500,
    proteine_g: 180,
    carboidrati_g: 250,
    grassi_g: 80,
    peso_obiettivo: null,
  });
}

describe("useStatoOnboarding", () => {
  it("non ancora noto finché utente o metadati non sono letti", async () => {
    finti.userId = undefined;
    const { result, rerender } = renderHook(() => useStatoOnboarding());
    expect(result.current).toBeUndefined();

    finti.userId = "u1";
    finti.metadati = undefined;
    rerender();
    await new Promise((fine) => setTimeout(fine, 20));
    expect(result.current).toBeUndefined();

    finti.metadati = { onboarding: "da_fare" };
    rerender();
    await waitFor(() => expect(result.current).toBeDefined());
  });

  it("nessun utente: nessun segno, niente da mostrare", () => {
    finti.userId = null;
    const { result } = renderHook(() => useStatoOnboarding());
    expect(result.current).toEqual({
      segno: null,
      mostraOnboarding: false,
      mostraScheda: false,
      attendiDiscesa: false,
    });
  });

  it("metadati senza segno: utente di prima, niente", async () => {
    finti.metadati = { nome: "Giulia" };
    const { result } = renderHook(() => useStatoOnboarding());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.segno).toBeNull();
    expect(result.current?.mostraOnboarding).toBe(false);
  });

  it("da_fare con Dexie vuoto: aspetta la discesa; riuscita, smette di aspettare da solo", async () => {
    const { result } = renderHook(() => useStatoOnboarding());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toMatchObject({ segno: "da_fare", mostraOnboarding: true, attendiDiscesa: true });

    act(() => segnaDiscesaRiuscita("u1"));
    expect(result.current?.attendiDiscesa).toBe(false);
  });

  it("le righe dell'utente in Dexie bastano a non aspettare; quelle di un altro no", async () => {
    await obiettivo("u2");
    const { result } = renderHook(() => useStatoOnboarding());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current?.attendiDiscesa).toBe(true);
  });

  it("un obiettivo che arriva in Dexie vale «fatto», senza ridisegnare a mano", async () => {
    finti.metadati = { onboarding: "rimandato" };
    act(() => segnaDiscesaRiuscita("u1"));
    const { result } = renderHook(() => useStatoOnboarding());
    await waitFor(() => expect(result.current?.mostraScheda).toBe(true));

    await act(() => obiettivo("u1"));
    await waitFor(() => expect(result.current?.segno).toBe("fatto"));
    expect(result.current?.mostraScheda).toBe(false);
  });

  it("la chiave locale, appena scritta, vince sui metadati", async () => {
    act(() => segnaDiscesaRiuscita("u1"));
    const { result } = renderHook(() => useStatoOnboarding());
    await waitFor(() => expect(result.current?.segno).toBe("da_fare"));

    await act(() => concludiOnboarding("u1", "rimandato"));
    expect(result.current).toMatchObject({ segno: "rimandato", mostraOnboarding: false, mostraScheda: true });
  });
});
