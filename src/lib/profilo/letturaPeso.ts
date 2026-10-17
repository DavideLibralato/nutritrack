// Il peso scritto dall'utente in un campo: "Registra peso" in Impostazioni >
// Peso e il passo 3 dell'onboarding (PUNTO_DI_PARTENZA.md, sezione 3,
// "Peso" e "Onboarding") accettano gli stessi valori. La virgola vale come
// separatore decimale (numeroDaCampo).

import { numeroDaCampo } from "./salvataggioProfilo";

export const PESO_MASSIMO_KG = 500;

// Il peso in kg, così come è scritto (l'arrotondamento a un decimale lo fa
// chi registra), oppure null se non è un numero maggiore di 0 e al massimo
// PESO_MASSIMO_KG.
export function leggiPesoKg(valore: string): number | null {
  const kg = numeroDaCampo(valore);
  return Number.isNaN(kg) || kg <= 0 || kg > PESO_MASSIMO_KG ? null : kg;
}
