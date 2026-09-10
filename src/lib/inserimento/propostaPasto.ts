// Quale pasto proporre come titolo della pagina di inserimento
// (PUNTO_DI_PARTENZA.md, sezione "I pasti" e "Inserimento retroattivo").
//
// Funzioni pure, testate in modo permanente: la proposta del pasto in base
// all'ora, "inclusa la fascia che scavalca la mezzanotte", è uno dei quattro
// pezzi di logica che la sezione 10.5 chiede di coprire con dei test.

import type { Pasto } from "../db/tipi";

// Il pasto corrispondente a un orario "HH:mm": quello con `ora_inizio` più
// recente ma non successivo all'orario. Ogni pasto dura fino all'inizio del
// successivo; l'ultimo arriva fino al primo del giorno dopo, quindi un
// orario precedente all'inizio del primo pasto (es. le 03:00 con la
// Colazione alle 06:00) ricade nell'ultimo pasto, non nel primo.
export function pastoPerOrario(pasti: Pasto[], oraHHmm: string): Pasto | null {
  if (pasti.length === 0) return null;

  const ordinati = [...pasti].sort((a, b) =>
    a.ora_inizio.localeCompare(b.ora_inizio)
  );

  // Default: l'ultimo pasto della giornata — copre la fascia che scavalca la
  // mezzanotte, cioè ogni orario prima dell'inizio del primo pasto.
  let scelto = ordinati[ordinati.length - 1];
  for (const pasto of ordinati) {
    if (pasto.ora_inizio <= oraHHmm) scelto = pasto;
  }
  return scelto;
}

// L'ora di inizio ("HH:mm") del primo pasto della giornata: il più mattiniero
// per `ora_inizio`, non il primo per `ordine` (le fasce sono riordinabili).
// Serve alla regola del giorno logico (dataGiorno.ts `giornoLogico`). Lista
// vuota → null: nessuna regola da applicare.
export function oraInizioPrimoPasto(pasti: Pasto[]): string | null {
  if (pasti.length === 0) return null;
  return pasti.reduce((min, p) =>
    p.ora_inizio.localeCompare(min.ora_inizio) < 0 ? p : min
  ).ora_inizio;
}

// Sui giorni passati l'ora non aiuta ("sarebbe sempre sbagliato"): si
// propone il primo pasto ancora senza voci, perché stai completando la
// giornata; se sono tutti pieni, l'ultimo della lista.
export function primoPastoVuoto(
  pastiOrdinati: Pasto[],
  pastiConVoci: Set<string>
): Pasto | null {
  if (pastiOrdinati.length === 0) return null;

  return (
    pastiOrdinati.find((p) => !pastiConVoci.has(p.id)) ??
    pastiOrdinati[pastiOrdinati.length - 1]
  );
}
