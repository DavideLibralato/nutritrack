"use client";

// "Esci", in fondo all'elenco Impostazioni: una riga arancio centrata nel
// suo gruppo, come nel mockup (docs/mockups/impostazioni.html). La conferma,
// quando serve, compare dentro lo stesso gruppo. Lo stesso componente è
// "Esci e rientra" in Impostazioni > Sincronizzazione.
//
// Dall'11/10 uscendo si svuotano i dati di questo utente dal dispositivo
// (PUNTO_DI_PARTENZA.md §9.6, "Esci svuota i dati locali"). Che cosa
// succede lo decide lo stato, non il pulsante: il lavoro e la regola stanno
// in src/lib/account/esci.ts; qui solo stati e testi.
// - offline → non si esce;
// - coda vuota → si esce e si svuota, senza chiedere;
// - coda non vuota, sessione valida → conferma "perdi N" (Resta / Esci e
//   perdile). Arancio, non rosso: il rosso è solo di Elimina account;
// - coda non vuota, sessione non valida → la frase che dice che restano
//   qui (Resta / Esci), e non si svuota niente.
// Le modifiche non salvate di un modulo non c'entrano: per lasciare una
// sotto-pagina con modifiche il guardiano chiede già prima
// (GuardianoModifiche).

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ModificheNonInviate } from "@/lib/sync/ripristino";
import {
  eseguiUscita,
  preparaUscita,
  totaleModifiche,
  type DecisioneUscita,
} from "@/lib/account/esci";
import { descriviGruppo } from "./RicaricaDatiAccount";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useOnline } from "@/lib/useOnline";
import GruppoImpostazioni from "./GruppoImpostazioni";
import { FrecciaDestra } from "./RigaImpostazioni";

type Stato =
  | { fase: "inattivo" }
  | { fase: "controllo" }
  | {
      fase: "conferma";
      decisione: Exclude<DecisioneUscita, "svuota">;
      testo: string;
      etichetta: string;
      firme: string[];
    }
  | { fase: "uscita" }
  | { fase: "errore"; testo: string };

const TESTO_SENZA_RETE = "Per uscire serve la connessione. Non sei uscito: riprova quando sei online.";

// I tipi di dato di tutte le modifiche rimaste, senza ripetizioni.
function tipi(modifiche: ModificheNonInviate): string[] {
  return [...new Set([...modifiche.inAttesa.tipi, ...modifiche.nonRiuscite.tipi])];
}

// Coda non vuota, sessione valida: uscendo si perdono.
export function testoPerdita(modifiche: ModificheNonInviate): string {
  const n = totaleModifiche(modifiche);
  const quante = descriviGruppo(
    n,
    "modifica che l'app non è riuscita a salvare online",
    "modifiche che l'app non è riuscita a salvare online",
    tipi(modifiche)
  );
  return `Su questo telefono ${n === 1 ? "c'è" : "ci sono"} ${quante}. Uscendo, i dati di questo telefono vengono cancellati: ${
    n === 1 ? "questa modifica andrà persa" : "queste modifiche andranno perse"
  }.`;
}

// Coda non vuota, sessione non valida: restano qui.
export function testoTieni(modifiche: ModificheNonInviate): string {
  const n = totaleModifiche(modifiche);
  return n === 1
    ? "La sessione è scaduta: la tua modifica resta su questo telefono e parte appena rientri con lo stesso account."
    : `La sessione è scaduta: le tue ${n} modifiche restano su questo telefono e partono appena rientri con lo stesso account.`;
}

// `etichetta`: il testo del pulsante. "Esci" in fondo all'elenco; "Esci e
// rientra" in Impostazioni > Sincronizzazione con la sessione scaduta
// (dal 10/10), stesso percorso.
// `variante` (dal 02/11/2026): "gruppo" è la riga centrata nel suo gruppo,
// com'era; "riga" è una riga dentro un gruppo che mette la pagina (il
// gruppo Dati di Sincronizzazione, sotto "Ricarica i dati"): scritta
// arancio a sinistra, `nota` grigia sotto, freccia a destra (mockup
// docs/mockups/sincronizzazione-sessione.html, proposta C). Il flusso è lo
// stesso.
export default function EsciAccount({
  userId,
  etichetta = "Esci",
  variante = "gruppo",
  nota,
}: {
  userId: string;
  etichetta?: string;
  variante?: "gruppo" | "riga";
  nota?: string;
}) {
  const router = useRouter();
  const [stato, setStato] = useState<Stato>({ fase: "inattivo" });
  // Solo per disattivare il pulsante quando il browser sa già di essere
  // offline; la verifica vera è getUser() in preparaUscita.
  const online = useOnline();

  async function avvia() {
    setStato({ fase: "controllo" });
    let preparazione;
    try {
      preparazione = await preparaUscita(userId);
    } catch {
      setStato({ fase: "errore", testo: "Controllo non riuscito. Non sei uscito: riprova." });
      return;
    }
    if (preparazione.esito === "rete") {
      setStato({ fase: "errore", testo: TESTO_SENZA_RETE });
      return;
    }

    const { decisione, modifiche } = preparazione;
    if (decisione === "svuota") {
      await esci(decisione, modifiche.firme);
    } else if (decisione === "conferma-perdita") {
      setStato({
        fase: "conferma",
        decisione,
        testo: testoPerdita(modifiche),
        etichetta: totaleModifiche(modifiche) === 1 ? "Esci e perdila" : "Esci e perdile",
        firme: modifiche.firme,
      });
    } else {
      setStato({ fase: "conferma", decisione, testo: testoTieni(modifiche), etichetta: "Esci", firme: modifiche.firme });
    }
  }

  async function esci(decisione: DecisioneUscita, firme: string[]) {
    // "Uscita…" con il pulsante spento per tutta l'uscita, compresa
    // l'attesa delle discese in corso prima della pulizia.
    setStato({ fase: "uscita" });
    let esito;
    try {
      esito = await eseguiUscita(userId, decisione, firme);
    } catch {
      setStato({ fase: "errore", testo: "Uscita non riuscita. Riprova." });
      return;
    }
    if (esito === "sessione-rimasta") {
      setStato({ fase: "errore", testo: TESTO_SENZA_RETE });
      return;
    }

    // Navigazione interna (non window.location): non fa scattare l'avviso
    // "modifiche non salvate" della pagina, già confermato qui sopra.
    router.replace("/login");
    router.refresh();
  }

  const occupato = stato.fase === "controllo" || stato.fase === "uscita";
  const testoPulsante =
    stato.fase === "controllo" ? "Controllo…" : stato.fase === "uscita" ? "Uscita…" : etichetta;

  if (variante === "riga") {
    return (
      <div className="border-t border-border">
        {stato.fase === "conferma" ? (
          <ConfermaUscita
            testo={stato.testo}
            etichetta={stato.etichetta}
            onResta={() => setStato({ fase: "inattivo" })}
            onEsci={() => esci(stato.decisione, stato.firme)}
          />
        ) : (
          <button
            type="button"
            onClick={avvia}
            disabled={occupato || !online}
            className={`flex min-h-[52px] w-full items-center gap-2.5 px-4 py-3 text-left disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-warning">{testoPulsante}</span>
              {nota && <span className="mt-0.5 block text-xs leading-snug text-muted">{nota}</span>}
            </span>
            <FrecciaDestra />
          </button>
        )}
        <Messaggi online={online} stato={stato} className="px-4 pb-3 text-sm empty:hidden" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <GruppoImpostazioni>
        {stato.fase === "conferma" ? (
          <ConfermaUscita
            testo={stato.testo}
            etichetta={stato.etichetta}
            onResta={() => setStato({ fase: "inattivo" })}
            onEsci={() => esci(stato.decisione, stato.firme)}
          />
        ) : (
          <button
            type="button"
            onClick={avvia}
            disabled={occupato || !online}
            className={`flex min-h-[52px] w-full items-center justify-center px-4 text-base font-medium text-warning disabled:opacity-50 ${CLASSE_FOCUS}`}
          >
            {testoPulsante}
          </button>
        )}
      </GruppoImpostazioni>

      <Messaggi online={online} stato={stato} className="mx-4 mt-2 text-sm empty:hidden" />
    </div>
  );
}

// La conferma, dentro lo stesso riquadro (Resta / Esci e perdile...).
function ConfermaUscita({
  testo,
  etichetta,
  onResta,
  onEsci,
}: {
  testo: string;
  etichetta: string;
  onResta: () => void;
  onEsci: () => void;
}) {
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-warning">{testo}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onResta}
          className={`flex-1 rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
        >
          Resta
        </button>
        <button
          type="button"
          onClick={onEsci}
          className={`flex-1 rounded-lg bg-warning-strong p-2 font-medium text-on-strong ${CLASSE_FOCUS}`}
        >
          {etichetta}
        </button>
      </div>
    </div>
  );
}

// role="status": gli screen reader leggono i messaggi quando cambiano,
// senza spostare il fuoco. Sta sempre nella pagina (vuoto = nascosto),
// altrimenti il primo messaggio non verrebbe letto.
function Messaggi({ online, stato, className }: { online: boolean; stato: Stato; className: string }) {
  return (
    <div role="status" className={className}>
      {!online && stato.fase !== "errore" && (
        <p className="text-muted">Per uscire serve la connessione.</p>
      )}
      {stato.fase === "errore" && <p className="text-warning">{stato.testo}</p>}
    </div>
  );
}
