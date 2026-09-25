// Le frasi mostrate all'utente quando un pasto di giornata contiene alimenti
// cancellati dal catalogo (regola "Alimenti cancellati" in
// PUNTO_DI_PARTENZA.md). Scritte in un posto solo perché le stesse parole
// compaiono in due punti di Oggi (al tocco della stella e dentro lo sheet)
// e devono restare identiche, singolare/plurale compresi.

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
