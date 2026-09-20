// Bug reale trovato controllando Supabase: 10 pasti invece di 5 per lo
// stesso utente (il set predefinito creato due volte, a un refresh di
// distanza). La prima versione del fix passava ancora `pastiEsistenti` (lo
// stato React di useLiveQuery) come controllo — ma è uno stato derivato e
// reattivo, che dopo un refresh completo può restare "non ancora arrivato"
// più a lungo del previsto. Poi l'id è diventato deterministico (UUID v5 da
// utente + nome canonico) e il controllo da aggregato ("l'utente ha già un
// pasto?") a per-id ("questo pasto specifico esiste già?"): due dispositivi
// che seminano senza essersi mai sincronizzati producono le stesse righe,
// non due set diversi. Bug di logica sottile (race condition + doppioni):
// test permanente.

import { describe, it, expect, vi } from "vitest";
import {
  garantisciPastiPredefiniti,
  idPastoPredefinito,
  PASTI_PREDEFINITI,
} from "./pasti";
import { repositoryPasti } from "./index";
import { db } from "../db/database";

// scaricaTabella (discesa.ts) chiamata da garantisciPastiPredefiniti prova
// sempre una discesa best-effort prima del controllo per-id: qui la
// facciamo fallire di proposito (rete assente), così ogni test esercita il
// seed sul solo stato locale — il comportamento della discesa vera ha i
// suoi test in src/lib/sync/discesa.test.ts.
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => {
      throw new Error("Rete non disponibile (finta, nei test).");
    },
  }),
}));

describe("idPastoPredefinito — determinismo", () => {
  it("stesso utente e stesso nome producono sempre lo stesso id, letterale", () => {
    // Valore atteso scritto come stringa fissa, non ricalcolato nel test:
    // un "stesso input -> stesso output entro la stessa esecuzione" non
    // si accorgerebbe se qualcuno cambia il namespace o se un aggiornamento
    // della libreria uuid altera l'algoritmo — resterebbe comunque coerente
    // con sé stesso. Solo un valore letterale, fissato una volta e mai
    // ricalcolato dal codice sotto test, intercetta quel giorno.
    const id = idPastoPredefinito(
      "11111111-1111-1111-1111-111111111111",
      "Colazione"
    );
    expect(id).toBe("e706dea9-94e8-5663-a1f7-d48cde562824");
  });

  it("un nome diverso produce un id diverso, anche letterale", () => {
    const id = idPastoPredefinito(
      "11111111-1111-1111-1111-111111111111",
      "Cena"
    );
    expect(id).toBe("57b89487-8ac7-58de-a343-28a856405c56");
  });

  it("utenti diversi non collidono sullo stesso nome", () => {
    const idA = idPastoPredefinito("11111111-1111-1111-1111-111111111111", "Cena");
    const idB = idPastoPredefinito("22222222-2222-2222-2222-222222222222", "Cena");
    expect(idA).not.toBe(idB);
  });
});

describe("garantisciPastiPredefiniti — niente doppioni", () => {
  it("una seconda chiamata dopo che la prima ha già finito non duplica i pasti", async () => {
    const userId = `utente-${crypto.randomUUID()}`;

    await garantisciPastiPredefiniti(userId);
    const dopoPrimoGiro = await repositoryPasti.ottieniTutti(userId);
    expect(dopoPrimoGiro).toHaveLength(PASTI_PREDEFINITI.length);

    await garantisciPastiPredefiniti(userId);
    const dopoSecondoGiro = await repositoryPasti.ottieniTutti(userId);
    expect(dopoSecondoGiro).toHaveLength(PASTI_PREDEFINITI.length);
  });

  it("due chiamate sovrapposte (senza aspettare la prima) creano un solo set", async () => {
    const userId = `utente-${crypto.randomUUID()}`;

    await Promise.all([
      garantisciPastiPredefiniti(userId),
      garantisciPastiPredefiniti(userId),
    ]);

    const pasti = await repositoryPasti.ottieniTutti(userId);
    expect(pasti).toHaveLength(PASTI_PREDEFINITI.length);
  });

  it("un pasto personalizzato non impedisce la creazione dei 5 predefiniti", async () => {
    // Prima del controllo per-id, un qualunque pasto (anche non uno dei 5
    // nomi canonici) bastava a far saltare tutto il seed — un utente che
    // avesse un solo pasto proprio non riceveva mai i predefiniti su un
    // dispositivo nuovo. Ora il controllo è per nome canonico, non
    // aggregato: un pasto personalizzato convive con i 5 predefiniti.
    const userId = `utente-${crypto.randomUUID()}`;
    await repositoryPasti.crea({
      user_id: userId,
      nome: "Merenda dei bambini",
      ora_inizio: "17:00",
      ordine: 5,
    });

    await garantisciPastiPredefiniti(userId);

    const pasti = await repositoryPasti.ottieniTutti(userId);
    expect(pasti).toHaveLength(1 + PASTI_PREDEFINITI.length);
  });

  it("un pasto predefinito perso (mai creato, non solo cancellato) viene ricreato anche se gli altri quattro ci sono", async () => {
    // È esattamente come è sparita la Cena nell'incidente reale: un pasto
    // mancante per un bug, non per una scelta dell'utente. Il vecchio
    // controllo aggregato ("l'utente ha già un pasto?") non lo notava
    // perché gli altri quattro bastavano a far saltare tutto il seed —
    // "garantisci che i 5 esistano" ora vale alla lettera, pasto per
    // pasto.
    const userId = `utente-${crypto.randomUUID()}`;
    await garantisciPastiPredefiniti(userId);

    const idCena = idPastoPredefinito(userId, "Cena");
    await db.pasti.delete(idCena); // sparita del tutto, non una cancellazione logica

    await garantisciPastiPredefiniti(userId);

    const pasti = await repositoryPasti.ottieniTutti(userId);
    expect(pasti).toHaveLength(PASTI_PREDEFINITI.length);
    const cenaRicreata = await repositoryPasti.ottieniPerId(idCena);
    expect(cenaRicreata).toBeDefined();
    expect(cenaRicreata?.deleted_at).toBeNull();
  });

  it("un pasto predefinito cancellato deliberatamente non viene resuscitato", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await garantisciPastiPredefiniti(userId);

    const idCena = idPastoPredefinito(userId, "Cena");
    await repositoryPasti.elimina(idCena); // cancellazione logica, non sparizione

    await garantisciPastiPredefiniti(userId);

    const pastiVivi = await repositoryPasti.ottieniTutti(userId);
    expect(pastiVivi).toHaveLength(PASTI_PREDEFINITI.length - 1);
    const cena = await repositoryPasti.ottieniPerId(idCena);
    expect(cena?.deleted_at).not.toBeNull(); // ancora lì, ancora cancellata
  });

  it("rinominare un pasto predefinito non ne spezza il riconoscimento", async () => {
    // L'id resta quello calcolato sul nome CANONICO ("Cena"), anche se la
    // riga sullo schermo ora si chiama diversamente: la funzione non deve
    // ricrearne una seconda scambiando il nome vivo per un pasto mancante.
    const userId = `utente-${crypto.randomUUID()}`;
    await garantisciPastiPredefiniti(userId);

    const idCena = idPastoPredefinito(userId, "Cena");
    await repositoryPasti.aggiorna(idCena, { nome: "Dinner" });

    await garantisciPastiPredefiniti(userId);

    const pasti = await repositoryPasti.ottieniTutti(userId);
    expect(pasti).toHaveLength(PASTI_PREDEFINITI.length);
    expect(pasti.find((p) => p.id === idCena)?.nome).toBe("Dinner");
  });
});
