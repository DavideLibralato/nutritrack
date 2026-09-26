// Test permanenti per la modifica di un pasto salvato
// (src/lib/inserimento/modificaPastoSalvato.ts). Coprono gli errori che non
// fanno rumore: una riga riscritta che l'utente non ha toccato, una riga
// viva rimasta in un pasto cancellato (i pasti fantasma del 2026-09-22), un
// alimento cancellato dal catalogo che rientra in un pasto salvato, una
// scrittura prima del Salva, il diario che cambia.

import { describe, it, expect, vi } from "vitest";
import {
  aggiungiAlimento,
  caricaModuloPasto,
  erroreGrammi,
  grammiNelModulo,
  moduloModificato,
  salvaModificaPasto,
  type ModuloPasto,
} from "./modificaPastoSalvato";
import {
  repositoryAlimenti,
  repositoryComposizioni,
  repositoryComposizioniVoci,
  repositoryVociDiario,
} from "../repository";
import { rimuoviAlimentoDaPastiSalvati } from "../repository/composizioni";
import { db } from "../db/database";
import type { Alimento } from "../db/tipi";

async function creaAlimento(userId: string, nome: string): Promise<Alimento> {
  return repositoryAlimenti.crea({
    user_id: userId,
    nome,
    marca: null,
    barcode: null,
    kcal_100g: 100,
    proteine_100g: 5,
    carboidrati_100g: 10,
    grassi_100g: 2,
    zuccheri_100g: null,
    fibre_100g: null,
    saturi_100g: null,
    sale_100g: null,
    porzione_default_g: 100,
    fonte: "manuale",
    verificato: false,
  });
}

async function creaPastoSalvato(
  userId: string,
  nome: string,
  voci: { alimento: Alimento; grammi: number }[]
): Promise<string> {
  const composizione = await repositoryComposizioni.crea({
    user_id: userId,
    nome,
    tipo: "pasto_salvato",
    alimento_id: null,
  });
  for (const [indice, v] of voci.entries()) {
    await repositoryComposizioniVoci.crea({
      user_id: userId,
      composizione_id: composizione.id,
      alimento_id: v.alimento.id,
      quantita_g: v.grammi,
      ordine: indice,
    });
  }
  return composizione.id;
}

// Tutte le righe dell'utente, anche quelle cancellate logicamente: serve a
// vedere se qualcosa è stato scritto (updated_at compreso).
async function istantanea(userId: string) {
  const [composizioni, voci, diario] = await Promise.all([
    db.composizioni.where("user_id").equals(userId).toArray(),
    db.composizioni_voci.where("user_id").equals(userId).toArray(),
    db.voci_diario.where("user_id").equals(userId).toArray(),
  ]);
  const perId = <T extends { id: string }>(righe: T[]) =>
    [...righe].sort((a, b) => a.id.localeCompare(b.id));
  return { composizioni: perId(composizioni), voci: perId(voci), diario: perId(diario) };
}

async function righeDelPasto(composizioneId: string) {
  return db.composizioni_voci.where("composizione_id").equals(composizioneId).toArray();
}

// Pasto "Colazione": Pane 100 g, Burro 20 g, Marmellata 30 g.
async function preparaColazione() {
  const userId = `utente-${crypto.randomUUID()}`;
  const pane = await creaAlimento(userId, "Pane");
  const burro = await creaAlimento(userId, "Burro");
  const marmellata = await creaAlimento(userId, "Marmellata");
  const composizioneId = await creaPastoSalvato(userId, "Colazione", [
    { alimento: pane, grammi: 100 },
    { alimento: burro, grammi: 20 },
    { alimento: marmellata, grammi: 30 },
  ]);
  const caricati = (await caricaModuloPasto(userId, composizioneId))!;
  return { userId, pane, burro, marmellata, composizioneId, caricati };
}

function conGrammi(modulo: ModuloPasto, alimentoId: string, grammi: string): ModuloPasto {
  return {
    ...modulo,
    righe: modulo.righe.map((r) => (r.alimentoId === alimentoId ? { ...r, grammi } : r)),
  };
}

function senza(modulo: ModuloPasto, alimentoId: string): ModuloPasto {
  return { ...modulo, righe: modulo.righe.filter((r) => r.alimentoId !== alimentoId) };
}

describe("salvaModificaPasto", () => {
  it("cambio grammi: si aggiorna solo quella riga, le altre non si riscrivono", async () => {
    const { userId, burro, composizioneId, caricati } = await preparaColazione();
    const prima = await righeDelPasto(composizioneId);
    const spiaRighe = vi.spyOn(repositoryComposizioniVoci, "aggiorna");
    const spiaNome = vi.spyOn(repositoryComposizioni, "aggiorna");

    const esito = await salvaModificaPasto({
      userId,
      composizioneId,
      caricati,
      attuali: conGrammi(caricati, burro.id, "15"),
    });

    expect(esito).toEqual({ esito: "salvato", esclusi: [] });
    // Una sola scrittura, sulla riga del burro; il nome, non cambiato, non si
    // riscrive. (Il confronto delle righe qui sotto da solo non basta: due
    // scritture nello stesso millisecondo avrebbero lo stesso updated_at.)
    expect(spiaRighe).toHaveBeenCalledTimes(1);
    expect(spiaRighe).toHaveBeenCalledWith(caricati.righe[1].voceId, { quantita_g: 15 });
    expect(spiaNome).not.toHaveBeenCalled();
    spiaRighe.mockRestore();
    spiaNome.mockRestore();
    const dopo = await righeDelPasto(composizioneId);
    for (const riga of dopo) {
      const vecchia = prima.find((p) => p.id === riga.id)!;
      if (riga.alimento_id === burro.id) {
        expect(riga.quantita_g).toBe(15);
      } else {
        // Identica, updated_at compreso: non riscritta.
        expect(riga).toEqual(vecchia);
      }
    }
  });

  it("tolgo un alimento: la sua riga è cancellata logicamente, le altre intatte", async () => {
    const { userId, burro, composizioneId, caricati } = await preparaColazione();
    const prima = await righeDelPasto(composizioneId);

    await salvaModificaPasto({ userId, composizioneId, caricati, attuali: senza(caricati, burro.id) });

    const dopo = await righeDelPasto(composizioneId);
    expect(dopo).toHaveLength(3);
    for (const riga of dopo) {
      if (riga.alimento_id === burro.id) {
        expect(riga.deleted_at).not.toBeNull();
      } else {
        expect(riga).toEqual(prima.find((p) => p.id === riga.id));
      }
    }
    const composizione = await repositoryComposizioni.ottieniPerId(composizioneId);
    expect(composizione?.deleted_at).toBeNull();
  });

  it("aggiungo un alimento: riga nuova in fondo, dopo l'ordine più alto", async () => {
    const { userId, composizioneId, caricati } = await preparaColazione();
    const latte = await creaAlimento(userId, "Latte");

    await salvaModificaPasto({
      userId,
      composizioneId,
      caricati,
      attuali: aggiungiAlimento(caricati, latte, 200),
    });

    const vive = (await righeDelPasto(composizioneId))
      .filter((r) => r.deleted_at === null)
      .sort((a, b) => a.ordine - b.ordine);
    expect(vive).toHaveLength(4);
    expect(vive[3]).toMatchObject({ alimento_id: latte.id, quantita_g: 200, ordine: 3 });
    const ricaricato = await caricaModuloPasto(userId, composizioneId);
    expect(ricaricato!.righe.map((r) => r.nomeAlimento)).toEqual([
      "Pane",
      "Burro",
      "Marmellata",
      "Latte",
    ]);
  });

  it("tolgo tutti gli alimenti: composizione cancellata e nessuna riga viva", async () => {
    const { userId, composizioneId, caricati } = await preparaColazione();

    const esito = await salvaModificaPasto({
      userId,
      composizioneId,
      caricati,
      attuali: { ...caricati, righe: [] },
    });

    expect(esito.esito).toBe("eliminato");
    const composizione = await repositoryComposizioni.ottieniPerId(composizioneId);
    expect(composizione?.deleted_at).not.toBeNull();
    const vive = (await righeDelPasto(composizioneId)).filter((r) => r.deleted_at === null);
    expect(vive).toHaveLength(0);
  });

  it("alimento aggiunto e poi cancellato dal catalogo prima del Salva: non entra nel pasto", async () => {
    const { userId, burro, composizioneId, caricati } = await preparaColazione();
    const latte = await creaAlimento(userId, "Latte");
    const attuali = conGrammi(aggiungiAlimento(caricati, latte, 200), burro.id, "10");

    // Cancellato mentre la schermata è aperta (qui, o da un altro dispositivo).
    await repositoryAlimenti.elimina(latte.id);
    await rimuoviAlimentoDaPastiSalvati(userId, latte.id);

    const esito = await salvaModificaPasto({ userId, composizioneId, caricati, attuali });

    expect(esito).toEqual({ esito: "salvato", esclusi: ["Latte"] });
    const righe = await righeDelPasto(composizioneId);
    expect(righe.some((r) => r.alimento_id === latte.id)).toBe(false);
    // Le altre modifiche valgono comunque.
    expect(righe.find((r) => r.alimento_id === burro.id)?.quantita_g).toBe(10);
  });

  it("alimento del pasto cancellato dal catalogo durante la modifica: niente 'pasto-cambiato', non torna nel pasto", async () => {
    const { userId, pane, marmellata, composizioneId, caricati } = await preparaColazione();
    const attuali = conGrammi(caricati, pane.id, "80");

    await repositoryAlimenti.elimina(marmellata.id);
    await rimuoviAlimentoDaPastiSalvati(userId, marmellata.id);

    const esito = await salvaModificaPasto({ userId, composizioneId, caricati, attuali });

    expect(esito).toEqual({ esito: "salvato", esclusi: ["Marmellata"] });
    const vive = (await righeDelPasto(composizioneId)).filter((r) => r.deleted_at === null);
    expect(vive.map((r) => r.alimento_id).sort()).toEqual(
      [pane.id, caricati.righe[1].alimentoId].sort()
    );
    expect(vive.find((r) => r.alimento_id === pane.id)?.quantita_g).toBe(80);
  });

  it("tutti gli alimenti rimasti spariscono dal catalogo: il pasto si cancella, nessuna riga viva", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const yogurt = await creaAlimento(userId, "Yogurt");
    const composizioneId = await creaPastoSalvato(userId, "Merenda", [
      { alimento: yogurt, grammi: 125 },
    ]);
    const caricati = (await caricaModuloPasto(userId, composizioneId))!;
    const latte = await creaAlimento(userId, "Latte");
    const attuali = aggiungiAlimento(senza(caricati, yogurt.id), latte, 200);
    await repositoryAlimenti.elimina(latte.id);

    const esito = await salvaModificaPasto({ userId, composizioneId, caricati, attuali });

    expect(esito).toEqual({ esito: "eliminato", esclusi: ["Latte"] });
    const composizione = await repositoryComposizioni.ottieniPerId(composizioneId);
    expect(composizione?.deleted_at).not.toBeNull();
    const vive = (await righeDelPasto(composizioneId)).filter((r) => r.deleted_at === null);
    expect(vive).toHaveLength(0);
  });

  it("'Annulla modifiche': si torna ai caricati, nulla risulta modificato e niente è scritto", async () => {
    const { userId, burro, caricati } = await preparaColazione();
    const latte = await creaAlimento(userId, "Latte");
    const prima = await istantanea(userId);

    // Modifiche solo in memoria: nessuna scrittura prima del Salva.
    const modificato = aggiungiAlimento(conGrammi(senza(caricati, burro.id), burro.id, "5"), latte, 50);
    expect(moduloModificato(caricati, modificato)).toBe(true);
    expect(await istantanea(userId)).toEqual(prima);

    // "Annulla modifiche" = gli attuali tornano i caricati.
    const annullato = caricati;
    expect(moduloModificato(caricati, annullato)).toBe(false);
    expect(await istantanea(userId)).toEqual(prima);
  });

  it("il diario non cambia mai, qualunque modifica si salvi", async () => {
    const { userId, pane, burro, composizioneId, caricati } = await preparaColazione();
    await repositoryVociDiario.crea({
      user_id: userId,
      alimento_id: pane.id,
      pasto_id: null,
      gruppo_id: "gruppo-1",
      quantita_g: 100,
      data: "2026-09-20",
      creato_il: "2026-09-20T08:00:00.000Z",
      consumato_alle: null,
      nome_alimento: pane.nome,
      kcal_100g: pane.kcal_100g,
      proteine_100g: pane.proteine_100g,
      carboidrati_100g: pane.carboidrati_100g,
      grassi_100g: pane.grassi_100g,
    });
    const latte = await creaAlimento(userId, "Latte");
    const diarioPrima = (await istantanea(userId)).diario;

    await salvaModificaPasto({
      userId,
      composizioneId,
      caricati,
      attuali: {
        nome: "Colazione nuova",
        righe: aggiungiAlimento(conGrammi(senza(caricati, burro.id), pane.id, "50"), latte, 200)
          .righe,
      },
    });
    expect((await istantanea(userId)).diario).toEqual(diarioPrima);

    const ricaricato = (await caricaModuloPasto(userId, composizioneId))!;
    await salvaModificaPasto({
      userId,
      composizioneId,
      caricati: ricaricato,
      attuali: { ...ricaricato, righe: [] },
    });
    expect((await istantanea(userId)).diario).toEqual(diarioPrima);
  });

  it("rinomina: stesso controllo dei nomi doppi, escludendo il pasto stesso", async () => {
    const { userId, pane, composizioneId, caricati } = await preparaColazione();
    await creaPastoSalvato(userId, "Pranzo", [{ alimento: pane, grammi: 50 }]);
    const prima = await istantanea(userId);

    const doppio = await salvaModificaPasto({
      userId,
      composizioneId,
      caricati,
      attuali: { ...caricati, nome: " Pranzo " },
    });
    expect(doppio.esito).toBe("nome-duplicato");
    expect(await istantanea(userId)).toEqual(prima);

    // Il suo stesso nome non è un doppione.
    const stesso = await salvaModificaPasto({
      userId,
      composizioneId,
      caricati,
      attuali: conGrammi({ ...caricati, nome: "Colazione " }, pane.id, "90"),
    });
    expect(stesso.esito).toBe("salvato");
  });

  it("pasto modificato da un altro dispositivo: 'pasto-cambiato', niente scritto", async () => {
    const { userId, burro, composizioneId, caricati } = await preparaColazione();
    // L'altro dispositivo cambia i grammi del pane (arrivato via sync).
    await repositoryComposizioniVoci.aggiorna(caricati.righe[0].voceId!, { quantita_g: 120 });
    const prima = await istantanea(userId);

    const esito = await salvaModificaPasto({
      userId,
      composizioneId,
      caricati,
      attuali: conGrammi(caricati, burro.id, "10"),
    });

    expect(esito.esito).toBe("pasto-cambiato");
    if (esito.esito === "pasto-cambiato") expect(esito.caricati.righe[0].grammi).toBe("120");
    expect(await istantanea(userId)).toEqual(prima);
  });

  it("pasto cancellato da un altro dispositivo: 'pasto-eliminato', niente scritto", async () => {
    const { userId, burro, composizioneId, caricati } = await preparaColazione();
    await repositoryComposizioni.elimina(composizioneId);
    const prima = await istantanea(userId);

    const esito = await salvaModificaPasto({
      userId,
      composizioneId,
      caricati,
      attuali: conGrammi(caricati, burro.id, "10"),
    });

    expect(esito.esito).toBe("pasto-eliminato");
    expect(await istantanea(userId)).toEqual(prima);
  });

  it("grammi non validi: 'da-correggere', niente scritto", async () => {
    const { userId, burro, composizioneId, caricati } = await preparaColazione();
    const prima = await istantanea(userId);

    for (const grammi of ["", "0", "-5", "abc"]) {
      const esito = await salvaModificaPasto({
        userId,
        composizioneId,
        caricati,
        attuali: conGrammi(caricati, burro.id, grammi),
      });
      expect(esito.esito).toBe("da-correggere");
    }
    expect(await istantanea(userId)).toEqual(prima);
  });
});

describe("aggiungiAlimento", () => {
  it("alimento già nel pasto: i grammi si sostituiscono, non si sommano, nessuna riga doppia", async () => {
    const { burro, caricati } = await preparaColazione();
    expect(grammiNelModulo(caricati, burro.id)).toBe(20);

    const modulo = aggiungiAlimento(caricati, burro, 35);

    expect(modulo.righe).toHaveLength(3);
    expect(modulo.righe[1]).toMatchObject({ alimentoId: burro.id, grammi: "35", voceId: caricati.righe[1].voceId });
  });
});

describe("erroreGrammi", () => {
  it("accetta solo numeri maggiori di zero, con la virgola come decimale", () => {
    expect(erroreGrammi("")).not.toBeNull();
    expect(erroreGrammi("0")).not.toBeNull();
    expect(erroreGrammi("-1")).not.toBeNull();
    expect(erroreGrammi("abc")).not.toBeNull();
    expect(erroreGrammi("150")).toBeNull();
    expect(erroreGrammi("12,5")).toBeNull();
  });
});

describe("moduloModificato", () => {
  it("grammi uguali come numero non contano come modifica", async () => {
    const { burro, caricati } = await preparaColazione();
    expect(moduloModificato(caricati, conGrammi(caricati, burro.id, "20,0"))).toBe(false);
    expect(moduloModificato(caricati, conGrammi(caricati, burro.id, "21"))).toBe(true);
  });
});
