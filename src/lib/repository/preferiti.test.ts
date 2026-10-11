// Bug reale trovato controllando le voci ferme nell'outbox: togliere e
// rimettere la stessa stella creava ogni volta una riga nuova (id diverso),
// perché la lista `preferiti` passata a togglePreferito arriva già filtrata
// senza le righe cancellate — quindi non c'era modo di sapere che una riga
// per lo stesso alimento esisteva già, solo cancellata. Su Supabase il
// vincolo unico (user_id, alimento_id) non fa eccezione per le cancellate,
// quindi ogni ri-aggiunta falliva con "duplicate key", in silenzio (sync
// fallita, mai a schermo). Bug di logica sottile: resta come test
// permanente.

import { describe, it, expect } from "vitest";
import { db } from "../db/database";
import { repositoryPreferiti } from "./index";
import { rimettiPreferito, togliPreferito, togglePreferito } from "./preferiti";

const USER = "utente-preferiti-toggle";

describe("togglePreferito — aggiungere di nuovo un preferito già tolto", () => {
  it("risuscita la riga cancellata invece di crearne una seconda", async () => {
    const alimentoId = crypto.randomUUID();

    // Primo giro: aggiunta.
    await togglePreferito(USER, [], alimentoId);
    const dopoAggiunta = await repositoryPreferiti.ottieniTutti(USER);
    expect(dopoAggiunta.filter((p) => p.alimento_id === alimentoId)).toHaveLength(1);
    const primoId = dopoAggiunta.find((p) => p.alimento_id === alimentoId)!.id;

    // Secondo giro: rimozione (cancellazione logica, la riga resta nel db).
    await togglePreferito(USER, dopoAggiunta, alimentoId);
    const dopoRimozione = await repositoryPreferiti.ottieniTutti(USER);
    expect(dopoRimozione.filter((p) => p.alimento_id === alimentoId)).toHaveLength(0);

    // Terzo giro: ri-aggiunta. Deve risuscitare la riga di prima (stesso
    // id), non crearne una seconda — altrimenti su Supabase sarebbe un
    // secondo INSERT sullo stesso (user_id, alimento_id), in collisione col
    // vincolo unico.
    await togglePreferito(USER, dopoRimozione, alimentoId);
    const dopoRiaggiunta = await repositoryPreferiti.ottieniTutti(USER);
    const viventi = dopoRiaggiunta.filter((p) => p.alimento_id === alimentoId);
    expect(viventi).toHaveLength(1);
    expect(viventi[0].id).toBe(primoId);

    // Nessuna riga fantasma: una sola riga in tutto per questo alimento,
    // viva o cancellata che sia.
    const tutte = await db.preferiti
      .filter((p) => p.user_id === USER && p.alimento_id === alimentoId)
      .toArray();
    expect(tutte).toHaveLength(1);
  });
});

// togliPreferito e rimettiPreferito (Impostazioni > Preferiti e pasti
// salvati) rileggono Dexie invece di fidarsi dell'elenco della pagina. Con
// l'elenco della pagina, un "Annulla" toccato subito dopo la stella, prima
// che la liveQuery ridisegni, vedrebbe il preferito ancora vivo e lo
// toglierebbe di nuovo invece di rimetterlo.
describe("togliPreferito e rimettiPreferito", () => {
  const UTENTE = "utente-preferiti-togli-rimetti";

  it("rimettere rimette in vita la stessa riga, e una seconda volta non fa niente", async () => {
    const alimentoId = crypto.randomUUID();
    const { id } = await repositoryPreferiti.crea({ user_id: UTENTE, alimento_id: alimentoId });

    await togliPreferito(UTENTE, alimentoId);
    await rimettiPreferito(UTENTE, alimentoId);
    await rimettiPreferito(UTENTE, alimentoId);

    const tutte = await db.preferiti
      .filter((p) => p.user_id === UTENTE && p.alimento_id === alimentoId)
      .toArray();
    expect(tutte).toHaveLength(1);
    expect(tutte[0].id).toBe(id);
    expect(tutte[0].deleted_at).toBeNull();
  });

  it("togliere toglie anche la seconda riga viva dello stesso alimento", async () => {
    const alimentoId = crypto.randomUUID();
    await repositoryPreferiti.crea({ user_id: UTENTE, alimento_id: alimentoId });
    await repositoryPreferiti.crea({ user_id: UTENTE, alimento_id: alimentoId });

    await togliPreferito(UTENTE, alimentoId);

    const vivi = await repositoryPreferiti.ottieniTutti(UTENTE);
    expect(vivi.filter((p) => p.alimento_id === alimentoId)).toHaveLength(0);
  });
});
