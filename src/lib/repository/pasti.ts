// Helper specifici per i pasti, oltre al CRUD generico di repositoryPasti.
//
// Il set predefinito dei 5 pasti (PUNTO_DI_PARTENZA.md, sezione "I pasti")
// va creato "alla registrazione", ma la registrazione è una Server Action e
// i pasti vivono in Dexie, che esiste solo nel browser (local-first, sezione
// 9.2). Quindi il set si crea lato client alla prima apertura dell'app, se
// l'utente non ne ha ancora nessuno.

import { repositoryPasti } from "./index";
import type { Pasto } from "../db/tipi";

export const PASTI_PREDEFINITI: Pick<Pasto, "nome" | "ora_inizio" | "ordine">[] = [
  { nome: "Colazione", ora_inizio: "06:00", ordine: 0 },
  { nome: "Spuntino mattina", ora_inizio: "10:00", ordine: 1 },
  { nome: "Pranzo", ora_inizio: "12:30", ordine: 2 },
  { nome: "Spuntino pomeriggio", ora_inizio: "16:00", ordine: 3 },
  { nome: "Cena", ora_inizio: "19:30", ordine: 4 },
];

// Guardia contro la doppia esecuzione: l'effetto React che chiama questa
// funzione può partire due volte di fila (StrictMode in sviluppo, o un
// ri-render prima che la useLiveQuery si aggiorni) mentre il primo giro sta
// ancora creando i pasti. Senza questo Set si finirebbe con 10 pasti.
const seedInCorso = new Set<string>();

// Se l'utente non ha ancora nessun pasto, crea il set predefinito. Ogni
// riga passa da repositoryPasti.crea → Dexie + outbox come qualsiasi altra
// scrittura. Idempotente: con almeno un pasto già presente non fa nulla.
export async function garantisciPastiPredefiniti(
  userId: string,
  pastiEsistenti: Pasto[]
): Promise<void> {
  if (pastiEsistenti.length > 0 || seedInCorso.has(userId)) return;

  seedInCorso.add(userId);
  try {
    for (const pasto of PASTI_PREDEFINITI) {
      await repositoryPasti.crea({ user_id: userId, ...pasto });
    }
  } finally {
    seedInCorso.delete(userId);
  }
}
