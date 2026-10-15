// L'ordinamento della pagina Impostazioni > Alimenti (PUNTO_DI_PARTENZA.md,
// sezione 3, "Alimenti"): Più usati / A → Z / Z → A / Meno usati.
//
// Funzioni pure, stesso stile di recenti.ts: ricevono catalogo e voci già
// caricati da Dexie (via useLiveQuery nella pagina) e non fanno altre
// interrogazioni.

import type { Alimento, VoceDiario } from "../db/tipi";

export type OrdineCatalogo = "piu-usati" | "a-z" | "z-a" | "meno-usati";

// Quante volte ogni alimento compare nel diario: un passaggio solo sulle
// voci. Contano solo le voci di diario vive, non le righe dei pasti
// salvati: un pasto salvato è uno stampo, non un uso, e quando lo si
// inserisce crea comunque voci di diario, già contate qui.
//
// Le voci cancellate si scartano anche qui, non solo a monte
// (ottieniTutti le scarta già): una voce eliminata da Oggi non è un uso, e
// il conteggio non deve dipendere da chi lo chiama. Una voce senza
// alimento_id non appartiene a nessun alimento del catalogo.
//
// Un alimento mai usato non è nella mappa: chi legge usa `?? 0`.
export function contaUsi(voci: VoceDiario[]): Map<string, number> {
  const usi = new Map<string, number>();
  for (const v of voci) {
    if (v.deleted_at !== null || v.alimento_id === null) continue;
    usi.set(v.alimento_id, (usi.get(v.alimento_id) ?? 0) + 1);
  }
  return usi;
}

// Ordine alfabetico, come cercaPerNome in src/lib/repository/alimenti.ts
// (localeCompare "it": maiuscole e accenti non spostano una parola in
// fondo all'elenco come farebbe il confronto per codice del carattere).
// Due alimenti con lo stesso nome si distinguono per marca, senza marca
// prima ("Yogurt" prima di "Yogurt · Fage"), e alla fine per id: un
// ordine che dipende solo dai dati, così una riga non salta di posto fra
// un ridisegno e l'altro.
function confrontaNome(a: Alimento, b: Alimento): number {
  return (
    a.nome.localeCompare(b.nome, "it") ||
    (a.marca ?? "").localeCompare(b.marca ?? "", "it") ||
    a.id.localeCompare(b.id)
  );
}

// Restituisce un elenco nuovo, non riordina quello ricevuto (che di solito
// è il risultato di una liveQuery, condiviso con il resto della pagina).
// Con "Più usati" e "Meno usati", a parità di usi l'ordine è sempre A → Z,
// anche per "Meno usati": è il secondo criterio, non il primo rovesciato.
export function ordinaCatalogo(
  alimenti: Alimento[],
  usi: Map<string, number>,
  ordine: OrdineCatalogo
): Alimento[] {
  const n = (a: Alimento) => usi.get(a.id) ?? 0;
  const confronto: (a: Alimento, b: Alimento) => number = {
    "piu-usati": (a: Alimento, b: Alimento) => n(b) - n(a) || confrontaNome(a, b),
    "meno-usati": (a: Alimento, b: Alimento) => n(a) - n(b) || confrontaNome(a, b),
    "a-z": confrontaNome,
    "z-a": (a: Alimento, b: Alimento) => confrontaNome(b, a),
  }[ordine];
  return [...alimenti].sort(confronto);
}
