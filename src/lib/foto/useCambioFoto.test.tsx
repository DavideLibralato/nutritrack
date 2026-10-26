// Il cambio della foto con le chiamate vere sostituite (useCambioFoto.ts).
// Errori che non fanno rumore: Riprova che rifà ritaglio e compressione (o
// ne carica un'altra), due tocchi veloci che caricano due volte. Casi:
// - "Usa foto": prepara una volta, carica il file preparato;
// - Riprova: ricarica lo STESSO Blob, senza preparare di nuovo;
// - doppio tocco su "Usa foto", su Riprova, su "Elimina foto": una chiamata;
// - una chiamata che lancia vale come fallita, e non blocca le successive.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { EsitoPreparazioneFoto } from "./ritaglioFoto";
import type { EsitoCambioFoto, EsitoEliminaFoto } from "./fotoProfilo";

const prepara = vi.fn<(file: Blob, area: unknown) => Promise<EsitoPreparazioneFoto>>();
const cambia = vi.fn<(client: unknown, userId: string, foto: Blob) => Promise<EsitoCambioFoto>>();
const elimina = vi.fn<(client: unknown, userId: string) => Promise<EsitoEliminaFoto>>();

vi.mock("./ritaglioFoto", () => ({ preparaFotoProfilo: (f: Blob, a: unknown) => prepara(f, a) }));
vi.mock("./fotoProfilo", () => ({
  cambiaFoto: (c: unknown, u: string, f: Blob) => cambia(c, u, f),
  eliminaFoto: (c: unknown, u: string) => elimina(c, u),
}));
vi.mock("../supabase/client", () => ({ createClient: () => ({}) }));

import { useCambioFoto } from "./useCambioFoto";

const U = "11111111-1111-4111-8111-111111111111";
const AREA = { x: 0, y: 0, width: 400, height: 400 };
const scelta = new Blob(["originale"], { type: "image/heic" });
const pronta = new Blob(["jpeg"], { type: "image/jpeg" });

// Una promessa che si risolve quando lo si dice.
function comandata<T>() {
  let risolvi!: (v: T) => void;
  const promessa = new Promise<T>((r) => (risolvi = r));
  return { promessa, risolvi };
}

beforeEach(() => {
  prepara.mockReset().mockResolvedValue({ esito: "ok", file: pronta });
  cambia
    .mockReset()
    .mockResolvedValue({ esito: "ok", percorso: `${U}/x.jpg`, avanziRimasti: false });
  elimina.mockReset().mockResolvedValue({ esito: "ok", avanziRimasti: false });
});
afterEach(() => cleanup());

function conRitaglio() {
  const hook = renderHook(() => useCambioFoto(U));
  act(() => hook.result.current.invia({ tipo: "file-scelto", file: scelta }));
  return hook;
}

describe("useCambioFoto", () => {
  it("Usa foto: prepara la foto scelta una volta e carica il file preparato", async () => {
    const { result } = conRitaglio();
    await act(() => result.current.usaFoto(AREA));

    expect(prepara).toHaveBeenCalledTimes(1);
    expect(prepara.mock.calls[0][0]).toBe(scelta);
    expect(cambia).toHaveBeenCalledTimes(1);
    expect(cambia.mock.calls[0][1]).toBe(U);
    expect(cambia.mock.calls[0][2]).toBe(pronta);
    expect(result.current.stato).toEqual({ fase: "fatto", cosa: "aggiornata" });
  });

  it("Riprova ricarica lo stesso Blob, senza preparare di nuovo", async () => {
    cambia.mockResolvedValueOnce({ esito: "caricamento-fallito" });
    const { result } = conRitaglio();
    await act(() => result.current.usaFoto(AREA));
    expect(result.current.stato).toEqual({ fase: "caricamento-fallito", foto: pronta });

    await act(() => result.current.riprova());
    expect(prepara).toHaveBeenCalledTimes(1);
    expect(cambia).toHaveBeenCalledTimes(2);
    expect(cambia.mock.calls[1][2]).toBe(pronta);
    expect(result.current.stato).toEqual({ fase: "fatto", cosa: "aggiornata" });
  });

  it("doppio tocco su Usa foto: una sola preparazione e un solo caricamento", async () => {
    const lenta = comandata<EsitoPreparazioneFoto>();
    prepara.mockReturnValueOnce(lenta.promessa);
    const { result } = conRitaglio();

    let primo!: Promise<void>;
    let secondo!: Promise<void>;
    act(() => {
      // Tutti e due nello stesso istante: vedono lo stesso stato.
      primo = result.current.usaFoto(AREA);
      secondo = result.current.usaFoto(AREA);
    });
    await act(async () => {
      lenta.risolvi({ esito: "ok", file: pronta });
      await Promise.all([primo, secondo]);
    });

    expect(prepara).toHaveBeenCalledTimes(1);
    expect(cambia).toHaveBeenCalledTimes(1);
  });

  it("doppio tocco su Riprova: un solo caricamento", async () => {
    cambia.mockResolvedValueOnce({ esito: "caricamento-fallito" });
    const { result } = conRitaglio();
    await act(() => result.current.usaFoto(AREA));

    const lento = comandata<EsitoCambioFoto>();
    cambia.mockReturnValueOnce(lento.promessa);
    let primo!: Promise<void>;
    let secondo!: Promise<void>;
    act(() => {
      primo = result.current.riprova();
      secondo = result.current.riprova();
    });
    await act(async () => {
      lento.risolvi({ esito: "ok", percorso: `${U}/x.jpg`, avanziRimasti: false });
      await Promise.all([primo, secondo]);
    });

    expect(cambia).toHaveBeenCalledTimes(2); // il primo tentativo + un solo Riprova
  });

  it("una chiamata che lancia vale come fallita, e Riprova funziona dopo", async () => {
    cambia.mockRejectedValueOnce(new Error("Failed to fetch"));
    const { result } = conRitaglio();
    await act(() => result.current.usaFoto(AREA));
    expect(result.current.stato.fase).toBe("caricamento-fallito");

    await act(() => result.current.riprova());
    expect(result.current.stato.fase).toBe("fatto");
  });

  it("preparazione che lancia: foto non valida, niente caricamento", async () => {
    prepara.mockRejectedValueOnce(new Error("canvas"));
    const { result } = conRitaglio();
    await act(() => result.current.usaFoto(AREA));
    expect(result.current.stato.fase).toBe("foto-non-valida");
    expect(cambia).not.toHaveBeenCalled();
  });

  it("Elimina foto: doppio tocco → una chiamata; fallita → di nuovo la conferma, e si ripete", async () => {
    const { result } = renderHook(() => useCambioFoto(U));
    act(() => {
      result.current.invia({ tipo: "apri-scelta" });
      result.current.invia({ tipo: "chiedi-elimina" });
    });

    elimina.mockResolvedValueOnce({ esito: "fallito" });
    let primo!: Promise<void>;
    let secondo!: Promise<void>;
    act(() => {
      primo = result.current.confermaElimina();
      secondo = result.current.confermaElimina();
    });
    await act(() => Promise.all([primo, secondo]).then(() => {}));
    expect(elimina).toHaveBeenCalledTimes(1);
    expect(result.current.stato.fase).toBe("conferma-elimina");

    await act(() => result.current.confermaElimina());
    expect(elimina).toHaveBeenCalledTimes(2);
    expect(result.current.stato).toEqual({ fase: "fatto", cosa: "eliminata" });
  });

  it("senza utente non parte niente", async () => {
    const { result } = renderHook(() => useCambioFoto(null));
    act(() => result.current.invia({ tipo: "file-scelto", file: scelta }));
    await act(() => result.current.usaFoto(AREA));
    expect(prepara).not.toHaveBeenCalled();
  });
});
