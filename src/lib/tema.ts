// Tema chiaro / scuro / sistema e colore principale (PUNTO_DI_PARTENZA.md,
// sezione 7; pagina Impostazioni > Aspetto).
//
// Le scelte stanno nel localStorage del dispositivo (CHIAVE_TEMA,
// CHIAVE_ACCENTO), non su Supabase: sono preferenze di questo telefono, non
// dell'account. Safari e l'app installata sulla Home hanno ciascuno il suo
// localStorage, quindi anche scelte separate.
//
// Chi le applica è uno script piccolissimo dentro <head> (SCRIPT_TEMA,
// messo da src/app/layout.tsx): gira prima che la pagina venga disegnata,
// così non si vede mai un lampo del tema o del colore sbagliato. Scrive su
// <html> gli attributi data-tema="chiaro|scuro" e data-accento="verde|...",
// che globals.css usa per scegliere i colori, e aggiorna il colore della
// barra del browser (theme-color).
//
// Una sola copia della logica: SCRIPT_TEMA non è scritto a mano, è il testo
// delle funzioni temaEffettivo, accentoEffettivo e avviaTema qui sotto
// (toString()). Per questo devono bastare a sé stesse: niente import,
// niente costanti di fuori, niente chiamate ad altre funzioni del modulo
// (nel testo copiato non esisterebbero). offline.html non passa da Next e
// ne ha una copia: il test (tema.test.ts) fa girare le due versioni sugli
// stessi casi.

export type SceltaTema = "chiaro" | "scuro" | "sistema";
export type TemaEffettivo = "chiaro" | "scuro";

export const CHIAVE_TEMA = "nutritrack:tema";
export const CHIAVE_ACCENTO = "nutritrack:accento";

// I colori principali, nell'ordine della pagina Aspetto. Il primo è il
// predefinito. I valori dei colori stanno solo in globals.css
// ([data-accento="..."]); temaScuro.test.ts controlla che i due elenchi
// coincidano.
export const ACCENTI = ["verde", "blu", "viola", "petrolio"] as const;
export type Accento = (typeof ACCENTI)[number];

// I nomi a schermo (pagina Aspetto e riga dell'elenco).
export const NOMI_ACCENTO: Record<Accento, string> = {
  verde: "Verde",
  blu: "Blu",
  viola: "Viola",
  petrolio: "Petrolio",
};

// Mandato dalla pagina Aspetto dopo aver salvato una scelta: lo script in
// <head> lo ascolta e riapplica tema e colore subito.
export const EVENTO_TEMA = "nutritrack:tema";

// Il colore della barra del browser per ciascun tema: è --background di
// globals.css (chiaro e scuro), ricopiato perché il <meta> non legge le
// variabili CSS. Lo controlla temaScuro.test.ts.
export const COLORI_BARRA: Record<TemaEffettivo, string> = {
  chiaro: "#faf7f2",
  scuro: "#1b1815",
};

// REGOLA: temaEffettivo, accentoEffettivo e avviaTema devono restare
// autonome, niente import e niente funzioni o costanti di fuori. Lo script
// in <head> è il loro testo (toString()), dove il resto del modulo non
// esiste.
//
// Il tema da disegnare: la scelta salvata se è "chiaro" o "scuro", altrimenti
// (sistema, niente salvato, valore sconosciuto) quello del telefono.
export function temaEffettivo(scelta: string | null, sistemaScuro: boolean): TemaEffettivo {
  if (scelta === "chiaro" || scelta === "scuro") return scelta;
  return sistemaScuro ? "scuro" : "chiaro";
}

// REGOLA: autonoma come temaEffettivo (vedi sopra). L'elenco dei colori
// arriva come parametro, non da ACCENTI.
//
// Il colore da disegnare: la scelta salvata se è uno dei colori, altrimenti
// (niente salvato, valore sconosciuto) il primo dell'elenco, il verde.
export function accentoEffettivo<T extends string>(scelta: string | null, accenti: readonly T[]): T {
  for (const accento of accenti) {
    if (accento === scelta) return accento;
  }
  return accenti[0];
}

// REGOLA: come temaEffettivo, autonoma: niente import e niente funzioni o
// costanti di fuori. Quello che le serve arriva come parametro (anche
// temaEffettivo e accentoEffettivo, come `decidiTema` e `decidiAccento`).
//
// Il lavoro sulla pagina: legge le scelte, decide con le due funzioni,
// scrive data-tema, data-accento e theme-color. Poi lo rifà quando cambia
// il tema del telefono (conta solo con "sistema"), quando la pagina Aspetto
// salva una scelta (evento) e quando un'altra scheda dello stesso browser
// la cambia (evento "storage").
export function avviaTema(
  decidiTema: typeof temaEffettivo,
  decidiAccento: typeof accentoEffettivo,
  opzioni: {
    chiaveTema: string;
    chiaveAccento: string;
    accenti: readonly string[];
    evento: string;
    colori: Record<TemaEffettivo, string>;
  }
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

  function leggi(chiave: string) {
    // Safari in navigazione privata (e browser con i dati del sito
    // bloccati) può lanciare un errore al solo accesso: si fa come senza
    // scelta.
    try {
      return window.localStorage.getItem(chiave);
    } catch {
      return null;
    }
  }

  function applica() {
    const tema = decidiTema(leggi(opzioni.chiaveTema), sistema.matches);
    const html = document.documentElement;
    html.setAttribute("data-tema", tema);
    html.setAttribute("data-accento", decidiAccento(leggi(opzioni.chiaveAccento), opzioni.accenti));
    barra.setAttribute("content", opzioni.colori[tema]);
  }

  applica();
  sistema.addEventListener("change", applica);
  window.addEventListener(opzioni.evento, applica);
  window.addEventListener("storage", function (e) {
    if (e.key === opzioni.chiaveTema || e.key === opzioni.chiaveAccento) applica();
  });
}

// Il testo dello script in <head>: le tre funzioni qui sopra, con i loro
// valori, chiamate subito.
export const SCRIPT_TEMA = `(${avviaTema.toString()})(${temaEffettivo.toString()}, ${accentoEffettivo.toString()}, ${JSON.stringify(
  {
    chiaveTema: CHIAVE_TEMA,
    chiaveAccento: CHIAVE_ACCENTO,
    accenti: ACCENTI,
    evento: EVENTO_TEMA,
    colori: COLORI_BARRA,
  }
)});`;

function leggiDaStorage(chiave: string): string | null {
  try {
    return window.localStorage.getItem(chiave);
  } catch {
    return null;
  }
}

// Salva una scelta e la applica subito. Se localStorage non c'è non si salva
// niente e resta il predefinito, senza errori.
function salvaInStorage(chiave: string, valore: string): void {
  try {
    window.localStorage.setItem(chiave, valore);
  } catch {
    // Niente localStorage: resta il predefinito.
  }
  window.dispatchEvent(new Event(EVENTO_TEMA));
}

// La scelta del tema salvata, per la pagina Aspetto e la riga dell'elenco.
// Senza localStorage, o con un valore sconosciuto: "sistema".
export function leggiSceltaTema(): SceltaTema {
  const valore = leggiDaStorage(CHIAVE_TEMA);
  return valore === "chiaro" || valore === "scuro" ? valore : "sistema";
}

export function salvaSceltaTema(scelta: SceltaTema): void {
  salvaInStorage(CHIAVE_TEMA, scelta);
}

// Il colore principale salvato. Senza localStorage, o con un valore
// sconosciuto: il verde (stessa regola dello script).
export function leggiSceltaAccento(): Accento {
  return accentoEffettivo(leggiDaStorage(CHIAVE_ACCENTO), ACCENTI);
}

export function salvaSceltaAccento(scelta: Accento): void {
  salvaInStorage(CHIAVE_ACCENTO, scelta);
}
