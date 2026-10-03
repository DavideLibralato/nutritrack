// I testi del peso in Impostazioni (PUNTO_DI_PARTENZA.md, sezione 3,
// "Impostazioni" e "Peso"). Funzioni pure, testate in testiPeso.test.ts.
//
// Il peso ha lo stesso formato ovunque, come nella scheda dell'account:
// decimale solo se c'è, con la virgola ("85 kg", "78,4 kg").
//   - testoRigaPeso: il valore a destra della riga "Peso" nell'elenco, o
//     "Da registrare" senza pesate;
//   - testoUltimaPesata: in cima alla pagina Peso, con la data: "85 kg · 2
//     ottobre" (l'anno solo se non è quello in corso), o "Nessuna pesata
//     registrata" senza pesate.

import type { Misurazione } from "../db/tipi";

function chilogrammi(valore: number): string {
  return valore.toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

// "2026-10-02" → "2 ottobre" (o "2 ottobre 2025" se l'anno è diverso da
// quello di `oggi`). Solo la data del calendario, letta dai pezzi della
// stringa: niente fusi orari.
function dataPesata(iso: string, oggi: string): string {
  const [anno, mese, giorno] = iso.split("-").map(Number);
  const data = new Date(anno, mese - 1, giorno);
  const stessoAnno = iso.slice(0, 4) === oggi.slice(0, 4);
  return data.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    ...(stessoAnno ? {} : { year: "numeric" }),
  });
}

export function testoRigaPeso(ultima: Misurazione | null): string {
  return ultima ? `${chilogrammi(ultima.valore)} kg` : "Da registrare";
}

// `oggi`: "YYYY-MM-DD" (oggiLocale), per decidere se scrivere l'anno.
export function testoUltimaPesata(ultima: Misurazione | null, oggi: string): string {
  if (!ultima) return "Nessuna pesata registrata";
  return `${chilogrammi(ultima.valore)} kg · ${dataPesata(ultima.data, oggi)}`;
}
