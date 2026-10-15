// I testi della pagina Amici (PUNTO_DI_PARTENZA.md §3 "Amici"; mockup
// docs/mockups/amici.html, "Testi degli esiti"). Funzioni pure, con test.

import { normalizzaUsername } from "@/lib/validazione";
import type { EsitoChiediAmicizia } from "./amicizie";

export type ToniEsito = "ok" | "avviso";

// L'esito di "Invia richiesta", sotto il campo del foglio "Aggiungi un
// amico". `valore`: il nome come l'ha scritto l'utente; nel testo va
// normalizzato, come lo vede l'altro. In verde solo ciò che è andato a buon
// fine (inviata, ora siete amici), il resto in arancio, come nel mockup.
export function testoEsitoChiedi(
  esito: EsitoChiediAmicizia,
  valore: string
): { testo: string; tono: ToniEsito } {
  const nome = `@${normalizzaUsername(valore)}`;
  switch (esito) {
    case "inviata":
      return { testo: `Richiesta inviata a ${nome}.`, tono: "ok" };
    case "accettata":
      return { testo: "Ora siete amici.", tono: "ok" };
    case "non_trovato":
      return {
        testo: "Nessun utente con questo username. Controlla come è scritto.",
        tono: "avviso",
      };
    case "gia_amici":
      return { testo: "Siete già amici.", tono: "avviso" };
    case "gia_chiesta":
      return { testo: `Hai già mandato una richiesta a ${nome}.`, tono: "avviso" };
    case "troppo_presto":
      return { testo: "Puoi riprovare tra qualche giorno.", tono: "avviso" };
    case "sei_tu":
      return { testo: "Questo è il tuo username.", tono: "avviso" };
    case "senza_username":
      return { testo: "Prima scegli il tuo username.", tono: "avviso" };
    case "errore":
      return { testo: TESTO_AZIONE_NON_RIUSCITA, tono: "avviso" };
  }
}

// La barra dopo Accetta o Rifiuta su una richiesta che nel frattempo è
// stata annullata (esito "non_trovata"). Annulla, Rimuovi e Ok con
// "non_trovata" invece valgono "già fatto": nessun messaggio (passo 5).
export const TESTO_RICHIESTA_NON_CE_PIU = "Questa richiesta non c'è più.";

// Quando la risposta non arriva, per qualunque azione della pagina.
export const TESTO_AZIONE_NON_RIUSCITA =
  "Non sono riuscito a farlo. Controlla la connessione e riprova.";

// Accettare senza username (in pratica non succede: la pagina lo chiede
// prima).
export const TESTO_PRIMA_USERNAME = "Prima scegli il tuo username.";

// La conferma di "Rimuovi amico" (SheetConferma, arancio: si può
// richiedere subito, non è per sempre).
export function testiConfermaRimozione(username: string | null): {
  titolo: string;
  testo: string;
} {
  return {
    titolo: username ? `Rimuovere @${username} dagli amici?` : "Rimuovere questo amico?",
    testo: "Gli alimenti che vi siete già mandati restano.",
  };
}

// La riga Amici in Impostazioni: quanti amici (accettati).
export function testoRigaAmici(numero: number): string {
  if (numero === 0) return "Nessuno";
  return numero === 1 ? "1 amico" : `${numero} amici`;
}

// Il nome nella riga: "@nome", o il ripiego quando il nome non è arrivato.
export function etichettaAmico(username: string | null): string {
  return username ? `@${username}` : "Nome non disponibile";
}
