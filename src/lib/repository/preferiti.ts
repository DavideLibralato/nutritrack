// Helper specifici per i preferiti, oltre al CRUD generico di
// repositoryPreferiti. Solo alimenti singoli in questo pezzo — i pasti
// salvati (composizioni) sono un giro a parte.

import { repositoryPreferiti } from "./index";
import type { Preferito } from "../db/tipi";

export function ePreferito(preferiti: Preferito[], alimentoId: string): boolean {
  return preferiti.some((p) => p.alimento_id === alimentoId);
}

// Aggiunge o toglie in base allo stato attuale: un solo punto d'ingresso per
// la stella nello sheet quantità, che non deve sapere se sta aggiungendo o
// togliendo. Scrive subito nel repository (non solo stato locale) — la
// stella riflette poi lo stato vero tramite la liveQuery del chiamante.
export async function togglePreferito(
  userId: string,
  preferiti: Preferito[],
  alimentoId: string
): Promise<void> {
  const esistente = preferiti.find((p) => p.alimento_id === alimentoId);
  if (esistente) {
    await repositoryPreferiti.elimina(esistente.id);
  } else {
    await repositoryPreferiti.crea({ user_id: userId, alimento_id: alimentoId });
  }
}
