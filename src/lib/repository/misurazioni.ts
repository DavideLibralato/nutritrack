// Helper specifici per le misurazioni (peso, in questa fase), oltre al CRUD
// generico di repositoryMisurazioni. Vivono qui e non nella pagina Profilo
// perché li usa il campo "Registra peso" (src/components/RegistraPeso.tsx).

import { repositoryMisurazioni } from "./index";
import type { Misurazione } from "../db/tipi";
import { oggiLocale } from "../dataGiorno";

// La più recente per data (non per updated_at: due misurazioni possono
// essere inserite in ordine diverso da quello dei giorni a cui si
// riferiscono — un inserimento retroattivo, ad esempio).
export function ultimaMisurazione(righe: Misurazione[]): Misurazione | null {
  if (righe.length === 0) return null;

  return [...righe].sort((a, b) => {
    const perData = b.data.localeCompare(a.data);
    return perData !== 0 ? perData : b.updated_at.localeCompare(a.updated_at);
  })[0];
}

// Registra la pesata del giorno (PUNTO_DI_PARTENZA.md, sezione 3, "Peso"):
//   - nello stesso giorno c'è al massimo una pesata: se esiste già, il
//     valore nuovo la sostituisce (stesso valore = niente da scrivere);
//   - in un giorno diverso si scrive SEMPRE, anche se il valore è uguale
//     all'ultima pesata: "oggi peso come ieri" è un dato, serve allo storico
//     e al grafico del peso.
// Fino al 3/10 un valore uguale all'ultima pesata di un altro giorno non si
// scriveva: veniva dal 6/9, quando il peso partiva con ogni "Salva
// obiettivo" anche se non era stato toccato. Con "Registra peso" (un gesto
// esplicito, con il suo pulsante) quel motivo non c'è più, e il messaggio
// "Registrato" mentiva.
//
// La pesata del giorno si cerca rileggendo Dexie QUI DENTRO, non da un
// elenco passato dalla pagina (stato React di useLiveQuery, che può essere
// indietro di un giro): due "Registra" ravvicinati creerebbero due righe
// per lo stesso giorno. Stessa regola di salvaProfilo e
// garantisciGiornoPerPrimaVoce.
//
// `giorno`: "YYYY-MM-DD", il giorno dell'orologio locale (oggiLocale), non
// quello UTC di toISOString(): a Roma fra mezzanotte e le 2 sarebbe ancora
// "ieri" (vedi dataGiorno.ts). Parametro solo per i test.
export async function registraPesoSenzaDuplicati(
  userId: string,
  valoreKg: number,
  giorno: string = oggiLocale()
): Promise<void> {
  const righe = await repositoryMisurazioni.ottieniTutti(userId);
  const rigaDelGiorno = righe.find(
    (riga) => riga.tipo === "peso" && riga.data === giorno && riga.deleted_at === null
  );

  if (rigaDelGiorno) {
    if (rigaDelGiorno.valore !== valoreKg) {
      await repositoryMisurazioni.aggiorna(rigaDelGiorno.id, { valore: valoreKg });
    }
    return;
  }

  await repositoryMisurazioni.crea({
    user_id: userId,
    tipo: "peso",
    valore: valoreKg,
    unita: "kg",
    data: giorno,
  });
}
