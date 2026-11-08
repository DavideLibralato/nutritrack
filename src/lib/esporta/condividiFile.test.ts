// Le strade per consegnare il file (condividiFile.ts; PUNTO_DI_PARTENZA.md
// §10.4, "Salvare il file su iPhone"). Sbaglia in silenzio: un download
// nell'app installata che apre il file senza ritorno, un foglio annullato
// contato come salvato, o una condivisione rifiutata perché qualcosa si è
// messo in mezzo fra il tocco e navigator.share(). Il browser è finto.

import { describe, it, expect, vi } from "vitest";
import {
  salvaFile,
  sceltaStrada,
  TIPO_CSV,
  TIPO_JSON,
  type AmbienteSalvataggio,
} from "./condividiFile";

const NOME_JSON = "libra-dati-2026-11-08.json";
const NOME_CSV = "libra-diario-2026-11-08.csv";

// Un browser che accetta nella condivisione solo i tipi indicati.
function ambiente(opzioni: {
  tipiCondivisibili?: string[] | null; // null = niente Web Share API
  installata?: boolean;
  conDownload?: boolean;
  share?: () => Promise<void>;
}) {
  const tipi = opzioni.tipiCondivisibili === undefined ? [TIPO_JSON, TIPO_CSV, "text/plain"] : opzioni.tipiCondivisibili;
  const share = vi.fn<(dati: { files: File[] }) => Promise<void>>(opzioni.share ?? (async () => {}));
  const scarica = vi.fn<(file: File) => void>();
  const amb: AmbienteSalvataggio = {
    canShare: tipi === null ? undefined : ({ files }) => files.every((f) => tipi.includes(f.type)),
    share: tipi === null ? undefined : share,
    installata: opzioni.installata ?? false,
    scarica: opzioni.conDownload === false ? undefined : scarica,
  };
  // Le spie a parte: amb.share e amb.scarica restano undefined quando il
  // browser finto non li ha.
  return { ...amb, spiaShare: share, spiaScarica: scarica };
}

function errore(nome: string): Error {
  const e = new Error(nome);
  e.name = nome;
  return e;
}

describe("la scelta della strada", () => {
  it("il tipo vero accettato: condivisione con application/json", async () => {
    const strada = sceltaStrada(ambiente({}), NOME_JSON, '{"a":1}', TIPO_JSON);
    expect(strada.tipo).toBe("condividi");
    if (strada.tipo !== "condividi") return;
    expect(strada.file.type).toBe(TIPO_JSON);
    expect(strada.file.name).toBe(NOME_JSON);
    expect(await strada.file.text()).toBe('{"a":1}');
  });

  it("il tipo vero rifiutato, text/plain accettato: stesso file come text/plain, stessa estensione", async () => {
    for (const [nome, tipo] of [
      [NOME_JSON, TIPO_JSON],
      [NOME_CSV, TIPO_CSV],
    ] as const) {
      const strada = sceltaStrada(ambiente({ tipiCondivisibili: ["text/plain"] }), nome, "dentro", tipo);
      expect(strada.tipo, nome).toBe("condividi");
      if (strada.tipo !== "condividi") return;
      expect(strada.file.type).toBe("text/plain");
      expect(strada.file.name).toBe(nome);
      expect(await strada.file.text()).toBe("dentro");
    }
  });

  it("CSV con text/csv accettato: condivisione con text/csv", () => {
    const strada = sceltaStrada(ambiente({}), NOME_CSV, "x", TIPO_CSV);
    expect(strada.tipo === "condividi" && strada.file.type).toBe(TIPO_CSV);
  });

  it("nessun tipo accettato, app installata: niente download, impossibile con il motivo", () => {
    for (const tipiCondivisibili of [[], null]) {
      const amb = ambiente({ tipiCondivisibili, installata: true });
      expect(sceltaStrada(amb, NOME_JSON, "x", TIPO_JSON)).toEqual({ tipo: "impossibile", motivo: "app-installata" });
    }
  });

  it("nessun tipo accettato, fuori dall'app installata: download con il tipo vero", () => {
    for (const tipiCondivisibili of [[], null]) {
      const strada = sceltaStrada(ambiente({ tipiCondivisibili }), NOME_JSON, "x", TIPO_JSON);
      expect(strada.tipo).toBe("scarica");
      if (strada.tipo !== "scarica") return;
      expect(strada.file.type).toBe(TIPO_JSON);
      expect(strada.file.name).toBe(NOME_JSON);
    }
  });

  it("niente condivisione e niente download: non supportato", () => {
    const amb = ambiente({ tipiCondivisibili: null, conDownload: false });
    expect(sceltaStrada(amb, NOME_JSON, "x", TIPO_JSON)).toEqual({ tipo: "impossibile", motivo: "non-supportato" });
  });

  it("canShare che lancia vale come un no", () => {
    const amb: AmbienteSalvataggio = {
      canShare: () => {
        throw new TypeError("files non supportati");
      },
      share: async () => {},
      installata: true,
    };
    expect(sceltaStrada(amb, NOME_JSON, "x", TIPO_JSON)).toEqual({ tipo: "impossibile", motivo: "app-installata" });
  });
});

describe("salvaFile", () => {
  it("condivisione riuscita: salvato", async () => {
    const amb = ambiente({});
    expect(await salvaFile(amb, NOME_JSON, "x", TIPO_JSON)).toEqual({ esito: "salvato", strada: "condividi" });
    expect(amb.spiaShare).toHaveBeenCalledTimes(1);
    expect(amb.spiaScarica).not.toHaveBeenCalled();
  });

  it("foglio chiuso senza scegliere (AbortError): annullato", async () => {
    const amb = ambiente({ share: async () => Promise.reject(errore("AbortError")) });
    expect(await salvaFile(amb, NOME_JSON, "x", TIPO_JSON)).toEqual({ esito: "annullato" });
  });

  it("condivisione rifiutata per un altro motivo: errore con il nome", async () => {
    const amb = ambiente({ share: async () => Promise.reject(errore("NotAllowedError")) });
    expect(await salvaFile(amb, NOME_JSON, "x", TIPO_JSON)).toEqual({ esito: "errore", nome: "NotAllowedError" });
  });

  it("rifiuto con un oggetto che non è un Error (DOMException di Safari): il nome conta lo stesso", async () => {
    const annullato = ambiente({ share: () => Promise.reject({ name: "AbortError", message: "Share canceled" }) });
    expect(await salvaFile(annullato, NOME_JSON, "x", TIPO_JSON)).toEqual({ esito: "annullato" });

    const rifiutato = ambiente({ share: () => Promise.reject({ name: "NotAllowedError" }) });
    expect(await salvaFile(rifiutato, NOME_JSON, "x", TIPO_JSON)).toEqual({ esito: "errore", nome: "NotAllowedError" });
  });

  it("rifiuto senza un nome leggibile: errore \"Error\"", async () => {
    for (const motivo of [undefined, null, "testo", { name: 42 }, { name: "" }]) {
      const amb = ambiente({ share: () => Promise.reject(motivo) });
      expect(await salvaFile(amb, NOME_JSON, "x", TIPO_JSON), String(motivo)).toEqual({ esito: "errore", nome: "Error" });
    }
  });

  it("il download che lancia un oggetto con il nome: errore con quel nome", async () => {
    const amb = ambiente({ tipiCondivisibili: null });
    amb.spiaScarica.mockImplementation(() => {
      throw { name: "SecurityError" };
    });
    expect(await salvaFile(amb, NOME_JSON, "x", TIPO_JSON)).toEqual({ esito: "errore", nome: "SecurityError" });
  });

  it("share parte subito, senza attese fra il tocco e la condivisione", () => {
    const amb = ambiente({});
    void salvaFile(amb, NOME_JSON, "x", TIPO_JSON);
    // Nessun await qui: se salvaFile aspettasse qualcosa prima di share,
    // a questo punto share non sarebbe ancora stato chiamato.
    expect(amb.spiaShare).toHaveBeenCalledTimes(1);
  });

  it("download: salvato con la strada scarica, il file passato al link", async () => {
    const amb = ambiente({ tipiCondivisibili: null });
    expect(await salvaFile(amb, NOME_CSV, "a;b", TIPO_CSV)).toEqual({ esito: "salvato", strada: "scarica" });
    const file = amb.spiaScarica.mock.calls[0][0] as File;
    expect(file.name).toBe(NOME_CSV);
    expect(await file.text()).toBe("a;b");
  });

  it("app installata senza condivisione: impossibile, e il download non parte", async () => {
    const amb = ambiente({ tipiCondivisibili: [], installata: true });
    expect(await salvaFile(amb, NOME_JSON, "x", TIPO_JSON)).toEqual({ esito: "impossibile", motivo: "app-installata" });
    expect(amb.spiaScarica).not.toHaveBeenCalled();
  });
});
