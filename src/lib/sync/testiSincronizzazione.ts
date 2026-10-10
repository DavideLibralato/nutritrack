// I testi dell'indicatore di sincronizzazione (Impostazioni >
// Sincronizzazione), dal mockup approvato il 10/10
// (docs/mockups/sincronizzazione.html, pagina "A · Riquadro"). Funzioni
// pure: lo stato da mostrare (statoDaMostrare) diventa titolo, testo, riga
// "da quando" / "controllato alle", tono e icona.

import { formattaGiornoCorto, oggiLocale, giornoPrecedente } from "../dataGiorno";
import { ETICHETTE } from "./ripristino";
import { SOGLIA_SOSPENSIONE } from "./sincronizza";
import type { RiassuntoCoda, StatoDaMostrare } from "./statoSincronizzazione";
import type { VoceOutbox } from "./outbox";

// Il colore del riquadro (token del tema, sezione 7): verde per tutto a
// posto e in corso, ocra per in attesa, arancio per i tre stati che
// chiedono attenzione (gli stessi del pallino sulla tab).
export type Tono = "accento" | "attesa" | "avviso";
export type IconaStato = "fatto" | "in-corso" | "senza-rete" | "avviso" | "chiave";

export interface TestiStato {
  titolo: string;
  testo: string;
  quando: string | null;
  tono: Tono;
  icona: IconaStato;
}

function modifiche(n: number): string {
  return n === 1 ? "1 modifica" : `${n} modifiche`;
}

function ora(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

// Il giorno di un istante, detto rispetto a oggi: "" (oggi), "ieri",
// "gio 8 ott". Il giorno è quello del calendario locale, come nel diario.
function giorno(iso: string, adesso: Date): string {
  const data = oggiLocale(new Date(iso));
  const oggi = oggiLocale(adesso);
  if (data === oggi) return "";
  if (data === giornoPrecedente(oggi)) return "ieri";
  return formattaGiornoCorto(data);
}

// "Controllato alle 14:32", "Controllato ieri alle 14:32", "Controllato
// gio 8 ott alle 14:32".
export function testoControllato(iso: string, adesso: Date): string {
  const g = giorno(iso, adesso);
  return `Controllato ${g ? `${g} ` : ""}alle ${ora(iso)}`;
}

// "dalle 14:02", "da ieri alle 14:02", "da gio 8 ott alle 14:02": dentro
// una frase ("In attesa dalle 14:02").
export function testoDaQuando(iso: string, adesso: Date): string {
  const g = giorno(iso, adesso);
  return g ? `da ${g} alle ${ora(iso)}` : `dalle ${ora(iso)}`;
}

function maiuscola(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

// "Diario (2), Pasti (1)": i tipi delle voci accantonate, in parole
// dell'utente (le stesse etichette della conferma di Ricarica), con quante.
export function riepilogoPerTipo(voci: VoceOutbox[]): string {
  const conteggi = new Map<string, number>();
  for (const v of voci) {
    const etichetta = maiuscola(ETICHETTE[v.tabella]);
    conteggi.set(etichetta, (conteggi.get(etichetta) ?? 0) + 1);
  }
  return [...conteggi].map(([etichetta, n]) => `${etichetta} (${n})`).join(", ");
}

// `riepilogoAccantonate`: riepilogoPerTipo delle voci accantonate, per la
// riga sotto il titolo dello stato "accantonate".
export function testiStato(
  stato: StatoDaMostrare,
  coda: RiassuntoCoda,
  riepilogoAccantonate: string,
  adesso: Date
): TestiStato {
  switch (stato.tipo) {
    case "accantonate":
      return {
        titolo: `${modifiche(stato.numero)} non ${stato.numero === 1 ? "salvata" : "salvate"} online`,
        testo: `L'app ha smesso di riprovare dopo ${SOGLIA_SOSPENSIONE} rifiuti del server.`,
        quando: riepilogoAccantonate || null,
        tono: "avviso",
        icona: "avviso",
      };

    case "sessione":
      return {
        titolo: "Accesso scaduto",
        testo:
          stato.inAttesa > 0
            ? "Le modifiche restano su questo telefono. Esci e rientra per salvarle online."
            : "Esci e rientra per sincronizzare di nuovo.",
        quando:
          stato.inAttesa > 0 && coda.inAttesaDal
            ? `${modifiche(stato.inAttesa)} in attesa ${testoDaQuando(coda.inAttesaDal, adesso)}`
            : null,
        tono: "avviso",
        icona: "chiave",
      };

    case "errore": {
      const quando = stato.dal ? maiuscola(testoDaQuando(stato.dal, adesso)) : null;
      // Senza modifiche in coda l'errore è della discesa: i dati di questo
      // telefono sono salvati, è il server che non si legge.
      if (stato.inAttesa === 0) {
        return {
          titolo: "Non riesco a scaricare i dati dal server",
          testo: "Le modifiche di questo telefono sono salvate. Riprovo da solo a ogni apertura.",
          quando,
          tono: "avviso",
          icona: "avviso",
        };
      }
      return {
        titolo: `Non riesco a salvare ${modifiche(stato.inAttesa)} online`,
        testo: `Il server ${stato.inAttesa === 1 ? "la" : "le"} rifiuta. Riprovo da solo a ogni apertura.`,
        quando,
        tono: "avviso",
        icona: "avviso",
      };
    }

    case "in-corso":
      return {
        titolo: "Sincronizzazione in corso…",
        testo:
          coda.inAttesa > 0
            ? `Sto inviando ${modifiche(coda.inAttesa)}.`
            : "Sto controllando i dati sul server.",
        quando: null,
        tono: "accento",
        icona: "in-corso",
      };

    case "in-attesa":
      return {
        titolo: `${modifiche(stato.numero)} in attesa`,
        testo: "Partono da sole quando torna la rete.",
        quando: stato.dal ? `In attesa ${testoDaQuando(stato.dal, adesso)}` : null,
        tono: "attesa",
        icona: "senza-rete",
      };

    case "sincronizzato":
      return {
        titolo: "Tutto salvato online",
        testo: "Le modifiche di questo telefono sono anche sul server.",
        quando: stato.ultimoSuccesso ? testoControllato(stato.ultimoSuccesso, adesso) : null,
        tono: "accento",
        icona: "fatto",
      };
  }
}

// "gio 8 ott, 13:10": quando è stata fatta una modifica accantonata.
export function testoModificataIl(iso: string): string {
  return `${formattaGiornoCorto(oggiLocale(new Date(iso)))}, ${ora(iso)}`;
}
