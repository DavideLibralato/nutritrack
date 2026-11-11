// Test permanenti del file del catalogo precaricato (PUNTO_DI_PARTENZA.md
// §10.1), generato da scripts/catalogo/generaCatalogo.mjs. Un errore qui
// non fa rumore: un alimento rinominato o con la porzione sbagliata
// rispetto alla lista approvata da Davide, un id cambiato (le copie già
// prese non si riconoscerebbero più come «Nei tuoi»), o un valore che il
// modulo dell'app rifiuterebbe, e la copia non si potrebbe più salvare.

import { describe, it, expect } from "vitest";
import catalogo from "./catalogoPrecaricato.json";
import lista from "../../../docs/catalogo/lista-approvata-2026-11-08.json";
import correzioni from "../../../docs/catalogo/correzioni.json";
import fileOdbl from "../../../public/catalogo/catalogo-open-food-facts-odbl.json";
import { leggiCodice } from "../barcode/codiceEan";
import { validaValoriAlimento } from "../inserimento/valoriAlimento";
import { numeroPerCampo } from "../numeriDecimali";
import { stessoProdotto } from "./doppioniAlimenti";

const FACOLTATIVI = ["zuccheri_100g", "fibre_100g", "saturi_100g", "sale_100g"] as const;

type AlimentoCatalogo = (typeof catalogo.alimenti)[number];
type VoceLista = (typeof lista.alimenti)[number] & { codice_ciqual?: string; barcode?: string };

const alimenti: AlimentoCatalogo[] = catalogo.alimenti;
const voci: VoceLista[] = lista.alimenti;

function campo(n: number | null): string {
  return n === null ? "" : numeroPerCampo(n, 2);
}

describe("catalogo precaricato: uguale alla lista approvata", () => {
  it("ha gli stessi 183 alimenti, nello stesso ordine", () => {
    expect(alimenti).toHaveLength(183);
    expect(alimenti).toHaveLength(voci.length);
  });

  it("nome, marca, porzione, categoria, origine e codice vengono dalla lista", () => {
    alimenti.forEach((a, i) => {
      const v = voci[i];
      expect({
        nome: a.nome,
        marca: a.marca,
        porzione: a.porzione_default_g,
        categoria: a.categoria,
        origine: a.origine,
        barcode: a.barcode,
      }).toEqual({
        nome: v.nome,
        marca: v.marca,
        porzione: v.porzione_default_g,
        categoria: v.categoria,
        origine: v.fonte,
        barcode: v.barcode ?? null,
      });
    });
  });

  it("l'id è ciqual:<codice> per gli sfusi e off:<codice a barre> per quelli di marca", () => {
    alimenti.forEach((a, i) => {
      const v = voci[i];
      expect(a.id).toBe(v.fonte === "ciqual" ? `ciqual:${v.codice_ciqual}` : `off:${v.barcode}`);
    });
  });

  it("gli id sono tutti diversi", () => {
    expect(new Set(alimenti.map((a) => a.id)).size).toBe(alimenti.length);
  });
});

describe("catalogo precaricato: valori che l'app accetta", () => {
  it("ogni alimento passa la validazione del modulo, compresi i quattro valori nascosti", () => {
    for (const a of alimenti) {
      const esito = validaValoriAlimento({
        kcal: campo(a.kcal_100g),
        proteine: campo(a.proteine_100g),
        carboidrati: campo(a.carboidrati_100g),
        grassi: campo(a.grassi_100g),
        porzione: campo(a.porzione_default_g),
        zuccheri: campo(a.zuccheri_100g),
        fibre: campo(a.fibre_100g),
        saturi: campo(a.saturi_100g),
        sale: campo(a.sale_100g),
      });
      expect({
        id: a.id,
        errori: esito.errori,
        mancanti: esito.mancanti,
        somma: esito.erroreSomma,
      }).toEqual({
        id: a.id,
        errori: {},
        mancanti: [],
        somma: null,
      });
      // Nessun arrotondamento nascosto: il valore è già quello che si
      // scrive (numeric(7,2)).
      expect(esito.valori).toMatchObject({
        kcal_100g: a.kcal_100g,
        proteine_100g: a.proteine_100g,
        carboidrati_100g: a.carboidrati_100g,
        grassi_100g: a.grassi_100g,
        porzione_default_g: a.porzione_default_g,
        zuccheri_100g: a.zuccheri_100g,
        fibre_100g: a.fibre_100g,
        saturi_100g: a.saturi_100g,
        sale_100g: a.sale_100g,
      });
    }
  });

  // "Modifica alimento" mostra il valore salvato con due decimali: una
  // copia con 386,36 kcal (Open Food Facts, calcolate dai kJ) lo
  // mostrerebbe così (Davide, 08/11).
  it("kcal intere; proteine, carboidrati e grassi con al massimo un decimale", () => {
    const fuori: string[] = [];
    for (const a of alimenti) {
      if (!Number.isInteger(a.kcal_100g)) fuori.push(`${a.id} kcal ${a.kcal_100g}`);
      for (const c of ["proteine_100g", "carboidrati_100g", "grassi_100g"] as const) {
        if (Math.round(a[c] * 10) / 10 !== a[c]) fuori.push(`${a.id} ${c} ${a[c]}`);
      }
    }
    expect(fuori).toEqual([]);
  });

  // Regola dello script (Davide, 08/11): un valore nascosto più grande
  // del suo totale diventa null, perché il modulo dell'app lo
  // rifiuterebbe. Il caso vero è l'avocado di Ciqual: carboidrati
  // «traces» (0) e zuccheri 0,4.
  it("nessun valore nascosto è più grande del suo totale: l'avocado ha gli zuccheri a null", () => {
    const fuori = alimenti.filter(
      (a) =>
        (a.zuccheri_100g !== null && a.zuccheri_100g > a.carboidrati_100g) ||
        (a.saturi_100g !== null && a.saturi_100g > a.grassi_100g)
    );
    expect(fuori.map((a) => a.id)).toEqual([]);
    const avocado = alimenti.find((a) => a.id === "ciqual:13004")!;
    expect({ carboidrati: avocado.carboidrati_100g, zuccheri: avocado.zuccheri_100g }).toEqual({
      carboidrati: 0,
      zuccheri: null,
    });
  });

  // La regola di coerenza dello script (Davide, 08/11), solo per Open
  // Food Facts: i valori li scrivono dei volontari, e le kcal possono non
  // tornare con i macro (Mozzarella Galbani: 184 kcal dall'API, 238 dai
  // macro). Ciqual no: aceto, birra e vino hanno acidi e alcol.
  it("Open Food Facts: kcal coerenti con 4·P + 4·C + 9·G + 2·fibre (scarto ≤ 15 kcal o 12%)", () => {
    const incoerenti = alimenti
      .filter((a) => a.origine === "off")
      .filter((a) => {
        const daiMacro =
          4 * a.proteine_100g +
          4 * a.carboidrati_100g +
          9 * a.grassi_100g +
          2 * (a.fibre_100g ?? 0);
        return Math.abs(a.kcal_100g - daiMacro) > Math.max(15, 0.12 * a.kcal_100g);
      })
      .map((a) => `${a.id} ${a.kcal_100g}`);
    expect(incoerenti).toEqual([]);
  });

  it("le correzioni di docs/catalogo/correzioni.json sono nel file", () => {
    const voci = Object.entries(correzioni.correzioni);
    expect(voci.length).toBeGreaterThan(0);
    for (const [id, correzione] of voci) {
      const a = alimenti.find((x) => x.id === id);
      expect({ id, ...a }).toMatchObject({ id, ...correzione.valori });
    }
  });

  it("ognuno dei quattro valori nascosti è pieno nella maggior parte degli alimenti", () => {
    for (const c of FACOLTATIVI) {
      const pieni = alimenti.filter((a) => a[c] !== null).length;
      expect({ campo: c, pieni: pieni > alimenti.length / 2 }).toEqual({ campo: c, pieni: true });
    }
  });

  it("i codici a barre sono validi e già nella forma dell'app", () => {
    for (const a of alimenti.filter((x) => x.barcode !== null)) {
      expect(leggiCodice(a.barcode!).codice).toBe(a.barcode);
    }
  });

  it("nel catalogo non ci sono due alimenti uguali (codice, oppure nome e marca)", () => {
    const doppi: string[] = [];
    alimenti.forEach((a, i) => {
      alimenti.slice(i + 1).forEach((b) => {
        if (stessoProdotto(a, b)) doppi.push(`${a.id} = ${b.id}`);
      });
    });
    expect(doppi).toEqual([]);
  });
});

// Il file pubblico con i prodotti di Open Food Facts (public/catalogo/,
// PUNTO_DI_PARTENZA.md §10.1, "Licenze"): l'ODbL chiede di offrire il
// database che ne ricaviamo. Deve essere proprio quello che l'app usa:
// un catalogo rigenerato senza rigenerare questo file offrirebbe un
// database diverso da quello in uso.
describe("catalogo precaricato: il file ODbL in public/catalogo/", () => {
  it("contiene esattamente i prodotti di Open Food Facts del catalogo, con gli stessi valori", () => {
    const attesi = alimenti
      .filter((a) => a.origine === "off")
      .map((a) => {
        const prodotto: Partial<AlimentoCatalogo> = { ...a };
        delete prodotto.id;
        delete prodotto.origine;
        return prodotto;
      });
    expect(fileOdbl.prodotti).toEqual(attesi);
    expect(fileOdbl.versione).toBe(catalogo.versione);
  });

  it("dice la licenza, la fonte e le correzioni fatte", () => {
    expect(fileOdbl.licenza).toContain("https://opendatacommons.org/licenses/odbl/1-0/");
    expect(fileOdbl.fonte).toContain("Open Food Facts");
    for (const id of Object.keys(correzioni.correzioni).filter((x) => x.startsWith("off:"))) {
      expect(fileOdbl.modifiche.some((m) => m.startsWith(id.slice(4)))).toBe(true);
    }
  });
});
