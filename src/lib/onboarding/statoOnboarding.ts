// Le decisioni dell'onboarding (PUNTO_DI_PARTENZA.md, sezione 3,
// "Onboarding"): da quale passo si parte, cosa manca per la scheda di Oggi,
// e cosa vuol dire il segno nei metadati dell'account.
//
// Funzioni pure: i dati entrano come parametri, niente Dexie, Supabase o
// localStorage. Sono logica che sbaglia in silenzio (CLAUDE.md, test
// permanenti): un passo sbagliato fa riscrivere dati già salvati, un segno
// letto male mostra l'onboarding a un utente di prima o lo fa ricomparire
// a chi l'ha finito. Test in statoOnboarding.test.ts.

import type { Misurazione, Obiettivo, Profilo } from "../db/tipi";

// --- Il passo da fare -----------------------------------------------------

// 1 Benvenuto, 2 Su di te, 3 Il tuo peso, 4 Il tuo obiettivo, 5 Obiettivi
// giornalieri.
export type PassoOnboarding = 1 | 2 | 3 | 4 | 5;

// Il primo passo da fare. Mai il 5: i passi 4 e 5 si salvano insieme alla
// fine, quindi chi non ha un obiettivo riparte sempre dal 4.
export type PassoDaFare = 2 | 3 | 4 | "finito";

// Le etichette di "cosa manca" nella scheda "Completa il tuo profilo".
export const ETICHETTE_PASSI: Record<2 | 3 | 4 | 5, string> = {
  2: "Su di te",
  3: "Il tuo peso",
  4: "Il tuo obiettivo",
  5: "Obiettivi giornalieri",
};

// `deleted_at` è ricontrollato qui anche se il repository lo filtra già: la
// funzione è pura e deve dare il risultato giusto a chiunque le passi una
// lista (stessa regola di vociDelGiorno in totaliDiario.ts).
function profiloVivo(profilo: Profilo | null): Profilo | null {
  return profilo && profilo.deleted_at === null ? profilo : null;
}

function haPesate(misurazioni: Misurazione[]): boolean {
  return misurazioni.some((m) => m.tipo === "peso" && m.deleted_at === null);
}

function haObiettivi(obiettivi: Obiettivo[]): boolean {
  return obiettivi.some((o) => o.deleted_at === null);
}

// I passi i cui dati non sono salvati, in ordine. La base di tutto il
// resto: il primo passo da fare è il primo di questa lista, "cosa manca" è
// la lista intera.
//   - un obiettivo vivo → niente da fare, qualunque cosa manchi (chi ha
//     impostato gli obiettivi da Impostazioni ha già finito);
//   - passo 2: profilo assente, o data di nascita, altezza o livello di
//     attività vuoti. Il sesso non si controlla: "non_indicato" è sia il
//     valore iniziale della colonna sia una risposta valida;
//   - passo 3: nessuna pesata viva;
//   - passi 4 e 5: sempre insieme, perché si salvano insieme.
function passiMancanti(
  profilo: Profilo | null,
  misurazioni: Misurazione[],
  obiettivi: Obiettivo[]
): (2 | 3 | 4 | 5)[] {
  if (haObiettivi(obiettivi)) return [];

  const passi: (2 | 3 | 4 | 5)[] = [];
  const p = profiloVivo(profilo);
  if (!p || !p.data_nascita || p.altezza_cm == null || !p.livello_attivita) passi.push(2);
  if (!haPesate(misurazioni)) passi.push(3);
  passi.push(4, 5);
  return passi;
}

export function primoPassoDaFare(
  profilo: Profilo | null,
  misurazioni: Misurazione[],
  obiettivi: Obiettivo[]
): PassoDaFare {
  const passi = passiMancanti(profilo, misurazioni, obiettivi);
  return passi.length === 0 ? "finito" : (passi[0] as 2 | 3 | 4);
}

// Le etichette di tutto ciò che manca, non solo del primo passo: chi ha la
// pesata ma non il profilo vede "Su di te" e i due degli obiettivi. Vuota
// se non manca niente.
export function cosaManca(
  profilo: Profilo | null,
  misurazioni: Misurazione[],
  obiettivi: Obiettivo[]
): string[] {
  return passiMancanti(profilo, misurazioni, obiettivi).map((passo) => ETICHETTE_PASSI[passo]);
}

// Da dove riparte l'onboarding.
//   - "ripresa": l'app riaperta con il segno da_fare. Dal Benvenuto solo se
//     non è salvato niente (nessun profilo, nessuna pesata, nessun
//     obiettivo), altrimenti dal primo passo da fare;
//   - "continua": il pulsante della scheda di Oggi. Sempre dal primo passo
//     da fare, mai dal Benvenuto.
export function passoDiPartenza(
  da: "ripresa" | "continua",
  profilo: Profilo | null,
  misurazioni: Misurazione[],
  obiettivi: Obiettivo[]
): PassoOnboarding | "finito" {
  const primo = primoPassoDaFare(profilo, misurazioni, obiettivi);
  const nienteSalvato =
    !profiloVivo(profilo) && !haPesate(misurazioni) && !haObiettivi(obiettivi);
  return da === "ripresa" && nienteSalvato ? 1 : primo;
}

// --- Il segno -------------------------------------------------------------

// Il campo `onboarding` nei metadati dell'account. null = assente: gli utenti
// registrati prima dell'onboarding.
export type SegnoMetadati = "da_fare" | "rimandato" | "fatto" | null;

// L'esito scritto sul dispositivo e non ancora confermato dal server
// (updateUser offline). null = niente in sospeso.
export type SegnoLocale = "rimandato" | "fatto" | null;

export const CHIAVE_METADATI_ONBOARDING = "onboarding";

// Il segno letto dai metadati della sessione. Un valore che non è uno dei
// tre (un tipo diverso, una stringa sconosciuta) vale assente: nel dubbio
// l'onboarding non si mostra, come per un utente di prima.
export function segnoDaiMetadati(metadati: Record<string, unknown> | undefined): SegnoMetadati {
  const valore = metadati?.[CHIAVE_METADATI_ONBOARDING];
  return valore === "da_fare" || valore === "rimandato" || valore === "fatto" ? valore : null;
}

export interface IngressiSegno {
  metadati: SegnoMetadati;
  locale: SegnoLocale;
  // Almeno un obiettivo vivo in Dexie.
  ciSonoObiettivi: boolean;
  // Una discesa riuscita in questa sessione dell'app.
  discesaRiuscita: boolean;
  // Almeno una riga dell'utente in Dexie, in qualunque tabella.
  righeInDexie: boolean;
}

export interface StatoSegno {
  // Il segno che vale davvero, dopo la chiave locale e la rete di
  // sicurezza. null = utente senza segno.
  segno: SegnoMetadati;
  // La guardia porta all'onboarding.
  mostraOnboarding: boolean;
  // Oggi mostra "Completa il tuo profilo".
  mostraScheda: boolean;
  // I dati in Dexie non bastano ancora per decidere: l'onboarding non sceglie
  // il passo e non scrive, la scheda aspetta.
  attendiDiscesa: boolean;
}

// Le regole, in ordine:
//   1. la chiave locale vince sui metadati (un esito scritto offline);
//   2. senza segno, né nei metadati né in locale → mai onboarding, mai
//      scheda (gli utenti di prima, anche senza obiettivi);
//   3. un obiettivo vivo vale "fatto", qualunque sia il segno (la rete di
//      sicurezza: onboarding finito offline su un altro dispositivo);
//   4. "fatto" → niente;
//   5. "da_fare" → onboarding; "rimandato" → scheda, ma solo con 0
//      obiettivi e dati noti. Dati noti = una discesa riuscita in questa
//      sessione, o righe dell'utente già in Dexie: su un dispositivo vuoto
//      "0 obiettivi" vuol dire solo "non ancora scaricati".
// Il segno prima della rete di sicurezza: la chiave locale, se c'è, vince sui
// metadati (regola 1 di statoSegno). Da qui statoSegno parte, e da qui la
// guardia di (app)/layout.tsx decide se serve leggere Dexie: solo con
// "da_fare" statoSegno può dire "mostra l'onboarding".
export function segnoEffettivo(metadati: SegnoMetadati, locale: SegnoLocale): SegnoMetadati {
  return locale ?? metadati;
}

export function statoSegno(ingressi: IngressiSegno): StatoSegno {
  const nessuno = { mostraOnboarding: false, mostraScheda: false, attendiDiscesa: false };
  const segno = segnoEffettivo(ingressi.metadati, ingressi.locale);

  if (segno === null) return { segno: null, ...nessuno };
  if (ingressi.ciSonoObiettivi || segno === "fatto") return { segno: "fatto", ...nessuno };

  const datiNoti = ingressi.discesaRiuscita || ingressi.righeInDexie;
  if (segno === "da_fare") {
    return { segno, mostraOnboarding: true, mostraScheda: false, attendiDiscesa: !datiNoti };
  }
  return { segno, mostraOnboarding: false, mostraScheda: datiNoti, attendiDiscesa: !datiNoti };
}

// --- La ripresa: cosa mandare al server ------------------------------------

export interface DecisioneRipresa {
  // Il valore da scrivere nei metadati con updateUser; null = niente.
  manda: "fatto" | "rimandato" | null;
  // La chiave locale non serve più: il server ha già quel valore.
  togliLocale: boolean;
}

const NIENTE_DA_FARE: DecisioneRipresa = { manda: null, togliLocale: false };

// Cosa fa la ripresa all'avvio e al ritorno della rete
// (RipresaSegnoOnboarding). `ciSonoObiettivi`: null se non si sa ancora (né
// discesa riuscita né righe dell'utente in Dexie): allora la rete di
// sicurezza non scatta, perché su un telefono nuovo "0 obiettivi" vuol dire
// solo "non ancora scaricati". Le regole, in ordine:
//   1. utente senza segno nei metadati → mai niente, nemmeno una chiamata;
//   2. chiave locale uguale ai metadati → il server l'ha già: si toglie;
//   3. chiave locale "rimandato" con i metadati "fatto" → si toglie senza
//      mandarla: "fatto" è la fine, e "rimandato" sopra di lui
//      riaccenderebbe la scheda di Oggi a chi ha già finito;
//   4. chiave locale diversa dai metadati → si manda la chiave;
//   5. nessuna chiave, metadati da_fare o rimandato e un obiettivo vivo →
//      si manda "fatto" (la rete di sicurezza).
export function decidiRipresa(
  metadati: SegnoMetadati,
  locale: SegnoLocale,
  ciSonoObiettivi: boolean | null
): DecisioneRipresa {
  if (metadati === null) return NIENTE_DA_FARE;
  if (locale !== null) {
    if (locale === metadati || metadati === "fatto") return { manda: null, togliLocale: true };
    return { manda: locale, togliLocale: false };
  }
  if (metadati !== "fatto" && ciSonoObiettivi === true) return { manda: "fatto", togliLocale: false };
  return NIENTE_DA_FARE;
}
