// «Nei tuoi» (PUNTO_DI_PARTENZA.md §10.1): un alimento del catalogo
// precaricato è già fra quelli dell'utente se fra i suoi alimenti vivi
// c'è
// 1. una copia presa da lì (`catalogo_id` uguale all'id del catalogo),
//    anche se l'ha rinominata o ne ha cambiato la marca;
// 2. oppure un doppione secondo la regola di sempre ("Mai due alimenti
//    uguali", §3): stesso codice a barre non vuoto, oppure stesso nome e
//    marca. È il caso di un prodotto creato a mano o con la scansione
//    prima di esistere nel catalogo (sull'account di prova «Gocciole
//    chocolate · Pavesi», codice 8013355999143).
//
// La copia viene prima del doppione: è quella che «Apri» deve aprire.
// Contano solo gli alimenti vivi dell'utente, come in trovaDoppione: una
// copia cancellata non conta (si può riaggiungere: nasce una riga nuova),
// né il catalogo comune, né gli alimenti di un altro utente rimasti sul
// telefono.
//
// Funzione pura: i test sono in neiTuoi.test.ts.

import type { Alimento } from "../db/tipi";
import type { AlimentoCatalogo } from "./catalogoPrecaricato";
import { trovaDoppione } from "./doppioniAlimenti";

export type StatoNelCatalogo =
  | { stato: "da-aggiungere" }
  // `alimento`: quello che «Apri» apre. `perche`: "copia" se viene da qui,
  // "doppione" se è un alimento uguale nato in un altro modo.
  | { stato: "nei-tuoi"; alimento: Alimento; perche: "copia" | "doppione" };

export function statoNelCatalogo(
  voce: AlimentoCatalogo,
  catalogoUtente: Alimento[],
  userId: string
): StatoNelCatalogo {
  const copia = catalogoUtente.find(
    (a) => a.deleted_at === null && a.user_id === userId && (a.catalogo_id ?? null) === voce.id
  );
  if (copia) return { stato: "nei-tuoi", alimento: copia, perche: "copia" };
  const doppione = trovaDoppione(
    catalogoUtente,
    { nome: voce.nome, marca: voce.marca, barcode: voce.barcode },
    { userId }
  );
  if (doppione) return { stato: "nei-tuoi", alimento: doppione, perche: "doppione" };
  return { stato: "da-aggiungere" };
}
