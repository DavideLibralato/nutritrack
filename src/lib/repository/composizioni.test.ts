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
  ripristinaAlimentoEliminato,
  eliminaComposizione,
} from "./composizioni";
import { repositoryAlimenti, repositoryComposizioni, repositoryComposizioniVoci, repositoryVociDiario } from "./index";
import { catalogoLocale } from "./alimenti";
import {
  pastiSalvati,
  pastoGiaSalvato,
  pastoSalvatoCoiSoliValidi,
  separaVociPerCatalogo,
} from "../inserimento/pastiSalvati";
import { testoAvvisoEsclusi, testoGiaSalvato } from "../inserimento/testiAlimentiCancellati";
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

    const risultato = await salvaPastoComeComposizione(userId, "Colazione", [voceP, voceM], [voceM.id]);
    expect(risultato.esito).toBe("salvato");

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

    const risultato = await salvaPastoComeComposizione(userId, "Colazione fantasma", [voceM], []);
    expect(risultato.esito).toBe("senza-alimenti");

    // Nessuna composizione vuota creata — sarebbe un fantasma fin dalla
    // nascita, lo stesso problema in un'altra forma.
    const composizioni = await repositoryComposizioni.ottieniTutti(userId);
    expect(composizioni.find((c) => c.nome === "Colazione fantasma")).toBeUndefined();
  });
});

// Regola "Alimenti cancellati" (PUNTO_DI_PARTENZA.md, decisa il 2026-09-25):
// cancellare un alimento lo ritira dal futuro (ricerca, recenti, preferiti,
// pasti salvati), non dal passato (il diario lo conserva). Prima l'app lo
// decideva in silenzio; questi test fissano i quattro comportamenti visibili.
// Sono bug che non fanno rumore: una stella accesa a torto o un Annulla che
// resuscita una riga vecchia si notano solo mesi dopo, se mai.
describe("regola Alimenti cancellati", () => {
  // Giornata tipo: una Cena con Pasta (ancora nel catalogo) e «test»
  // (cancellato dopo essere stato mangiato).
  async function giornataConAlimentoCancellato() {
    const userId = `utente-${crypto.randomUUID()}`;
    const pasta = await creaAlimento(userId, "Pasta");
    const test = await creaAlimento(userId, "test");
    const vocePasta = await creaVoceDiario(userId, pasta, 80);
    const voceTest = await creaVoceDiario(userId, test, 30);
    await repositoryAlimenti.elimina(test.id);
    return { userId, pasta, test, vocePasta, voceTest, vociPasto: [vocePasta, voceTest] };
  }

  async function statoLocale(userId: string) {
    const [catalogo, composizioni, composizioniVoci] = await Promise.all([
      catalogoLocale(userId),
      repositoryComposizioni.ottieniTutti(userId),
      repositoryComposizioniVoci.ottieniTutti(userId),
    ]);
    return { catalogo, composizioni, composizioniVoci };
  }

  it("punto 1: con un alimento cancellato il salvataggio avvisa, e salva solo le voci valide", async () => {
    const { userId, pasta, voceTest, vociPasto } = await giornataConAlimentoCancellato();
    const { catalogo } = await statoLocale(userId);

    // Cosa annuncia lo sheet.
    const { valide, escluse } = separaVociPerCatalogo(vociPasto, catalogo);
    expect(escluse.map((v) => v.id)).toEqual([voceTest.id]);
    expect(
      testoAvvisoEsclusi(valide.length, vociPasto.length, escluse.map((v) => v.nome_alimento))
    ).toBe("Verrà salvato 1 alimento su 2. «test» non è più nel catalogo.");

    // Senza che l'utente abbia visto l'avviso (nessuna voce annunciata come
    // esclusa) non si salva niente: l'esclusione non è mai silenziosa.
    const senzaAvviso = await salvaPastoComeComposizione(userId, "Cena", vociPasto, []);
    expect(senzaAvviso).toEqual({ esito: "esclusi-cambiati", idVociEscluse: [voceTest.id] });
    expect(await repositoryComposizioni.ottieniTutti(userId)).toHaveLength(0);

    // Confermato l'avviso: salvata, con la sola Pasta.
    const confermato = await salvaPastoComeComposizione(userId, "Cena", vociPasto, [voceTest.id]);
    expect(confermato.esito).toBe("salvato");
    const { composizioni, composizioniVoci } = await statoLocale(userId);
    const cena = composizioni.find((c) => c.nome === "Cena")!;
    const voci = composizioniVoci.filter((v) => v.composizione_id === cena.id);
    expect(voci.map((v) => v.alimento_id)).toEqual([pasta.id]);
  });

  it("punto 2: dopo il salvataggio la stella di quella giornata resta vuota", async () => {
    const { userId, voceTest, vociPasto } = await giornataConAlimentoCancellato();
    await salvaPastoComeComposizione(userId, "Cena", vociPasto, [voceTest.id]);
    const { catalogo, composizioni, composizioniVoci } = await statoLocale(userId);

    // A schermo ci sono Pasta e «test», il pasto salvato ha solo Pasta: non
    // riproduce l'elenco visibile, quindi non risulta salvato. Voluto: il
    // lato del diario NON si filtra (commento su composizioniCorrispondenti).
    expect(pastoGiaSalvato(vociPasto, catalogo, composizioni, composizioniVoci)).toBe(false);
    // E il pasto salvato resta comunque visibile in Preferiti: il filtro
    // sull'altro lato non si è rotto.
    expect(pastiSalvati(catalogo, composizioni, composizioniVoci).map((p) => p.nome)).toEqual([
      "Cena",
    ]);
  });

  it("punto 3: ripremendo la stella esce il messaggio informativo, non l'errore di nome duplicato", async () => {
    const { userId, voceTest, vociPasto } = await giornataConAlimentoCancellato();
    await salvaPastoComeComposizione(userId, "Cena", vociPasto, [voceTest.id]);
    const { catalogo, composizioni, composizioniVoci } = await statoLocale(userId);

    // Al tocco della stella (Oggi, toggleSalvaPreferito): trovato, niente sheet.
    const trovato = pastoSalvatoCoiSoliValidi(vociPasto, catalogo, composizioni, composizioniVoci);
    expect(trovato?.nome).toBe("Cena");
    expect(testoGiaSalvato("Cena", ["test"])).toBe(
      "Hai già un pasto salvato «Cena». Non contiene «test», che non è più nel catalogo."
    );

    // Rete di sicurezza nello sheet: stesso nome → informativo, non errore.
    const stessoNome = await salvaPastoComeComposizione(userId, "Cena", vociPasto, [voceTest.id]);
    expect(stessoNome).toEqual({ esito: "gia-salvato", nomePasto: "Cena", nomiEsclusi: ["test"] });
    // Il confronto è sul contenuto: anche con un altro nome non si crea un
    // secondo pasto salvato identico (conseguenza accettata il 2026-09-25).
    const altroNome = await salvaPastoComeComposizione(userId, "Cena bis", vociPasto, [voceTest.id]);
    expect(altroNome.esito).toBe("gia-salvato");
    expect(await repositoryComposizioni.ottieniTutti(userId)).toHaveLength(1);
  });

  it("punto 3: con contenuto diverso l'errore di nome duplicato resta quello di sempre", async () => {
    const { userId, pasta, voceTest, vociPasto } = await giornataConAlimentoCancellato();
    await salvaPastoComeComposizione(userId, "Cena", vociPasto, [voceTest.id]);

    // Un'altra giornata, un'altra quantità di Pasta: contenuto diverso.
    const altraVoce = await creaVoceDiario(userId, pasta, 120);
    const risultato = await salvaPastoComeComposizione(userId, "Cena", [altraVoce], []);
    expect(risultato.esito).toBe("nome-duplicato");
  });

  it("giornata senza alimenti cancellati: nessun avviso, e la stella si comporta come sempre", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    const pasta = await creaAlimento(userId, "Pasta");
    const pomodoro = await creaAlimento(userId, "Pomodoro");
    const vociPasto = [
      await creaVoceDiario(userId, pasta, 80),
      await creaVoceDiario(userId, pomodoro, 100),
    ];

    const prima = await statoLocale(userId);
    expect(separaVociPerCatalogo(vociPasto, prima.catalogo).escluse).toEqual([]);
    expect(
      pastoSalvatoCoiSoliValidi(vociPasto, prima.catalogo, prima.composizioni, prima.composizioniVoci)
    ).toBeNull();

    const risultato = await salvaPastoComeComposizione(userId, "Pranzo", vociPasto, []);
    expect(risultato.esito).toBe("salvato");

    const dopo = await statoLocale(userId);
    expect(
      pastoGiaSalvato(vociPasto, dopo.catalogo, dopo.composizioni, dopo.composizioniVoci)
    ).toBe(true);
  });

  describe("punto 4: Annulla dopo la cancellazione di un alimento", () => {
    // Stessi passi e stesso ordine di handleElimina in CreaAlimentoForm.
    async function cancellaAlimento(userId: string, alimentoId: string) {
      const traccia = await rimuoviAlimentoDaPastiSalvati(userId, alimentoId);
      await repositoryAlimenti.elimina(alimentoId);
      return traccia;
    }

    async function alimentiDelPasto(userId: string, nome: string) {
      const { composizioni, composizioniVoci } = await statoLocale(userId);
      const c = composizioni.find((x) => x.nome === nome);
      if (!c) return undefined;
      return composizioniVoci
        .filter((v) => v.composizione_id === c.id)
        .map((v) => v.alimento_id)
        .sort();
    }

    it("alimento e pasti salvati tornano come prima, e una riga cancellata in precedenza NON torna", async () => {
      const userId = `utente-${crypto.randomUUID()}`;
      const pane = await creaAlimento(userId, "Pane");
      const test = await creaAlimento(userId, "test");
      await creaPastoSalvato(userId, "Cena", [pane, test]); // resta con il Pane
      await creaPastoSalvato(userId, "Spuntino", [test]); // resta vuoto → cancellato
      const colazioneId = await creaPastoSalvato(userId, "Colazione", [pane, test]);

      // Molto prima: la riga di «test» in Colazione era già stata cancellata.
      const vocePrecedente = (await repositoryComposizioniVoci.ottieniTutti(userId)).find(
        (v) => v.composizione_id === colazioneId && v.alimento_id === test.id
      )!;
      await repositoryComposizioniVoci.elimina(vocePrecedente.id);

      const traccia = await cancellaAlimento(userId, test.id);
      expect(traccia.idComposizioniVoci).not.toContain(vocePrecedente.id);
      expect(await alimentiDelPasto(userId, "Spuntino")).toBeUndefined();

      const esito = await ripristinaAlimentoEliminato(userId, test.id, traccia);
      expect(esito.pastiNonRipristinati).toEqual([]);

      const { catalogo, composizioni, composizioniVoci } = await statoLocale(userId);
      expect(catalogo.some((a) => a.id === test.id)).toBe(true);
      expect(await alimentiDelPasto(userId, "Cena")).toEqual([pane.id, test.id].sort());
      expect(await alimentiDelPasto(userId, "Spuntino")).toEqual([test.id]);
      // Colazione resta com'era PRIMA di questa cancellazione: solo Pane.
      expect(await alimentiDelPasto(userId, "Colazione")).toEqual([pane.id]);
      expect(
        (await repositoryComposizioniVoci.ottieniPerId(vocePrecedente.id))?.deleted_at
      ).not.toBeNull();

      expect(pastiSalvati(catalogo, composizioni, composizioniVoci).map((p) => p.nome)).toEqual([
        "Cena",
        "Colazione",
        "Spuntino",
      ]);
    });

    it("se nel frattempo è nato un pasto salvato con lo stesso nome, quello vuoto non si ripristina", async () => {
      const userId = `utente-${crypto.randomUUID()}`;
      const pane = await creaAlimento(userId, "Pane");
      const test = await creaAlimento(userId, "test");
      const vecchioId = await creaPastoSalvato(userId, "Spuntino", [test]);

      const traccia = await cancellaAlimento(userId, test.id);
      // Durante la finestra dell'Annulla (es. arriva dalla sync): un nuovo
      // "Spuntino", con il Pane.
      await creaPastoSalvato(userId, "Spuntino", [pane]);

      const esito = await ripristinaAlimentoEliminato(userId, test.id, traccia);
      expect(esito.pastiNonRipristinati).toEqual(["Spuntino"]);

      // L'alimento torna; il vecchio Spuntino e la sua riga restano
      // cancellati — niente doppione, niente riga orfana.
      const { catalogo } = await statoLocale(userId);
      expect(catalogo.some((a) => a.id === test.id)).toBe(true);
      expect((await repositoryComposizioni.ottieniPerId(vecchioId))?.deleted_at).not.toBeNull();
      for (const id of traccia.idComposizioniVoci) {
        expect((await repositoryComposizioniVoci.ottieniPerId(id))?.deleted_at).not.toBeNull();
      }
    });

    it("una riga il cui pasto salvato è stato cancellato durante la finestra non torna", async () => {
      const userId = `utente-${crypto.randomUUID()}`;
      const pane = await creaAlimento(userId, "Pane");
      const test = await creaAlimento(userId, "test");
      const cenaId = await creaPastoSalvato(userId, "Cena", [pane, test]);

      const traccia = await cancellaAlimento(userId, test.id);
      // L'utente elimina "Cena" dai preferiti mentre la barra è ancora lì.
      await eliminaComposizione(cenaId, await repositoryComposizioniVoci.ottieniTutti(userId));

      await ripristinaAlimentoEliminato(userId, test.id, traccia);

      expect((await repositoryComposizioni.ottieniPerId(cenaId))?.deleted_at).not.toBeNull();
      for (const id of traccia.idComposizioniVoci) {
        expect((await repositoryComposizioniVoci.ottieniPerId(id))?.deleted_at).not.toBeNull();
      }
    });
  });
});
