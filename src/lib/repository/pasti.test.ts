// Bug reale trovato controllando Supabase: 10 pasti invece di 5 per lo
// stesso utente (il set predefinito creato due volte, a un refresh di
// distanza). La prima versione del fix passava ancora `pastiEsistenti` (lo
// stato React di useLiveQuery) come controllo — ma è uno stato derivato e
// reattivo, che dopo un refresh completo può restare "non ancora arrivato"
// più a lungo del previsto. Ora la funzione non riceve più `pasti`: l'unica
// fonte di verità è la lettura diretta di Dexie, fatta qui dentro. Bug di
// logica sottile (race condition): test permanente.

import { describe, it, expect } from "vitest";
import { garantisciPastiPredefiniti, PASTI_PREDEFINITI } from "./pasti";
import { repositoryPasti } from "./index";

describe("garantisciPastiPredefiniti — niente doppioni", () => {
  it("una seconda chiamata dopo che la prima ha già finito non duplica i pasti", async () => {
    const userId = `utente-${crypto.randomUUID()}`;

    await garantisciPastiPredefiniti(userId);
    const dopoPrimoGiro = await repositoryPasti.ottieniTutti(userId);
    expect(dopoPrimoGiro).toHaveLength(PASTI_PREDEFINITI.length);

    // Non riceve più `pasti` dal chiamante: rilegge Dexie da sola, quindi
    // una seconda invocazione — indipendentemente da cosa stesse mostrando
    // la UI in quel momento — non deve creare altri 5 pasti.
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

  it("con almeno un pasto già presente in Dexie non fa nulla", async () => {
    const userId = `utente-${crypto.randomUUID()}`;
    await repositoryPasti.crea({
      user_id: userId,
      nome: "Pranzo",
      ora_inizio: "12:30",
      ordine: 0,
    });

    await garantisciPastiPredefiniti(userId);

    const pasti = await repositoryPasti.ottieniTutti(userId);
    expect(pasti).toHaveLength(1);
  });
});
