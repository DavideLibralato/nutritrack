// Il CSV del diario (diarioCsv.ts; PUNTO_DI_PARTENZA.md §10.4). Sbaglia in
// silenzio: una voce in meno rispetto al JSON, kcal diverse da quelle di
// Oggi, un nome con ";" che sposta tutte le colonne, accenti illeggibili
// in Excel, o un nome alimento che Excel esegue come formula. Si rilegge
// il testo con un lettore CSV scritto qui, che fa come Excel: ";" come
// separatore, virgolette doppie raddoppiate.

import { describe, it, expect } from "vitest";
import type { Alimento, Pasto, VoceDiario } from "../db/tipi";
import { totaleVoce } from "../totaliDiario";
import { costruisciEsportazione, type DatiContorno } from "./raccoltaDati";
import type { DatiEsportati, RighePerTabella } from "./formatoEsportazione";
import { INTESTAZIONE_CSV, nomeFileDiario, righeDiario, testoCsv, testoSicuro } from "./diarioCsv";

const IO = "utente-io";
const ALTRO = "utente-altro";
const CANCELLATA = "2026-11-01T10:00:00.000Z";

function pasto(nome: string, ora: string, deletedAt: string | null = null, userId = IO): Pasto {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: deletedAt,
    nome,
    ora_inizio: ora,
    ordine: 0,
  };
}

function alimento(nome: string, marca: string | null, deletedAt: string | null = null, userId: string | null = IO): Alimento {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: deletedAt,
    nome,
    marca,
    barcode: null,
    kcal_100g: 52,
    proteine_100g: 0.3,
    carboidrati_100g: 14,
    grassi_100g: 0.2,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
  };
}

function voce(
  a: Alimento,
  p: Pasto | null,
  campi: Partial<VoceDiario> = {}
): VoceDiario {
  return {
    id: crypto.randomUUID(),
    user_id: IO,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: null,
    alimento_id: a.id,
    pasto_id: p?.id ?? null,
    gruppo_id: null,
    quantita_g: 100,
    data: "2026-11-07",
    creato_il: "2026-11-07T12:40:00.000Z",
    consumato_alle: null,
    nome_alimento: a.nome,
    kcal_100g: a.kcal_100g,
    proteine_100g: a.proteine_100g,
    carboidrati_100g: a.carboidrati_100g,
    grassi_100g: a.grassi_100g,
    ...campi,
  };
}

function vuoto(): RighePerTabella {
  return {
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
}

const CONTORNO: DatiContorno = {
  adesso: new Date("2026-11-07T19:45:00.000Z"),
  versioneApp: "0.1.0",
  build: "prova",
  fusoOrario: "Europe/Rome",
  ultimoContattoServer: null,
  statoFoto: { stato: "assente" },
  foto: null,
};

// Le righe dalla raccolta vera del JSON: il CSV deve partire da lì.
function dati(tutte: RighePerTabella): DatiEsportati {
  return costruisciEsportazione(tutte, IO, CONTORNO).dati;
}

// Lettore CSV come Excel: ";" separa, le virgolette racchiudono un campo
// (anche con a capo dentro), "" dentro le virgolette è una virgoletta.
function leggiCsv(testo: string): string[][] {
  const righe: string[][] = [];
  let riga: string[] = [];
  let campo = "";
  let tra = false;
  for (let i = 0; i < testo.length; i++) {
    const c = testo[i];
    if (tra) {
      if (c === '"' && testo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') tra = false;
      else campo += c;
    } else if (c === '"') tra = true;
    else if (c === ";") {
      riga.push(campo);
      campo = "";
    } else if (c === "\r" && testo[i + 1] === "\n") {
      riga.push(campo);
      righe.push(riga);
      riga = [];
      campo = "";
      i++;
    } else campo += c;
  }
  if (campo !== "" || riga.length > 0) righe.push([...riga, campo]);
  return righe;
}

function senzaBom(testo: string): string {
  expect(testo.charCodeAt(0)).toBe(0xfeff);
  return testo.slice(1);
}

describe("le stesse voci del JSON", () => {
  it("una riga per ogni voce viva del JSON, nessuna di più, nessuna cancellata o di altri", () => {
    const pranzo = pasto("Pranzo", "12:30");
    const mela = alimento("Mela", null);
    const vive = [voce(mela, pranzo), voce(mela, pranzo, { data: "2026-11-06" })];
    const tutte: RighePerTabella = {
      ...vuoto(),
      pasti: [pranzo],
      alimenti: [mela],
      voci_diario: [
        ...vive,
        voce(mela, pranzo, { deleted_at: CANCELLATA }),
        voce(mela, pranzo, { user_id: ALTRO }),
      ],
    };
    const d = dati(tutte);

    expect(righeDiario(d).map((r) => r.voceId).sort()).toEqual(d.voci_diario.map((v) => v.id).sort());
    expect(righeDiario(d).map((r) => r.voceId).sort()).toEqual(vive.map((v) => v.id).sort());
    // Intestazione più una riga per voce.
    expect(leggiCsv(senzaBom(testoCsv(d)))).toHaveLength(1 + vive.length);
  });

  it("diario vuoto: solo l'intestazione", () => {
    const righe = leggiCsv(senzaBom(testoCsv(dati(vuoto()))));
    expect(righe).toEqual([[...INTESTAZIONE_CSV]]);
  });
});

describe("i calcoli, come in Oggi", () => {
  it("kcal come la riga di Oggi (Math.round di totaleVoce), macro a un decimale, grammi come salvati", () => {
    const a = { ...alimento("Riso", null), kcal_100g: 52, proteine_100g: 0.3, carboidrati_100g: 14, grassi_100g: 0.25 };
    const v = voce(a, null, { quantita_g: 134.5 });
    const [riga] = righeDiario(dati({ ...vuoto(), alimenti: [a], voci_diario: [v] }));
    const [, , , , , grammi, kcal, proteine, carboidrati, grassi] = riga.campi;

    // 52 × 1,345 = 69,94 → 70 (arrotondato, non troncato), come
    // Math.round(totaleVoce(voce).kcal) in Oggi.
    expect(kcal).toBe(String(Math.round(totaleVoce(v).kcal)));
    expect(kcal).toBe("70");
    expect(grammi).toBe("134,5");
    expect(proteine).toBe("0,4"); // 0,4035
    expect(carboidrati).toBe("18,8"); // 18,83
    expect(grassi).toBe("0,3"); // 0,33625
  });

  it("i valori sono quelli copiati sulla voce, non quelli di oggi dell'alimento", () => {
    const a = alimento("Pane", null);
    const v = voce(a, null, { kcal_100g: 260 });
    a.kcal_100g = 999; // corretto dopo nel catalogo: la storia non cambia
    const [riga] = righeDiario(dati({ ...vuoto(), alimenti: [a], voci_diario: [v] }));
    expect(riga.campi[6]).toBe("260");
  });

  it("niente punto delle migliaia: 12.500 g resta 12500", () => {
    const a = alimento("Acqua", null);
    const v = voce(a, null, { quantita_g: 12500, kcal_100g: 0, proteine_100g: 0, carboidrati_100g: 0, grassi_100g: 0 });
    const [riga] = righeDiario(dati({ ...vuoto(), alimenti: [a], voci_diario: [v] }));
    expect(riga.campi[5]).toBe("12500");
    expect(riga.campi.slice(6)).toEqual(["0", "0", "0", "0"]);
  });
});

describe("data, pasto, ora, marca e ordine", () => {
  it("data all'italiana, ora locale del consumo, vuota se manca", () => {
    const a = alimento("Mela", null);
    const tutte = {
      ...vuoto(),
      alimenti: [a],
      voci_diario: [
        voce(a, null, { consumato_alle: "2026-11-07T11:40:00.000Z" }), // 12:40 a Roma
        voce(a, null, { consumato_alle: null, creato_il: "2026-11-07T13:00:00.000Z" }),
      ],
    };
    const righe = righeDiario(dati(tutte));
    expect(righe.map((r) => [r.campi[0], r.campi[2]])).toEqual([
      ["07/11/2026", "12:40"],
      ["07/11/2026", ""],
    ]);
  });

  it("il nome del pasto anche da un pasto cancellato citato; la marca anche da un alimento cancellato citato o comune", () => {
    const chiuso = pasto("Merenda", "17:00", CANCELLATA);
    const ritirato = alimento("Panino", "Forno Rossi", CANCELLATA);
    const comune = alimento("Riso", "Comune Spa", null, null);
    const tutte = {
      ...vuoto(),
      pasti: [chiuso],
      alimenti: [ritirato, comune],
      voci_diario: [voce(ritirato, chiuso), voce(comune, null, { creato_il: "2026-11-07T18:00:00.000Z" })],
    };
    const righe = righeDiario(dati(tutte));
    expect(righe.map((r) => [r.campi[1], r.campi[3], r.campi[4]])).toEqual([
      ["Merenda", "Panino", "Forno Rossi"],
      ["", "Riso", "Comune Spa"],
    ]);
  });

  it("telefono condiviso: la voce su un alimento di un altro utente resta, senza la sua marca", () => {
    const suo = alimento("Suo", "Marca dell'altro", null, ALTRO);
    const d = dati({ ...vuoto(), alimenti: [suo], voci_diario: [voce(suo, null)] });
    const testo = testoCsv(d);
    expect(righeDiario(d)[0].campi[3]).toBe("Suo");
    expect(righeDiario(d)[0].campi[4]).toBe("");
    expect(testo).not.toContain("Marca dell'altro");
  });

  it("ordine: giorno, poi pasto per orario come in Oggi, poi ora di inserimento", () => {
    const colazione = pasto("Colazione", "07:00");
    const cena = pasto("Cena", "19:30");
    const a = alimento("Mela", null);
    const tutte = {
      ...vuoto(),
      pasti: [cena, colazione],
      alimenti: [a],
      voci_diario: [
        voce(a, cena, { nome_alimento: "C2", creato_il: "2026-11-07T19:10:00.000000+00:00" }),
        voce(a, null, { nome_alimento: "Senza pasto" }),
        // Le 19:05 UTC scritte con un altro fuso: come testo verrebbero dopo le
        // 19:10, come istante vengono prima.
        voce(a, cena, { nome_alimento: "C1", creato_il: "2026-11-07T20:05:00+01:00" }),
        voce(a, colazione, { nome_alimento: "K", data: "2026-11-08" }),
        voce(a, colazione, { nome_alimento: "A" }),
      ],
    };
    expect(righeDiario(dati(tutte)).map((r) => r.campi[3])).toEqual(["A", "C1", "C2", "Senza pasto", "K"]);
  });
});

describe("caratteri speciali e formule", () => {
  it("; virgolette, a capo e accenti tornano uguali dopo la rilettura, colonne al loro posto", () => {
    const p = pasto('Pranzo; "lungo"', "12:30");
    const a = alimento('Caffè "ristretto"; d\'orzo\nperò', "Città & Co.");
    const tutte = { ...vuoto(), pasti: [p], alimenti: [a], voci_diario: [voce(a, p)] };
    const [, riga] = leggiCsv(senzaBom(testoCsv(dati(tutte))));
    expect(riga).toHaveLength(INTESTAZIONE_CSV.length);
    expect(riga[1]).toBe('Pranzo; "lungo"');
    expect(riga[3]).toBe('Caffè "ristretto"; d\'orzo\nperò');
    expect(riga[4]).toBe("Città & Co.");
  });

  it("formule: apostrofo davanti a pasto, alimento e marca che cominciano con = + - @", () => {
    const p = pasto("=SOMMA(A1)", "12:30");
    const a = alimento("+39 cracker", "@marca");
    const b = alimento("-light", "=HYPERLINK(\"x\")");
    const tutte = {
      ...vuoto(),
      pasti: [p],
      alimenti: [a, b],
      voci_diario: [voce(a, p), voce(b, p, { creato_il: "2026-11-07T13:00:00.000Z" })],
    };
    const [, prima, seconda] = leggiCsv(senzaBom(testoCsv(dati(tutte))));
    expect([prima[1], prima[3], prima[4]]).toEqual(["'=SOMMA(A1)", "'+39 cracker", "'@marca"]);
    expect([seconda[1], seconda[3], seconda[4]]).toEqual(["'=SOMMA(A1)", "'-light", "'=HYPERLINK(\"x\")"]);
  });

  it("testoSicuro lascia stare il resto, anche un = in mezzo", () => {
    expect(testoSicuro("Mela")).toBe("Mela");
    expect(testoSicuro("1 = uno")).toBe("1 = uno");
    expect(testoSicuro("")).toBe("");
    expect(testoSicuro("\tTab")).toBe("'\tTab");
  });

  it("BOM UTF-8 in testa, righe chiuse da CRLF, intestazione in italiano", () => {
    const testo = testoCsv(dati(vuoto()));
    expect(testo.startsWith("﻿Data;Pasto;Ora;Alimento;Marca;Grammi;Kcal;Proteine (g);Carboidrati (g);Grassi (g)\r\n")).toBe(true);
    expect(testo.endsWith("\r\n")).toBe(true);
  });
});

describe("nome del file", () => {
  it("dal giorno locale: dopo la mezzanotte di Roma è già il giorno dopo", () => {
    expect(nomeFileDiario(new Date("2026-11-07T19:45:00.000Z"))).toBe("libra-diario-2026-11-07.csv");
    expect(nomeFileDiario(new Date("2026-11-07T23:30:00.000Z"))).toBe("libra-diario-2026-11-08.csv");
  });
});
