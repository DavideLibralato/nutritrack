// Confronto fra istanti ISO 8601 (updated_at e simili). Modulo puro, senza
// Dexie né Supabase, così lo possono usare anche le funzioni pure come
// obiettivoValidoPer (totaliDiario.ts) senza tirarsi dietro il database.
//
// Perché un numero e non un confronto fra stringhe: PostgREST restituisce
// "...619969+00:00" (6 decimali, offset esplicito) mentre
// new Date().toISOString() locale produce "...619Z" (3 decimali). Due
// stringhe dello stesso istante possono ordinarsi al contrario, e una riga
// scaricata dal server accanto a una scritta in locale si confronterebbe
// male (vedi il confronto riga-per-riga in src/lib/sync/discesa.ts).

export function millisecondiDi(iso: string): number {
  return new Date(iso).getTime();
}
