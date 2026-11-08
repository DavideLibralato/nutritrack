// I testi della pagina Esporta (mockup docs/mockups/esporta.html, approvato
// l'08/11; PUNTO_DI_PARTENZA.md §10.4, "Dove e com'è fatta"). Funzioni
// pure, con i loro test: la pagina li mostra e basta.

import type { DatiEsportati, StatoFoto } from "./formatoEsportazione";
import { giorniDiCalendarioFra } from "./ultimaEsportazione";

export const TESTI_ESPORTA = {
  titolo: "Esporta i miei dati",
  apertura:
    "Una copia di tutti i tuoi dati in un file. Tienila in un posto sicuro: servirà per ripristinarli se un giorno li perdessi.",
  avvisoForte: "Il file contiene dati personali e di salute:",
  avviso: "cosa mangi, il peso, i tuoi obiettivi. Dove salvarlo lo scegli tu; evita le cartelle condivise.",
  pulsante: "Esporta i miei dati",
  preparo: "Preparo il file…",
  riprova: "Riprova",
  csv: "Esporta il diario per Excel",
  csvSotto: "File CSV con le voci del diario. Non serve per ripristinare i dati.",
  csvVuoto: "Il diario è vuoto.",
  salvato: "File salvato",
  nonScaricataTitolo: "Dati non ancora scaricati",
  nonScaricata:
    "Su questo telefono non ci sono ancora tutti i tuoi dati. Collegati a internet e tieni Libra aperta finché la sincronizzazione non finisce, poi torna qui.",
  nonScaricataAzione: "Vai a Sincronizzazione",
  senzaProfiloTitolo: "Manca il tuo profilo",
  // Dal 08/11 diverso dal mockup (decisione di Davide): il pulsante porta
  // a Impostazioni > Profilo, che crea il profilo per chiunque.
  senzaProfilo: "Per esportare serve il tuo profilo. Compilalo e torna qui.",
  senzaProfiloAzione: "Vai al profilo",
  installataForte: "Da qui non riesco a salvare il file.",
  // Prima e dopo l'indirizzo, che la pagina mostra in grassetto.
  installataPrima: "Apri",
  indirizzo: "app-libra.vercel.app",
  installataDopo: "in Safari, accedi ed esporta da lì.",
  erroreForte: "Il file non è stato salvato.",
  errore: "Riprova; se succede ancora, chiudi e riapri Libra.",
  // Non nel mockup: un browser senza condivisione e senza download (molto
  // vecchio). Raro, ma senza testo il tocco non farebbe niente.
  nonSupportatoForte: "Questo browser non sa salvare il file.",
  nonSupportato: "Prova con Safari o Chrome aggiornati.",
  letturaFallitaForte: "Non riesco a leggere i dati di questo telefono.",
  letturaFallita: "Chiudi e riapri Libra, poi torna qui.",
} as const;

// "07/11", con l'anno solo se prima e ultima data sono in anni diversi.
function giornoMese(iso: string, conAnno: boolean): string {
  const [anno, mese, giorno] = iso.split("-");
  return conAnno ? `${giorno}/${mese}/${anno}` : `${giorno}/${mese}`;
}

// La riga Diario: il numero di voci sopra, il periodo sotto.
export function testoDiario(voci: { data: string }[]): { numero: string; periodo: string | null } {
  if (voci.length === 0) return { numero: "Nessuna voce", periodo: null };
  const date = voci.map((v) => v.data).sort();
  const prima = date[0];
  const ultima = date[date.length - 1];
  const conAnno = prima.slice(0, 4) !== ultima.slice(0, 4);
  const numero = voci.length === 1 ? "1 voce" : `${voci.length} voci`;
  const periodo =
    prima === ultima
      ? `del ${giornoMese(prima, false)}`
      : `dal ${giornoMese(prima, conAnno)} al ${giornoMese(ultima, conAnno)}`;
  return { numero, periodo };
}

// I numeri del riepilogo, contati dalle stesse righe che vanno nel file.
export function conteggiRiepilogo(dati: DatiEsportati) {
  return {
    diario: testoDiario(dati.voci_diario),
    alimenti: dati.alimenti.length,
    pastiSalvati: dati.composizioni.filter((c) => c.tipo === "pasto_salvato").length,
    pesate: dati.misurazioni.filter((m) => m.tipo === "peso").length,
    obiettivi: dati.obiettivi.length,
  };
}

// La riga Foto profilo; null = la foto è ancora in verifica.
export function testoFoto(stato: StatoFoto | null): string {
  if (stato === null) return "Controllo…";
  if (stato.stato === "inclusa") return "Inclusa";
  if (stato.stato === "assente") return "Non hai una foto";
  return "Non inclusa";
}

function due(n: number): string {
  return String(n).padStart(2, "0");
}

// La nota sotto il riepilogo. La foto dalla copia del telefono o non
// inclusa ha la sua nota, che prende il posto di quella dei dati.
export function notaRiepilogo(
  stato: StatoFoto,
  ultimoContatto: string | null,
  adesso: Date = new Date()
): string {
  if (stato.stato === "inclusa" && stato.origine === "telefono") {
    return "La foto è quella salvata su questo telefono: senza rete non ho potuto controllare che sia l'ultima.";
  }
  if (stato.stato === "non-inclusa") {
    return "Senza rete non so se hai una foto aggiornata, quindi resta fuori. Tutto il resto è nel file. Con la rete, riapri questa pagina.";
  }
  const base = "Sono i dati di questo telefono.";
  const quando = ultimoContatto ? new Date(ultimoContatto) : null;
  if (!quando || Number.isNaN(quando.getTime())) return base;
  const giorni = giorniDiCalendarioFra(quando, adesso);
  const ora = `${due(quando.getHours())}:${due(quando.getMinutes())}`;
  const giorno =
    giorni <= 0 ? "oggi" : giorni === 1 ? "ieri" : `il ${due(quando.getDate())}/${due(quando.getMonth() + 1)}`;
  return `${base} Ultimo collegamento al server: ${giorno} alle ${ora}.`;
}

// "circa 240 KB", "circa 1,2 MB": il peso del file, arrotondato.
export function testoPeso(byte: number): string {
  if (byte < 1_000_000) return `circa ${Math.max(1, Math.round(byte / 1000))} KB`;
  return `circa ${(byte / 1_000_000).toFixed(1).replace(".", ",")} MB`;
}
