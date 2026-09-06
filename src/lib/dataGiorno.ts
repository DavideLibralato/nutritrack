// Il "giorno" della pagina Oggi è una stringa "YYYY-MM-DD", la stessa forma
// con cui `voci_diario.data` è salvata (PUNTO_DI_PARTENZA.md, sezione 4).
//
// Funzioni pure: solo stringhe e Date dentro, stringhe fuori. Niente Dexie,
// niente React — così la navigazione fra i giorni (frecce, calendario) si
// testa senza montare nulla.
//
// Perché non usare `new Date().toISOString().slice(0, 10)` come altrove:
// toISOString() dà la data in UTC. A Roma, fra mezzanotte e le 02:00 d'estate,
// sarebbe ancora "ieri". Qui il giorno è sempre quello dell'orologio locale.

// "YYYY-MM-DD" dell'orologio locale.
export function oggiLocale(d: Date = new Date()): string {
  const anno = d.getFullYear();
  const mese = String(d.getMonth() + 1).padStart(2, "0");
  const giorno = String(d.getDate()).padStart(2, "0");
  return `${anno}-${mese}-${giorno}`;
}

// Da "YYYY-MM-DD" a Date locale a mezzogiorno: l'ora 12:00 evita che un
// cambio d'ora legale (che scatta di notte) sposti il giorno avanti o
// indietro quando si somma/sottrae 24 h.
function daISO(iso: string): Date {
  const [anno, mese, giorno] = iso.split("-").map(Number);
  return new Date(anno, mese - 1, giorno, 12, 0, 0);
}

export function giornoPrecedente(iso: string): string {
  const d = daISO(iso);
  d.setDate(d.getDate() - 1);
  return oggiLocale(d);
}

export function giornoSuccessivo(iso: string): string {
  const d = daISO(iso);
  d.setDate(d.getDate() + 1);
  return oggiLocale(d);
}

// "Mercoledì 4 set" — come nel mockup. toLocaleDateString dà "mercoledì 4
// set" (minuscolo), qui si alza solo la prima lettera.
export function formattaData(iso: string): string {
  const testo = daISO(iso).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

export function eOggi(iso: string, adesso: Date = new Date()): boolean {
  return iso === oggiLocale(adesso);
}

// Il giorno futuro non è mai inseribile né visualizzabile (sezione
// "Inserimento retroattivo"): la navigazione si ferma a oggi.
export function eFuturo(iso: string, adesso: Date = new Date()): boolean {
  return iso > oggiLocale(adesso);
}
