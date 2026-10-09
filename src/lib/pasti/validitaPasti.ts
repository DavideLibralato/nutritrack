// Quali pasti esistono in un giorno, e in che ordine (PUNTO_DI_PARTENZA.md,
// sezione 3, "I pasti", e sezione 4, "pasti"). Funzioni pure, testate in
// modo permanente: sbagliare qui non fa crashare niente, mostra un pasto
// in un giorno in cui non c'era, o lo nasconde con le sue voci dentro.
//
// Ogni schermata chiede i pasti del SUO giorno: Oggi quello mostrato,
// Aggiungi quello in cui si registra, Duplica quello di destinazione.

import type { Pasto, VoceDiario } from "../db/tipi";

// Una riga di `pasti` vale nel giorno D se non è cancellata e
// valido_dal <= D <= valido_al, confini inclusi. Null (o la chiave assente,
// su una riga salvata prima di Dexie version(6)) vuol dire "nessun limite"
// da quella parte. Le date sono "YYYY-MM-DD", quindi l'ordine alfabetico è
// quello del calendario.
export function pastoValidoIl(pasto: Pasto, giorno: string): boolean {
  if (pasto.deleted_at !== null) return false;
  const dal = pasto.valido_dal ?? null;
  const al = pasto.valido_al ?? null;
  return (dal === null || dal <= giorno) && (al === null || giorno <= al);
}

// L'ordine della giornata segue l'orario (decisione del 2026-10-07): ogni
// pasto inizia alla sua ora e dura fino al successivo. `ora_inizio` è
// "HH:mm" se la riga è nata sul dispositivo e "HH:mm:ss" se arriva da
// Postgres: si confrontano solo i primi 5 caratteri, altrimenti
// "12:30" < "12:30:00" metterebbe in ordine diverso due pasti alla stessa
// ora. A parità d'orario (oggi l'app non la permette, ma i dati vecchi
// potrebbero averla) decide `ordine`, poi `id`: un ordine sempre uguale,
// su ogni dispositivo.
export function ordinaPerOrario<T extends Pick<Pasto, "id" | "ora_inizio" | "ordine">>(
  pasti: T[]
): T[] {
  return [...pasti].sort(
    (a, b) =>
      a.ora_inizio.slice(0, 5).localeCompare(b.ora_inizio.slice(0, 5)) ||
      a.ordine - b.ordine ||
      a.id.localeCompare(b.id)
  );
}

// I pasti che esistono nel giorno D, in ordine d'orario. Sono quelli che
// si possono SCEGLIERE: come pasto di una voce nuova, come destinazione di
// Sposta, Duplica e del trascinamento.
export function pastiValidiIl(pasti: Pasto[], giorno: string): Pasto[] {
  return ordinaPerOrario(pasti.filter((p) => pastoValidoIl(p, giorno)));
}

export const ETICHETTA_NON_IN_USO = "Non più in uso";

// Le opzioni del menu "Pasto" nello sheet di una voce: i pasti validi nel
// giorno della voce, più il suo pasto attuale se quel giorno non vale
// (rete di sicurezza), con "· non più in uso" accanto al nome. Senza
// quest'ultimo, il valore del menu (il pasto della voce) non sarebbe fra
// le opzioni: il browser ne mostrerebbe un altro, mentre "Salva" lascerebbe
// la voce dov'era. Così il menu mostra sempre il pasto vero, e lo si può
// cambiare solo verso un pasto valido.
export function opzioniPastoDellaVoce(
  pasti: Pasto[],
  voce: Pick<VoceDiario, "data" | "pasto_id">
): { id: string; nome: string }[] {
  const validi = pastiValidiIl(pasti, voce.data);
  const attuale = pasti.find((p) => p.id === voce.pasto_id);
  const elenco = attuale && !validi.some((p) => p.id === attuale.id) ? ordinaPerOrario([...validi, attuale]) : validi;
  return elenco.map((p) => ({
    id: p.id,
    nome: p === attuale && !pastoValidoIl(p, voce.data) ? `${p.nome} · ${ETICHETTA_NON_IN_USO.toLowerCase()}` : p.nome,
  }));
}

// I pasti da MOSTRARE in Oggi nel giorno D: quelli validi, più ogni pasto
// che ha voci vive in D anche se in D non vale più (fuori dal suo periodo,
// o cancellato). È la rete di sicurezza: senza, le voci di quel pasto
// sparirebbero dalla lista ma resterebbero nei totali, e i numeri non
// tornerebbero. `pasti` deve contenere anche le righe cancellate
// (tuttiIPasti in src/lib/repository/pasti.ts): ottieniTutti le scarta.
// Una voce il cui pasto non è proprio in `pasti` (pasto_id null, o pasto
// non ancora arrivato sul dispositivo) qui non ha una riga: il gruppo
// "Senza pasto" è rimandato (decisione del 2026-10-09).
export function pastiDaMostrare(
  pasti: Pasto[],
  vociGiorno: VoceDiario[],
  giorno: string
): Pasto[] {
  const conVoci = new Set(
    vociGiorno
      .filter((v) => v.data === giorno && v.deleted_at === null)
      .map((v) => v.pasto_id)
  );
  return ordinaPerOrario(pasti.filter((p) => pastoValidoIl(p, giorno) || conVoci.has(p.id)));
}
