// Il segno "discesa riuscita in questa sessione" (statoSincronizzazione.ts,
// dal 17/10, branch onboarding). Sbaglia in silenzio: acceso troppo presto,
// l'onboarding decide il passo da un Dexie ancora vuoto e il passo 2 crea un
// secondo profilo, rifiutato dal server (profili_user_id_key); mai acceso,
// l'onboarding resta fermo su "Caricamento…" per un utente nuovo con il
// server vuoto. Si prova con la discesa vera (scaricaTutto): finto è solo il
// client Supabase.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { scaricaTutto, TABELLE_DATI_ONBOARDING } from "./discesa";
import {
  azzeraStatoGiri,
  discesaRiuscitaPer,
  leggiStatoGiri,
  segnaDiscesaRiuscita,
} from "./statoSincronizzazione";
import { useDiscesaRiuscita } from "./useDiscesaRiuscita";

// --- Client Supabase finto ---------------------------------------------------
// Ogni tabella risponde vuota (il server di un utente nuovo), salvo quelle
// in `rispostePerTabella`.
const server = vi.hoisted(() => ({
  rispostePerTabella: {} as Record<string, { error: { message: string }; status: number }>,
}));

vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: (tabella: string) => {
      const builder = {
        select: () => builder,
        order: () => builder,
        eq: () => builder,
        or: () => builder,
        gte: () => builder,
        range: () => builder,
        then: (risolvi: (v: unknown) => void) =>
          risolvi(server.rispostePerTabella[tabella] ?? { data: [], error: null, status: 200 }),
      };
      return builder;
    },
  }),
}));

const SENZA_RETE = { error: { message: "FetchError: Load failed" }, status: 0 };

beforeEach(() => {
  server.rispostePerTabella = {};
  window.localStorage.clear();
  azzeraStatoGiri();
});

describe("discesaRiuscitaPer", () => {
  it("all'inizio è falso", () => {
    expect(discesaRiuscitaPer("u1")).toBe(false);
    expect(discesaRiuscitaPer(null)).toBe(false);
    expect(discesaRiuscitaPer(undefined)).toBe(false);
  });

  it("un giro riuscito con il server vuoto lo accende, anche senza nessuna riga", async () => {
    await scaricaTutto("u1");
    expect(discesaRiuscitaPer("u1")).toBe(true);
  });

  it("se una delle tre tabelle fallisce resta spento", async () => {
    for (const tabella of TABELLE_DATI_ONBOARDING) {
      azzeraStatoGiri();
      server.rispostePerTabella = { [tabella]: SENZA_RETE };
      await scaricaTutto("u1");
      expect(discesaRiuscitaPer("u1"), tabella).toBe(false);
    }
  });

  it("una tabella che non serve all'onboarding può fallire: si accende lo stesso", async () => {
    server.rispostePerTabella = { pasti: SENZA_RETE, alimenti: SENZA_RETE };
    await scaricaTutto("u1");
    expect(discesaRiuscitaPer("u1")).toBe(true);
    // Il giro resta comunque segnato come non riuscito, per l'indicatore.
    expect(leggiStatoGiri().discesa.esito).toBe("rete");
  });

  it("acceso, un giro fallito dopo non lo spegne", async () => {
    await scaricaTutto("u1");
    server.rispostePerTabella = { profili: SENZA_RETE, obiettivi: SENZA_RETE };
    await scaricaTutto("u1");
    expect(discesaRiuscitaPer("u1")).toBe(true);
  });

  it("vale per un utente solo: per un altro è spento", async () => {
    await scaricaTutto("u1");
    expect(discesaRiuscitaPer("u2")).toBe(false);
    await scaricaTutto("u2");
    expect(discesaRiuscitaPer("u2")).toBe(true);
    expect(discesaRiuscitaPer("u1")).toBe(false);
  });

  it("Esci (azzeraStatoGiri) lo spegne: chi rientra aspetta di nuovo la discesa", async () => {
    await scaricaTutto("u1");
    azzeraStatoGiri();
    expect(discesaRiuscitaPer("u1")).toBe(false);
  });
});

describe("useDiscesaRiuscita", () => {
  it("si aggiorna quando il segno si accende, e segue il cambio di utente", async () => {
    const { result, rerender } = renderHook(({ userId }) => useDiscesaRiuscita(userId), {
      initialProps: { userId: "u1" as string | null },
    });
    expect(result.current).toBe(false);

    await act(() => scaricaTutto("u1"));
    expect(result.current).toBe(true);

    rerender({ userId: "u2" });
    expect(result.current).toBe(false);

    rerender({ userId: null });
    expect(result.current).toBe(false);
  });

  it("il segno avvisa da solo, senza aspettare l'avviso di fine giro", () => {
    const { result } = renderHook(() => useDiscesaRiuscita("u1"));
    act(() => segnaDiscesaRiuscita("u1"));
    expect(result.current).toBe(true);
  });

  it("si spegne con azzeraStatoGiri", async () => {
    await scaricaTutto("u1");
    const { result } = renderHook(() => useDiscesaRiuscita("u1"));
    expect(result.current).toBe(true);

    act(() => azzeraStatoGiri());
    expect(result.current).toBe(false);
  });
});
