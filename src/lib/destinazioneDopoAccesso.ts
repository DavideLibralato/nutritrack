// Dove andare dopo l'accesso: la pagina indicata in ?redirectTo= (la mette
// il middleware quando si apre una pagina protetta senza sessione), ma
// solo se è una pagina dell'app. Non basta che inizi con "/": il browser
// legge "//esempio.com" e "/\esempio.com" come un altro sito. Quindi si
// risolve l'indirizzo come farebbe il browser, rispetto all'origine
// dell'app, e si accetta solo se l'origine resta la stessa. Tutto il resto
// (altri siti, "javascript:", vuoto, assente) porta alla home.
//
// Dal 14/11/2026 (branch redirect-sicuro): anche il percorso che ESCE
// deve cominciare con una sola "/". La stessa origine non basta:
// "/.//esempio.com" si risolve sull'app, ma il suo percorso è
// "//esempio.com", e router.push lo rilegge come un altro sito. Il
// controllo si fa dopo la risoluzione, non sul testo che entra, perché
// è la risoluzione a creare la doppia barra: toglie tab e a capo
// ("/\t/esempio.com"), risolve "." e ".." anche codificati ("%2e"), e
// trasforma "\" in "/".
const UNA_SOLA_BARRA_IN_TESTA = /^\/(?![/\\])/;

export function destinazioneDopoAccesso(redirectTo: string | null, origine: string): string {
  if (!redirectTo) return "/";
  let url: URL;
  try {
    url = new URL(redirectTo, origine);
  } catch {
    return "/";
  }
  if (url.origin !== new URL(origine).origin) return "/";
  // Accedi stessa no (dal 01/11/2026): la navigazione resterebbe su questa
  // pagina, e dopo un accesso riuscito il pulsante resta "Attendere..." per sempre.
  if (url.pathname === "/login" || url.pathname.startsWith("/login/")) return "/";
  const percorso = url.pathname + url.search + url.hash;
  if (!UNA_SOLA_BARRA_IN_TESTA.test(percorso)) return "/";
  return percorso;
}
