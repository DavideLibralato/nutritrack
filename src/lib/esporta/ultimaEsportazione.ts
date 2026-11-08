// Il promemoria «Ultima esportazione: N giorni fa» (PUNTO_DI_PARTENZA.md
// §10.4, "Il promemoria"): una riga di solo testo sotto «Esporta i miei
// dati», niente pallino, niente avvisi.
//
// - Vale per il dispositivo: localStorage, una chiave per utente;
// - lo aggiorna solo il JSON (il CSV non è un backup), e solo a
//   salvataggio riuscito: un foglio di condivisione annullato non conta
//   (salvaEsportazione.ts);
// - lo tolgono Esci ed Elimina account.
//
// I giorni si contano sul calendario locale, non per blocchi di 24 ore:
// esportato alle 23:50 di ieri e guardato alle 00:10 di oggi è «ieri», e
// il cambio dell'ora legale non sposta niente.

import { oggiLocale } from "../dataGiorno";

export function chiaveUltimaEsportazione(userId: string): string {
  return `nutritrack:esporta:ultima:${userId}`;
}

// Il valore salvato è l'istante (ISO 8601); i giorni si ricavano leggendo.
// Chi mostra il promemoria si iscrive qui (useUltimaEsportazione): segna e
// togli avvisano, così la riga cambia senza ricaricare la pagina.
const ascoltatori = new Set<() => void>();

export function iscriviUltimaEsportazione(ascoltatore: () => void): () => void {
  ascoltatori.add(ascoltatore);
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

function avvisa(): void {
  for (const ascoltatore of ascoltatori) ascoltatore();
}

export function segnaEsportazione(userId: string, adesso: Date = new Date()): void {
  try {
    window.localStorage.setItem(chiaveUltimaEsportazione(userId), adesso.toISOString());
  } catch {
    // Niente localStorage: il promemoria resta «Mai esportato».
  }
  avvisa();
}

export function leggiUltimaEsportazione(userId: string): string | null {
  try {
    return window.localStorage.getItem(chiaveUltimaEsportazione(userId));
  } catch {
    return null;
  }
}

export function togliUltimaEsportazione(userId: string): void {
  try {
    window.localStorage.removeItem(chiaveUltimaEsportazione(userId));
  } catch {
    // Niente localStorage: non c'era niente da togliere.
  }
  avvisa();
}

// Quanti giorni del calendario locale fra due istanti (0 = stesso giorno).
// Da "YYYY-MM-DD" a giorni interi con Date.UTC: niente ore, quindi niente
// ora legale in mezzo.
export function giorniDiCalendarioFra(da: Date, a: Date): number {
  const giorni = (d: Date) => {
    const [anno, mese, giorno] = oggiLocale(d).split("-").map(Number);
    return Date.UTC(anno, mese - 1, giorno) / 86_400_000;
  };
  return giorni(a) - giorni(da);
}

// Il testo della riga. Un valore illeggibile vale «Mai esportato»; una data
// nel futuro (orologio spostato indietro) vale «oggi».
export function testoPromemoria(ultima: string | null, adesso: Date = new Date()): string {
  const quando = ultima ? new Date(ultima) : null;
  if (!quando || Number.isNaN(quando.getTime())) return "Mai esportato";
  const giorni = Math.max(0, giorniDiCalendarioFra(quando, adesso));
  if (giorni === 0) return "Ultima esportazione: oggi";
  if (giorni === 1) return "Ultima esportazione: ieri";
  return `Ultima esportazione: ${giorni} giorni fa`;
}
