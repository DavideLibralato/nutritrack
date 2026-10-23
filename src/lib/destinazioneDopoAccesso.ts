// Dove andare dopo l'accesso: la pagina indicata in ?redirectTo= (la mette
// il middleware quando si apre una pagina protetta senza sessione), ma
// solo se è una pagina dell'app. Non basta che inizi con "/": il browser
// legge "//esempio.com" e "/\esempio.com" come un altro sito. Quindi si
// risolve l'indirizzo come farebbe il browser, rispetto all'origine
// dell'app, e si accetta solo se l'origine resta la stessa. Tutto il resto
// (altri siti, "javascript:", vuoto, assente) porta alla home.
export function destinazioneDopoAccesso(redirectTo: string | null, origine: string): string {
  if (!redirectTo) return "/";
  let url: URL;
  try {
    url = new URL(redirectTo, origine);
  } catch {
    return "/";
  }
  if (url.origin !== new URL(origine).origin) return "/";
  return url.pathname + url.search + url.hash;
}
