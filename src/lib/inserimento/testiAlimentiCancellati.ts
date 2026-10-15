// Le frasi mostrate all'utente quando un pasto di giornata contiene alimenti
// cancellati dal catalogo (regola "Alimenti cancellati" in
// PUNTO_DI_PARTENZA.md). Scritte in un posto solo perché le stesse parole
// compaiono in due punti di Oggi (al tocco della stella e dentro lo sheet)
// e devono restare identiche, singolare/plurale compresi. Qui anche le
// frasi della barra dopo l'Annulla di una cancellazione, che compaiono in
// Aggiungi e in Impostazioni > Alimenti.

import { messaggioRipristinato, type MessaggioBarra } from "./testiBarra";

// «a» / «a» e «b» / «a», «b» e «c». Nomi ripetuti (lo stesso alimento
// inserito due volte) compaiono una volta sola.
export function elencoNomi(nomi: string[]): string {
  const unici = [...new Set(nomi)].map((n) => `«${n}»`);
  if (unici.length <= 1) return unici.join("");
  return `${unici.slice(0, -1).join(", ")} e ${unici[unici.length - 1]}`;
}

function nonPiuNelCatalogo(nomi: string[]): string {
  return new Set(nomi).size === 1 ? "non è più nel catalogo" : "non sono più nel catalogo";
}

// Punto 1: prima di salvare. "Verrà salvato 1 alimento su 2. «test» non è
// più nel catalogo."
export function testoAvvisoEsclusi(daSalvare: number, totale: number, nomiEsclusi: string[]): string {
  const salvati =
    daSalvare === 1
      ? `Verrà salvato 1 alimento su ${totale}.`
      : `Verranno salvati ${daSalvare} alimenti su ${totale}.`;
  return `${salvati} ${elencoNomi(nomiEsclusi)} ${nonPiuNelCatalogo(nomiEsclusi)}.`;
}

// Punto 3: il contenuto valido è già salvato. "Hai già un pasto salvato
// «Cena». Non contiene «test», che non è più nel catalogo."
export function testoGiaSalvato(nomePasto: string, nomiEsclusi: string[]): string {
  const primo = `Hai già un pasto salvato «${nomePasto}».`;
  if (nomiEsclusi.length === 0) return primo;
  const che = new Set(nomiEsclusi).size === 1 ? "che non è più" : "che non sono più";
  return `${primo} Non contiene ${elencoNomi(nomiEsclusi)}, ${che} nel catalogo.`;
}

// Punto 4: la barra dopo l'"Annulla" di una cancellazione, dall'esito di
// ripristinaAlimenti. Caso normale: "Ripristinato: Mela", su una riga. Se
// un pasto salvato non è tornato (il suo nome nel frattempo è stato preso),
// serve la frase intera, che può andare a capo. `nomi`: gli alimenti
// ripristinati, uno solo (Aggiungi, o il form del catalogo) o più di uno
// (selezione in Impostazioni > Alimenti: "Ripristinati: 3 alimenti").
export function messaggioDopoRipristino(
  nomi: string[],
  pastiNonRipristinati: string[]
): MessaggioBarra {
  const piu = nomi.length > 1;
  const [verbo, nome] = piu ? ["Ripristinati:", `${nomi.length} alimenti`] : ["Ripristinato:", nomi[0]];
  if (pastiNonRipristinati.length === 0) {
    return piu ? { testo: verbo, nome, icona: "spunta" } : messaggioRipristinato(nome);
  }
  let testo = `${verbo} ${nome}.`;
  if (pastiNonRipristinati.length === 1) {
    testo += ` Il pasto salvato ${elencoNomi(pastiNonRipristinati)} no: ne hai già un altro con lo stesso nome.`;
  } else {
    testo += ` I pasti salvati ${elencoNomi(pastiNonRipristinati)} no: hai già altri pasti con gli stessi nomi.`;
  }
  return { testo };
}

// Il ripristino non è riuscito: la barra lo dice e ripropone l'Annulla
// (ripristinaAlimenti salta ciò che è già tornato in vita, quindi
// riprovare converge). "Non è stato possibile ripristinare «Mela»." o
// "… ripristinare 3 alimenti."
export function testoRipristinoNonRiuscito(nomi: string[]): string {
  const cosa = nomi.length > 1 ? `${nomi.length} alimenti` : elencoNomi(nomi);
  return `Non è stato possibile ripristinare ${cosa}.`;
}
