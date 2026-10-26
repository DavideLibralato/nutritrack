// La pulizia di questo dispositivo quando l'account non esiste più
// (PUNTO_DI_PARTENZA.md §9.6). Una sola, per tutti quelli che la fanno:
// - Elimina account, dopo il sì del server (eliminaAccount.ts);
// - l'account eliminato da un altro dispositivo (accountEliminatoAltrove.ts).
//
// Toglie solo ciò che è di quell'utente o che chi entra dopo non deve
// vedere: le sue righe in Dexie, le sue voci in coda, la sua foto
// (cancellaDatiUtente), le pagine salvate dal service worker, l'ora
// dell'ultimo contatto col server, il segno del reset password, le novità
// di Amici, l'esito dell'onboarding in sospeso, lo stato dei giri in
// memoria. Gli altri utenti e il catalogo condiviso restano.
//
// NON tocca la sessione e NON tocca il segno "eliminazione in corso": li
// gestisce chi chiama, ognuno nel suo ordine.
//
// Non si ferma mai: un pezzo che fallisce non impedisce gli altri.
// Restituisce false se la pulizia di Dexie (l'unica che conta per i dati)
// non è riuscita: chi chiama lascia il segno, e il prossimo avvio riprova.

import { cancellaDatiUtente } from "../sync/ripristino";
import { svuotaPagineSalvate } from "../serviceWorker";
import { azzeraStatoGiri, CHIAVE_ULTIMO_SUCCESSO } from "../sync/statoSincronizzazione";
import { cancellaNovita } from "../amici/novita";
import { togliSegnoRipristino } from "../segnoRipristinoPassword";
import { togliSegnoLocale } from "../onboarding/segnoOnboarding";

export async function pulisciDispositivoDopoEliminazione(idUtente: string): Promise<boolean> {
  let dexiePulito = true;
  try {
    await cancellaDatiUtente(idUtente);
  } catch (errore) {
    dexiePulito = false;
    console.error("Account eliminato: pulizia di Dexie non riuscita, si riprova al prossimo avvio.", errore);
  }
  await svuotaPagineSalvate().catch(() => {});
  try {
    localStorage.removeItem(CHIAVE_ULTIMO_SUCCESSO);
  } catch {
    // Niente localStorage: non c'era niente da togliere.
  }
  togliSegnoRipristino();
  // Le novità di Amici salvate per il pallino offline (dal 15/10).
  cancellaNovita(idUtente);
  // L'esito dell'onboarding in sospeso (dal 17/10): l'account non c'è più,
  // non c'è niente a cui mandarlo.
  togliSegnoLocale(idUtente);
  // Dopo aver tolto l'ora salvata: azzeraStatoGiri la rilegge da lì.
  azzeraStatoGiri();
  return dexiePulito;
}
