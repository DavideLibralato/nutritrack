// La foto nel file JSON (fotoEsportazione.ts; PUNTO_DI_PARTENZA.md §10.4).
// Sbaglia in silenzio: una foto che c'è ma viene scritta "assente", un
// server che non risponde e blocca l'esportazione, o un'esportazione che
// dice "verificata col server" quando ha usato una copia vecchia. Finti
// sono solo il server e lo Storage; aggiornaMiaFoto e la copia in Dexie
// sono quelli veri.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "../db/database";
import { base64DaByte, fotoPerEsportazione, TEMPO_MASSIMO_FOTO_MS } from "./fotoEsportazione";
import { costruisciEsportazione } from "./raccoltaDati";
import { testoJson, type RighePerTabella, type StatoFoto } from "./formatoEsportazione";

const VUOTO: RighePerTabella = {
  profili: [],
  obiettivi: [],
  obiettivi_target: [],
  giorni: [],
  pasti: [],
  alimenti: [],
  voci_diario: [],
  composizioni: [],
  composizioni_voci: [],
  misurazioni: [],
  preferiti: [],
};

const U = "11111111-1111-4111-8111-111111111111";
const VECCHIA = `${U}/vecchia.jpg`;
const NUOVA = `${U}/nuova.jpg`;
const TEMPO_PROVA_MS = 50;

type Risposta = "ok" | "errore" | "lancia" | "mai" | "lenta";

interface Server {
  percorso: string | null; // foto_profilo.percorso
  lettura: Risposta; // la select su foto_profilo
  download: Risposta;
  file: Map<string, Uint8Array<ArrayBuffer>>;
  chiamate: string[];
}

let s: Server;

// "lenta": la risposta arriva, ma solo dopo il tempo massimo — la rilascia
// afterEach, così non scrive la copia durante il test dopo.
let rilascia: (() => void)[] = [];

function attesa(risposta: Risposta): Promise<void> {
  if (risposta === "mai") return new Promise(() => {});
  if (risposta === "lenta") return new Promise((r) => rilascia.push(r));
  return Promise.resolve();
}

// Solo le due letture: nessun metodo per scrivere, così una scrittura sul
// server farebbe fallire il test.
function client(): SupabaseClient {
  return {
    from: (tabella: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            s.chiamate.push(`select ${tabella}`);
            await attesa(s.lettura);
            if (s.lettura === "lancia") throw new Error("Load failed");
            if (s.lettura === "errore") return { data: null, error: { message: "boom" } };
            return { data: s.percorso === null ? null : { percorso: s.percorso }, error: null };
          },
        }),
      }),
    }),
    storage: {
      from: () => ({
        download: async (percorso: string) => {
          s.chiamate.push(`download ${percorso}`);
          await attesa(s.download);
          if (s.download === "lancia") throw new Error("Load failed");
          const file = s.file.get(percorso);
          if (s.download === "errore" || !file) return { data: null, error: { message: "boom" } };
          return { data: new Blob([file], { type: "image/jpeg" }), error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

async function copiaSulTelefono(percorso: string, byte: number[]) {
  await db.foto_locale.put({
    user_id: U,
    percorso,
    byte: new Uint8Array(byte).buffer,
    tipo: "image/jpeg",
  });
}

const base64 = (byte: number[]) => base64DaByte(new Uint8Array(byte).buffer);

afterEach(async () => {
  for (const r of rilascia) r();
  rilascia = [];
  // Il tempo di finire per gli aggiornamenti arrivati tardi.
  await new Promise((r) => setTimeout(r, 20));
});

beforeEach(async () => {
  await db.foto_locale.clear();
  s = {
    percorso: null,
    lettura: "ok",
    download: "ok",
    file: new Map([
      [VECCHIA, new Uint8Array([255, 216, 1])],
      [NUOVA, new Uint8Array([255, 216, 2])],
    ]),
    chiamate: [],
  };
});

describe("il server risponde: foto verificata", () => {
  it("foto sul server e nessuna copia: la scarica, inclusa dal server", async () => {
    s.percorso = NUOVA;
    expect(await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS)).toEqual({
      statoFoto: { stato: "inclusa", origine: "server" },
      foto: { tipo: "image/jpeg", base64: base64([255, 216, 2]) },
    });
  });

  it("copia uguale al server: nessun download, inclusa dal server", async () => {
    s.percorso = VECCHIA;
    await copiaSulTelefono(VECCHIA, [255, 216, 1]);
    const esito = await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS);
    expect(esito.statoFoto).toEqual({ stato: "inclusa", origine: "server" });
    expect(esito.foto?.base64).toBe(base64([255, 216, 1]));
    expect(s.chiamate.some((c) => c.startsWith("download"))).toBe(false);
  });

  it("copia vecchia, foto nuova sul server: entra la nuova", async () => {
    s.percorso = NUOVA;
    await copiaSulTelefono(VECCHIA, [255, 216, 1]);
    const esito = await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS);
    expect(esito.statoFoto).toEqual({ stato: "inclusa", origine: "server" });
    expect(esito.foto?.base64).toBe(base64([255, 216, 2]));
  });

  it("il server dice nessuna foto: assente, anche con una copia vecchia sul telefono", async () => {
    await copiaSulTelefono(VECCHIA, [255, 216, 1]);
    expect(await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS)).toEqual({
      statoFoto: { stato: "assente" },
      foto: null,
    });
  });

  it("nessuna foto né sul server né sul telefono: assente", async () => {
    expect(await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS)).toEqual({
      statoFoto: { stato: "assente" },
      foto: null,
    });
  });
});

describe("il server non risponde: copia del telefono, o non inclusa", () => {
  for (const lettura of ["errore", "lancia", "mai", "lenta"] as const) {
    it(`lettura "${lettura}" con la copia: inclusa dal telefono`, async () => {
      s.lettura = lettura;
      s.percorso = NUOVA;
      await copiaSulTelefono(VECCHIA, [255, 216, 1]);
      const esito = await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS);
      expect(esito.statoFoto).toEqual({ stato: "inclusa", origine: "telefono" });
      expect(esito.foto?.base64).toBe(base64([255, 216, 1]));
    });

    it(`lettura "${lettura}" senza copia: non inclusa, mai "assente"`, async () => {
      s.lettura = lettura;
      expect(await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS)).toEqual({
        statoFoto: { stato: "non-inclusa" },
        foto: null,
      });
    });
  }

  for (const download of ["errore", "lancia", "mai", "lenta"] as const) {
    it(`Storage "${download}" sulla foto nuova, con la copia vecchia: inclusa dal telefono, la vecchia`, async () => {
      s.percorso = NUOVA;
      s.download = download;
      await copiaSulTelefono(VECCHIA, [255, 216, 1]);
      const esito = await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS);
      expect(esito.statoFoto).toEqual({ stato: "inclusa", origine: "telefono" });
      expect(esito.foto?.base64).toBe(base64([255, 216, 1]));
    });

    it(`Storage "${download}" senza copia: non inclusa`, async () => {
      s.percorso = NUOVA;
      s.download = download;
      expect(await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS)).toEqual({
        statoFoto: { stato: "non-inclusa" },
        foto: null,
      });
    });
  }

  it("un server che non risponde mai non blocca: si va avanti dopo il tempo massimo", async () => {
    s.lettura = "mai";
    const inizio = Date.now();
    await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS);
    expect(Date.now() - inizio).toBeLessThan(TEMPO_PROVA_MS * 5);
  });

  it("il tempo massimo dell'app è di 8 secondi", () => {
    expect(TEMPO_MASSIMO_FOTO_MS).toBe(8_000);
  });
});

describe("nel file JSON", () => {
  it("intestazione e byte, nei tre casi, e la foto riletta è identica", async () => {
    const casi: { prepara: () => Promise<void>; atteso: StatoFoto }[] = [
      {
        prepara: async () => void (s.percorso = NUOVA),
        atteso: { stato: "inclusa", origine: "server" },
      },
      { prepara: async () => void (s.percorso = null), atteso: { stato: "assente" } },
      { prepara: async () => void (s.lettura = "errore"), atteso: { stato: "non-inclusa" } },
    ];
    for (const { prepara, atteso } of casi) {
      await db.foto_locale.clear();
      s.lettura = "ok";
      await prepara();
      const { statoFoto, foto } = await fotoPerEsportazione(client(), U, TEMPO_PROVA_MS);
      const esportazione = costruisciEsportazione(VUOTO, U, {
        adesso: new Date("2026-11-07T19:45:00.000Z"),
        versioneApp: "0.1.0",
        build: "prova",
        fusoOrario: "Europe/Rome",
        ultimoContattoServer: null,
        statoFoto,
        foto,
      });
      const riletta = JSON.parse(testoJson(esportazione));
      expect(riletta.intestazione.foto).toEqual(atteso);
      if (atteso.stato === "inclusa") {
        expect(riletta.foto.tipo).toBe("image/jpeg");
        expect(Array.from(atob(riletta.foto.base64), (c) => c.charCodeAt(0))).toEqual([
          255, 216, 2,
        ]);
      } else {
        expect(riletta.foto).toBeNull();
      }
    }
  });
});

describe("base64DaByte", () => {
  it("tutti i 256 valori, e un file più grande di un pezzo, tornano uguali con atob", () => {
    const tutti = Array.from({ length: 256 }, (_, i) => i);
    const grande = Array.from({ length: 100_000 }, (_, i) => (i * 37) % 256);
    for (const byte of [tutti, grande, []]) {
      const riletto = Array.from(atob(base64(byte)), (c) => c.charCodeAt(0));
      expect(riletto).toEqual(byte);
    }
  });
});
