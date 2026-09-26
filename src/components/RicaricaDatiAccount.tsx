"use client";

// Sezione minima di Profilo "Dati su questo dispositivo": il pulsante che
// sostituisce i dati locali con quelli del server (src/lib/sync/ripristino.ts,
// PUNTO_DI_PARTENZA.md §9.2 "Ripristino dei dati locali"). Volutamente
// essenziale. Accanto, nella stessa sezione, c'è "Esci" (EsciAccount.tsx).
//
// Passi visti dall'utente:
// 1. tocco sul pulsante → breve controllo (prova a inviare ciò che è in
//    coda, conta ciò che resta);
// 2. conferma sulla stessa riga, come "Elimina → No / Sì, elimina" nel resto
//    dell'app. Se ci sono modifiche non inviate la conferma lo dice, con
//    quante e di che tipo, e il pulsante di conferma prende il colore di
//    avviso;
// 3. scarico e sostituzione, con il pulsante disattivato;
// 4. messaggio di esito. Se è andata bene, `onRipristinato` fa ricaricare i
//    moduli della pagina dai dati nuovi.

import { useState, type ReactNode } from "react";
import {
  preparaRipristino,
  ripristinaDatiLocali,
  type ModificheNonInviate,
} from "@/lib/sync/ripristino";
import { CLASSE_FOCUS } from "@/lib/classeFocus";

type Stato =
  | { fase: "inattivo" }
  | { fase: "controllo" }
  | { fase: "conferma"; modifiche: ModificheNonInviate }
  | { fase: "in-corso" }
  | { fase: "esito"; riuscito: boolean; testo: string };

// "3 modifiche non ancora salvate online (diario, preferiti)". Esportata
// perché la usa anche la conferma di Esci (EsciAccount.tsx).
export function descriviGruppo(
  numero: number,
  singolare: string,
  plurale: string,
  tipi: string[]
): string {
  const testo = numero === 1 ? `1 ${singolare}` : `${numero} ${plurale}`;
  return `${testo} (${tipi.join(", ")})`;
}

// moduloNonSalvato: il modulo di Profilo ha modifiche non ancora salvate con
// Salva. Il ripristino ricrea il modulo dai dati scaricati, quindi andrebbero
// perse anche quelle — va detto, come per le modifiche non inviate (regola:
// mai perdere dati in silenzio).
export function testoConferma(
  modifiche: ModificheNonInviate,
  moduloNonSalvato = false
): string {
  const { inAttesa, nonRiuscite } = modifiche;
  const parti: string[] = [];
  if (inAttesa.numero > 0) {
    parti.push(
      descriviGruppo(
        inAttesa.numero,
        "modifica non ancora salvata online",
        "modifiche non ancora salvate online",
        inAttesa.tipi
      )
    );
  }
  if (nonRiuscite.numero > 0) {
    parti.push(
      descriviGruppo(
        nonRiuscite.numero,
        "modifica che l'app non è riuscita a salvare online, nemmeno riprovando",
        "modifiche che l'app non è riuscita a salvare online, nemmeno riprovando",
        nonRiuscite.tipi
      )
    );
  }

  if (parti.length === 0 && moduloNonSalvato) {
    return "I dati di questo dispositivo verranno sostituiti con quelli del tuo account. Le modifiche al profilo che non hai salvato andranno perse.";
  }
  if (parti.length === 0) {
    return "I dati di questo dispositivo verranno sostituiti con quelli del tuo account. Non perdi niente: è tutto già salvato online.";
  }

  const totale = inAttesa.numero + nonRiuscite.numero;
  return `Su questo dispositivo ${totale === 1 ? "c'è" : "ci sono"} ${parti.join(" e ")}. Ricaricando ${
    totale === 1 ? "andrà persa" : "andranno perse"
  }.${moduloNonSalvato ? " Andranno perse anche le modifiche al profilo che non hai salvato." : ""}`;
}

export default function RicaricaDatiAccount({
  userId,
  onRipristinato,
  modificheModuloNonSalvate = false,
  children,
}: {
  userId: string;
  onRipristinato: () => void;
  modificheModuloNonSalvate?: boolean;
  children?: ReactNode;
}) {
  const [stato, setStato] = useState<Stato>({ fase: "inattivo" });

  async function avvia() {
    setStato({ fase: "controllo" });
    try {
      const modifiche = await preparaRipristino(userId);
      setStato({ fase: "conferma", modifiche });
    } catch {
      setStato({
        fase: "esito",
        riuscito: false,
        testo: "Operazione non riuscita. Su questo dispositivo non è cambiato niente. Riprova.",
      });
    }
  }

  async function conferma(modifiche: ModificheNonInviate) {
    setStato({ fase: "in-corso" });
    let esito;
    try {
      esito = await ripristinaDatiLocali(userId, modifiche.firme);
    } catch {
      esito = { esito: "scarico-fallito" as const };
    }

    switch (esito.esito) {
      case "ripristinato":
        onRipristinato();
        setStato({
          fase: "esito",
          riuscito: true,
          testo: "Fatto: i dati di questo dispositivo sono di nuovo uguali a quelli del tuo account.",
        });
        break;
      case "scarico-fallito":
        setStato({
          fase: "esito",
          riuscito: false,
          testo:
            "Non è stato possibile scaricare i tuoi dati. Controlla la connessione e riprova. Su questo dispositivo non è cambiato niente.",
        });
        break;
      case "modifiche-cambiate":
        setStato({
          fase: "esito",
          riuscito: false,
          testo:
            "Nel frattempo è cambiato qualcosa su questo dispositivo, quindi non è stato sostituito niente. Riprova.",
        });
        break;
    }
  }

  const occupato = stato.fase === "controllo" || stato.fase === "in-corso";
  const conPerdita =
    stato.fase === "conferma" &&
    (stato.modifiche.inAttesa.numero + stato.modifiche.nonRiuscite.numero > 0 ||
      modificheModuloNonSalvate);

  return (
    <section className="w-full max-w-sm space-y-3 border-t border-border pt-8 pb-8">
      <h2 className="text-lg font-display font-bold">Dati su questo dispositivo</h2>
      <p className="text-sm text-muted">
        Sostituisce i dati salvati su questo dispositivo con quelli del tuo account. Utile se vedi
        qualcosa di doppio o che non torna.
      </p>

      {stato.fase === "conferma" ? (
        <>
          <p className={`text-sm ${conPerdita ? "text-warning" : ""}`}>
            {testoConferma(stato.modifiche, modificheModuloNonSalvate)}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStato({ fase: "inattivo" })}
              className={`flex-1 rounded-lg border border-border p-2 ${CLASSE_FOCUS}`}
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => conferma(stato.modifiche)}
              className={`flex-1 rounded-lg p-2 font-medium text-background ${
                conPerdita ? "bg-warning" : "bg-accent"
              } ${CLASSE_FOCUS}`}
            >
              {conPerdita ? "Ricarica lo stesso" : "Sì, ricarica"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={avvia}
          disabled={occupato}
          className={`w-full rounded-lg border border-border p-2 disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {stato.fase === "controllo"
            ? "Controllo..."
            : stato.fase === "in-corso"
              ? "Scarico i tuoi dati..."
              : "Ricarica i dati dal tuo account"}
        </button>
      )}

      {/* role="status": gli screen reader leggono avanzamento ed esito
          quando cambiano, senza spostare il fuoco. */}
      <div role="status">
        {stato.fase === "in-corso" && (
          <p className="text-sm text-muted">
            Può volerci qualche secondo. Se chiudi l&apos;app adesso non cambia niente.
          </p>
        )}
        {stato.fase === "esito" && (
          <p className={`text-sm ${stato.riuscito ? "text-accent" : "text-warning"}`}>
            {stato.testo}
          </p>
        )}
      </div>

      {/* Le altre azioni sull'account in questo dispositivo: oggi "Esci". */}
      {children}
    </section>
  );
}
