// Genera il catalogo precaricato dell'app (PUNTO_DI_PARTENZA.md §10.1)
// dalla lista approvata da Davide e dalle due fonti:
// - Ciqual 2025 (Anses), i due file XML scaricati a mano (fuori dal repo);
// - Open Food Facts, un prodotto per codice a barre.
//
// Nome, marca, porzione e categoria vengono dalla lista, mai dalle fonti.
// I valori si rileggono dalle fonti e si confrontano con quelli della
// lista (`valori_letti_08_11`): le differenze si stampano, non si
// correggono. Una correzione decisa da Davide sta in un file a parte,
// docs/catalogo/correzioni.json (un altro con --correzioni), così la
// lista approvata resta com'è; ogni correzione applicata ha la sua riga
// nel rapporto.
//
// Coerenza delle kcal, solo per Open Food Facts (Davide, 08/11): se
// |kcal − (4·P + 4·C + 9·G + 2·fibre)| supera il più grande fra 15 kcal
// e il 12% delle kcal, lo script si ferma su quel prodotto, a meno che
// non abbia una correzione. Su OFF i valori li scrivono dei volontari, e
// le kcal possono non tornare con i macro (Mozzarella Galbani: 184 kcal
// con P 17, C 2, G 18, che fanno 238). Ciqual no: aceto, birra e vino
// hanno acidi e alcol, e lì le kcal sono giuste.
//
// Uso (da questa cartella del progetto):
//   node scripts/catalogo/generaCatalogo.mjs \
//     --alim "<cartella>/alim_2025_11_03.xml" \
//     --compo "<cartella>/compo_2025_11_03.xml" \
//     [--cache-off <cartella>] [--correzioni <file.json>]
//
// --cache-off: le risposte di Open Food Facts si salvano lì e, alla volta
// dopo, si rileggono da lì invece di richiamare OFF.
//
// Regole sui valori:
// - "traces" e "< X" (Ciqual) diventano 0: è la convenzione delle
//   etichette UE, che possono scrivere "0 g" al posto di "< 0,5 g";
// - kcal, proteine, carboidrati e grassi mancanti ("-" o assenti): errore,
//   l'alimento non si scrive e lo script esce con un codice d'errore;
// - zuccheri, fibre, saturi e sale mancanti: null;
// - letti dalle fonti, i valori si arrotondano a due decimali come
//   arrotondaDecimali (src/lib/numeriDecimali.ts), cioè numeric(7,2) su
//   Supabase; il confronto con la lista si fa su questi;
// - poi, nel file, kcal intere e proteine, carboidrati e grassi con al
//   massimo un decimale (Davide, 08/11): elenchi e sheet quantità
//   arrotondano già, ma "Modifica alimento" mostra il valore salvato con
//   due decimali, e una copia mostrerebbe «386,36» (kcal di Open Food
//   Facts calcolate dai kJ). Zuccheri e saturi a un decimale come il loro
//   totale (sotto, DECIMALI_NEL_FILE); fibre e sale restano a due: non si
//   mostrano, e il sale della frutta è di centesimi;
// - un valore nascosto più grande del suo totale, già arrotondato
//   (zuccheri oltre i carboidrati, saturi oltre i grassi), diventa null,
//   con una riga nel rapporto (Davide, 08/11): il modulo dell'app lo
//   rifiuterebbe. Caso trovato: l'avocado di Ciqual, carboidrati
//   «traces» (0) e zuccheri 0,4;
// - Open Food Facts senza kcal ma con i kJ: kcal = kJ / 4,184, segnalato.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const RADICE = resolve(import.meta.dirname, "..", "..");
const LISTA = join(RADICE, "docs", "catalogo", "lista-approvata-2026-11-08.json");
const CORREZIONI = join(RADICE, "docs", "catalogo", "correzioni.json");
const USCITA = join(RADICE, "src", "lib", "catalogo", "catalogoPrecaricato.json");

const MD5_ATTESI = {
  alim: "8e1171d63cee4b6010cfce25dd29243d",
  compo: "2da725585946434df320d8041631998b",
};

// Codici dei componenti Ciqual.
const CODICI_CIQUAL = {
  kcal_100g: "328", // energia, Reg. UE 1169/2011, kcal/100 g
  proteine_100g: "25000",
  carboidrati_100g: "31000",
  grassi_100g: "40000",
  zuccheri_100g: "32000",
  fibre_100g: "34100",
  saturi_100g: "40302",
  sale_100g: "10004",
};

const CAMPI_OFF = {
  kcal_100g: "energy-kcal_100g",
  proteine_100g: "proteins_100g",
  carboidrati_100g: "carbohydrates_100g",
  grassi_100g: "fat_100g",
  zuccheri_100g: "sugars_100g",
  fibre_100g: "fiber_100g",
  saturi_100g: "saturated-fat_100g",
  sale_100g: "salt_100g",
};

const OBBLIGATORI = ["kcal_100g", "proteine_100g", "carboidrati_100g", "grassi_100g"];
const FACOLTATIVI = ["zuccheri_100g", "fibre_100g", "saturi_100g", "sale_100g"];
const NOMI_LISTA = { kcal_100g: "kcal", proteine_100g: "proteine", carboidrati_100g: "carboidrati", grassi_100g: "grassi" };

// 15 letture di prodotto al minuto per indirizzo IP (documentazione
// dell'API di Open Food Facts): una ogni 5 secondi sta sotto.
const PAUSA_OFF_MS = 5000;
const CONTATTO = "libra.app.supporto@gmail.com";

function argomenti() {
  const a = process.argv.slice(2);
  const valore = (nome) => {
    const i = a.indexOf(`--${nome}`);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return { alim: valore("alim"), compo: valore("compo"), cacheOff: valore("cache-off"), correzioni: valore("correzioni") };
}

function md5(buffer) {
  return createHash("md5").update(buffer).digest("hex");
}

// Legge un XML di Ciqual controllando impronta e codifica (UTF-8 con BOM).
function leggiXml(percorso, atteso) {
  const buffer = readFileSync(percorso);
  const impronta = md5(buffer);
  if (impronta !== atteso) throw new Error(`${percorso}: md5 ${impronta}, atteso ${atteso}`);
  if (!(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf)) {
    throw new Error(`${percorso}: manca il BOM UTF-8`);
  }
  const testo = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(3));
  if (!/encoding="utf-8"/i.test(testo.slice(0, 100))) throw new Error(`${percorso}: dichiarazione non utf-8`);
  return testo;
}

function decodificaEntita(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function arrotonda(n, decimali = 2) {
  if (Math.abs(n) < 1e-6) return 0;
  return Number((Math.round(Number(`${n}e${decimali}`)) / 10 ** decimali).toFixed(decimali));
}

// Quanti decimali tiene il file (vedi sopra). Zuccheri e saturi come il
// loro totale: con i carboidrati a 0,7 e gli zuccheri a 0,71 (il burro di
// Ciqual) la parte supererebbe il tutto solo per l'arrotondamento.
const DECIMALI_NEL_FILE = {
  kcal_100g: 0,
  proteine_100g: 1,
  carboidrati_100g: 1,
  grassi_100g: 1,
  zuccheri_100g: 1,
  saturi_100g: 1,
};

// La regola della coerenza delle kcal (vedi in cima). La stessa formula
// sta nel test del file (catalogoPrecaricato.test.ts).
function kcalDaiMacro(a) {
  return 4 * a.proteine_100g + 4 * a.carboidrati_100g + 9 * a.grassi_100g + 2 * (a.fibre_100g ?? 0);
}

function kcalIncoerenti(a) {
  return Math.abs(a.kcal_100g - kcalDaiMacro(a)) > Math.max(15, 0.12 * a.kcal_100g);
}

// Il valore nascosto e il totale di cui è una parte.
const PARTI = [
  ["zuccheri_100g", "carboidrati_100g"],
  ["saturi_100g", "grassi_100g"],
];

// Un valore di Ciqual: numero (virgola decimale), "traces", "< X", "-".
// Restituisce { valore, regola } con valore null se manca.
function valoreCiqual(testo) {
  if (testo === undefined) return { valore: null, regola: "assente" };
  const t = decodificaEntita(testo).trim();
  if (t === "-" || t === "") return { valore: null, regola: "-" };
  if (t === "traces") return { valore: 0, regola: "traces → 0" };
  if (t.startsWith("<")) return { valore: 0, regola: `${t} → 0` };
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n)) throw new Error(`valore Ciqual non leggibile: «${t}»`);
  return { valore: arrotonda(n), regola: null };
}

function leggiCiqual(percorsoAlim, percorsoCompo, codiciVoluti) {
  const alim = leggiXml(percorsoAlim, MD5_ATTESI.alim);
  const compo = leggiXml(percorsoCompo, MD5_ATTESI.compo);
  const nomi = new Map();
  for (const m of alim.matchAll(/<ALIM>([\s\S]*?)<\/ALIM>/g)) {
    const codice = /<alim_code>\s*(\S+)\s*<\/alim_code>/.exec(m[1])?.[1];
    const nome = /<alim_nom_fr>\s*([\s\S]*?)\s*<\/alim_nom_fr>/.exec(m[1])?.[1];
    if (codice && codiciVoluti.has(codice)) nomi.set(codice, decodificaEntita(nome ?? ""));
  }
  const codiciComponenti = new Set(Object.values(CODICI_CIQUAL));
  const valori = new Map(); // alim_code → const_code → testo
  for (const m of compo.matchAll(/<COMPO>([\s\S]*?)<\/COMPO>/g)) {
    const codice = /<alim_code>\s*(\S+)\s*<\/alim_code>/.exec(m[1])?.[1];
    if (!codice || !codiciVoluti.has(codice)) continue;
    const componente = /<const_code>\s*(\S+)\s*<\/const_code>/.exec(m[1])?.[1];
    if (!codiciComponenti.has(componente)) continue;
    const teneur = /<teneur>([\s\S]*?)<\/teneur>/.exec(m[1])?.[1];
    if (!valori.has(codice)) valori.set(codice, new Map());
    valori.get(codice).set(componente, teneur);
  }
  return { nomi, valori };
}

async function pausa(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function prodottoOff(codice, versioneApp, cartellaCache) {
  const fileCache = cartellaCache ? join(cartellaCache, `${codice}.json`) : null;
  if (fileCache && existsSync(fileCache)) {
    return { json: JSON.parse(readFileSync(fileCache, "utf8")), daCache: true };
  }
  const agente = `Libra/${versioneApp} (${CONTATTO})`;
  const url = `https://world.openfoodfacts.org/api/v3/product/${codice}?fields=product_name,product_name_it,brands,nutriments`;
  const risposta = await fetch(url, {
    headers: { "User-Agent": agente, "X-User-Agent": agente },
    signal: AbortSignal.timeout(30000),
  });
  if (risposta.status !== 200 && risposta.status !== 404) {
    throw new Error(`Open Food Facts ${codice}: HTTP ${risposta.status}`);
  }
  const json = await risposta.json();
  if (fileCache) writeFileSync(fileCache, JSON.stringify(json, null, 1));
  return { json, daCache: false };
}

function numeroOff(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

// Un valore di OFF, con il suo "modifier" ("<" vale come "< X" di Ciqual).
function valoreOff(nutrienti, chiave) {
  const n = numeroOff(nutrienti[chiave]);
  const modifier = nutrienti[chiave.replace("_100g", "_modifier")];
  if (n === null) return { valore: null, regola: "assente" };
  if (modifier === "<" || modifier === "≤") return { valore: 0, regola: `< ${n} → 0` };
  return { valore: arrotonda(n), regola: modifier ? `modifier «${modifier}»` : null };
}

function formattaValore(v) {
  return v === null || v === undefined ? "—" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
}

async function main() {
  const { alim, compo, cacheOff, correzioni } = argomenti();
  if (!alim || !compo) {
    console.error("Servono --alim e --compo (i due XML di Ciqual).");
    process.exit(2);
  }
  if (cacheOff) mkdirSync(cacheOff, { recursive: true });
  const versioneApp = JSON.parse(readFileSync(join(RADICE, "package.json"), "utf8")).version;
  const lista = JSON.parse(readFileSync(LISTA, "utf8"));
  const fileCorrezioni = correzioni ?? CORREZIONI;
  const correzioniPerId = existsSync(fileCorrezioni)
    ? JSON.parse(readFileSync(fileCorrezioni, "utf8")).correzioni ?? {}
    : {};
  const correzioniApplicate = [];

  const codiciCiqual = new Set(lista.alimenti.filter((a) => a.fonte === "ciqual").map((a) => a.codice_ciqual));
  const ciqual = leggiCiqual(alim, compo, codiciCiqual);

  const differenze = [];
  const regoleApplicate = [];
  const avvisi = [];
  const errori = [];
  const valoriNascostiTolti = [];
  let arrotondamenti = 0;
  const alimenti = [];

  const daOff = lista.alimenti.filter((a) => a.fonte === "off").length;
  let letti = 0;

  for (const voce of lista.alimenti) {
    const id = voce.fonte === "ciqual" ? `ciqual:${voce.codice_ciqual}` : `off:${voce.barcode}`;
    const etichetta = voce.marca ? `${voce.nome} · ${voce.marca}` : voce.nome;
    const valori = {};

    if (voce.fonte === "ciqual") {
      const nomeFr = ciqual.nomi.get(voce.codice_ciqual);
      if (nomeFr === undefined) {
        errori.push(`${id} ${etichetta}: codice assente in alim`);
        continue;
      }
      if (nomeFr !== voce.nome_ciqual_fr) {
        avvisi.push(`${id} ${etichetta}: nome Ciqual «${nomeFr}», nella lista «${voce.nome_ciqual_fr}»`);
      }
      const componenti = ciqual.valori.get(voce.codice_ciqual) ?? new Map();
      for (const [campo, codice] of Object.entries(CODICI_CIQUAL)) {
        const { valore, regola } = valoreCiqual(componenti.get(codice));
        valori[campo] = valore;
        if (regola && valore !== null) regoleApplicate.push(`${id} ${etichetta}: ${campo} ${regola}`);
      }
    } else {
      letti += 1;
      const { json, daCache } = await prodottoOff(voce.barcode, versioneApp, cacheOff);
      process.stderr.write(`OFF ${letti}/${daOff} ${voce.barcode}${daCache ? " (cache)" : ""}\n`);
      if (!daCache && letti < daOff) await pausa(PAUSA_OFF_MS);
      const prodotto = json?.product;
      if (!prodotto) {
        errori.push(`${id} ${etichetta}: prodotto non trovato su Open Food Facts`);
        continue;
      }
      const nutrienti = typeof prodotto.nutriments === "object" && prodotto.nutriments ? prodotto.nutriments : {};
      for (const [campo, chiave] of Object.entries(CAMPI_OFF)) {
        const { valore, regola } = valoreOff(nutrienti, chiave);
        valori[campo] = valore;
        if (regola && valore !== null) regoleApplicate.push(`${id} ${etichetta}: ${campo} ${regola}`);
      }
      if (valori.kcal_100g === null) {
        const kj = numeroOff(nutrienti["energy-kj_100g"]);
        if (kj !== null) {
          valori.kcal_100g = arrotonda(kj / 4.184);
          avvisi.push(`${id} ${etichetta}: kcal calcolate dai kJ (${kj} kJ)`);
        }
      }
    }

    const correzione = correzioniPerId[id];
    if (correzione) {
      for (const [campo, valore] of Object.entries(correzione.valori ?? {})) {
        correzioniApplicate.push(
          `${id} ${etichetta}: ${campo} da ${formattaValore(valori[campo])} a ${formattaValore(valore)} (${correzione.motivo})`
        );
        valori[campo] = valore;
      }
    }

    const mancanti = OBBLIGATORI.filter((c) => valori[c] === null);
    if (mancanti.length > 0) {
      errori.push(`${id} ${etichetta}: mancano ${mancanti.join(", ")}`);
      continue;
    }

    // Confronto con i valori letti l'08/11 per la revisione. "< 0.5" e
    // "traces" nella lista valgono come la regola dello script (0).
    for (const campo of OBBLIGATORI) {
      const nellaLista = voce.valori_letti_08_11[NOMI_LISTA[campo]];
      const atteso = typeof nellaLista === "number" ? arrotonda(nellaLista) : 0;
      if (atteso !== valori[campo]) {
        differenze.push({ id, etichetta, campo: NOMI_LISTA[campo], lista: nellaLista, letto: valori[campo] });
      }
    }

    // I valori mostrati, con i decimali del file.
    const v = { ...valori };
    for (const [c, decimali] of Object.entries(DECIMALI_NEL_FILE)) {
      if (v[c] === null) continue;
      const arrotondato = arrotonda(v[c], decimali);
      if (arrotondato !== v[c]) arrotondamenti += 1;
      v[c] = arrotondato;
    }

    // Una parte più grande del suo totale: null, con il log.
    for (const [parte, totale] of PARTI) {
      if (v[parte] !== null && v[parte] > v[totale]) {
        valoriNascostiTolti.push(
          `${id} ${etichetta}: ${parte} ${formattaValore(v[parte])} oltre ${totale} ${formattaValore(v[totale])} → null`
        );
        v[parte] = null;
      }
    }

    // Coerenza delle kcal, sui valori del file, solo Open Food Facts.
    if (voce.fonte === "off" && kcalIncoerenti(v)) {
      const testo = `${id} ${etichetta}: kcal ${formattaValore(v.kcal_100g)}, dai macro ${formattaValore(arrotonda(kcalDaiMacro(v), 1))}`;
      if (!correzione) {
        errori.push(`${testo} — kcal incoerenti con i macro, serve una correzione`);
        continue;
      }
      avvisi.push(`${testo} — incoerenti anche dopo la correzione`);
    }

    // Le altre regole della validazione dell'app (valoriAlimento.ts), per
    // saperlo subito: il test del file le rifà con il codice vero.
    if (v.kcal_100g > 900) avvisi.push(`${id} ${etichetta}: kcal oltre 900`);
    for (const c of [...OBBLIGATORI.slice(1), ...FACOLTATIVI]) {
      if (v[c] !== null && v[c] > 100) avvisi.push(`${id} ${etichetta}: ${c} oltre 100`);
    }
    const somma = arrotonda(v.proteine_100g + v.carboidrati_100g + v.grassi_100g);
    if (somma > 101.5) avvisi.push(`${id} ${etichetta}: P+C+G ${somma} oltre 101,5`);

    alimenti.push({
      id,
      origine: voce.fonte,
      categoria: voce.categoria,
      nome: voce.nome,
      marca: voce.marca,
      barcode: voce.barcode ?? null,
      porzione_default_g: voce.porzione_default_g,
      ...Object.fromEntries([...OBBLIGATORI, ...FACOLTATIVI].map((c) => [c, v[c]])),
    });
  }

  console.log(`\n# Differenze con valori_letti_08_11 (${differenze.length})\n`);
  console.log("| Alimento | id | Valore | Nella lista | Letto ora |\n|---|---|---|---|---|");
  for (const d of differenze) {
    console.log(`| ${d.etichetta} | ${d.id} | ${d.campo} | ${formattaValore(d.lista)} | ${formattaValore(d.letto)} |`);
  }
  console.log(`\n# Correzioni applicate (${correzioniApplicate.length}, da ${fileCorrezioni})\n`);
  for (const c of correzioniApplicate) console.log(`- ${c}`);
  console.log(`\n# Avvisi (${avvisi.length})\n`);
  for (const a of avvisi) console.log(`- ${a}`);
  console.log(`\n# Valori nascosti più grandi del loro totale, diventati null (${valoriNascostiTolti.length})\n`);
  for (const t of valoriNascostiTolti) console.log(`- ${t}`);
  console.log(`\n# Valori arrotondati per il file (kcal intere; P, C, G, zuccheri e saturi a un decimale): ${arrotondamenti}`);
  console.log(`\n# Regole applicate (${regoleApplicate.length})\n`);
  for (const r of regoleApplicate) console.log(`- ${r}`);
  console.log(`\n# Errori (${errori.length})\n`);
  for (const e of errori) console.log(`- ${e}`);

  if (errori.length > 0) {
    console.error(`\n${errori.length} errori: file non scritto.`);
    process.exit(1);
  }

  const file = {
    versione: "2026-11-08",
    descrizione:
      "Catalogo precaricato di Libra (PUNTO_DI_PARTENZA.md §10.1), generato da scripts/catalogo/generaCatalogo.mjs dalla lista docs/catalogo/lista-approvata-2026-11-08.json. Non modificare a mano.",
    fonti: {
      ciqual: lista.fonti.ciqual,
      off: lista.fonti.off,
    },
    alimenti,
  };
  writeFileSync(USCITA, JSON.stringify(file, null, 1) + "\n");
  console.log(`\nScritto ${USCITA}: ${alimenti.length} alimenti.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});
