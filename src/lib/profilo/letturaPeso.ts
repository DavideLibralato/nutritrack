// Il peso scritto dall'utente in un campo: "Registra peso" in Impostazioni >
// Peso e il passo 3 dell'onboarding (PUNTO_DI_PARTENZA.md, sezione 3,
// "Peso" e "Onboarding") accettano gli stessi valori, e lo stesso vale per
// il peso obiettivo, nell'onboarding e in Impostazioni > Obiettivi
// (pesoObiettivoNonValido in salvataggioProfilo.ts). La virgola vale come
// separatore decimale (numeroDaCampo).

import { arrotondaDecimali, numeroDaCampo } from "../numeriDecimali";

export const PESO_MASSIMO_KG = 500;

// Un decimale: la pesata si registra così ("78,4 kg"; misurazioni.valore è
// numeric(7,2), quindi il server la tiene uguale), e il peso obiettivo è
// numeric(5,1).
const DECIMALI_PESO = 1;

// Il peso in kg come si scriverà, già arrotondato a un decimale
// (arrotondaDecimali: "78,46" → 78,5), oppure null se non è un numero
// maggiore di 0 e al massimo PESO_MASSIMO_KG. Il controllo è sul valore
// arrotondato: "0,04" darebbe 0 kg.
export function leggiPesoKg(valore: string): number | null {
  const n = numeroDaCampo(valore);
  if (Number.isNaN(n)) return null;
  const kg = arrotondaDecimali(n, DECIMALI_PESO);
  return kg <= 0 || kg > PESO_MASSIMO_KG ? null : kg;
}
