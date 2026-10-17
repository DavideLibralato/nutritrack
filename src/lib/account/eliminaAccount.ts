// "Elimina il mio account" (PUNTO_DI_PARTENZA.md §9.6): chiede al server di
// cancellare l'account (funzione Postgres elimina_mio_account, migration
// supabase/migrations/elimina_mio_account.sql) e, SOLO dopo il suo sì,
// pulisce questo dispositivo ed esce. Il componente (EliminaAccount.tsx)
// mostra l'esito; qui non c'è interfaccia.
//
// L'ordine conta:
// 1. il server risponde ed è proprio questo utente? Se no, niente toccato;
// 2. segno "richiesta" (eliminazioneInCorso.ts), poi la chiamata;
// 3. risposta:
//    - sì → segno "confermata", poi la pulizia;
//    - rifiuto del server (status HTTP) → la funzione gira in una
//      transazione, quindi non ha cancellato niente: segno tolto;
//    - nessuna risposta (rete caduta, tempo scaduto) → la richiesta può
//      essere arrivata o no: si chiede al server se l'utente esiste ancora.
//      Non esiste → come un sì. Esiste → non era arrivata, segno tolto. Non
//      si sa → "risposta persa": il segno "richiesta" resta, e lo risolve
//      il prossimo tentativo o il prossimo avvio;
// 4. pulizia: dati dell'utente in Dexie, pagine salvate dal service
//    worker, ora dell'ultimo contatto col server, segno del reset password,
//    esito dell'onboarding in sospeso, stato dei giri in memoria, e per
//    ultima la sessione. Una pulizia
//    fallita non ferma l'uscita: il segno "confermata" resta e il prossimo
//    avvio la ripete.

import { createClient } from "../supabase/client";
import { cancellaDatiUtente } from "../sync/ripristino";
import { svuotaPagineSalvate } from "../serviceWorker";
import { azzeraStatoGiri, CHIAVE_ULTIMO_SUCCESSO } from "../sync/statoSincronizzazione";
import { cancellaNovita } from "../amici/novita";
import { conTempoMassimo, SCADUTA } from "../sync/tempoMassimo";
import { togliSegnoRipristino } from "../segnoRipristinoPassword";
import { togliSegnoLocale } from "../onboarding/segnoOnboarding";
import { classificaErroreVerifica } from "../supabase/utenteOffline";
import {
  classificaVerificaUtente,
  scriviSegnoEliminazione,
  togliSegnoEliminazione,
  type VerificaUtente,
} from "./eliminazioneInCorso";

export type EsitoEliminazione =
  // Account cancellato, dispositivo pulito, sessione chiusa: si va al login.
  | "eliminato"
  // Il server non ha risposto prima della chiamata, o la chiamata non è
  // arrivata: l'account non è stato toccato.
  | "rete"
  // La chiamata è partita ma la risposta no, e non si riesce a sapere com'è
  // andata. Riprovare è sicuro (la funzione è idempotente).
  | "risposta-persa"
  // Il server ha rifiutato la richiesta: l'account non è stato toccato.
  | "rifiutato"
  // Il server non riconosce più questa sessione (scaduta, uscita da un
  // altro dispositivo): serve rientrare prima di eliminare.
  | "sessione";

// La parola da scrivere per confermare: "ELIMINA", con maiuscole e
// minuscole indifferenti e senza contare gli spazi ai bordi (deciso
// l'11/10: sull'iPhone la tastiera mette da sola la prima maiuscola).
export const PAROLA_DI_CONFERMA = "ELIMINA";

export function parolaDiConfermaGiusta(testo: string): boolean {
  return testo.trim().toUpperCase() === PAROLA_DI_CONFERMA;
}

// Chiede al server se l'utente esiste ancora. Usata qui dopo una risposta
// persa e all'avvio dell'app (RipresaEliminazioneAccount.tsx).
export async function verificaUtenteSulServer(idUtente: string): Promise<VerificaUtente> {
  const { data, error } = await createClient().auth.getUser();
  return classificaVerificaUtente(idUtente, data.user, error);
}

export async function eliminaAccount(idUtente: string): Promise<EsitoEliminazione> {
  const supabase = createClient();

  // 1. Il server risponde ed è proprio questo utente?
  // Rete assente, server in errore: "rete" (regola di utenteOffline.ts).
  const { data, error } = await supabase.auth.getUser();
  const prima = classificaVerificaUtente(idUtente, data.user, error);
  if (prima !== "non-esiste" && classificaErroreVerifica(error) === "rete") return "rete";
  // Già cancellato (per esempio un nuovo tentativo dopo una risposta
  // persa): resta solo la pulizia.
  if (prima === "non-esiste") return confermaEPulisci(idUtente);
  if (prima !== "esiste") return "sessione";

  // 2. Segno, poi la chiamata.
  scriviSegnoEliminazione(idUtente, "richiesta");
  const risposta = await conTempoMassimo(supabase.rpc("elimina_mio_account"));

  // 3. La risposta.
  if (risposta !== SCADUTA && !risposta.error) return confermaEPulisci(idUtente);

  if (risposta !== SCADUTA && risposta.status !== 0) {
    console.error("Eliminazione account rifiutata dal server.", risposta.error);
    togliSegnoEliminazione();
    return "rifiutato";
  }

  const dopo = await verificaUtenteSulServer(idUtente).catch((): VerificaUtente => "sconosciuto");
  if (dopo === "non-esiste") return confermaEPulisci(idUtente);
  if (dopo === "esiste") {
    togliSegnoEliminazione();
    return "rete";
  }
  return "risposta-persa";
}

// 4. Da qui l'account non c'è più: niente può più fermare l'uscita.
async function confermaEPulisci(idUtente: string): Promise<"eliminato"> {
  scriviSegnoEliminazione(idUtente, "confermata");

  try {
    await cancellaDatiUtente(idUtente);
  } catch (errore) {
    console.error("Eliminazione account: pulizia di Dexie non riuscita, si riprova al prossimo avvio.", errore);
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

  // scope "local": la sessione sul server non esiste più, si toglie quella
  // salvata qui. Un errore (rete) non conta: l'account è già cancellato, e
  // il server rifiuterà comunque quel token.
  await createClient()
    .auth.signOut({ scope: "local" })
    .catch(() => {});

  return "eliminato";
}
