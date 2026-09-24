// Test permanenti per il bug dei pasti salvati "fantasma" (2026-09-22): un
// alimento cancellato dal catalogo che era l'unico di un pasto salvato
// lasciava la composizione "viva" (deleted_at ancora null) ma senza nessun
// alimento — pastiSalvati() non la mostrava più, però esisteComposizioneConNome
// continuava a considerarla "esistente" guardando tutte le composizioni senza
// lo stesso filtro. Risultato: risalvare un pasto con lo stesso nome
// ("Colazione") diceva "nome già in uso" per un pasto che nell'elenco non
// c'era. Corretto in due parti, entrambe da tenere coperte per sempre:
// 1. rimuoviAlimentoDaPastiSalvati cancella la riga di composizioni_voci e,
//    se era l'ultima del pasto, anche la composizione stessa;
// 2. esisteComposizioneConNome usa la stessa regola di visibilità di
//    pastiSalvati() (pastoSalvatoVisibile), non un filtro separato.
//
// Un'altra cancellazione, quella di una VOCE DI DIARIO (togliere un
// alimento dal pasto di una giornata), non deve invece toccare i pasti
// salvati: è un caso diverso, verificato qui sotto per non confonderlo di
// nuovo con quello sopra.

import { describe, it, expect } from "vitest";
import {
  rimuoviAlimentoDaPastiSalvati,
  esisteComposizioneConNome,
  salvaPastoComeComposizione,
} from "./composizioni";
import { repositoryAlimenti, repositoryComposizioni, repositoryComposizioniVoci, repositoryVociDiario } from "./index";
import { catalogoLocale } from "./alimenti";
import { pastiSalvati } from "../inserimento/pastiSalvati";
import type { Alimento, VoceDiario } from "../db/tipi";

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

async function creaVoceDiario(userId: string, alimento: Alimento, quantitaG: number): Promise<VoceDiario> {
  return repositoryVociDiario.crea({
    user_id: userId,
    alimento_id: alimento.id,
    pasto_id: null,
    gruppo_id: null,
    quantita_g: quantitaG,
    data: "2026-09-25",
    creato_il: "2026-09-25T08:00:00.000Z",
    consumato_alle: null,
    nome_alimento: alimento.nome,
    kcal_100g: alimento.kcal_100g,
    proteine_100g: alimento.proteine_100g,
    carboidrati_100g: alimento.carboidrati_100g,
    grassi_100g: alimento.grassi_100g,
  });
}

async function creaPastoSalvato(
  userId: string,
  nome: string,
  alimenti: Alimento[]
): Promise<string> {
  const composizione = await repositoryComposizioni.crea({
    user_id: userId,
    nome,
    tipo: "pasto_salvato",
    alimento_id: null,
  });
  await Promise.all(
    alimenti.map((a, indice) =>
      repositoryComposizioniVoci.crea({
        user_id: userId,
        composizione_id: composizione.id,
        alimento_id: a.id,
        quantita_g: 100,
        ordine: indice,
      })
    )
  );
  return composizione.id;
}

describe("rimuoviAlimentoDaPastiSalvati", () => {
  it("era l'unico alimento del pasto: il pasto risulta cancellato e il nome torna riusabile", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const yogurt = await creaAlimento(userId, "Yogurt");
    const composizioneId = await creaPastoSalvato(userId, "Colazione", [yogurt]);

    await repositoryAlimenti.elimina(yogurt.id);
    await rimuoviAlimentoDaPastiSalvati(userId, yogurt.id);

    const composizioni = await repositoryComposizioni.ottieniTutti(userId);
    expect(composizioni.find((c) => c.id === composizioneId)).toBeUndefined();

    // Il nome è di nuovo libero: esisteComposizioneConNome non deve più
    // considerarlo preso (era esattamente il bug: diceva "esiste" mentre
    // l'elenco lo aveva già nascosto).
    const composizioniVoci = await repositoryComposizioniVoci.ottieniTutti(userId);
    const catalogo = await catalogoLocale(userId);
    expect(
      esisteComposizioneConNome("Colazione", catalogo, composizioni, composizioniVoci)
    ).toBe(false);
  });

  it("restavano altri alimenti: sparisce solo la riga di quell'alimento, il pasto resta", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const pane = await creaAlimento(userId, "Pane");
    const burro = await creaAlimento(userId, "Burro");
    const marmellata = await creaAlimento(userId, "Marmellata");
    const uova = await creaAlimento(userId, "Uova");
    const composizioneId = await creaPastoSalvato(userId, "Colazione grande", [
      pane,
      burro,
      marmellata,
      uova,
    ]);

    await repositoryAlimenti.elimina(marmellata.id);
    await rimuoviAlimentoDaPastiSalvati(userId, marmellata.id);

    const composizioni = await repositoryComposizioni.ottieniTutti(userId);
    expect(composizioni.find((c) => c.id === composizioneId)).not.toBeUndefined();

    const composizioniVoci = await repositoryComposizioniVoci.ottieniTutti(userId);
    const vociRimaste = composizioniVoci.filter((v) => v.composizione_id === composizioneId);
    expect(vociRimaste.map((v) => v.alimento_id).sort()).toEqual(
      [pane.id, burro.id, uova.id].sort()
    );

    // Il pasto continua a comparire in Preferiti, con solo i 3 alimenti
    // rimasti.
    const catalogo = await catalogoLocale(userId);
    const risultato = pastiSalvati(catalogo, composizioni, composizioniVoci);
    const pasto = risultato.find((p) => p.composizioneId === composizioneId);
    expect(pasto?.voci).toHaveLength(3);
  });

  it("cancellare una VOCE DI DIARIO non tocca i pasti salvati (caso diverso, da non confondere)", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const yogurt = await creaAlimento(userId, "Yogurt");
    const composizioneId = await creaPastoSalvato(userId, "Colazione", [yogurt]);

    const voce = await repositoryVociDiario.crea({
      user_id: userId,
      alimento_id: yogurt.id,
      pasto_id: null,
      gruppo_id: null,
      quantita_g: 150,
      data: "2026-09-24",
      creato_il: "2026-09-24T08:00:00.000Z",
      consumato_alle: null,
      nome_alimento: yogurt.nome,
      kcal_100g: yogurt.kcal_100g,
      proteine_100g: yogurt.proteine_100g,
      carboidrati_100g: yogurt.carboidrati_100g,
      grassi_100g: yogurt.grassi_100g,
    });

    // Solo la voce di diario si cancella — nessuna funzione di questo file
    // viene chiamata: è esattamente il comportamento di oggi in Oggi
    // (eliminaVoce chiama solo repositoryVociDiario.elimina).
    await repositoryVociDiario.elimina(voce.id);

    const composizioni = await repositoryComposizioni.ottieniTutti(userId);
    const composizioniVoci = await repositoryComposizioniVoci.ottieniTutti(userId);
    expect(composizioni.find((c) => c.id === composizioneId)).not.toBeUndefined();
    expect(
      composizioniVoci.filter((v) => v.composizione_id === composizioneId)
    ).toHaveLength(1);

    const catalogo = await catalogoLocale(userId);
    const risultato = pastiSalvati(catalogo, composizioni, composizioniVoci);
    expect(risultato.find((p) => p.composizioneId === composizioneId)).not.toBeUndefined();
  });
});

describe("salvaPastoComeComposizione", () => {
  // Bug del 2026-09-24 (visto su Supabase, composizione 74a9b00f): la voce di
  // diario sopravvive alla cancellazione del suo alimento dal catalogo
  // (conserva la copia dei valori nutrizionali, giusto), ma salvare quel
  // pasto come preferito copiava comunque la voce in composizioni_voci,
  // creando un pasto salvato "fantasma" — stavolta nuovo di zecca, non un
  // residuo di dati vecchi.
  it("un alimento cancellato dal catalogo non finisce nella composizione", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const pane = await creaAlimento(userId, "Pane");
    const marmellata = await creaAlimento(userId, "Marmellata");
    const voceP = await creaVoceDiario(userId, pane, 50);
    const voceM = await creaVoceDiario(userId, marmellata, 20);

    // La marmellata sparisce dal catalogo DOPO essere stata mangiata: la
    // voce di diario resta (copia congelata), l'alimento no.
    await repositoryAlimenti.elimina(marmellata.id);

    const creata = await salvaPastoComeComposizione(userId, "Colazione", [voceP, voceM]);
    expect(creata).toBe(true);

    const composizioni = await repositoryComposizioni.ottieniTutti(userId);
    const composizione = composizioni.find((c) => c.nome === "Colazione");
    expect(composizione).not.toBeUndefined();

    const composizioniVoci = await repositoryComposizioniVoci.ottieniTutti(userId);
    const voci = composizioniVoci.filter((v) => v.composizione_id === composizione!.id);
    expect(voci).toHaveLength(1);
    expect(voci[0].alimento_id).toBe(pane.id);
  });

  it("se TUTTI gli alimenti del pasto sono cancellati dal catalogo, non crea nessuna composizione", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const marmellata = await creaAlimento(userId, "Marmellata");
    const voceM = await creaVoceDiario(userId, marmellata, 20);
    await repositoryAlimenti.elimina(marmellata.id);

    const creata = await salvaPastoComeComposizione(userId, "Colazione fantasma", [voceM]);
    expect(creata).toBe(false);

    // Nessuna composizione vuota creata — sarebbe un fantasma fin dalla
    // nascita, lo stesso problema in un'altra forma.
    const composizioni = await repositoryComposizioni.ottieniTutti(userId);
    expect(composizioni.find((c) => c.nome === "Colazione fantasma")).toBeUndefined();
  });
});
