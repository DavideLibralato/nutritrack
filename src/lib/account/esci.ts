// Esci (PUNTO_DI_PARTENZA.md §9.6, "Esci svuota i dati locali"): decide se
// uscendo si svuotano i dati di questo utente dal dispositivo, poi esce.
// Il componente (EsciAccount.tsx) mostra conferme ed esiti; qui non c'è
// interfaccia. "Esci" in fondo a Impostazioni ed "Esci e rientra" in
// Sincronizzazione passano entrambi da qui: decide lo stato, non il
// pulsante.
//
// Due tempi, perché in mezzo può esserci una conferma:
// 1. preparaUscita: il server risponde? (offline non si esce, e una
//    conferma "perdi N" offline sarebbe falsa). Con la sessione valida
//    prova a inviare la coda, poi conta ciò che resta e decide:
//    - coda vuota → "svuota", senza chiedere;
//    - coda non vuota, sessione valida → "conferma-perdita": ciò che resta
//      il server non lo prende da solo;
//    - coda non vuota, sessione non valida → "tieni": rientrando con lo
//      stesso account le modifiche partono. Non si svuota niente.
// 2. eseguiUscita: signOut, controllo che la sessione sia sparita, e solo
//    se la decisione svuota: segno di uscita, attesa delle discese in
//    corso, pulizia.
//
// IL SEGNO SI SCRIVE SOLO SE SI SVUOTA. Con "tieni" i dati restano apposta:
// un segno scritto lì farebbe cancellare proprio quei dati alla ripresa
// del prossimo avvio (uscitaInCorso.ts), con le modifiche non inviate.

import { createClient } from "../supabase/client";
import { classificaErroreVerifica } from "../supabase/utenteOffline";
import {
  modificheNonInviate,
  sostituisciDatiUtente,
  type ModificheNonInviate,
} from "../sync/ripristino";
import { sincronizzaOutbox } from "../sync/sincronizza";
import { attendiDiscesaInCorso } from "../sync/discesa";
import { azzeraStatoGiri, CHIAVE_ULTIMO_SUCCESSO } from "../sync/statoSincronizzazione";
import { cancellaNovita } from "../amici/novita";
import { svuotaPagineSalvate } from "../serviceWorker";
import { togliSegnoRipristino } from "../segnoRipristinoPassword";
import { scriviSegnoUscita, togliSegnoUscita } from "./uscitaInCorso";

export type DecisioneUscita = "svuota" | "conferma-perdita" | "tieni";

// Funzione pura: la regola decisa l'11/10.
export function decidiUscita(modificheRimaste: number, sessioneValida: boolean): DecisioneUscita {
  if (modificheRimaste === 0) return "svuota";
  return sessioneValida ? "conferma-perdita" : "tieni";
}

export function totaleModifiche(modifiche: ModificheNonInviate): number {
  return modifiche.inAttesa.numero + modifiche.nonRiuscite.numero;
}

export type PreparazioneUscita =
  // Il server non risponde: non si esce, niente toccato.
  | { esito: "rete" }
  | { esito: "pronta"; decisione: DecisioneUscita; modifiche: ModificheNonInviate };

export async function preparaUscita(userId: string): Promise<PreparazioneUscita> {
  // getUser è una vera chiamata di rete (navigator.onLine su iOS non è
  // affidabile). Un errore di autenticazione invece è una risposta: la
  // sessione non vale più, ed è proprio il caso di "Esci e rientra".
  const { data, error } = await createClient().auth.getUser();
  const verifica = classificaErroreVerifica(error);
  if (verifica === "rete") return { esito: "rete" };
  const sessioneValida = verifica === null && data.user?.id === userId;

  // Prima prova a inviare ciò che è in coda (spesso basta a svuotarla).
  // Con la sessione non valida non partirebbe niente.
  if (sessioneValida) await sincronizzaOutbox().catch(() => {});

  const modifiche = await modificheNonInviate(userId);
  return {
    esito: "pronta",
    decisione: decidiUscita(totaleModifiche(modifiche), sessioneValida),
    modifiche,
  };
}

export type EsitoUscita =
  // Uscito: si va al login.
  | "uscito"
  // signOut non ha tolto la sessione (rete caduta in mezzo, token
  // scaduto): si resta dentro, niente svuotato.
  | "sessione-rimasta";

// `firme`: le modifiche non inviate che l'utente ha visto (vuote se la coda
// era vuota). Una modifica comparsa dopo, da un'altra scheda, fa saltare
// la pulizia: i dati restano, mai persi in silenzio.
export async function eseguiUscita(
  userId: string,
  decisione: DecisioneUscita,
  firme: string[]
): Promise<EsitoUscita> {
  const svuota = decisione !== "tieni";
  const supabase = createClient();

  // scope "local": esce solo QUESTO dispositivo. Il predefinito ("global")
  // chiuderebbe la sessione anche sugli altri dispositivi dello stesso
  // account.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});

  // Uscita completa o niente.
  const { data } = await supabase.auth.getSession();
  if (data.session) return "sessione-rimasta";

  if (svuota) {
    // Prima il segno: se l'app si chiude da qui in poi, la pulizia la
    // finisce il prossimo avvio.
    scriviSegnoUscita(userId, firme);
    // Una discesa partita prima dell'uscita può ancora scrivere righe e
    // cursore: si pulisce solo quando ha finito (discesa.ts). Dopo
    // signOut una discesa nuova fallisce subito, senza scrivere.
    await attendiDiscesaInCorso();
    try {
      const pulito = await sostituisciDatiUtente(userId, new Map(), firme);
      togliSegnoUscita();
      if (!pulito) {
        console.error("Uscita: in coda c'è una modifica non confermata, dati lasciati sul dispositivo.");
      }
    } catch (errore) {
      // Il segno resta: il prossimo avvio riprova. L'uscita non si ferma.
      console.error("Uscita: pulizia del dispositivo non riuscita, si riprova al prossimo avvio.", errore);
    }
  }

  // Questi sempre: non sono dati da salvare, e chi entra dopo su questo
  // dispositivo non deve vederli.
  // - le pagine salvate per l'uso offline: senza rete l'app si riaprirebbe
  //   come se si fosse ancora dentro;
  await svuotaPagineSalvate().catch(() => {});
  // - l'ora dell'ultimo contatto col server e il segno del reset password;
  try {
    localStorage.removeItem(CHIAVE_ULTIMO_SUCCESSO);
  } catch {
    // Niente localStorage: non c'era niente da togliere.
  }
  togliSegnoRipristino();
  // - le novità di Amici salvate per il pallino offline (dal 15/10);
  cancellaNovita(userId);
  // - lo stato dei giri in memoria. Dopo aver tolto l'ora salvata:
  //   azzeraStatoGiri la rilegge da lì.
  azzeraStatoGiri();

  return "uscito";
}
