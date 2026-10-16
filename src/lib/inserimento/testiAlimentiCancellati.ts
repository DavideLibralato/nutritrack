// Le frasi mostrate all'utente quando un pasto di giornata contiene alimenti
// cancellati dal catalogo (regola "Alimenti cancellati" in
// PUNTO_DI_PARTENZA.md). Scritte in un posto solo perché le stesse parole
// compaiono in due punti di Oggi (al tocco della stella e dentro lo sheet)
// e devono restare identiche, singolare/plurale compresi. Qui anche le
// frasi della barra dopo l'Annulla di una cancellazione, che compaiono in
// Aggiungi e in Impostazioni > Alimenti.

import { messaggioRipristinato, type MessaggioBarra } from "./testiBarra";
import type { EsitoRipristino } from "../repository/composizioni";

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
// dell'Annulla, uno solo (Aggiungi, o il form del catalogo) o più di uno
// (selezione in Impostazioni > Alimenti: "Ripristinati: 3 alimenti").
//
// Un alimento che non è tornato perché nel frattempo ne è nato uno uguale
// (stesso nome e marca, regola del doppione) si dice con nome e marca:
// "Non ripristinato: hai già «Pane · Mulino»." se non è tornato niente,
// altrimenti dopo i ripristinati ("Ripristinati: 2 alimenti. «Pane ·
// Mulino» no: ne hai già uno uguale.").
export function messaggioDopoRipristino(nomi: string[], esito: EsitoRipristino): MessaggioBarra {
  const { alimentiNonRipristinati, pastiNonRipristinati } = esito;
  // I ripristinati: `nomi` meno, una volta ciascuno, i non ripristinati.
  const ripristinati = [...nomi];
  for (const { nome } of alimentiNonRipristinati) {
    const i = ripristinati.indexOf(nome);
    if (i >= 0) ripristinati.splice(i, 1);
  }
  const piu = ripristinati.length > 1;
  const [verbo, nome] = piu
    ? ["Ripristinati:", `${ripristinati.length} alimenti`]
    : ["Ripristinato:", ripristinati[0]];
  if (alimentiNonRipristinati.length === 0 && pastiNonRipristinati.length === 0) {
    return piu ? { testo: verbo, nome, icona: "spunta" } : messaggioRipristinato(nome);
  }

  const frasi: string[] = [];
  const etichette = elencoNomi(alimentiNonRipristinati.map((a) => a.etichetta));
  const unNonRipristinato = new Set(alimentiNonRipristinati.map((a) => a.etichetta)).size === 1;
  if (ripristinati.length === 0) {
    frasi.push(`${unNonRipristinato ? "Non ripristinato" : "Non ripristinati"}: hai già ${etichette}.`);
  } else {
    frasi.push(`${verbo} ${nome}.`);
    if (alimentiNonRipristinati.length > 0) {
      frasi.push(
        unNonRipristinato
          ? `${etichette} no: ne hai già uno uguale.`
          : `${etichette} no: ne hai già di uguali.`
      );
    }
  }
  if (pastiNonRipristinati.length > 0) frasi.push(frasePastiNonRipristinati(pastiNonRipristinati));
  return { testo: frasi.join(" ") };
}

function frasePastiNonRipristinati(pastiNonRipristinati: string[]): string {
  if (pastiNonRipristinati.length === 1) {
    return `Il pasto salvato ${elencoNomi(pastiNonRipristinati)} no: ne hai già un altro con lo stesso nome.`;
  }
  return `I pasti salvati ${elencoNomi(pastiNonRipristinati)} no: hai già altri pasti con gli stessi nomi.`;
}

// Il ripristino non è riuscito: la barra lo dice e ripropone l'Annulla
// (ripristinaAlimenti salta ciò che è già tornato in vita, quindi
// riprovare converge). "Non è stato possibile ripristinare «Mela»." o
// "… ripristinare 3 alimenti."
export function testoRipristinoNonRiuscito(nomi: string[]): string {
  const cosa = nomi.length > 1 ? `${nomi.length} alimenti` : elencoNomi(nomi);
  return `Non è stato possibile ripristinare ${cosa}.`;
}
