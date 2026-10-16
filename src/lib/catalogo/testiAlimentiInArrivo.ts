// I testi della condivisione degli alimenti (PUNTO_DI_PARTENZA.md §3
// "Amici", "Condividere un alimento"; mockup
// docs/mockups/alimenti-in-arrivo.html, proposta B, e
// docs/mockups/amici.html, schermata 6). Funzioni pure, con test.

import type { CampoValore } from "./alimentiInArrivo";
import type { MessaggioBarra } from "../inserimento/testiBarra";
import { TESTO_AZIONE_NON_RIUSCITA } from "../amici/testiAmici";
import type { EsitoMandaAlimenti } from "../amici/alimentiCondivisi";

function alimentiN(n: number): string {
  return n === 1 ? "1 alimento" : `${n} alimenti`;
}

// --- La riga in cima ad Alimenti e quella di Impostazioni ---

export function titoloRigaInArrivo(n: number): string {
  return `${alimentiN(n)} in arrivo`;
}

// Chi li manda, sotto il titolo: gli username dei mittenti, uno per
// mittente, nell'ordine dell'elenco. Con un mittente "Da @sara_c", con due
// "Da @sara_c e @paolo_a", con tre o più "Da 3 amici". Uno username che non
// è arrivato (null) non si scrive: "Da un amico", "Da 2 amici".
export function sottotitoloMittenti(username: (string | null)[]): string {
  const n = username.length;
  if (n === 0) return "";
  if (n >= 3 || (n === 2 && username.some((u) => u === null))) return `Da ${n} amici`;
  if (n === 1) return username[0] === null ? "Da un amico" : `Da @${username[0]}`;
  return `Da @${username[0]} e @${username[1]}`;
}

// La riga Alimenti di Impostazioni, al posto del numero di alimenti.
export function testoRigaImpostazioniInArrivo(n: number): string {
  return `${n} in arrivo`;
}

// --- Il foglio ---

export const TITOLO_FOGLIO_IN_ARRIVO = "In arrivo dagli amici";

export const NOTA_FOGLIO_IN_ARRIVO =
  "Aggiunto, diventa un alimento tuo: lo puoi modificare, e le modifiche di chi l'ha mandato non lo toccano.";

export const NOTA_SELEZIONE_IN_ARRIVO =
  "I doppioni non si selezionano: per loro si decide uno per uno.";

// Il doppione con valori diversi: sempre nome e marca, come il messaggio
// del form (testoDoppione).
export function testoDoppioneDiverso(mio: { nome: string; marca: string | null }): string {
  const marca = mio.marca?.trim();
  return marca
    ? `Hai già «${mio.nome} · ${marca}», con valori diversi.`
    : `Hai già «${mio.nome}», senza marca, con valori diversi.`;
}

export const TESTO_VALORI_IDENTICI = "Hai già questo alimento, con gli stessi valori.";

export const NOTA_CONFRONTO =
  'In arancio i valori diversi dal tuo. "Usa questi valori" aggiorna il tuo alimento: preferiti e pasti salvati prendono i valori nuovi, il diario già registrato non cambia.';

// La riga dei quattro valori per 100 g sotto il nome: "259 kcal · G 3,3 ·
// C 45 · P 9 g", come nel mockup.
export function testoValoriBrevi(v: {
  kcal_100g: number;
  grassi_100g: number;
  carboidrati_100g: number;
  proteine_100g: number;
}): string {
  return (
    `${numero(v.kcal_100g)} kcal · G ${numero(v.grassi_100g)} · ` +
    `C ${numero(v.carboidrati_100g)} · P ${numero(v.proteine_100g)} g`
  );
}

// --- La tabella "Confronta i valori" ---

export const ETICHETTE_CAMPI: Record<CampoValore, string> = {
  kcal_100g: "Kcal",
  grassi_100g: "Grassi",
  carboidrati_100g: "Carboidrati",
  proteine_100g: "Proteine",
  porzione_default_g: "Porzione",
  zuccheri_100g: "Zuccheri",
  fibre_100g: "Fibre",
  saturi_100g: "Saturi",
  sale_100g: "Sale",
};

// Un numero all'italiana con al massimo due decimali ("0,4", "57",
// "3,33"): una differenza al secondo decimale deve vedersi, se no la cella
// in arancio mostrerebbe due numeri uguali.
function numero(v: number): string {
  return v.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}

// Una cella della tabella: le kcal senza unità, il resto in grammi, un
// valore assente con il trattino.
export function testoValoreConfronto(campo: CampoValore, valore: number | null): string {
  if (valore === null) return "—";
  return campo === "kcal_100g" ? numero(valore) : `${numero(valore)} g`;
}

// --- Le conferme della selezione multipla (solo con più di un alimento) ---

export interface TestiConferma {
  titolo: string;
  testo: string;
  etichettaSi: string;
}

// `restanoDoppioni`: nel foglio ci sono alimenti che non si selezionano
// (doppioni o uguali) e che restano lì dopo l'Aggiungi.
export function testiConfermaAggiungi(n: number, restanoDoppioni: boolean): TestiConferma {
  return {
    titolo: `Aggiungere ${n} alimenti?`,
    testo:
      "Entrano nel tuo catalogo come alimenti tuoi." +
      (restanoDoppioni ? " I doppioni restano qui, da decidere uno per uno." : ""),
    etichettaSi: `Aggiungi ${n}`,
  };
}

export function testiConfermaRifiuta(n: number): TestiConferma {
  return {
    titolo: `Rifiutare ${n} alimenti?`,
    testo: "Chi te li ha mandati non lo saprà. Per riaverli dovrà mandarteli di nuovo.",
    etichettaSi: `Rifiuta ${n}`,
  };
}

// --- Le barre ---

// Dopo Aggiungi, senza Annulla: "Aggiunto: Pane", "Aggiunti: 3 alimenti".
export function messaggioAlimentiAggiunti(nomi: string[]): MessaggioBarra {
  if (nomi.length === 1) return { testo: "Aggiunto:", nome: nomi[0], icona: "spunta" };
  return { testo: "Aggiunti:", nome: alimentiN(nomi.length), icona: "spunta" };
}

// Dopo "Usa questi valori", con Annulla: "Valori aggiornati: Yogurt ·
// Fage". Se la chiusura non è arrivata lo dice: alla rilettura l'alimento
// resta fra quelli in arrivo, con gli stessi valori e solo Ok.
export function messaggioValoriAggiornati(nome: string, chiusuraRiuscita: boolean): MessaggioBarra {
  return {
    testo: "Valori aggiornati:",
    nome,
    coda: chiusuraRiuscita ? undefined : "(resta fra quelli in arrivo)",
    icona: "spunta",
  };
}

// L'Annulla non è riuscito (la riapertura non ha risposto): non è cambiato
// niente, e la barra offre di nuovo Annulla.
export const TESTO_ANNULLA_NON_RIUSCITO =
  "Non sono riuscito ad annullare. Controlla la connessione e riprova.";

// "Usa questi valori" su un alimento proprio che nel frattempo non c'è più
// (eliminato, anche da un altro telefono): non è cambiato niente.
export const TESTO_MIO_ALIMENTO_SPARITO = "Il tuo alimento non c'è più: non è cambiato niente.";

// Dopo l'invio: "Mandati 2 alimenti a @sara_c.", con la stessa forma per
// un alimento ("Mandato 1 alimento a …") e per più amici ("… a @sara_c e
// @paolo_a.", "… a 3 amici."). Uno username non arrivato (null) non si
// scrive, come nel sottotitolo: "… a un amico.", "… a 2 amici.".
export function messaggioInviati(numeroAlimenti: number, amici: (string | null)[]): MessaggioBarra {
  const verbo = numeroAlimenti === 1 ? "Mandato" : "Mandati";
  const n = amici.length;
  const a =
    n >= 3 || (n === 2 && amici.some((u) => u === null))
      ? `${n} amici`
      : n === 1
        ? amici[0] === null
          ? "un amico"
          : `@${amici[0]}`
        : `@${amici[0]} e @${amici[1]}`;
  return { testo: `${verbo} ${alimentiN(numeroAlimenti)} a ${a}.`, icona: "spunta" };
}

// --- Il foglio "Condividi con" (mockup amici.html, schermata 6) ---

export function titoloCondividi(numeroAlimenti: number): string {
  return `Condividi ${alimentiN(numeroAlimenti)}`;
}

export const TESTO_CONDIVIDI =
  "Ogni amico riceve una copia: la aggiunge al suo catalogo solo se la accetta, e le tue modifiche future non la toccano.";

// Il pulsante: "Manda a 1 amico", "Manda a 3 amici"; senza amici spuntati
// solo "Manda", spento.
export function etichettaManda(numeroAmici: number): string {
  if (numeroAmici === 0) return "Manda";
  return numeroAmici === 1 ? "Manda a 1 amico" : `Manda a ${numeroAmici} amici`;
}

export const TESTO_SENZA_AMICI = "Non hai ancora amici. Aggiungine uno da Amici, poi torna qui.";

export const TESTO_CONDIVIDI_SENZA_RETE = "Per condividere un alimento serve la connessione.";

export const TESTO_AMICI_NON_LETTI =
  "Non riesco a leggere i tuoi amici. Controlla la connessione e riprova.";

// L'esito di "Manda" quando non è andato: resta nel foglio "Condividi
// con", che non si chiude. "non_valido" non dovrebbe mai succedere (l'app
// manda solo alimenti già validi): vale come un errore.
export function testoEsitoInvio(esito: Exclude<EsitoMandaAlimenti, "ok">): string {
  if (esito === "non_amici") {
    return "Uno degli amici scelti non è più tuo amico: non è partito niente. Controlla l'elenco e riprova.";
  }
  return TESTO_AZIONE_NON_RIUSCITA;
}

// Una risposta (Aggiungi, Rifiuta, Ok, ...) su alimenti che nel frattempo
// non sono più in arrivo: non è cambiato niente, l'elenco si rilegge.
export function testoNonPiuInArrivo(n: number): string {
  return n === 1
    ? "Questo alimento non è più in arrivo."
    : "Alcuni di questi alimenti non sono più in arrivo: non è cambiato niente.";
}
