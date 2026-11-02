"use client";

// "Non salvate online", in Impostazioni > Sincronizzazione (mockup del
// 10/10): le modifiche che l'app ha smesso di mandare dopo troppi rifiuti
// del server. Compare solo se ce ne sono.
//
// - l'elenco in parole dell'utente: che cosa (Voce del diario, Pasto...),
//   quale («Merenda», "Yogurt, Pranzo") e quando è stata fatta;
// - "Dettagli tecnici", chiuso di default (decisione del 10/10: in futuro
//   l'app potrebbe usarla qualcuno in famiglia): tabella, tentativi, status
//   ed errore, per non dover aprire Supabase (componente DettagliTecnici);
// - "Riprova a salvarle": le rimette in coda come nuove e fa partire un
//   giro. Niente "Scarta": per buttarle c'è già "Ricarica i dati dal tuo
//   account", con la sua conferma.

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { riprovaAccantonate, vociAccantonate } from "@/lib/sync/codaDellUtente";
import { sincronizzaOutbox } from "@/lib/sync/sincronizza";
import type { VoceOutbox } from "@/lib/sync/outbox";
import { testoModificataIl } from "@/lib/sync/testiSincronizzazione";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import GruppoImpostazioni from "./GruppoImpostazioni";
import DettagliTecnici from "./DettagliTecnici";

export default function ModificheAccantonate({
  userId,
  voci,
}: {
  userId: string;
  voci: VoceOutbox[];
}) {
  const elenco = useLiveQuery(() => vociAccantonate(voci), [voci]);
  const [inCorso, setInCorso] = useState(false);

  if (!elenco || elenco.length === 0) return null;

  async function riprova() {
    setInCorso(true);
    try {
      await riprovaAccantonate(userId);
      await sincronizzaOutbox().catch(() => {});
    } finally {
      setInCorso(false);
    }
  }

  return (
    <GruppoImpostazioni titolo="Non salvate online">
      <div className="px-4 pt-1 pb-4">
        <ul>
          {elenco.map((v) => (
            <li key={v.id} className="border-b border-border py-3">
              <p className="text-sm font-medium">{v.tipo}</p>
              <p className="mt-0.5 text-xs text-muted">
                {[v.dettaglio, testoModificataIl(v.modificataIl)].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>

        <DettagliTecnici
          className="mt-1.5"
          righe={elenco.map((v) => ({
            chiave: v.id,
            testo: [
              v.tabella,
              `${v.tentativi} tentativi`,
              v.status ?? "status non noto",
              v.errore ?? "nessun messaggio",
            ].join(" · "),
          }))}
        />

        <button
          type="button"
          onClick={riprova}
          disabled={inCorso}
          className={`mt-2 w-full rounded-lg border border-border p-2 font-medium disabled:opacity-50 ${CLASSE_FOCUS}`}
        >
          {inCorso ? "Riprovo..." : "Riprova a salvarle"}
        </button>
      </div>
    </GruppoImpostazioni>
  );
}
