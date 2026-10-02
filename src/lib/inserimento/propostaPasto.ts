// Quale pasto proporre come titolo della pagina di inserimento
// (PUNTO_DI_PARTENZA.md, sezione "I pasti" e "Inserimento retroattivo").
//
// Funzioni pure, testate in modo permanente: la proposta del pasto in base
// all'ora, incluse le ore fra mezzanotte e il primo pasto, è uno dei pezzi
// di logica che la sezione 10.5 chiede di coprire con dei test.

import type { Pasto } from "../db/tipi";

// Il pasto corrispondente a un orario "HH:mm": quello con `ora_inizio` più
// recente ma non successivo all'orario. Ogni pasto dura fino all'inizio del
// successivo, l'ultimo fino a mezzanotte. Un orario precedente all'inizio
// del primo pasto (es. le 00:30 con la Colazione alle 06:00) propone il
// primo pasto: il giorno è sempre quello del calendario (sezione 4, "Il
// giorno è quello del calendario"), e proporre la Cena metterebbe la
// voce nella Cena di stasera, non ancora mangiata.
//
// `ora_inizio` può arrivare da Postgres come "HH:mm:ss": si confrontano solo
// i primi 5 caratteri, altrimenti "12:30:00" <= "12:30" è falso e all'ora
// esatta di inizio si proporrebbe il pasto precedente.
export function pastoPerOrario(pasti: Pasto[], oraHHmm: string): Pasto | null {
  if (pasti.length === 0) return null;

  const ordinati = [...pasti].sort((a, b) =>
    a.ora_inizio.localeCompare(b.ora_inizio)
  );

  // Default: il primo pasto della giornata — copre ogni orario prima del suo
  // inizio, fra mezzanotte e la Colazione.
  let scelto = ordinati[0];
  for (const pasto of ordinati) {
    if (pasto.ora_inizio.slice(0, 5) <= oraHHmm) scelto = pasto;
  }
  return scelto;
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
