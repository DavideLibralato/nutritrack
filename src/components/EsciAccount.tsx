"use client";

// "Esci" in Profilo, nella sezione "Dati su questo dispositivo" accanto a
// "Ricarica i dati dal tuo account".
//
// I DATI LOCALI NON SI CANCELLANO all'uscita: la cancellazione al logout
// (PUNTO_DI_PARTENZA.md §9.6) è rimandata per scelta finché l'app non si apre
// ad altri utenti. Le modifiche non ancora inviate restano sul dispositivo.
//
// La conferma compare SOLO se uscire può far perdere qualcosa (regola: mai
// perdere dati in silenzio):
//   - modifiche non ancora inviate al tuo account (modificheNonInviate,
//     accantonate comprese): restano qui, ma non arrivano al tuo account
//     finché non rientri da questo dispositivo;
//   - modifiche al modulo del Profilo non ancora salvate: quelle si perdono.
// Se non c'è niente di tutto questo, si esce senza chiedere.
//
// Offline non si esce. Dopo l'uscita per rientrare serve comunque la rete,
// e signOut offline con il token scaduto non riesce a togliere la sessione:
// si resterebbe "a metà". navigator.onLine da solo non basta (su iOS non è
// affidabile), quindi prima di uscire si chiede al server chi è l'utente
// (getUser, una vera chiamata di rete): se non risponde, non si tocca
// niente. Dopo signOut si controlla che la sessione locale sia davvero
// sparita: o si è usciti del tutto, o si resta dentro con un messaggio.

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { modificheNonInviate, type ModificheNonInviate } from "@/lib/sync/ripristino";
import { sincronizzaOutbox } from "@/lib/sync/sincronizza";
import { descriviGruppo } from "./RicaricaDatiAccount";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { svuotaPagineSalvate } from "@/lib/serviceWorker";

type Stato =
  | { fase: "inattivo" }
  | { fase: "controllo" }
  | { fase: "conferma"; testo: string }
  | { fase: "uscita" }
  | { fase: "errore"; testo: string };

const TESTO_SENZA_RETE = "Per uscire serve la connessione. Non sei uscito: riprova quando sei online.";

export function testoConfermaUscita(
  modifiche: ModificheNonInviate,
  moduloNonSalvato: boolean
): string | null {
  const { inAttesa, nonRiuscite } = modifiche;
  const frasi: string[] = [];

  const parti: string[] = [];
  if (inAttesa.numero > 0) {
    parti.push(
      descriviGruppo(
        inAttesa.numero,
        "modifica non ancora inviata",
        "modifiche non ancora inviate",
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
  if (parti.length > 0) {
    const totale = inAttesa.numero + nonRiuscite.numero;
    frasi.push(
      `Su questo dispositivo ${totale === 1 ? "c'è" : "ci sono"} ${parti.join(" e ")}. Uscendo ${
        totale === 1 ? "resta" : "restano"
      } qui, ma non ${totale === 1 ? "arriva" : "arrivano"} al tuo account finché non rientri da questo dispositivo.`
    );
  }
  if (moduloNonSalvato) {
    frasi.push("Le modifiche al profilo che non hai salvato andranno perse.");
  }

  return frasi.length > 0 ? frasi.join(" ") : null;
}

// useSyncExternalStore: l'hook di React per leggere un valore che vive fuori
// da React (qui navigator.onLine) e ridisegnare quando cambia. `subscribe`
// si iscrive agli eventi online/offline; il terzo argomento è il valore
// durante il rendering sul server, dove navigator non esiste.
function iscriviOnline(avvisa: () => void) {
  window.addEventListener("online", avvisa);
  window.addEventListener("offline", avvisa);
  return () => {
    window.removeEventListener("online", avvisa);
    window.removeEventListener("offline", avvisa);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(
    iscriviOnline,
    () => navigator.onLine,
    () => true
  );
}

export default function EsciAccount({
  userId,
  modificheModuloNonSalvate,
}: {
  userId: string;
  modificheModuloNonSalvate: boolean;
}) {
  const router = useRouter();
  const [stato, setStato] = useState<Stato>({ fase: "inattivo" });
  // Solo per disattivare il pulsante quando il browser sa già di essere
  // offline; la verifica vera è getUser() in esci().
  const online = useOnline();

  async function avvia() {
    setStato({ fase: "controllo" });
    // Come per Ricarica: prima prova a inviare ciò che è in coda (spesso
    // basta a svuotarla), poi conta ciò che resta.
    await sincronizzaOutbox().catch(() => {});
    let testo: string | null;
    try {
      testo = testoConfermaUscita(await modificheNonInviate(userId), modificheModuloNonSalvate);
    } catch {
      setStato({ fase: "errore", testo: "Controllo non riuscito. Non sei uscito: riprova." });
      return;
    }
    if (testo) {
      setStato({ fase: "conferma", testo });
    } else {
      await esci();
    }
  }

  async function esci() {
    setStato({ fase: "uscita" });
    const supabase = createClient();

    // 1. Il server risponde? Se no, non si tocca niente.
    const verifica = await supabase.auth.getUser();
    if (verifica.error && isAuthRetryableFetchError(verifica.error)) {
      setStato({ fase: "errore", testo: TESTO_SENZA_RETE });
      return;
    }

    // 2. scope "local": esce solo QUESTO dispositivo. Il predefinito
    //    ("global") chiuderebbe la sessione anche sugli altri dispositivi
    //    dello stesso account.
    await supabase.auth.signOut({ scope: "local" });

    // 3. Uscita completa o niente: se la sessione è ancora qui (rete caduta
    //    fra 1 e 2, token scaduto), si resta dentro con un messaggio.
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      setStato({ fase: "errore", testo: TESTO_SENZA_RETE });
      return;
    }

    // 4. Via le pagine salvate per l'uso offline: altrimenti, senza rete,
    //    l'app si riaprirebbe come se si fosse ancora dentro.
    await svuotaPagineSalvate().catch(() => {});

    // Navigazione interna (non window.location): non fa scattare l'avviso
    // "modifiche non salvate" della pagina, già confermato qui sopra.
    router.replace("/login");
    router.refresh();
  }

  const occupato = stato.fase === "controllo" || stato.fase === "uscita";

  return (
    <div className="space-y-3 pt-2">
      {stato.fase === "conferma" ? (
        <>
          <p className="text-sm text-warning">{stato.testo}</p>
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
              onClick={esci}
              className={`flex-1 rounded-lg bg-warning p-2 font-medium text-background ${CLASSE_FOCUS}`}
            >
              Esci lo stesso
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={avvia}
          disabled={occupato || !online}
          className={`w-full rounded-lg border border-border p-2 disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {stato.fase === "controllo" ? "Controllo..." : stato.fase === "uscita" ? "Esco..." : "Esci"}
        </button>
      )}

      <div role="status">
        {!online && stato.fase !== "errore" && (
          <p className="text-sm text-muted">Per uscire serve la connessione.</p>
        )}
        {stato.fase === "errore" && <p className="text-sm text-warning">{stato.testo}</p>}
      </div>
    </div>
  );
}
