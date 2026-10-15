// Quali alimenti l'utente può modificare ed eliminare (sezione 10.8):
// solo i suoi (user_id = utente) e non ancora verificati. Un alimento
// verificato non si modifica, se ne crea uno nuovo; quelli del catalogo
// comune (user_id null) non si toccano, anche per RLS.
//
// Un posto solo per la regola: la usano la matita in Aggiungi (risultati
// di ricerca, Recenti e Preferiti) e Impostazioni > Alimenti, che mostra
// solo questi (PUNTO_DI_PARTENZA.md, sezione 3, "Alimenti"). Prima stava
// scritta due volte in Aggiungi, e una volta le due copie non coincidevano
// (la matita mancava su Recenti e Preferiti).

import type { Alimento } from "../db/tipi";

export function eModificabile(alimento: Alimento, userId: string): boolean {
  return alimento.user_id === userId && !alimento.verificato;
}

// `catalogo` è quello di catalogoLocale (src/lib/repository/alimenti.ts),
// già senza le righe cancellate.
export function alimentiModificabili(catalogo: Alimento[], userId: string): Alimento[] {
  return catalogo.filter((a) => eModificabile(a, userId));
}
