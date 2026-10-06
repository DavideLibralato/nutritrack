// I dita (puntatori) che un gesto ha "preso" per sé, perché gli altri gesti
// sullo stesso dito si facciano da parte. Oggi: il tieni-premuto in Oggi
// (tieniPremuto.ts) li prende quando la riga si solleva, e lo swipe del
// giorno (swipeGiorno.ts), che ascolta sul pannello attorno alla lista e
// quindi riceve gli stessi eventi, smette di seguirli.
//
// Un insieme in memoria e non un attributo sul DOM: i due gesti stanno su
// elementi diversi, e un pointerId è unico finché il dito resta giù.

const rivendicati = new Set<number>();

export function rivendicaPuntatore(id: number): void {
  rivendicati.add(id);
}

export function liberaPuntatore(id: number): void {
  rivendicati.delete(id);
}

export function puntatoreRivendicato(id: number): boolean {
  return rivendicati.has(id);
}
