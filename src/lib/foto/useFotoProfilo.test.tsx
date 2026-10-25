// L'indirizzo locale della propria foto (useMiaFoto). Un errore qui non
// fa rumore: indirizzi "blob:" mai revocati tengono in memoria una copia
// della foto per ogni cambio, finché la pagina resta aperta; e un
// indirizzo nuovo a ogni rilettura fa ricaricare l'immagine. Casi fissati:
// - UN indirizzo per copia (anche se useLiveQuery rilegge), revocato
//   quando la copia cambia;
// - copia tolta → null (iniziali) e indirizzo revocato;
// - componente che sparisce → indirizzo revocato;
// - la copia di un altro utente non si mostra.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { db } from "../db/database";
import { useMiaFoto } from "./useFotoProfilo";

const U = "11111111-1111-4111-8111-111111111111";
const ALTRO = "22222222-2222-4222-8222-222222222222";

function copia(userId: string, nome: string) {
  return {
    user_id: userId,
    percorso: `${userId}/${nome}.jpg`,
    byte: new Uint8Array([255, 216]).buffer,
    tipo: "image/jpeg",
  };
}

let creati: string[];
let revocati: string[];
const originali = { crea: URL.createObjectURL, revoca: URL.revokeObjectURL };

beforeEach(async () => {
  await db.foto_locale.clear();
  creati = [];
  revocati = [];
  // jsdom non ha gli indirizzi locali: li si finge, numerati.
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:prova/${creati.length + 1}`;
    creati.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revocati.push(url);
  });
});

afterEach(() => {
  // Senza globals di vitest Testing Library non smonta da sola: un hook
  // rimasto montato da un test prima creerebbe indirizzi anche in questo.
  cleanup();
  URL.createObjectURL = originali.crea;
  URL.revokeObjectURL = originali.revoca;
});

// Gli indirizzi creati e non ancora revocati: quelli in memoria.
const vivi = () => creati.filter((url) => !revocati.includes(url));

describe("useMiaFoto", () => {
  it("senza copia: null, nessun indirizzo creato", async () => {
    const { result } = renderHook(() => useMiaFoto(U));
    await new Promise((risolvi) => setTimeout(risolvi, 50));
    expect(result.current).toBeNull();
    expect(creati).toEqual([]);
  });

  it("copia cambiata: indirizzo nuovo, il vecchio revocato; sempre uno solo in memoria", async () => {
    await db.foto_locale.put(copia(U, "prima"));
    const { result } = renderHook(() => useMiaFoto(U));
    await waitFor(() => expect(result.current).toBe("blob:prova/1"));

    await db.foto_locale.put(copia(U, "seconda"));
    await waitFor(() => expect(result.current).toBe("blob:prova/2"));
    expect(revocati).toContain("blob:prova/1");
    expect(vivi()).toEqual(["blob:prova/2"]);
  });

  it("una scrittura che non cambia la copia (un altro utente) non crea indirizzi nuovi", async () => {
    await db.foto_locale.put(copia(U, "prima"));
    const { result } = renderHook(() => useMiaFoto(U));
    await waitFor(() => expect(result.current).toBe("blob:prova/1"));

    // La tabella cambia (useLiveQuery rilegge), la copia di U no.
    await db.foto_locale.put(copia(ALTRO, "sua"));
    await new Promise((risolvi) => setTimeout(risolvi, 50));
    expect(result.current).toBe("blob:prova/1");
    expect(creati).toEqual(["blob:prova/1"]);
  });

  it("copia tolta: null e indirizzo revocato", async () => {
    await db.foto_locale.put(copia(U, "prima"));
    const { result } = renderHook(() => useMiaFoto(U));
    await waitFor(() => expect(result.current).toBe("blob:prova/1"));

    await db.foto_locale.delete(U);
    await waitFor(() => expect(result.current).toBeNull());
    expect(vivi()).toEqual([]);
  });

  it("componente che sparisce: indirizzo revocato", async () => {
    await db.foto_locale.put(copia(U, "prima"));
    const { result, unmount } = renderHook(() => useMiaFoto(U));
    await waitFor(() => expect(result.current).not.toBeNull());

    unmount();
    expect(vivi()).toEqual([]);
  });

  it("la copia di un altro utente non si mostra; cambiando utente si torna alle iniziali", async () => {
    await db.foto_locale.put(copia(ALTRO, "sua"));
    await db.foto_locale.put(copia(U, "mia"));
    const { result, rerender } = renderHook(({ id }) => useMiaFoto(id), {
      initialProps: { id: U as string | null },
    });
    await waitFor(() => expect(result.current).not.toBeNull());

    rerender({ id: null });
    await waitFor(() => expect(result.current).toBeNull());
    expect(vivi()).toEqual([]);
  });
});
