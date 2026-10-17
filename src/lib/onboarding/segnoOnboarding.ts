// Il segno dell'onboarding fuori dalla logica pura (PUNTO_DI_PARTENZA.md,
// sezione 3, "Onboarding"): dove si legge, dove si scrive, come arriva al
// server. Le decisioni stanno in statoOnboarding.ts (statoSegno,
// decidiRipresa), testate a parte.
//
// Tre posti:
//   - i metadati dell'account (campo `onboarding`), letti dalla sessione
//     salvata nel cookie: si leggono anche offline, senza nessuna chiamata
//     di rete;
//   - una chiave locale per utente in localStorage, con l'esito scritto sul
//     dispositivo e non ancora confermato dal server. Vince sui metadati;
//   - il server, con updateUser.
//
// La chiave locale sopravvive a Esci apposta (esci.ts toglie solo le sue
// chiavi): un esito che il server non ha ancora lo manda la ripresa al
// prossimo accesso. La toglie Elimina account.

import { createClient } from "../supabase/client";
import { chiaveSessione, leggiSessioneSalvata } from "../supabase/utenteOffline";
import { idUtenteDellaSessione } from "../supabase/utenteDellaSessione";
import { repositoryMisurazioni, repositoryObiettivi, repositoryProfili } from "../repository";
import { discesaRiuscitaPer } from "../sync/statoSincronizzazione";
import {
  CHIAVE_METADATI_ONBOARDING,
  decidiRipresa,
  segnoDaiMetadati,
  segnoEffettivo,
  type SegnoLocale,
  type SegnoMetadati,
} from "./statoOnboarding";

// --- Il segno nei metadati -------------------------------------------------

// Il segno dei metadati della sessione salvata sul dispositivo, per questo
// utente. Letto dal cookie, come fanno useUtenteId e
// idUtenteDellaSessione quando supabase-js non dà la sessione: nessuna
// chiamata di rete, quindi va bene anche per chi non ha nessun segno.
// supabase-js riscrive il cookie dopo un updateUser riuscito, quindi il
// valore è quello confermato dal server. null se la sessione salvata è di
// un altro utente o non c'è.
export function segnoDellaSessione(userId: string): SegnoMetadati {
  const sessione = sessioneDelCookie();
  return sessione?.id === userId ? segnoDaiMetadati(sessione.metadati) : null;
}

// L'id dell'utente della sessione salvata se il suo segno effettivo (chiave
// locale, altrimenti metadati) è `segno`, altrimenti null. Solo cookie e
// localStorage: nessuna chiamata di rete, niente Dexie. Serve a chi deve
// decidere qualcosa solo per un segno, senza leggere Dexie per tutti gli
// altri utenti:
//   - "da_fare": la guardia di (app)/layout.tsx. Solo con "da_fare"
//     statoSegno può dire "mostra l'onboarding";
//   - "rimandato": la scheda "Completa il tuo profilo" di Oggi. Solo con
//     "rimandato" statoSegno può dire "mostra la scheda".
export function utenteConSegno(segno: "da_fare" | "rimandato"): string | null {
  const sessione = sessioneDelCookie();
  if (!sessione) return null;
  const effettivo = segnoEffettivo(segnoDaiMetadati(sessione.metadati), leggiSegnoLocale(sessione.id));
  return effettivo === segno ? sessione.id : null;
}

function sessioneDelCookie() {
  try {
    return leggiSessioneSalvata(document.cookie, chiaveSessione(process.env.NEXT_PUBLIC_SUPABASE_URL!));
  } catch {
    // Cookie o indirizzo illeggibili: come nessuna sessione.
    return null;
  }
}

// --- La chiave locale -------------------------------------------------------

export function chiaveSegnoLocale(userId: string): string {
  return `nutritrack:onboarding:${userId}`;
}

// Chi ascolta la chiave locale (useStatoOnboarding): avvisato a ogni
// scrittura e cancellazione fatte da qui.
const ascoltatori = new Set<() => void>();

export function iscriviSegnoLocale(ascoltatore: () => void): () => void {
  ascoltatori.add(ascoltatore);
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

function avvisa() {
  for (const ascoltatore of ascoltatori) ascoltatore();
}

// Un valore rovinato (scritto a mano, versione diversa) vale "niente in
// sospeso": nel dubbio non si manda niente al server.
export function leggiSegnoLocale(userId: string): SegnoLocale {
  try {
    const valore = window.localStorage.getItem(chiaveSegnoLocale(userId));
    return valore === "fatto" || valore === "rimandato" ? valore : null;
  } catch {
    return null;
  }
}

function scriviSegnoLocale(userId: string, esito: "fatto" | "rimandato") {
  try {
    window.localStorage.setItem(chiaveSegnoLocale(userId), esito);
  } catch {
    // Niente localStorage: l'esito arriva solo se il server risponde subito.
  }
  avvisa();
}

export function togliSegnoLocale(userId: string) {
  try {
    window.localStorage.removeItem(chiaveSegnoLocale(userId));
  } catch {
    // Niente localStorage: non c'era niente da togliere.
  }
  avvisa();
}

// --- Verso il server --------------------------------------------------------

export type EsitoConclusione = "confermato" | "in-sospeso";

// "Inizia a usare Libra" (fatto) o "Lo faccio dopo" (rimandato). Prima la
// chiave locale, così l'esito vale subito anche offline; poi updateUser.
// Riuscito → la chiave si toglie. Non riuscito (rete, sessione scaduta) →
// resta, e la manda la ripresa. Non lancia mai: chi chiama va avanti in
// tutti e due i casi.
//
// updateUser scrive sull'account della sessione: se la sessione è di un
// altro utente (cambiato nel frattempo), non si manda niente, per non
// mettere il segno sull'account sbagliato.
export async function concludiOnboarding(
  userId: string,
  esito: "fatto" | "rimandato"
): Promise<EsitoConclusione> {
  scriviSegnoLocale(userId, esito);
  try {
    if ((await idUtenteDellaSessione()) !== userId) return "in-sospeso";
    const { error } = await createClient().auth.updateUser({
      data: { [CHIAVE_METADATI_ONBOARDING]: esito },
    });
    if (error) return "in-sospeso";
    togliSegnoLocale(userId);
    return "confermato";
  } catch {
    return "in-sospeso";
  }
}

// Per Esci: se c'è un esito in sospeso, un tentativo prima di uscire. Senza
// chiave non fa niente, nemmeno una chiamata. Non lancia mai, e un
// tentativo fallito lascia la chiave: dopo l'uscita la manda la ripresa al
// prossimo accesso.
export async function inviaSegnoInSospeso(userId: string): Promise<void> {
  const locale = leggiSegnoLocale(userId);
  if (locale !== null) await concludiOnboarding(userId, locale);
}

// --- La ripresa --------------------------------------------------------------

// Ci sono righe dell'utente in Dexie nelle tre tabelle da cui si decide
// l'onboarding (TABELLE_DATI_ONBOARDING in discesa.ts)? Righe di altre
// tabelle non dicono niente su queste: i pasti predefiniti, per esempio, si
// creano su un dispositivo nuovo anche prima che i profili scendano.
export async function righeOnboardingInDexie(userId: string): Promise<boolean> {
  const [profili, misurazioni, obiettivi] = await Promise.all([
    repositoryProfili.ottieniTutti(userId),
    repositoryMisurazioni.ottieniTutti(userId),
    repositoryObiettivi.ottieniTutti(userId),
  ]);
  return profili.length > 0 || misurazioni.length > 0 || obiettivi.length > 0;
}

// La ripresa per l'utente della sessione salvata nel cookie
// (RipresaSegnoOnboarding). L'id si legge dal cookie e non con getUser:
// così chi non ha nessun segno non fa nessuna chiamata di rete, nemmeno per
// sapere chi è. Senza sessione salvata non fa niente.
export function riprendiSegnoDellaSessione(motivo: MotivoRipresa): Promise<void> {
  const userId = sessioneDelCookie()?.id;
  return userId ? riprendiSegnoOnboarding(userId, motivo) : Promise.resolve();
}

// Da cosa parte la ripresa. "giro": un avviso dei giri di sincronizzazione,
// che serve solo a vedere la prima discesa riuscita, non a ritentare.
export type MotivoRipresa = "avvio" | "online" | "giro";

// Una ripresa alla volta per utente: l'avvio, il ritorno della rete e la
// fine della discesa possono arrivare insieme. Chi arriva mentre una è in
// corso riceve quella: al massimo una chiamata a updateUser alla volta.
const ripreseInCorso = new Map<string, Promise<void>>();

// Gli utenti per cui, in questa sessione dell'app, l'ultimo invio della
// ripresa è fallito (rete, sessione scaduta). Finché c'è il segno, i giri
// non ritentano: con la sessione scaduta ogni giro rifarebbe una chiamata
// destinata a fallire. Si ritenta solo al ritorno della rete o al prossimo
// avvio (ricaricare l'app azzera la memoria). Un invio riuscito lo toglie.
const invioFallito = new Set<string>();

// Applica decidiRipresa: all'avvio, al ritorno della rete, agli avvisi dei
// giri (RipresaSegnoOnboarding). Per un utente senza segno né chiave
// finisce subito: niente Dexie, niente rete. Non lancia mai.
export function riprendiSegnoOnboarding(userId: string, motivo: MotivoRipresa = "avvio"): Promise<void> {
  const inCorso = ripreseInCorso.get(userId);
  if (inCorso) return inCorso;
  const ripresa = eseguiRipresa(userId, motivo)
    .catch((errore) => console.error("Ripresa del segno dell'onboarding non riuscita.", errore))
    .finally(() => ripreseInCorso.delete(userId));
  ripreseInCorso.set(userId, ripresa);
  return ripresa;
}

async function eseguiRipresa(userId: string, motivo: MotivoRipresa): Promise<void> {
  const metadati = segnoDellaSessione(userId);
  const locale = leggiSegnoLocale(userId);
  if (metadati === null) return;

  // La rete di sicurezza serve solo senza chiave e con un segno non
  // "fatto"; e conta solo con i dati noti.
  let ciSonoObiettivi: boolean | null = null;
  if (locale === null && metadati !== "fatto") {
    const noti = discesaRiuscitaPer(userId) || (await righeOnboardingInDexie(userId));
    if (noti) ciSonoObiettivi = (await repositoryObiettivi.ottieniTutti(userId)).length > 0;
  }

  const decisione = decidiRipresa(metadati, locale, ciSonoObiettivi);
  if (decisione.togliLocale) togliSegnoLocale(userId);
  if (!decisione.manda) return;
  if (motivo === "giro" && invioFallito.has(userId)) return;

  const esito = await concludiOnboarding(userId, decisione.manda);
  if (esito === "confermato") invioFallito.delete(userId);
  else invioFallito.add(userId);
}
