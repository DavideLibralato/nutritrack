// Test permanenti per «Nei tuoi» (neiTuoi.ts; PUNTO_DI_PARTENZA.md §10.1).
// Un errore qui non fa rumore: o il catalogo propone «Aggiungi» per un
// alimento che l'utente ha già (e nasce un doppione), o dice «Nei tuoi»
// per uno che non ha più (e non si può riaggiungere).

import { describe, it, expect } from "vitest";
import type { Alimento } from "../db/tipi";
import type { AlimentoCatalogo } from "./catalogoPrecaricato";
import { statoNelCatalogo } from "./neiTuoi";

const USER = "u1";

const MANDORLE: AlimentoCatalogo = {
  id: "ciqual:15000", origine: "ciqual", categoria: "Frutta secca e semi",
  nome: "Mandorle", marca: null, barcode: null, porzione_default_g: 30,
  kcal_100g: 615, proteine_100g: 18.8, carboidrati_100g: 9.5, grassi_100g: 51.3,
  zuccheri_100g: 4.4, fibre_100g: 11.9, saturi_100g: 4, sale_100g: 0,
};

const GOCCIOLE: AlimentoCatalogo = {
  id: "off:8013355999143", origine: "off", categoria: "Dolci e snack",
  nome: "Gocciole chocolate", marca: "Pavesi", barcode: "8013355999143", porzione_default_g: 30,
  kcal_100g: 488, proteine_100g: 6.5, carboidrati_100g: 64, grassi_100g: 22,
  zuccheri_100g: 25, fibre_100g: 4, saturi_100g: 6, sale_100g: 0.5,
};

function alimento(id: string, nome: string, marca: string | null, altro: Partial<Alimento> = {}): Alimento {
  return {
    id, user_id: USER, updated_at: "2026-11-08T10:00:00.000Z", deleted_at: null,
    nome, marca, barcode: null,
    kcal_100g: 100, proteine_100g: 1, carboidrati_100g: 1, grassi_100g: 1,
    zuccheri_100g: null, fibre_100g: null, saturi_100g: null, sale_100g: null,
    porzione_default_g: 100, fonte: "manuale", verificato: false,
    ...altro,
  };
}

describe("statoNelCatalogo", () => {
  it("senza niente di simile fra i miei: da aggiungere", () => {
    expect(statoNelCatalogo(MANDORLE, [alimento("a", "Pane", null)], USER)).toEqual({ stato: "da-aggiungere" });
  });

  it("una copia presa dal catalogo e poi rinominata, con un'altra marca: resta «Nei tuoi»", () => {
    const copia = alimento("c", "Mandorle tostate", "Mia", { catalogo_id: "ciqual:15000" });
    expect(statoNelCatalogo(MANDORLE, [copia], USER)).toEqual({ stato: "nei-tuoi", alimento: copia, perche: "copia" });
  });

  it("lo stesso codice a barre, creato a mano con un altro nome: «Nei tuoi» (il caso delle Gocciole)", () => {
    const amano = alimento("g", "Biscotti", null, { barcode: "8013355999143" });
    expect(statoNelCatalogo(GOCCIOLE, [amano], USER)).toEqual({ stato: "nei-tuoi", alimento: amano, perche: "doppione" });
  });

  it("stesso nome e marca, con maiuscole, accenti e spazi diversi: «Nei tuoi»", () => {
    const amano = alimento("g", "  gocciole   CHOCOLATE ", "pavési");
    expect(statoNelCatalogo(GOCCIOLE, [amano], USER)).toMatchObject({ stato: "nei-tuoi", perche: "doppione" });
  });

  it("stesso nome ma un'altra marca: da aggiungere", () => {
    const altro = alimento("g", "Gocciole chocolate", "Mulino Bianco");
    expect(statoNelCatalogo(GOCCIOLE, [altro], USER)).toEqual({ stato: "da-aggiungere" });
  });

  it("la copia viene prima del doppione: «Apri» apre la copia", () => {
    const doppione = alimento("d", "Gocciole chocolate", "Pavesi");
    const copia = alimento("c", "Le mie gocciole", null, { catalogo_id: "off:8013355999143" });
    expect(statoNelCatalogo(GOCCIOLE, [doppione, copia], USER)).toMatchObject({ alimento: copia, perche: "copia" });
  });

  it("una copia cancellata non conta: si può riaggiungere", () => {
    const cancellata = alimento("c", "Mandorle", null, {
      catalogo_id: "ciqual:15000", deleted_at: "2026-11-08T11:00:00.000Z",
    });
    expect(statoNelCatalogo(MANDORLE, [cancellata], USER)).toEqual({ stato: "da-aggiungere" });
  });

  it("le righe di un altro utente rimaste sul telefono non contano, né il catalogo comune", () => {
    const altroUtente = alimento("x", "Mandorle", null, { user_id: "u2", catalogo_id: "ciqual:15000" });
    const comune = alimento("y", "Mandorle", null, { user_id: null });
    expect(statoNelCatalogo(MANDORLE, [altroUtente, comune], USER)).toEqual({ stato: "da-aggiungere" });
  });

  it("una riga salvata prima della version(10), senza la chiave catalogo_id, vale come null", () => {
    const vecchia = alimento("v", "Mandorle tostate", null);
    expect("catalogo_id" in vecchia).toBe(false);
    expect(statoNelCatalogo(MANDORLE, [vecchia], USER)).toEqual({ stato: "da-aggiungere" });
  });
});
