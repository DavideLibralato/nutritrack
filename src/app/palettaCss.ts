// Lettura della palette scritta in globals.css (e ricopiata in
// public/offline.html), per i test: temaScuro.test.ts e contrasti.test.ts.
// Non la usa l'app.
//
// Forma attesa (PUNTO_DI_PARTENZA.md sezione 7):
//   :root, [data-tema], [data-accento] { --background: var(--se-chiaro, #...) var(--se-scuro, #...); ... }
//   :root, [data-tema="chiaro"] { --se-chiaro: initial; --se-scuro: ; color-scheme: light; }
//   [data-tema="scuro"] { ...al contrario... }
//   @media (prefers-color-scheme: dark) { :root:not([data-tema]) { ...come scuro... } }
//   :root, [data-accento="verde"] { --accento-chiaro: #...; --accento-scuro: #...; }
//   [data-accento="blu"] { ... } ...

// Il contenuto fra la graffa che segue `inizio` e quella che la chiude.
function corpoBlocco(testo: string, inizio: number): string {
  const apertura = testo.indexOf("{", inizio);
  let profondita = 0;
  for (let i = apertura; i < testo.length; i++) {
    if (testo[i] === "{") profondita++;
    if (testo[i] === "}") profondita--;
    if (profondita === 0) return testo.slice(apertura + 1, i);
  }
  throw new Error("graffa non chiusa");
}

// Le dichiarazioni di un blocco: { "--background": "var(--se-chiaro, ...", "color-scheme": "light" }
function dichiarazioni(corpo: string): Map<string, string> {
  const mappa = new Map<string, string>();
  for (const [, nome, valore] of corpo.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]*);/g)) {
    mappa.set(nome, valore.trim().replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")"));
  }
  return mappa;
}

// Tutte le regole: selettore (senza spazi) → dichiarazioni. Il selettore è
// il testo prima della graffa, dopo la regola precedente (o dopo un
// @import, che finisce con ";").
function regole(css: string): Map<string, Map<string, string>> {
  const mappa = new Map<string, Map<string, string>>();
  for (const m of css.matchAll(/([^{};]+)\{/g)) {
    mappa.set(m[1].replace(/\s+/g, ""), dichiarazioni(corpoBlocco(css, m.index)));
  }
  return mappa;
}

function regola(tutte: Map<string, Map<string, string>>, selettore: string): Map<string, string> {
  const trovata = tutte.get(selettore.replace(/\s+/g, ""));
  if (!trovata) throw new Error(`manca la regola ${selettore}`);
  return trovata;
}

export interface Paletta {
  // Il blocco dei colori: --background, --accento, ...
  colori: Map<string, string>;
  // Gli interruttori: scelta chiaro, scelta scuro, telefono al buio senza scelta.
  chiaro: Map<string, string>;
  scuro: Map<string, string>;
  telefonoScuro: Map<string, string>;
  // Per ogni colore principale (verde, blu...): --accento-chiaro e --accento-scuro.
  accenti: Map<string, Map<string, string>>;
}

// Da offline.html conta solo il CSS dentro <style>.
export function leggiPaletta(testo: string): Paletta {
  const stile = testo.match(/<style>([\s\S]*?)<\/style>/);
  const css = (stile ? stile[1] : testo).replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
  const media = css.indexOf("@media (prefers-color-scheme: dark)");
  if (media === -1) throw new Error("manca il blocco @media (prefers-color-scheme: dark)");
  const tutte = regole(css);

  const accenti = new Map<string, Map<string, string>>();
  for (const [selettore, corpo] of tutte) {
    const nome = selettore.match(/^(?::root,)?\[data-accento="([\w-]+)"\]$/);
    if (nome) accenti.set(nome[1], corpo);
  }

  return {
    colori: regola(tutte, ":root, [data-tema], [data-accento]"),
    chiaro: regola(tutte, ':root, [data-tema="chiaro"]'),
    scuro: regola(tutte, '[data-tema="scuro"]'),
    telefonoScuro: regola(regole(corpoBlocco(css, media)), ":root:not([data-tema])"),
    accenti,
  };
}

// Il valore dopo la virgola in var(--se-chiaro, ...) o var(--se-scuro, ...),
// parentesi annidate comprese. undefined se l'interruttore non c'è.
export function meta(valore: string, interruttore: "--se-chiaro" | "--se-scuro"): string | undefined {
  const inizio = valore.indexOf(`var(${interruttore},`);
  if (inizio === -1) return undefined;
  let profondita = 0;
  for (let i = inizio + 3; i < valore.length; i++) {
    if (valore[i] === "(") profondita++;
    if (valore[i] === ")") profondita--;
    if (profondita === 0) return valore.slice(inizio + `var(${interruttore},`.length, i).trim();
  }
  throw new Error("parentesi non chiusa");
}
