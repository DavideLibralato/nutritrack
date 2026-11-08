// La raccolta dei dati del file JSON (raccoltaDati.ts; PUNTO_DI_PARTENZA.md
// §10.4, "Esporta i miei dati"). Sbaglia in silenzio, e lo si scopre solo
// il giorno in cui serve il backup: una tabella mancante, una riga di un
// altro utente dentro il file, una riga cancellata che torna viva con
// Importa, una voce del diario che punta a un alimento che nel file non
// c'è. Si prova con Dexie vero (il finto IndexedDB dei test).

import { describe, it, expect, beforeEach } from "vitest";
import type {
  Alimento,
  Composizione,
  ComposizioneVoce,
  Giorno,
  Misurazione,
  Obiettivo,
  ObiettivoTarget,
  Pasto,
  Preferito,
  Profilo,
  RigaBase,
  VoceDiario,
} from "../db/tipi";
import { TABELLE_DISCESA } from "../sync/discesa";
import { segnaDiscesaCompleta } from "../sync/discesaCompleta";
import {
  costruisciEsportazione,
  raccogliEsportazione,
  type DatiContorno,
} from "./raccoltaDati";
import {
  NOME_FORMATO,
  VERSIONE_FORMATO,
  istanteConFuso,
  nomeFileDati,
  testoJson,
  type EsportazioneDati,
  type RighePerTabella,
} from "./formatoEsportazione";

const IO = "utente-io";
const ALTRO = "utente-altro";
const CANCELLATA = "2026-11-01T10:00:00.000Z";

// --- Righe di prova -------------------------------------------------------------

function base(userId: string | null, deletedAt: string | null = null): RigaBase {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    updated_at: "2026-11-07T08:00:00.000Z",
    deleted_at: deletedAt,
  };
}

const profilo = (u: string, d: string | null = null): Profilo => ({
  ...base(u, d),
  nome: null,
  sesso: "non_indicato",
  data_nascita: null,
  altezza_cm: 180,
  livello_attivita: "moderato",
  differenzia_giorni: false,
  giorni_allenamento_default: null,
});
const obiettivo = (u: string, d: string | null = null): Obiettivo => ({
  ...base(u, d),
  valido_dal: "2026-10-01",
  tipo: "mantenere",
  kcal: 2500,
  proteine_g: 150,
  carboidrati_g: 300,
  grassi_g: 80,
  peso_obiettivo: null,
});
const target = (u: string, obiettivoId: string, d: string | null = null): ObiettivoTarget => ({
  ...base(u, d),
  obiettivo_id: obiettivoId,
  tipo_giorno: "normale",
  kcal: 2500,
  proteine_g: 150,
  carboidrati_g: 300,
  grassi_g: 80,
});
const giorno = (u: string, d: string | null = null): Giorno => ({
  ...base(u, d),
  data: "2026-11-07",
  tipo_giorno: "normale",
});
const pasto = (u: string, d: string | null = null): Pasto => ({
  ...base(u, d),
  nome: "Pranzo",
  ora_inizio: "12:30",
  ordine: 2,
});
const alimento = (u: string | null, d: string | null = null, nome = "Mela"): Alimento => ({
  ...base(u, d),
  nome,
  marca: null,
  barcode: null,
  kcal_100g: 52,
  proteine_100g: 0.3,
  carboidrati_100g: 14,
  grassi_100g: 0.2,
  zuccheri_100g: null,
  fibre_100g: null,
  saturi_100g: null,
  sale_100g: null,
  porzione_default_g: 150,
  fonte: "manuale",
  verificato: false,
});
const voce = (u: string, alimentoId: string, d: string | null = null): VoceDiario => ({
  ...base(u, d),
  alimento_id: alimentoId,
  pasto_id: null,
  gruppo_id: null,
  quantita_g: 150,
  data: "2026-11-07",
  creato_il: "2026-11-07T12:40:00.000Z",
  consumato_alle: null,
  nome_alimento: "Mela",
  kcal_100g: 52,
  proteine_100g: 0.3,
  carboidrati_100g: 14,
  grassi_100g: 0.2,
});
const composizione = (u: string, d: string | null = null): Composizione => ({
  ...base(u, d),
  nome: "Colazione solita",
  tipo: "pasto_salvato",
  alimento_id: null,
});
const rigaComposizione = (
  u: string,
  composizioneId: string,
  alimentoId: string,
  d: string | null = null
): ComposizioneVoce => ({
  ...base(u, d),
  composizione_id: composizioneId,
  alimento_id: alimentoId,
  quantita_g: 100,
  ordine: 0,
});
const misurazione = (u: string, d: string | null = null): Misurazione => ({
  ...base(u, d),
  tipo: "peso",
  valore: 78.4,
  unita: "kg",
  data: "2026-11-07",
});
const preferito = (u: string, alimentoId: string, d: string | null = null): Preferito => ({
  ...base(u, d),
  alimento_id: alimentoId,
});

// Un dispositivo con, per ogni tabella, una riga viva e una cancellata
// dell'utente, e una riga viva di un altro utente.
function dispositivo() {
  const mio = {
    profilo: profilo(IO),
    obiettivo: obiettivo(IO),
    pasto: pasto(IO),
    alimento: alimento(IO),
    composizione: composizione(IO),
  };
  const suo = {
    profilo: profilo(ALTRO),
    obiettivo: obiettivo(ALTRO),
    alimento: alimento(ALTRO),
    composizione: composizione(ALTRO),
  };
  const vivi: RighePerTabella = {
    profili: [mio.profilo],
    obiettivi: [mio.obiettivo],
    obiettivi_target: [target(IO, mio.obiettivo.id)],
    giorni: [giorno(IO)],
    pasti: [mio.pasto],
    alimenti: [mio.alimento],
    voci_diario: [voce(IO, mio.alimento.id)],
    composizioni: [mio.composizione],
    composizioni_voci: [rigaComposizione(IO, mio.composizione.id, mio.alimento.id)],
    misurazioni: [misurazione(IO)],
    preferiti: [preferito(IO, mio.alimento.id)],
  };
  const cancellati: RighePerTabella = {
    profili: [profilo(IO, CANCELLATA)],
    obiettivi: [obiettivo(IO, CANCELLATA)],
    obiettivi_target: [target(IO, mio.obiettivo.id, CANCELLATA)],
    giorni: [giorno(IO, CANCELLATA)],
    pasti: [pasto(IO, CANCELLATA)],
    alimenti: [alimento(IO, CANCELLATA, "Pane vecchio")],
    voci_diario: [voce(IO, mio.alimento.id, CANCELLATA)],
    composizioni: [composizione(IO, CANCELLATA)],
    composizioni_voci: [rigaComposizione(IO, mio.composizione.id, mio.alimento.id, CANCELLATA)],
    misurazioni: [misurazione(IO, CANCELLATA)],
    preferiti: [preferito(IO, mio.alimento.id, CANCELLATA)],
  };
  const altrui: RighePerTabella = {
    profili: [suo.profilo],
    obiettivi: [suo.obiettivo],
    obiettivi_target: [target(ALTRO, suo.obiettivo.id)],
    giorni: [giorno(ALTRO)],
    pasti: [pasto(ALTRO)],
    alimenti: [suo.alimento],
    voci_diario: [voce(ALTRO, suo.alimento.id)],
    composizioni: [suo.composizione],
    composizioni_voci: [rigaComposizione(ALTRO, suo.composizione.id, suo.alimento.id)],
    misurazioni: [misurazione(ALTRO)],
    preferiti: [preferito(ALTRO, suo.alimento.id)],
  };
  return { vivi, cancellati, altrui, mio };
}

function unisci(...insiemi: RighePerTabella[]): RighePerTabella {
  const tutte = {} as Record<keyof RighePerTabella, RigaBase[]>;
  for (const { nome } of TABELLE_DISCESA) {
    tutte[nome] = insiemi.flatMap((i) => i[nome] as RigaBase[]);
  }
  return tutte as unknown as RighePerTabella;
}

async function scriviInDexie(righe: RighePerTabella) {
  for (const { nome, tabella } of TABELLE_DISCESA) {
    await tabella.bulkPut(righe[nome] as RigaBase[]);
  }
}

const ids = (righe: RigaBase[]) => righe.map((r) => r.id).sort();

const CONTORNO: DatiContorno = {
  adesso: new Date("2026-11-07T19:45:12.345Z"), // 20:45:12.345 a Roma
  versioneApp: "0.1.0",
  build: "1f150fc",
  fusoOrario: "Europe/Rome",
  ultimoContattoServer: "2026-11-07T19:40:00.000Z",
  statoFoto: { stato: "assente" },
  foto: null,
};

beforeEach(async () => {
  window.localStorage.clear();
  for (const { tabella } of TABELLE_DISCESA) await tabella.clear();
});

async function esportazionePronta(): Promise<EsportazioneDati> {
  const esito = await raccogliEsportazione(IO, CONTORNO);
  if (esito.esito !== "pronta") throw new Error(`raccolta non pronta: ${esito.esito}`);
  return esito.esportazione;
}

// --- Le righe dentro il file ------------------------------------------------------

describe("righe dell'utente, vive, di tutte le tabelle", () => {
  it("nel file ci sono tutte le righe vive dell'utente, tabella per tabella", async () => {
    const { vivi, cancellati, altrui } = dispositivo();
    await scriviInDexie(unisci(vivi, cancellati, altrui));
    segnaDiscesaCompleta(IO);

    const { dati } = await esportazionePronta();
    for (const { nome } of TABELLE_DISCESA) {
      expect(ids(dati[nome]), nome).toEqual(ids(vivi[nome]));
    }
  });

  it("nessuna riga di un altro utente, in nessuna sezione", async () => {
    const { vivi, cancellati, altrui } = dispositivo();
    await scriviInDexie(unisci(vivi, cancellati, altrui));
    segnaDiscesaCompleta(IO);

    const esportazione = await esportazionePronta();
    for (const [sezione, righe] of Object.entries(esportazione.dati)) {
      for (const riga of righe as RigaBase[]) {
        // null solo per il catalogo comune, nella sua sezione.
        if (sezione === "alimenti_comuni_citati") expect(riga.user_id).toBeNull();
        else expect(riga.user_id, sezione).toBe(IO);
      }
    }
    expect(testoJson(esportazione)).not.toContain(ALTRO);
  });

  it("nessuna riga cancellata fuori dalle sezioni dei cancellati citati", async () => {
    const { vivi, cancellati } = dispositivo();
    await scriviInDexie(unisci(vivi, cancellati));
    segnaDiscesaCompleta(IO);

    const { dati } = await esportazionePronta();
    for (const { nome } of TABELLE_DISCESA) {
      expect(dati[nome].every((r) => r.deleted_at === null), nome).toBe(true);
    }
    // L'alimento e il pasto cancellati di prova non sono citati da voci vive: fuori anche loro.
    expect(dati.alimenti_cancellati_citati).toEqual([]);
    expect(dati.pasti_cancellati_citati).toEqual([]);
  });

  it("le sezioni sono esattamente le tabelle di TABELLE_DISCESA più le tre dei citati", async () => {
    await scriviInDexie(dispositivo().vivi);
    segnaDiscesaCompleta(IO);

    const { dati } = await esportazionePronta();
    expect(Object.keys(dati).sort()).toEqual(
      [
        ...TABELLE_DISCESA.map((t) => t.nome),
        "alimenti_cancellati_citati",
        "pasti_cancellati_citati",
        "alimenti_comuni_citati",
      ].sort()
    );
  });
});

describe("gli alimenti cancellati e quelli del catalogo comune", () => {
  it("un alimento cancellato citato da una voce viva entra in alimenti_cancellati_citati, con il suo deleted_at", () => {
    const { vivi } = dispositivo();
    const panino = alimento(IO, CANCELLATA, "Panino");
    const nonCitato = alimento(IO, CANCELLATA, "Torta");
    const soloDaCancellata = alimento(IO, CANCELLATA, "Biscotti");
    const tutte = unisci(vivi, {
      ...vuoto(),
      alimenti: [panino, nonCitato, soloDaCancellata],
      voci_diario: [voce(IO, panino.id), voce(IO, soloDaCancellata.id, CANCELLATA)],
    });

    const { dati } = costruisciEsportazione(tutte, IO, CONTORNO);
    expect(dati.alimenti_cancellati_citati.map((a) => a.nome)).toEqual(["Panino"]);
    expect(dati.alimenti_cancellati_citati[0].deleted_at).toBe(CANCELLATA);
    // Non nella tabella degli alimenti vivi.
    expect(dati.alimenti.some((a) => a.id === panino.id)).toBe(false);
  });

  it("un alimento cancellato di un altro utente non entra, nemmeno se una mia voce lo cita", () => {
    // Telefono condiviso: in Dexie restano le righe dell'altro utente. Una
    // mia voce che punta al suo alimento non deve portarlo nel mio file.
    const suoCancellato = alimento(ALTRO, CANCELLATA, "Suo");
    const tutte = unisci(dispositivo().vivi, {
      ...vuoto(),
      alimenti: [suoCancellato],
      voci_diario: [voce(ALTRO, suoCancellato.id), voce(IO, suoCancellato.id)],
    });
    const { dati } = costruisciEsportazione(tutte, IO, CONTORNO);
    expect(dati.alimenti_cancellati_citati).toEqual([]);
    expect(dati.alimenti_comuni_citati).toEqual([]);
  });

  it("preferito e riga di pasto salvato su un alimento cancellato restano fuori, come nell'interfaccia", () => {
    const { vivi, mio } = dispositivo();
    const cancellato = alimento(IO, CANCELLATA, "Ritirato");
    const tutte = unisci(vivi, {
      ...vuoto(),
      alimenti: [cancellato],
      preferiti: [preferito(IO, cancellato.id)],
      composizioni_voci: [rigaComposizione(IO, mio.composizione.id, cancellato.id)],
    });

    const { dati } = costruisciEsportazione(tutte, IO, CONTORNO);
    expect(ids(dati.preferiti)).toEqual(ids(vivi.preferiti));
    expect(ids(dati.composizioni_voci)).toEqual(ids(vivi.composizioni_voci));
    // Non citato da voci: non entra nemmeno fra i cancellati citati.
    expect(dati.alimenti_cancellati_citati).toEqual([]);
  });

  it("una riga viva di un pasto salvato cancellato resta fuori", () => {
    const { vivi, mio } = dispositivo();
    const vecchio = composizione(IO, CANCELLATA);
    const tutte = unisci(vivi, {
      ...vuoto(),
      composizioni: [vecchio],
      composizioni_voci: [rigaComposizione(IO, vecchio.id, mio.alimento.id)],
    });
    const { dati } = costruisciEsportazione(tutte, IO, CONTORNO);
    expect(ids(dati.composizioni_voci)).toEqual(ids(vivi.composizioni_voci));
  });

  it("il catalogo comune: entra solo quello citato, nella sua sezione, mai fra gli alimenti propri", () => {
    const { vivi } = dispositivo();
    const comuneCitato = alimento(null, null, "Riso comune");
    const comuneNonCitato = alimento(null, null, "Pasta comune");
    const tutte = unisci(vivi, {
      ...vuoto(),
      alimenti: [comuneCitato, comuneNonCitato],
      preferiti: [preferito(IO, comuneCitato.id)],
    });

    const { dati } = costruisciEsportazione(tutte, IO, CONTORNO);
    expect(dati.alimenti_comuni_citati.map((a) => a.nome)).toEqual(["Riso comune"]);
    expect(dati.alimenti.every((a) => a.user_id === IO)).toBe(true);
    expect(dati.preferiti).toHaveLength(2);
  });

  it("un alimento proprio cancellato citato da un pasto salvato vivo (ricetta) entra in alimenti_cancellati_citati", () => {
    const { vivi } = dispositivo();
    const calcolato = alimento(IO, CANCELLATA, "Torta di mele");
    const ricetta: Composizione = { ...composizione(IO), tipo: "ricetta", alimento_id: calcolato.id };
    const tutte = unisci(vivi, { ...vuoto(), alimenti: [calcolato], composizioni: [ricetta] });

    const { dati } = costruisciEsportazione(tutte, IO, CONTORNO);
    expect(dati.alimenti_cancellati_citati.map((a) => a.nome)).toEqual(["Torta di mele"]);
    expect(dati.composizioni.some((c) => c.id === ricetta.id)).toBe(true);
  });
});

describe("i pasti cancellati citati", () => {
  it("un pasto proprio cancellato citato da una voce viva entra in pasti_cancellati_citati, con il suo deleted_at", () => {
    const { vivi, mio } = dispositivo();
    const chiuso = { ...pasto(IO, CANCELLATA), nome: "Merenda" };
    const nonCitato = { ...pasto(IO, CANCELLATA), nome: "Brunch" };
    const soloDaCancellata = { ...pasto(IO, CANCELLATA), nome: "Spuntino notte" };
    const tutte = unisci(vivi, {
      ...vuoto(),
      pasti: [chiuso, nonCitato, soloDaCancellata],
      voci_diario: [
        { ...voce(IO, mio.alimento.id), pasto_id: chiuso.id },
        { ...voce(IO, mio.alimento.id, CANCELLATA), pasto_id: soloDaCancellata.id },
      ],
    });

    const { dati } = costruisciEsportazione(tutte, IO, CONTORNO);
    expect(dati.pasti_cancellati_citati.map((p) => p.nome)).toEqual(["Merenda"]);
    expect(dati.pasti_cancellati_citati[0].deleted_at).toBe(CANCELLATA);
    expect(dati.pasti.some((p) => p.id === chiuso.id)).toBe(false);
  });

  it("un pasto cancellato di un altro utente non entra, nemmeno se una mia voce lo cita", () => {
    const { vivi, mio } = dispositivo();
    const suo = pasto(ALTRO, CANCELLATA);
    const tutte = unisci(vivi, {
      ...vuoto(),
      pasti: [suo],
      voci_diario: [
        { ...voce(ALTRO, mio.alimento.id), pasto_id: suo.id },
        { ...voce(IO, mio.alimento.id), pasto_id: suo.id },
      ],
    });
    expect(costruisciEsportazione(tutte, IO, CONTORNO).dati.pasti_cancellati_citati).toEqual([]);
  });
});

describe("i target di un obiettivo cancellato", () => {
  it("un target vivo su un obiettivo cancellato resta fuori, come in Oggi e in Obiettivi", () => {
    const { vivi } = dispositivo();
    const vecchio = obiettivo(IO, CANCELLATA);
    const tutte = unisci(vivi, {
      ...vuoto(),
      obiettivi: [vecchio],
      obiettivi_target: [target(IO, vecchio.id)],
    });
    const { dati } = costruisciEsportazione(tutte, IO, CONTORNO);
    expect(ids(dati.obiettivi_target)).toEqual(ids(vivi.obiettivi_target));
  });
});

// --- Integrità: le 7 foreign key di Supabase ---------------------------------------
//
// Ogni riferimento non nullo di una riga esportata deve trovare la sua riga
// dentro il file, nelle sezioni normali o in quelle dei citati: Importa
// riscrive le righe così come sono, e una foreign key senza la sua riga fa
// rifiutare la scrittura. L'elenco è quello di pg_constraint su Supabase
// (letto il 07/11): se si aggiunge una foreign key, si aggiunge qui.

const SEZIONI_ALIMENTI = ["alimenti", "alimenti_cancellati_citati", "alimenti_comuni_citati"] as const;
const CHIAVI_ESTERNE: { tabella: keyof RighePerTabella; campo: string; verso: readonly string[] }[] = [
  { tabella: "composizioni", campo: "alimento_id", verso: SEZIONI_ALIMENTI },
  { tabella: "composizioni_voci", campo: "alimento_id", verso: SEZIONI_ALIMENTI },
  { tabella: "composizioni_voci", campo: "composizione_id", verso: ["composizioni"] },
  { tabella: "obiettivi_target", campo: "obiettivo_id", verso: ["obiettivi"] },
  { tabella: "preferiti", campo: "alimento_id", verso: SEZIONI_ALIMENTI },
  { tabella: "voci_diario", campo: "alimento_id", verso: SEZIONI_ALIMENTI },
  { tabella: "voci_diario", campo: "pasto_id", verso: ["pasti", "pasti_cancellati_citati"] },
];

function riferimentiMancanti(esportazione: EsportazioneDati): string[] {
  const dati = esportazione.dati as unknown as Record<string, RigaBase[]>;
  const mancanti: string[] = [];
  for (const { tabella, campo, verso } of CHIAVI_ESTERNE) {
    const presenti = new Set(verso.flatMap((sezione) => dati[sezione].map((r) => r.id)));
    for (const riga of dati[tabella]) {
      const valore = (riga as unknown as Record<string, string | null>)[campo];
      if (valore !== null && !presenti.has(valore)) mancanti.push(`${tabella}.${campo} ${riga.id}`);
    }
  }
  return mancanti;
}

describe("integrità: ogni riferimento trova la sua riga nel file", () => {
  it("tutti i casi insieme; l'unico riferimento mancante è quello dichiarato del telefono condiviso", async () => {
    const { vivi, cancellati, altrui, mio } = dispositivo();

    // Riferimenti a righe cancellate, uno per foreign key.
    const alimentoRitirato = alimento(IO, CANCELLATA, "Panino");
    const pastoChiuso = { ...pasto(IO, CANCELLATA), nome: "Merenda" };
    const alimentoDellaRicetta = alimento(IO, CANCELLATA, "Torta");
    const ricetta: Composizione = { ...composizione(IO), tipo: "ricetta", alimento_id: alimentoDellaRicetta.id };
    const pastoSalvatoCancellato = composizione(IO, CANCELLATA);
    const obiettivoVecchio = obiettivo(IO, CANCELLATA);
    // Catalogo comune: uno vivo e uno cancellato, entrambi citati.
    const comuneVivo = alimento(null, null, "Riso comune");
    const comuneCancellato = alimento(null, CANCELLATA, "Farro comune");

    // Il telefono condiviso: una mia voce sull'alimento (cancellato) di un
    // altro utente. È l'eccezione dichiarata: resta un riferimento
    // mancante, e Importa dovrà metterlo a null o scartarlo.
    const alimentoDellAltro = alimento(ALTRO, CANCELLATA, "Suo");
    const voceTelefonoCondiviso = voce(IO, alimentoDellAltro.id);

    const extra: RighePerTabella = {
      ...vuoto(),
      alimenti: [alimentoRitirato, alimentoDellaRicetta, comuneVivo, comuneCancellato, alimentoDellAltro],
      pasti: [pastoChiuso],
      obiettivi: [obiettivoVecchio],
      obiettivi_target: [target(IO, obiettivoVecchio.id)],
      composizioni: [ricetta, pastoSalvatoCancellato],
      composizioni_voci: [
        rigaComposizione(IO, mio.composizione.id, alimentoRitirato.id),
        rigaComposizione(IO, pastoSalvatoCancellato.id, mio.alimento.id),
        rigaComposizione(IO, mio.composizione.id, comuneVivo.id),
      ],
      preferiti: [preferito(IO, alimentoRitirato.id), preferito(IO, comuneVivo.id)],
      voci_diario: [
        { ...voce(IO, alimentoRitirato.id), pasto_id: pastoChiuso.id },
        { ...voce(IO, comuneCancellato.id), pasto_id: mio.pasto.id },
        voceTelefonoCondiviso,
      ],
    };
    await scriviInDexie(unisci(vivi, cancellati, altrui, extra));
    segnaDiscesaCompleta(IO);

    const esportazione = await esportazionePronta();
    expect(riferimentiMancanti(esportazione)).toEqual([`voci_diario.alimento_id ${voceTelefonoCondiviso.id}`]);

    // E le righe che servivano ci sono davvero, ognuna nella sua sezione.
    const { dati } = esportazione;
    expect(dati.alimenti_cancellati_citati.map((a) => a.nome).sort()).toEqual(["Panino", "Torta"]);
    expect(dati.pasti_cancellati_citati.map((p) => p.nome)).toEqual(["Merenda"]);
    expect(dati.alimenti_comuni_citati.map((a) => a.nome).sort()).toEqual(["Farro comune", "Riso comune"]);
    expect(testoJson(esportazione)).not.toContain(ALTRO);
  });

  it("il dispositivo di base, senza casi limite: nessun riferimento mancante", async () => {
    const { vivi, cancellati, altrui } = dispositivo();
    await scriviInDexie(unisci(vivi, cancellati, altrui));
    segnaDiscesaCompleta(IO);
    expect(riferimentiMancanti(await esportazionePronta())).toEqual([]);
  });
});

// --- Intestazione e rilettura -----------------------------------------------------

describe("intestazione", () => {
  it("presente e completa, con i conteggi uguali alle righe", async () => {
    await scriviInDexie(dispositivo().vivi);
    segnaDiscesaCompleta(IO);

    const esportazione = await esportazionePronta();
    expect(esportazione.formato).toEqual({ nome: NOME_FORMATO, versione: VERSIONE_FORMATO });
    expect(esportazione.intestazione).toEqual({
      app: { versione: "0.1.0", build: "1f150fc" },
      esportato_il: "2026-11-07T20:45:12.345+01:00",
      fuso_orario: "Europe/Rome",
      giorno_locale: "2026-11-07",
      user_id: IO,
      ultimo_contatto_server: "2026-11-07T19:40:00.000Z",
      foto: { stato: "assente" },
      conteggi: {
        profili: 1,
        obiettivi: 1,
        obiettivi_target: 1,
        giorni: 1,
        pasti: 1,
        alimenti: 1,
        voci_diario: 1,
        composizioni: 1,
        composizioni_voci: 1,
        misurazioni: 1,
        preferiti: 1,
        alimenti_cancellati_citati: 0,
        pasti_cancellati_citati: 0,
        alimenti_comuni_citati: 0,
      },
    });
    for (const [sezione, righe] of Object.entries(esportazione.dati)) {
      expect(esportazione.intestazione.conteggi[sezione as keyof typeof esportazione.dati]).toBe(
        (righe as unknown[]).length
      );
    }
  });

  it("l'ora con il fuso: ora solare e ora legale", () => {
    expect(istanteConFuso(new Date("2026-11-07T19:45:12.345Z"))).toBe("2026-11-07T20:45:12.345+01:00");
    expect(istanteConFuso(new Date("2026-07-01T06:05:04.003Z"))).toBe("2026-07-01T08:05:04.003+02:00");
  });

  it("giorno locale e nome del file: dopo la mezzanotte di Roma è già il giorno dopo", () => {
    const adesso = new Date("2026-11-07T23:30:00.000Z"); // 00:30 dell'8/11 a Roma
    expect(nomeFileDati(adesso)).toBe("libra-dati-2026-11-08.json");
    const { intestazione } = costruisciEsportazione(unisci(dispositivo().vivi), IO, {
      ...CONTORNO,
      adesso,
    });
    expect(intestazione.giorno_locale).toBe("2026-11-08");
    expect(intestazione.esportato_il).toBe("2026-11-08T00:30:00.000+01:00");
  });
});

describe("rilettura", () => {
  it("JSON → parse: lo stesso contenuto, riga per riga", async () => {
    const { vivi } = dispositivo();
    // Testi con accenti, virgolette, a capo e un'emoji: devono tornare uguali.
    vivi.alimenti[0].nome = 'Caffè "lungo"\nd\'orzo ☕';
    vivi.alimenti[0].marca = "Città & Co.";
    await scriviInDexie(vivi);
    segnaDiscesaCompleta(IO);

    const esportazione = await esportazionePronta();
    const riletta = JSON.parse(testoJson(esportazione));
    expect(riletta).toEqual(esportazione);
    expect(riletta.dati.alimenti[0].nome).toBe('Caffè "lungo"\nd\'orzo ☕');
  });

  it("due esportazioni degli stessi dati danno lo stesso testo", async () => {
    await scriviInDexie(unisci(dispositivo().vivi, dispositivo().vivi));
    segnaDiscesaCompleta(IO);
    expect(testoJson(await esportazionePronta())).toBe(testoJson(await esportazionePronta()));
  });
});

// --- Copia locale incompleta -----------------------------------------------------

describe("senza il segno discesa completa non parte", () => {
  it("niente segno: copia-incompleta, anche con i dati in Dexie", async () => {
    await scriviInDexie(dispositivo().vivi);
    expect(await raccogliEsportazione(IO, CONTORNO)).toEqual({ esito: "copia-incompleta", manca: "non-scaricata" });
  });

  it("segno acceso ma nessun profilo vivo in Dexie: copia-incompleta", async () => {
    const { vivi } = dispositivo();
    await scriviInDexie({ ...vivi, profili: [] });
    segnaDiscesaCompleta(IO);
    expect(await raccogliEsportazione(IO, CONTORNO)).toEqual({ esito: "copia-incompleta", manca: "senza-profilo" });
  });

  it("il segno di un altro utente non basta", async () => {
    await scriviInDexie(dispositivo().vivi);
    segnaDiscesaCompleta(ALTRO);
    expect(await raccogliEsportazione(IO, CONTORNO)).toEqual({ esito: "copia-incompleta", manca: "non-scaricata" });
  });
});

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
