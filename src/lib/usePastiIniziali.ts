"use client";

// Il seed dei pasti predefiniti visto da una pagina (Oggi e Aggiungi):
// lancia garantisciPastiPredefiniti (src/lib/repository/pasti.ts) e dice
// a che punto è, per scegliere cosa mostrare finché l'utente non ha ancora
// nessun pasto:
//   - "in-corso": la lettura dal server non ha ancora risposto →
//     "Preparo i tuoi pasti…";
//   - "lettura-fallita": il server non ha risposto, nessun pasto creato →
//     "Serve la connessione" con "Riprova" (ServeConnessione);
//   - "pronto": i pasti c'erano già, sono stati creati o scaricati.
// Riprova da solo quando il browser torna online (evento `online`), e
// a mano con `riprova` (il pulsante).
//
// Una volta per utente per montaggio della pagina, più i tentativi: non
// dipende dall'elenco dei pasti letto con useLiveQuery, che dopo un
// refresh può restare "non ancora arrivato" più a lungo del previsto (bug
// reale: un secondo refresh ravvicinato aveva rifatto il seed da capo).
// Due pagine o due tentativi sovrapposti ricevono la stessa esecuzione
// (garantisciPastiPredefiniti tiene una sola promessa per utente).

import { useCallback, useEffect, useState } from "react";
import { garantisciPastiPredefiniti } from "./repository/pasti";

export type StatoPastiIniziali = "in-corso" | "lettura-fallita" | "pronto";

interface Esito {
  userId: string;
  tentativo: number;
  stato: Exclude<StatoPastiIniziali, "in-corso">;
}

export function usePastiIniziali(userId: string | null | undefined) {
  // Il numero del tentativo: cambiarlo fa ripartire l'effetto qui sotto.
  const [tentativo, setTentativo] = useState(0);
  // L'esito dell'ultimo tentativo concluso, con l'utente e il tentativo a
  // cui si riferisce. Se non corrisponde a quelli di adesso, il tentativo
  // in corso non ha ancora risposto: lo stato si DEDUCE da qui, invece di
  // scrivere "in-corso" all'inizio dell'effetto (una scrittura di stato
  // dentro un effetto fa ridisegnare la pagina una volta in più per niente).
  const [esito, setEsito] = useState<Esito | null>(null);

  useEffect(() => {
    if (!userId) return;
    // `attivo` diventa false quando l'effetto viene "pulito" (la funzione
    // restituita in fondo): pagina chiusa, utente cambiato o nuovo
    // tentativo partito. Una risposta arrivata dopo non scrive più niente.
    let attivo = true;
    garantisciPastiPredefiniti(userId)
      .then((risultato) => {
        if (!attivo) return;
        setEsito({
          userId,
          tentativo,
          stato: risultato === "lettura-fallita" ? "lettura-fallita" : "pronto",
        });
      })
      .catch(() => {
        // Errore inatteso (per esempio scrivendo in Dexie): per chi guarda
        // è lo stesso caso, i pasti non ci sono e si può riprovare.
        if (attivo) setEsito({ userId, tentativo, stato: "lettura-fallita" });
      });
    return () => {
      attivo = false;
    };
  }, [userId, tentativo]);

  const stato: StatoPastiIniziali =
    esito && esito.userId === userId && esito.tentativo === tentativo ? esito.stato : "in-corso";

  // useCallback: la stessa funzione fra un ridisegno e l'altro, così
  // l'effetto dell'evento `online` qui sotto non si riiscrive a ogni giro.
  const riprova = useCallback(() => setTentativo((n) => n + 1), []);

  // Torna la rete: si riprova da soli, ma solo se l'ultimo tentativo è
  // fallito (negli altri casi non c'è niente da recuperare).
  useEffect(() => {
    if (stato !== "lettura-fallita") return;
    window.addEventListener("online", riprova);
    return () => window.removeEventListener("online", riprova);
  }, [stato, riprova]);

  return { stato, riprova };
}
