// Ricerca di Aggiungi nei pasti salvati (cercaPastiSalvati). Logica che
// sbaglia in silenzio: un pasto trovato per l'alimento sbagliato, o con
// "Contiene" quando la parola è già nel nome, o un pasto che compare per un
// alimento cancellato, non dà nessun errore — si vede solo una riga strana
// in ricerca. I pasti si costruiscono con pastiSalvati, come nella pagina,
// così il caso "alimento uscito dal catalogo" passa dal filtro vero.

import { describe, it, expect } from "vitest";
import { cercaPastiSalvati, testoContiene } from "./ricercaPastiSalvati";
import { pastiSalvati } from "./pastiSalvati";
import type { Alimento, Composizione, ComposizioneVoce } from "../db/tipi";

const BASE = { user_id: "u1", updated_at: "2026-11-06T00:00:00.000Z", deleted_at: null };

function alimento(id: string, nome: string, marca: string | null = null): Alimento {
  return {
    ...BASE,
    id,
    nome,
    marca,
    barcode: null,
    kcal_100g: 100,
    proteine_100g: 1,
    carboidrati_100g: 10,
    grassi_100g: 1,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
  };
}

// Un pasto: nome e alimenti con il loro `ordine`, nell'ordine in cui le
// righe vengono scritte (che può non essere l'ordine del pasto).
interface Pasto {
  id: string;
  nome: string;
  righe: [alimentoId: string, ordine: number][];
}

function costruisci(catalogo: Alimento[], pasti: Pasto[]) {
  const composizioni: Composizione[] = pasti.map((p) => ({
    ...BASE,
    id: p.id,
    nome: p.nome,
    tipo: "pasto_salvato",
    alimento_id: null,
  }));
  const voci: ComposizioneVoce[] = pasti.flatMap((p) =>
    p.righe.map(([alimentoId, ordine]) => ({
      ...BASE,
      id: `${p.id}-${ordine}`,
      composizione_id: p.id,
      alimento_id: alimentoId,
      quantita_g: 50,
      ordine,
    }))
  );
  return pastiSalvati(catalogo, composizioni, voci);
}

// Nome del pasto e "Contiene", il minimo per leggere il risultato.
function cerca(catalogo: Alimento[], pasti: Pasto[], query: string) {
  return cercaPastiSalvati(costruisci(catalogo, pasti), query).map((t) => [
    t.pasto.nome,
    t.contiene,
  ]);
}

const RISO_BASMATI = alimento("riso-basmati", "Riso basmati");
const TONNO = alimento("tonno", "Tonno al naturale");
const YOGURT = alimento("yogurt", "Yogurt greco");
const GALLETTE = alimento("gallette", "Gallette di riso");
const CAFFE = alimento("caffe", "Caffè");
const CATALOGO = [RISO_BASMATI, TONNO, YOGURT, GALLETTE, CAFFE];

describe("cercaPastiSalvati", () => {
  it("parola nel nome del pasto: trovato, senza «Contiene» anche se c'è in un alimento", () => {
    const pasti = [{ id: "p1", nome: "Riso e tonno", righe: [["riso-basmati", 0], ["tonno", 1]] }] satisfies Pasto[];
    expect(cerca(CATALOGO, pasti, "riso")).toEqual([["Riso e tonno", null]]);
  });

  it("parola solo in un alimento: trovato, con «Contiene» e il nome dell'alimento come nel catalogo", () => {
    const pasti = [{ id: "p1", nome: "Colazione proteica", righe: [["yogurt", 0], ["gallette", 1]] }] satisfies Pasto[];
    expect(cerca(CATALOGO, pasti, "riso")).toEqual([["Colazione proteica", "Gallette di riso"]]);
  });

  it("più alimenti con la parola: il primo nell'ordine del pasto, non in quello delle righe", () => {
    // Le righe arrivano con ordine 1 prima di ordine 0: conta `ordine`.
    const pasti = [{ id: "p1", nome: "Colazione", righe: [["gallette", 1], ["riso-basmati", 0]] }] satisfies Pasto[];
    expect(cerca(CATALOGO, pasti, "riso")).toEqual([["Colazione", "Riso basmati"]]);
  });

  it("maiuscole, accenti e spazi indifferenti, come la ricerca degli alimenti", () => {
    const pasti = [
      { id: "p1", nome: "Pausa", righe: [["caffe", 0]] },
      { id: "p2", nome: "Pranzo PROTEICO", righe: [["tonno", 0]] },
    ] satisfies Pasto[];
    expect(cerca(CATALOGO, pasti, "CAFFE")).toEqual([["Pausa", "Caffè"]]);
    expect(cerca(CATALOGO, pasti, "  proteico ")).toEqual([["Pranzo PROTEICO", null]]);
  });

  it("un alimento uscito dal catalogo non fa trovare il pasto", () => {
    // Il pasto ha ancora la riga del riso, ma il riso non è più nel
    // catalogo: resta visibile per lo yogurt, non si trova per "riso".
    const pasti = [{ id: "p1", nome: "Colazione", righe: [["yogurt", 0], ["riso-basmati", 1]] }] satisfies Pasto[];
    const senzaRiso = CATALOGO.filter((a) => a.id !== "riso-basmati");
    expect(cerca(senzaRiso, pasti, "riso")).toEqual([]);
    expect(cerca(senzaRiso, pasti, "yogurt")).toEqual([["Colazione", "Yogurt greco"]]);
  });

  it("la marca non conta, come nella ricerca degli alimenti", () => {
    const conMarca = [...CATALOGO, alimento("latte", "Latte", "Riso Scotti")];
    const pasti = [{ id: "p1", nome: "Colazione", righe: [["latte", 0]] }] satisfies Pasto[];
    expect(cerca(conMarca, pasti, "scotti")).toEqual([]);
  });

  it("più pasti: in ordine di nome; quelli senza la parola restano fuori", () => {
    const pasti = [
      { id: "p1", nome: "Spuntino", righe: [["gallette", 0]] },
      { id: "p2", nome: "Cena leggera", righe: [["yogurt", 0]] },
      { id: "p3", nome: "Riso e tonno", righe: [["riso-basmati", 0], ["tonno", 1]] },
      { id: "p4", nome: "Colazione proteica", righe: [["yogurt", 0], ["gallette", 1]] },
    ] satisfies Pasto[];
    expect(cerca(CATALOGO, pasti, "riso")).toEqual([
      ["Colazione proteica", "Gallette di riso"],
      ["Riso e tonno", null],
      ["Spuntino", "Gallette di riso"],
    ]);
  });

  it("ricerca vuota o di soli spazi: niente, come cercaPerNome", () => {
    const pasti = [{ id: "p1", nome: "Riso e tonno", righe: [["riso-basmati", 0]] }] satisfies Pasto[];
    expect(cerca(CATALOGO, pasti, "")).toEqual([]);
    expect(cerca(CATALOGO, pasti, "   ")).toEqual([]);
  });

  it("il testo della seconda riga", () => {
    expect(testoContiene("Gallette di riso")).toBe("Contiene Gallette di riso");
  });
});
