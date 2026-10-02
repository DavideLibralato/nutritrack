// "Annulla" dopo un inserimento nel diario (PUNTO_DI_PARTENZA.md, punti 10.2
// e 10.6).
//
// Cancellazione LOGICA tramite il repository (deleted_at + outbox), mai una
// rimozione della riga da Dexie: la coda ha una voce sola per riga
// ("voci_diario:<id>"), quindi la cancellazione sostituisce l'inserimento
// se non era ancora partito, o viaggia dopo di lui se era già su Supabase.
// In entrambi i casi la voce non ricompare al sync successivo.
//
// Si annulla per id, non per gruppo_id: si cancellano esattamente le righe
// create da quell'inserimento, nemmeno una di più. Ogni voce è riletta da
// Dexie, non presa dallo stato React: una voce già cancellata (dallo sheet
// in Oggi, o da un primo Annulla interrotto a metà) si salta, così
// riprovare dopo un errore è sicuro.
//
// La riga di `giorni` creata dalla prima voce (garantisciGiornoPerPrima
// Voce) resta: può contenere una scelta esplicita fatta con la pastiglia
// nel frattempo, che vince sempre (sezione 3). Annullare si comporta come
// cancellare l'ultima voce dallo sheet.

import { repositoryVociDiario } from "./index";

// Restituisce quante voci ha cancellato davvero.
export async function annullaInserimento(idVoci: string[]): Promise<number> {
  let cancellate = 0;
  for (const id of idVoci) {
    const voce = await repositoryVociDiario.ottieniPerId(id);
    if (!voce || voce.deleted_at !== null) continue;
    await repositoryVociDiario.elimina(id);
    cancellate++;
  }
  return cancellate;
}
