// Tema chiaro / scuro / sistema (PUNTO_DI_PARTENZA.md, sezione 7; pagina
// Impostazioni > Aspetto).
//
// La scelta sta nel localStorage del dispositivo (chiave CHIAVE_TEMA), non
// su Supabase: è una preferenza di questo telefono, non dell'account.
// Safari e l'app installata sulla Home hanno ciascuno il suo localStorage,
// quindi anche due scelte separate.
//
// Chi applica il tema è uno script piccolissimo dentro <head> (SCRIPT_TEMA,
// messo da src/app/layout.tsx): gira prima che la pagina venga disegnata,
// così non si vede mai un lampo del tema sbagliato. Scrive su <html>
// l'attributo data-tema="chiaro|scuro", che globals.css usa per scegliere i
// colori, e aggiorna il colore della barra del browser (theme-color).
//
// Una sola copia della logica: SCRIPT_TEMA non è scritto a mano, è il testo
// delle funzioni temaEffettivo e avviaTema qui sotto (toString()). Per questo
// tutte e due devono bastare a sé stesse: niente import, niente costanti di
// fuori, niente chiamate ad altre funzioni del modulo (nel testo copiato non
// esisterebbero). offline.html non passa da Next e ne ha una copia: il test
// (tema.test.ts) fa girare le due versioni sugli stessi casi.

export type SceltaTema = "chiaro" | "scuro" | "sistema";
export type TemaEffettivo = "chiaro" | "scuro";

export const CHIAVE_TEMA = "nutritrack:tema";

// Mandato dalla pagina Aspetto dopo aver salvato la scelta: lo script in
// <head> lo ascolta e riapplica il tema subito.
export const EVENTO_TEMA = "nutritrack:tema";

// Il colore della barra del browser per ciascun tema: è --background di
// globals.css (chiaro e scuro), ricopiato perché il <meta> non legge le
// variabili CSS. Lo controlla temaScuro.test.ts.
export const COLORI_BARRA: Record<TemaEffettivo, string> = {
  chiaro: "#faf7f2",
  scuro: "#1b1815",
};

// REGOLA: temaEffettivo e avviaTema devono restare autonome, niente import
// e niente funzioni o costanti di fuori. Lo script in <head> è il loro
// testo (toString()), dove il resto del modulo non esiste.
//
// Il tema da disegnare: la scelta salvata se è "chiaro" o "scuro", altrimenti
// (sistema, niente salvato, valore sconosciuto) quello del telefono.
export function temaEffettivo(scelta: string | null, sistemaScuro: boolean): TemaEffettivo {
  if (scelta === "chiaro" || scelta === "scuro") return scelta;
  return sistemaScuro ? "scuro" : "chiaro";
}

// REGOLA: come temaEffettivo, autonoma: niente import e niente funzioni o
// costanti di fuori. Quello che le serve arriva come parametro (anche
// temaEffettivo stessa, come `decidi`).
//
// Il lavoro sulla pagina: legge la scelta, decide con temaEffettivo, scrive
// data-tema e theme-color. Poi lo rifà quando cambia il tema del telefono
// (conta solo con "sistema", per gli altri il risultato non cambia), quando
// la pagina Aspetto salva una scelta (evento) e quando un'altra scheda dello
// stesso browser la cambia (evento "storage").
export function avviaTema(
  decidi: typeof temaEffettivo,
  chiave: string,
  evento: string,
  colori: Record<TemaEffettivo, string>
): void {
  const sistema = window.matchMedia("(prefers-color-scheme: dark)");

  // Il colore della barra: un <meta name="theme-color"> tutto suo, senza
  // media, messo per primo in <head>. Il browser usa il primo theme-color
  // che vale, quindi questo vince sui due della pagina (uno per tema del
  // telefono), che restano com'erano: sono la rete di sicurezza senza
  // script. Toccare quelli no: React, quando prende in mano la pagina,
  // riconosce i <meta> dai loro attributi; con un content cambiato non li
  // ritrova e ne aggiunge una copia.
  const barra = document.createElement("meta");
  barra.setAttribute("name", "theme-color");
  document.head.prepend(barra);

  function leggi() {
    // Safari in navigazione privata (e browser con i dati del sito
    // bloccati) può lanciare un errore al solo accesso: si fa come "sistema".
    try {
      return window.localStorage.getItem(chiave);
    } catch {
      return null;
    }
  }

  function applica() {
    const tema = decidi(leggi(), sistema.matches);
    document.documentElement.setAttribute("data-tema", tema);
    barra.setAttribute("content", colori[tema]);
  }

  applica();
  sistema.addEventListener("change", applica);
  window.addEventListener(evento, applica);
  window.addEventListener("storage", function (e) {
    if (e.key === chiave) applica();
  });
}

// Il testo dello script in <head>: le due funzioni qui sopra, con i loro
// valori, chiamate subito.
export const SCRIPT_TEMA = `(${avviaTema.toString()})(${temaEffettivo.toString()}, ${JSON.stringify(
  CHIAVE_TEMA
)}, ${JSON.stringify(EVENTO_TEMA)}, ${JSON.stringify(COLORI_BARRA)});`;

// La scelta salvata, per la pagina Aspetto e la riga dell'elenco. Senza
// localStorage, o con un valore sconosciuto: "sistema".
export function leggiSceltaTema(): SceltaTema {
  try {
    const valore = window.localStorage.getItem(CHIAVE_TEMA);
    return valore === "chiaro" || valore === "scuro" ? valore : "sistema";
  } catch {
    return "sistema";
  }
}

// Salva la scelta e la applica subito. Se localStorage non c'è non si salva
// niente e l'app resta su "sistema", senza errori.
export function salvaSceltaTema(scelta: SceltaTema): void {
  try {
    window.localStorage.setItem(CHIAVE_TEMA, scelta);
  } catch {
    // Niente localStorage: si resta su "sistema".
  }
  window.dispatchEvent(new Event(EVENTO_TEMA));
}
