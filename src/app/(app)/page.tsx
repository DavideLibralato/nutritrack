"use client";

// La pagina Oggi (PUNTO_DI_PARTENZA.md, sezione 3 e 6): la schermata di
// apertura. Sta nel route group "(app)", quindi il suo URL è "/".
//
// Dexie vive solo nel browser, quindi è un componente client. useLiveQuery
// (dexie-react-hooks) riesegue la query e ridisegna da solo ogni volta che i
// dati locali cambiano — non serve rileggere a mano dopo una scrittura.
// Come nella pagina Profilo, le query rispondono `undefined` (= "non so
// ancora") finché non conosciamo l'utente, mai `[]` (= "so che è vuoto").
//
// Layout a tre fasce, solo quella centrale scorre (sezione 3):
//   - in alto, fisso: data navigabile, calorie rimanenti, anello e macro
//   - al centro, scorrevole: la lista dei pasti
//   - in basso, fisso: il pulsante "+ Aggiungi"
//
// Il pulsante "+ Aggiungi" apre /aggiungi passando il giorno mostrato, così
// dopo il salvataggio si torna all'Oggi del giorno giusto (anche un giorno
// passato). Per leggere ?giorno= serve useSearchParams, che va avvolto in
// <Suspense> (come nella pagina di login).

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useUtenteId } from "@/lib/supabase/useUtente";
import {
  repositoryPasti,
  repositoryVociDiario,
  repositoryObiettivi,
} from "@/lib/repository";
import { garantisciPastiPredefiniti } from "@/lib/repository/pasti";
import { sommaTotali, vociDelGiorno, obiettivoValidoPer } from "@/lib/totaliDiario";
import {
  oggiLocale,
  giornoPrecedente,
  giornoSuccessivo,
  formattaData,
  eOggi,
  eFuturo,
} from "@/lib/dataGiorno";
import AnelloCalorie from "@/components/AnelloCalorie";
import BarraMacro from "@/components/BarraMacro";

const CLASSE_FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function OggiPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-full items-center justify-center p-4">
          <p className="text-sm text-muted">Caricamento...</p>
        </main>
      }
    >
      <OggiContenuto />
    </Suspense>
  );
}

function OggiContenuto() {
  const userId = useUtenteId();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Il giorno visualizzato, "YYYY-MM-DD". Parte da oggi, oppure dal ?giorno=
  // con cui /aggiungi ci ha rimandato qui dopo un salvataggio. Un giorno
  // futuro viene ignorato: la navigazione si ferma a oggi.
  const [giorno, setGiorno] = useState(() => {
    const param = searchParams.get("giorno");
    return param && !eFuturo(param) ? param : oggiLocale();
  });

  // Il calendario si apre da codice con showPicker() sull'input date, non
  // sovrapponendo un input invisibile al testo: quel trucco lasciava
  // cliccabile solo una porzione della scritta (l'area utile di un input
  // date nativo non è tutta la sua superficie). Il testo della data è un
  // <button> vero: tap o Invio/Spazio aprono il calendario.
  const rifData = useRef<HTMLInputElement>(null);

  function apriCalendario() {
    const el = rifData.current;
    if (!el) return;
    // showPicker() è supportato da Chrome/Edge/Safari/Firefox recenti; può
    // lanciare un'eccezione (nessun gesto utente, input non renderizzato).
    // Nel dubbio si ripiega sul focus, che sui browser da telefono apre
    // comunque il calendario.
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

  const pasti = useLiveQuery(async () => {
    if (!userId) return undefined;
    const righe = await repositoryPasti.ottieniTutti(userId);
    // Le fasce si mostrano nell'ordine scelto dall'utente (campo `ordine`).
    return [...righe].sort((a, b) => a.ordine - b.ordine);
  }, [userId]);

  // Tutte le voci dell'utente: il filtro per giorno lo fa vociDelGiorno qui
  // sotto, così cambiare data non rilancia una query.
  const vociTutte = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryVociDiario.ottieniTutti(userId);
  }, [userId]);

  const obiettivi = useLiveQuery(async () => {
    if (!userId) return undefined;
    return repositoryObiettivi.ottieniTutti(userId);
  }, [userId]);

  // Se l'utente non ha ancora nessun pasto (registrazione fatta prima che
  // esistesse questa logica, o primo avvio), crea il set predefinito dei 5
  // pasti. garantisciPastiPredefiniti è idempotente e ha una guardia contro
  // la doppia esecuzione; la useLiveQuery qui sopra si aggiorna da sola
  // appena i pasti sono in Dexie.
  useEffect(() => {
    if (!userId || pasti === undefined) return;
    if (pasti.length === 0) {
      garantisciPastiPredefiniti(userId, pasti).catch(() => {});
    }
  }, [userId, pasti]);

  // Derivati: con React Compiler attivo non serve useMemo, il ricalcolo a
  // ogni render è già memoizzato dal compilatore.
  const vociGiorno = vociTutte ? vociDelGiorno(vociTutte, giorno) : [];
  const totali = sommaTotali(vociGiorno);
  const obiettivo = obiettivi ? obiettivoValidoPer(obiettivi, giorno) : null;

  const targetKcal = obiettivo?.kcal ?? null;
  const consumateKcal = Math.round(totali.kcal);

  // La seconda riga sotto la data cambia significato a seconda del giorno
  // (sezione 3): "Rimangono X kcal" su oggi, "consumate di target" sui
  // giorni passati (dove "rimangono" non vuol dire niente).
  let rigaCalorie: string;
  let classeRigaCalorie = "text-muted";
  if (targetKcal == null) {
    rigaCalorie = "Nessun obiettivo impostato";
  } else if (eOggi(giorno)) {
    const rimaste = targetKcal - consumateKcal;
    if (rimaste >= 0) {
      rigaCalorie = `Rimangono ${rimaste} kcal`;
    } else {
      rigaCalorie = `${-rimaste} kcal oltre l'obiettivo`;
      classeRigaCalorie = "text-warning";
    }
  } else {
    rigaCalorie = `${consumateKcal} di ${targetKcal} kcal`;
  }

  if (
    userId === undefined ||
    pasti === undefined ||
    vociTutte === undefined ||
    obiettivi === undefined
  ) {
    return (
      <main className="flex min-h-full items-center justify-center p-4">
        <p className="text-sm text-muted">Caricamento...</p>
      </main>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* FASCIA ALTA — fissa */}
      <header className="shrink-0 px-4 pt-6 pb-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setGiorno(giornoPrecedente(giorno))}
            aria-label="Giorno precedente"
            className={`rounded p-1 text-muted ${CLASSE_FOCUS}`}
          >
            <Chevron verso="sinistra" />
          </button>

          {/* Il titolo-data è un pulsante: aprirlo mostra il calendario
              nativo (sezione "Inserimento retroattivo"). `max` impedisce di
              scegliere un giorno futuro. L'input date resta fuori schermo
              (sr-only) e serve solo come bersaglio di showPicker(). */}
          <h1 className="font-display text-2xl font-bold">
            <button
              type="button"
              onClick={apriCalendario}
              aria-label={`Cambia data, ${formattaData(giorno)}`}
              className={`rounded ${CLASSE_FOCUS}`}
            >
              {formattaData(giorno)}
            </button>
          </h1>
          <input
            ref={rifData}
            type="date"
            value={giorno}
            max={oggiLocale()}
            onChange={(e) => e.target.value && setGiorno(e.target.value)}
            tabIndex={-1}
            aria-hidden
            className="sr-only"
          />

          <button
            type="button"
            onClick={() => setGiorno(giornoSuccessivo(giorno))}
            disabled={eOggi(giorno)}
            aria-label="Giorno successivo"
            className={`rounded p-1 text-muted disabled:opacity-30 ${CLASSE_FOCUS}`}
          >
            <Chevron verso="destra" />
          </button>

          {!eOggi(giorno) && (
            <button
              type="button"
              onClick={() => setGiorno(oggiLocale())}
              className={`ml-auto rounded-full border border-border px-3 py-1 text-xs ${CLASSE_FOCUS}`}
            >
              Oggi
            </button>
          )}
        </div>

        <p className={`mt-1 text-sm ${classeRigaCalorie}`}>{rigaCalorie}</p>

        {/* Anello + macro affiancati, non impilati (sezione 3). */}
        <div className="mt-5 flex items-center gap-4">
          <AnelloCalorie consumate={totali.kcal} obiettivo={targetKcal} />
          <div className="flex-1 space-y-3">
            <BarraMacro
              nome="Proteine"
              valore={totali.proteine}
              obiettivo={obiettivo?.proteine_g ?? null}
            />
            <BarraMacro
              nome="Carboidrati"
              valore={totali.carboidrati}
              obiettivo={obiettivo?.carboidrati_g ?? null}
            />
            <BarraMacro
              nome="Grassi"
              valore={totali.grassi}
              obiettivo={obiettivo?.grassi_g ?? null}
            />
          </div>
        </div>
      </header>

      {/* FASCIA CENTRALE — l'unica che scorre */}
      <ul className="min-h-0 flex-1 overflow-y-auto px-4">
        {pasti.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted">Preparo i tuoi pasti…</li>
        ) : (
          pasti.map((pasto) => {
            const vociPasto = vociGiorno.filter((v) => v.pasto_id === pasto.id);
            const kcalPasto = Math.round(sommaTotali(vociPasto).kcal);
            const nomi = vociPasto.map((v) => v.nome_alimento).join(" · ");
            return (
              <li key={pasto.id} className="border-b border-border py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-lg">{pasto.nome}</span>
                  <span className="shrink-0 text-lg">
                    {vociPasto.length > 0 ? `${kcalPasto} kcal` : "—"}
                  </span>
                </div>
                {vociPasto.length > 0 && (
                  <p className="mt-1 text-sm text-muted">{nomi}</p>
                )}
              </li>
            );
          })
        )}
      </ul>

      {/* FASCIA BASSA — fissa. Il pulsante non deve mai finire sotto la
          piega: è l'azione per cui esiste l'app (sezione 3). Apre /aggiungi
          per il giorno mostrato. */}
      <div className="shrink-0 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => router.push(`/aggiungi?giorno=${giorno}`)}
          className={`mx-auto block rounded-full bg-accent px-10 py-3 font-medium text-background ${CLASSE_FOCUS}`}
        >
          + Aggiungi
        </button>
      </div>
    </div>
  );
}

function Chevron({ verso }: { verso: "sinistra" | "destra" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={verso === "sinistra" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}
