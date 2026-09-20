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

// Guardia contro la doppia esecuzione concorrente: due chiamate che partono
// mentre la prima sta ancora scrivendo.
const seedInCorso = new Set<string>();

// Bug reale trovato controllando Supabase: 10 pasti invece di 5. Prima
// versione di questa funzione prendeva anche `pastiEsistenti` (lo stato
// `pasti` di useLiveQuery, passato dal chiamante) come primo controllo — ma
// è uno stato React derivato e reattivo, non una lettura diretta: dopo un
// refresh completo di pagina può restare "non ancora arrivato" più a lungo
// del previsto (dipende da quando la subscription di Dexie consegna la prima
// emissione vera), e in quella finestra sia quel controllo sia `seedInCorso`
// (che riparte vuoto a ogni refresh, correttamente) non bloccano nulla.
//
// Ora la funzione non riceve più `pasti` e non dipende da nessuno stato
// React: l'unica fonte di verità è una lettura diretta di Dexie, fatta qui
// dentro. Chi chiama la invoca una volta per utente per montaggio (vedi
// page.tsx) — se lo stato vero dice che i pasti ci sono già, non scrive
// nulla, indipendentemente da cosa stesse mostrando la UI in quel momento.
export async function garantisciPastiPredefiniti(userId: string): Promise<void> {
  if (seedInCorso.has(userId)) return;

  seedInCorso.add(userId);
  try {
    const pastiVeriOra = await repositoryPasti.ottieniTutti(userId);
    if (pastiVeriOra.length > 0) return;

    for (const pasto of PASTI_PREDEFINITI) {
      await repositoryPasti.crea({ user_id: userId, ...pasto });
    }
  } finally {
    seedInCorso.delete(userId);
  }
}
