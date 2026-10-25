// La foto profilo sul server e la sua copia sul telefono
// (PUNTO_DI_PARTENZA.md §3, "La foto profilo"). Un errore qui non fa
// rumore: una foto che risulta cambiata e non lo è, un file che resta sul
// server per sempre, una copia vecchia che ricompare. Casi fissati:
// - cambio: i tre passi in ordine; file non caricato → niente cambiato;
//   impostazione fallita → resta un file in più, che il cambio dopo
//   toglie; cancellazione dei vecchi fallita → solo un avanzo;
// - il file appena impostato non si cancella mai;
// - elimina foto: prima il server, poi i file, poi la copia;
// - aggiornamento della copia: scarica solo se il percorso è cambiato,
//   toglie la copia se il server non ha foto, non tocca niente senza
//   risposta, e non riscrive una copia nuova salvata nel frattempo;
// - foto degli amici: una sola chiamata allo Storage, e ogni errore dà
//   "nessuna foto", mai un errore.

import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "../db/database";
import {
  aggiornaMiaFoto,
  blobDaFotoLocale,
  cambiaFoto,
  eliminaFoto,
  indirizziFotoAmici,
  leggiFotoLocale,
  SCADENZA_URL_FIRMATI_S,
} from "./fotoProfilo";

const U = "11111111-1111-4111-8111-111111111111";

// --- Supabase finto, con uno Storage che tiene davvero i file ----------------

interface Finto {
  file: Map<string, Uint8Array<ArrayBuffer>>; // i file nel bucket, per percorso
  percorsoServer: string | null; // foto_profilo.percorso dell'utente
  righeAmici: { user_id: string; percorso: string | null }[];
  // I guasti, uno per chiamata.
  uploadFallisce: boolean;
  uploadLancia: boolean;
  rpc: "ok" | "file_mancante" | "errore" | "lancia" | "ok-ma-risposta-persa";
  listFallisce: boolean;
  removeFallisce: boolean;
  selectFallisce: boolean;
  downloadFallisce: boolean;
  firmaFallisce: boolean;
  // Se c'è, download aspetta questa promessa prima di rispondere.
  attesaDownload: Promise<void> | null;
  // Registro delle chiamate, nell'ordine.
  chiamate: string[];
  firmeChieste: { percorsi: string[]; scadenza: number }[];
}

let f: Finto;

function nuovoFinto(): Finto {
  return {
    file: new Map(),
    percorsoServer: null,
    righeAmici: [],
    uploadFallisce: false,
    uploadLancia: false,
    rpc: "ok",
    listFallisce: false,
    removeFallisce: false,
    selectFallisce: false,
    downloadFallisce: false,
    firmaFallisce: false,
    attesaDownload: null,
    chiamate: [],
    firmeChieste: [],
  };
}

const ERRORE = { message: "rete giù" };

function client(): SupabaseClient {
  const bucket = {
    upload: async (
      percorso: string,
      file: Blob,
      opzioni: { upsert?: boolean; contentType?: string }
    ) => {
      f.chiamate.push(`upload ${percorso} upsert=${opzioni.upsert} ${opzioni.contentType}`);
      if (f.uploadLancia) throw new Error("Failed to fetch");
      if (f.uploadFallisce) return { data: null, error: ERRORE };
      f.file.set(percorso, new Uint8Array(await file.arrayBuffer()));
      return { data: { path: percorso }, error: null };
    },
    list: async (cartella: string) => {
      f.chiamate.push(`list ${cartella}`);
      if (f.listFallisce) return { data: null, error: ERRORE };
      const nomi = [...f.file.keys()]
        .filter((p) => p.startsWith(`${cartella}/`))
        .map((p) => ({ name: p.slice(cartella.length + 1) }));
      return { data: nomi, error: null };
    },
    remove: async (percorsi: string[]) => {
      f.chiamate.push(`remove ${[...percorsi].sort().join(",")}`);
      if (f.removeFallisce) return { data: null, error: ERRORE };
      for (const p of percorsi) f.file.delete(p);
      return { data: [], error: null };
    },
    download: async (percorso: string) => {
      f.chiamate.push(`download ${percorso}`);
      // I byte partono subito, la risposta arriva dopo l'attesa: come un
      // download vero già in viaggio quando il file sul server cambia.
      const byte = f.file.get(percorso);
      if (f.attesaDownload) await f.attesaDownload;
      if (f.downloadFallisce || !byte) return { data: null, error: ERRORE };
      return { data: new Blob([byte], { type: "image/jpeg" }), error: null };
    },
    createSignedUrls: async (percorsi: string[], scadenza: number) => {
      f.chiamate.push("createSignedUrls");
      f.firmeChieste.push({ percorsi: [...percorsi], scadenza });
      if (f.firmaFallisce) return { data: null, error: ERRORE };
      return {
        data: percorsi.map((p) =>
          f.file.has(p)
            ? { path: p, signedUrl: `https://firmato/${p}`, error: null }
            : { path: p, signedUrl: null, error: "Object not found" }
        ),
        error: null,
      };
    },
  };

  return {
    storage: { from: () => bucket },
    rpc: async (nome: string, argomenti: { p_percorso: string | null }) => {
      f.chiamate.push(`rpc ${nome} ${argomenti.p_percorso}`);
      if (f.rpc === "lancia") throw new Error("Failed to fetch");
      if (f.rpc === "errore") return { data: null, error: ERRORE, status: 0 };
      if (f.rpc === "file_mancante") return { data: "file_mancante", error: null };
      // Come il server: il percorso si imposta. Con "risposta persa" la
      // scrittura c'è, ma al telefono arriva un errore.
      f.percorsoServer = argomenti.p_percorso;
      if (f.rpc === "ok-ma-risposta-persa") return { data: null, error: ERRORE, status: 0 };
      return { data: "ok", error: null };
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            f.chiamate.push("select mia");
            if (f.selectFallisce) return { data: null, error: ERRORE };
            return {
              data: f.percorsoServer === null ? null : { percorso: f.percorsoServer },
              error: null,
            };
          },
        }),
        in: async (_colonna: string, ids: string[]) => {
          f.chiamate.push("select amici");
          if (f.selectFallisce) return { data: null, error: ERRORE };
          return { data: f.righeAmici.filter((r) => ids.includes(r.user_id)), error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;
}

function jpeg(...byte: number[]): Blob {
  return new Blob([new Uint8Array([255, 216, ...byte])], { type: "image/jpeg" });
}

async function byteDellaCopia(): Promise<number[] | null> {
  const copia = await leggiFotoLocale(U);
  return copia ? Array.from(new Uint8Array(copia.byte)) : null;
}

const percorsiNelBucket = () => [...f.file.keys()].sort();

// Aspetta che l'aggiornamento sia fermo nel download: da lì in poi ha già
// letto la copia e il percorso sul server.
async function finoAlDownload() {
  for (let i = 0; i < 100 && !f.chiamate.some((c) => c.startsWith("download")); i++) {
    await new Promise((risolvi) => setTimeout(risolvi, 0));
  }
  expect(f.chiamate.some((c) => c.startsWith("download"))).toBe(true);
}

beforeEach(async () => {
  f = nuovoFinto();
  await db.foto_locale.clear();
});

// --- Cambiare la foto ---------------------------------------------------------

describe("cambiaFoto", () => {
  it("i tre passi in ordine, nome nuovo <user_id>/<uuid>.jpg, copia salvata senza riscaricare", async () => {
    const esito = await cambiaFoto(client(), U, jpeg(1));

    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(esito.percorso).toMatch(
      new RegExp(`^${U}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`)
    );
    expect(esito.avanziRimasti).toBe(false);
    expect(f.chiamate).toEqual([
      `upload ${esito.percorso} upsert=false image/jpeg`,
      `rpc imposta_foto_profilo ${esito.percorso}`,
      `list ${U}`,
    ]);
    expect(f.percorsoServer).toBe(esito.percorso);
    expect((await leggiFotoLocale(U))?.percorso).toBe(esito.percorso);
    expect(await byteDellaCopia()).toEqual([255, 216, 1]);
  });

  it("al cambio dopo si cancella il file vecchio, mai quello nuovo", async () => {
    const primo = await cambiaFoto(client(), U, jpeg(1));
    const secondo = await cambiaFoto(client(), U, jpeg(2));
    if (primo.esito !== "ok" || secondo.esito !== "ok") throw new Error("atteso ok");

    expect(f.chiamate).toContain(`remove ${primo.percorso}`);
    expect(percorsiNelBucket()).toEqual([secondo.percorso]);
    expect(f.percorsoServer).toBe(secondo.percorso);
    expect(await byteDellaCopia()).toEqual([255, 216, 2]);
  });

  it("file non caricato → niente cambiato: né server, né copia, né file", async () => {
    const primo = await cambiaFoto(client(), U, jpeg(1));
    if (primo.esito !== "ok") throw new Error("atteso ok");
    f.chiamate = [];

    for (const guasto of ["errore", "eccezione"] as const) {
      f.uploadFallisce = guasto === "errore";
      f.uploadLancia = guasto === "eccezione";
      expect(await cambiaFoto(client(), U, jpeg(2))).toEqual({ esito: "caricamento-fallito" });
    }

    expect(f.chiamate.filter((c) => !c.startsWith("upload"))).toEqual([]);
    expect(f.percorsoServer).toBe(primo.percorso);
    expect(percorsiNelBucket()).toEqual([primo.percorso]);
    expect(await byteDellaCopia()).toEqual([255, 216, 1]);
  });

  it("impostazione fallita → resta un file in più, nessuna cancellazione; il cambio dopo lo toglie", async () => {
    const primo = await cambiaFoto(client(), U, jpeg(1));
    if (primo.esito !== "ok") throw new Error("atteso ok");

    for (const guasto of ["errore", "lancia", "file_mancante"] as const) {
      f.rpc = guasto;
      f.chiamate = [];
      expect(await cambiaFoto(client(), U, jpeg(2))).toEqual({ esito: "impostazione-fallita" });
      // Nessun remove: il file nuovo potrebbe già essere la foto valida.
      expect(f.chiamate.some((c) => c.startsWith("list") || c.startsWith("remove"))).toBe(false);
    }

    // Il server e la copia sono ancora quelli di prima; nel bucket, in
    // più, i tre file caricati dai tentativi falliti.
    expect(f.percorsoServer).toBe(primo.percorso);
    expect(await byteDellaCopia()).toEqual([255, 216, 1]);
    expect(f.file.size).toBe(4);

    f.rpc = "ok";
    const terzo = await cambiaFoto(client(), U, jpeg(3));
    if (terzo.esito !== "ok") throw new Error("atteso ok");
    expect(terzo.avanziRimasti).toBe(false);
    expect(percorsiNelBucket()).toEqual([terzo.percorso]);
  });

  it("risposta persa dopo un'impostazione riuscita: il file nuovo non si cancella, e l'aggiornamento lo trova", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    f.rpc = "ok-ma-risposta-persa";
    expect(await cambiaFoto(client(), U, jpeg(2))).toEqual({ esito: "impostazione-fallita" });

    // Sul server la foto è cambiata davvero, e il suo file c'è ancora.
    expect(f.file.has(f.percorsoServer!)).toBe(true);
    expect(await byteDellaCopia()).toEqual([255, 216, 1]);

    f.rpc = "ok";
    expect(await aggiornaMiaFoto(client(), U)).toBe("aggiornata");
    expect(await byteDellaCopia()).toEqual([255, 216, 2]);
  });

  it("cancellazione dei vecchi fallita → foto cambiata lo stesso, solo un avanzo", async () => {
    const primo = await cambiaFoto(client(), U, jpeg(1));
    if (primo.esito !== "ok") throw new Error("atteso ok");

    for (const guasto of ["remove", "list"] as const) {
      f.removeFallisce = guasto === "remove";
      f.listFallisce = guasto === "list";
      const esito = await cambiaFoto(client(), U, jpeg(2));
      expect(esito).toMatchObject({ esito: "ok", avanziRimasti: true });
      if (esito.esito !== "ok") return;
      expect(f.percorsoServer).toBe(esito.percorso);
      expect((await leggiFotoLocale(U))?.percorso).toBe(esito.percorso);
    }
    expect(f.file.has(primo.percorso)).toBe(true);

    // Il cambio dopo toglie gli avanzi.
    f.removeFallisce = false;
    f.listFallisce = false;
    const ultimo = await cambiaFoto(client(), U, jpeg(3));
    if (ultimo.esito !== "ok") throw new Error("atteso ok");
    expect(percorsiNelBucket()).toEqual([ultimo.percorso]);
  });
});

// --- Eliminare la foto ----------------------------------------------------

describe("eliminaFoto", () => {
  it("prima il server, poi i file, poi la copia", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    f.chiamate = [];

    expect(await eliminaFoto(client(), U)).toEqual({ esito: "ok", avanziRimasti: false });

    expect(f.chiamate[0]).toBe("rpc imposta_foto_profilo null");
    expect(f.chiamate[1]).toBe(`list ${U}`);
    expect(f.chiamate[2]).toMatch(/^remove /);
    expect(f.percorsoServer).toBeNull();
    expect(f.file.size).toBe(0);
    expect(await leggiFotoLocale(U)).toBeUndefined();
  });

  it("server fallito → niente cambiato: né file né copia", async () => {
    const primo = await cambiaFoto(client(), U, jpeg(1));
    if (primo.esito !== "ok") throw new Error("atteso ok");

    for (const guasto of ["errore", "lancia"] as const) {
      f.rpc = guasto;
      f.chiamate = [];
      expect(await eliminaFoto(client(), U)).toEqual({ esito: "fallito" });
      expect(f.chiamate.some((c) => c.startsWith("list") || c.startsWith("remove"))).toBe(false);
    }
    expect(f.percorsoServer).toBe(primo.percorso);
    expect(percorsiNelBucket()).toEqual([primo.percorso]);
    expect(await byteDellaCopia()).toEqual([255, 216, 1]);
  });

  it("file non cancellati → foto tolta lo stesso, copia tolta, avanzo segnalato", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    f.removeFallisce = true;

    expect(await eliminaFoto(client(), U)).toEqual({ esito: "ok", avanziRimasti: true });
    expect(f.percorsoServer).toBeNull();
    expect(f.file.size).toBe(1);
    expect(await leggiFotoLocale(U)).toBeUndefined();
  });
});

// --- Aggiornare la copia ------------------------------------------------------

describe("aggiornaMiaFoto", () => {
  // Una foto cambiata da un altro telefono: file nel bucket e percorso sul
  // server, senza passare da questo.
  function cambiataAltrove(byte: number): string {
    const percorso = `${U}/${crypto.randomUUID()}.jpg`;
    f.file.set(percorso, new Uint8Array([255, 216, byte]));
    f.percorsoServer = percorso;
    return percorso;
  }

  it("percorso diverso → scarica la foto nuova nella copia", async () => {
    const percorso = cambiataAltrove(7);

    expect(await aggiornaMiaFoto(client(), U)).toBe("aggiornata");
    expect((await leggiFotoLocale(U))?.percorso).toBe(percorso);
    expect(await byteDellaCopia()).toEqual([255, 216, 7]);
    const copia = await leggiFotoLocale(U);
    expect(blobDaFotoLocale(copia!).type).toBe("image/jpeg");
  });

  it("stesso percorso → non scarica niente", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    f.chiamate = [];

    expect(await aggiornaMiaFoto(client(), U)).toBe("invariata");
    expect(f.chiamate).toEqual(["select mia"]);
  });

  it("nessuna foto sul server → copia tolta; senza copia resta tutto com'è", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    f.percorsoServer = null;

    expect(await aggiornaMiaFoto(client(), U)).toBe("nessuna");
    expect(await leggiFotoLocale(U)).toBeUndefined();
    expect(await aggiornaMiaFoto(client(), U)).toBe("invariata");
  });

  it("server senza risposta → copia intatta, anche se il server dice altro", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    f.selectFallisce = true;
    f.percorsoServer = null;

    expect(await aggiornaMiaFoto(client(), U)).toBe("non-letta");
    expect(await byteDellaCopia()).toEqual([255, 216, 1]);
  });

  it("foto nuova non scaricata → copia vecchia intatta, riprova la volta dopo", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    cambiataAltrove(9);
    f.downloadFallisce = true;

    expect(await aggiornaMiaFoto(client(), U)).toBe("non-scaricata");
    expect(await byteDellaCopia()).toEqual([255, 216, 1]);

    f.downloadFallisce = false;
    expect(await aggiornaMiaFoto(client(), U)).toBe("aggiornata");
    expect(await byteDellaCopia()).toEqual([255, 216, 9]);
  });

  it("un cambio da questo telefono durante il download vince: la copia nuova non si riscrive", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    cambiataAltrove(5);
    let sblocca!: () => void;
    f.attesaDownload = new Promise((risolvi) => (sblocca = risolvi));

    const aggiornamento = aggiornaMiaFoto(client(), U);
    await finoAlDownload();
    // Mentre il download della foto "altrove" è appeso, l'utente cambia la
    // foto da qui.
    f.attesaDownload = null;
    const cambio = await cambiaFoto(client(), U, jpeg(6));
    if (cambio.esito !== "ok") throw new Error("atteso ok");
    sblocca();

    expect(await aggiornamento).toBe("cambiata-nel-frattempo");
    expect((await leggiFotoLocale(U))?.percorso).toBe(cambio.percorso);
    expect(await byteDellaCopia()).toEqual([255, 216, 6]);
  });

  it("una foto tolta da qui durante il download non torna", async () => {
    await cambiaFoto(client(), U, jpeg(1));
    cambiataAltrove(5);
    let sblocca!: () => void;
    f.attesaDownload = new Promise((risolvi) => (sblocca = risolvi));

    const aggiornamento = aggiornaMiaFoto(client(), U);
    await finoAlDownload();
    await db.foto_locale.delete(U); // come fa eliminaFoto dopo l'ok del server
    sblocca();

    expect(await aggiornamento).toBe("cambiata-nel-frattempo");
    expect(await leggiFotoLocale(U)).toBeUndefined();
  });
});

// --- Le foto degli amici ----------------------------------------------------

describe("indirizziFotoAmici", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  function amicoConFoto(id: string): string {
    const percorso = `${id}/${crypto.randomUUID()}.jpg`;
    f.file.set(percorso, new Uint8Array([255, 216]));
    f.righeAmici.push({ user_id: id, percorso });
    return percorso;
  }

  it("una sola chiamata allo Storage per tutti, valida un'ora; chi non ha foto resta fuori", async () => {
    const percorsoA = amicoConFoto(A);
    const percorsoB = amicoConFoto(B);
    f.righeAmici.push({ user_id: C, percorso: null });

    const indirizzi = await indirizziFotoAmici(client(), [A, B, C]);

    expect(indirizzi).toEqual({
      [A]: `https://firmato/${percorsoA}`,
      [B]: `https://firmato/${percorsoB}`,
    });
    expect(f.chiamate.filter((c) => c === "createSignedUrls")).toHaveLength(1);
    expect(f.firmeChieste[0].scadenza).toBe(SCADENZA_URL_FIRMATI_S);
    expect(SCADENZA_URL_FIRMATI_S).toBe(3600);
    expect(f.firmeChieste[0].percorsi.sort()).toEqual([percorsoA, percorsoB].sort());
  });

  it("nessun amico, o nessuno con la foto → nessuna chiamata allo Storage", async () => {
    expect(await indirizziFotoAmici(client(), [])).toEqual({});
    expect(f.chiamate).toEqual([]);

    f.righeAmici.push({ user_id: A, percorso: null });
    expect(await indirizziFotoAmici(client(), [A])).toEqual({});
    expect(f.chiamate).toEqual(["select amici"]);
  });

  it("lettura o firma fallita → nessuna foto, mai un errore", async () => {
    amicoConFoto(A);
    f.selectFallisce = true;
    expect(await indirizziFotoAmici(client(), [A])).toEqual({});

    f.selectFallisce = false;
    f.firmaFallisce = true;
    expect(await indirizziFotoAmici(client(), [A])).toEqual({});
  });

  it("un file che manca dà le iniziali solo a quell'amico", async () => {
    const percorsoA = amicoConFoto(A);
    f.righeAmici.push({ user_id: B, percorso: `${B}/${crypto.randomUUID()}.jpg` });

    expect(await indirizziFotoAmici(client(), [A, B])).toEqual({
      [A]: `https://firmato/${percorsoA}`,
    });
  });
});
