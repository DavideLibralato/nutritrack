// La riga "Preferiti e pasti salvati" in Impostazioni (PUNTO_DI_PARTENZA.md,
// sezione 3, "Impostazioni"; mockup docs/mockups/preferiti-e-pasti-salvati.html).
// Funzioni pure, testate in rigaPreferiti.test.ts.
//
// Il conteggio passa dalle stesse funzioni dell'elenco in Aggiungi e nella
// pagina, mai dalle tabelle grezze: un alimento uscito dal catalogo o un
// pasto salvato senza più alimenti validi non si vedono da nessuna parte, e
// quindi non si contano (regola "Alimenti cancellati", sezione 4). Contare
// `preferiti.length` o `composizioni.length` darebbe in Impostazioni un
// numero diverso da quello che si vede aprendo la pagina.

import type { Alimento, Composizione, ComposizioneVoce, Preferito } from "../db/tipi";
import { alimentiPreferiti } from "./preferiti";
import { pastiSalvati } from "./pastiSalvati";

export interface ConteggioPreferiti {
  alimenti: number;
  pasti: number;
}

export function contaPreferiti(
  catalogo: Alimento[],
  preferiti: Preferito[],
  composizioni: Composizione[],
  composizioniVoci: ComposizioneVoce[]
): ConteggioPreferiti {
  return {
    // Le voci di diario servono solo a scegliere la quantità da mostrare:
    // per contare basta un elenco vuoto.
    alimenti: alimentiPreferiti(catalogo, preferiti, []).length,
    pasti: pastiSalvati(catalogo, composizioni, composizioniVoci).length,
  };
}

// La forma del valore a destra: "lunga" ("12 alimenti · 3 pasti") o "corta"
// ("12 · 3"). Si è scelta la lunga; se su iPhone accorcia il titolo della
// riga con "…", si passa alla corta cambiando solo questa costante.
export const FORMA_RIGA_PREFERITI: "lunga" | "corta" = "lunga";

// Con un gruppo a zero si mostra solo l'altro, con la sua parola ("4
// alimenti", "3 pasti"), in tutte e due le forme: un "4" da solo non
// direbbe di che cosa, e la forma corta serve solo quando i numeri sono due.
export function testoRigaPreferiti(
  { alimenti, pasti }: ConteggioPreferiti,
  forma: "lunga" | "corta" = FORMA_RIGA_PREFERITI
): string {
  const testoAlimenti = `${alimenti} ${alimenti === 1 ? "alimento" : "alimenti"}`;
  const testoPasti = `${pasti} ${pasti === 1 ? "pasto" : "pasti"}`;
  if (alimenti === 0 && pasti === 0) return "Nessuno";
  if (pasti === 0) return testoAlimenti;
  if (alimenti === 0) return testoPasti;
  if (forma === "corta") return `${alimenti} · ${pasti}`;
  return `${testoAlimenti} · ${testoPasti}`;
}
