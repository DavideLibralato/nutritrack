"use client";

// Gli alimenti in arrivo dagli amici, per la pagina Alimenti
// (PUNTO_DI_PARTENZA.md §3 "Amici", "Condividere un alimento"). Solo
// online. Si rilegge: all'apertura, dopo ogni risposta (chi agisce chiama
// `ricarica`), al ritorno in primo piano e al ritorno della rete. Niente
// polling, niente Realtime (§9.2). Stesso schema di useAmicizie: una
// rilettura non rimette "caricamento", e se due letture si accavallano
// vale l'ultima partita.

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AlimentoCondiviso } from "@/lib/db/tipi";
import { leggiAlimentiInArrivo } from "./alimentiCondivisi";

export type StatoInArrivo =
  | { esito: "caricamento" }
  | { esito: "errore" }
  | { esito: "ok"; righe: AlimentoCondiviso[]; nomi: Record<string, string> };

export function useAlimentiInArrivo(userId: string | null) {
  const [stato, setStato] = useState<StatoInArrivo>({ esito: "caricamento" });
  const ultimaLettura = useRef(0);

  const ricarica = useCallback((): Promise<void> => {
    if (!userId) return Promise.resolve();
    const numero = ++ultimaLettura.current;
    return leggiAlimentiInArrivo(createClient(), userId).then((lettura) => {
      if (numero !== ultimaLettura.current) return;
      if (lettura.esito === "ok") {
        setStato({ esito: "ok", righe: lettura.righe, nomi: lettura.nomi });
      } else {
        setStato((prima) => (prima.esito === "ok" ? prima : { esito: "errore" }));
      }
    });
  }, [userId]);

  useEffect(() => {
    void ricarica();

    function alRitorno() {
      if (document.visibilityState === "visible") void ricarica();
    }
    function allaRete() {
      void ricarica();
    }
    document.addEventListener("visibilitychange", alRitorno);
    window.addEventListener("online", allaRete);
    return () => {
      document.removeEventListener("visibilitychange", alRitorno);
      window.removeEventListener("online", allaRete);
    };
  }, [ricarica]);

  return { stato, ricarica };
}
