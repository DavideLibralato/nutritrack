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

// Registra un peso senza riempire lo storico di duplicati: se esiste già
// una misurazione di oggi la aggiorna, altrimenti ne crea una nuova solo se
// il valore è cambiato rispetto all'ultima registrata (o se non c'era
// ancora nessuna misurazione).
export async function registraPesoSenzaDuplicati(
  userId: string,
  valoreKg: number,
  misurazioniPesoEsistenti: Misurazione[]
): Promise<void> {
  // Il giorno dell'orologio locale, non quello UTC di toISOString(): a Roma
  // fra mezzanotte e le 2 sarebbe ancora "ieri" (vedi dataGiorno.ts).
  const oggi = oggiLocale();
  const rigaOggi = misurazioniPesoEsistenti.find((riga) => riga.data === oggi);

  if (rigaOggi) {
    if (rigaOggi.valore !== valoreKg) {
      await repositoryMisurazioni.aggiorna(rigaOggi.id, { valore: valoreKg });
    }
    return;
  }

  const ultima = ultimaMisurazione(misurazioniPesoEsistenti);
  if (!ultima || ultima.valore !== valoreKg) {
    await repositoryMisurazioni.crea({
      user_id: userId,
      tipo: "peso",
      valore: valoreKg,
      unita: "kg",
      data: oggi,
    });
  }
}
