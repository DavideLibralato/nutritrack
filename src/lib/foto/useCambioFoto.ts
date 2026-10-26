"use client";

// Il cambio della foto profilo, dal tocco alla risposta del server
// (PUNTO_DI_PARTENZA.md §3, "La foto profilo"). Lo stato lo decide
// prossimoStatoFoto (statoCambioFoto.ts); qui le chiamate:
// preparaFotoProfilo (ritaglioFoto.ts) e cambiaFoto / eliminaFoto
// (fotoProfilo.ts). La schermata (CambioFotoProfilo) mostra lo stato.
//
// Doppio tocco: due tocchi nello stesso istante leggono lo stesso stato
// (il secondo arriva prima che React ridisegni), quindi lo stato da solo
// non basta a fermarli. `lavoro` segna che un lavoro è partito: finché
// non finisce, "Usa foto", "Riprova" ed "Elimina foto" non fanno niente.

import { useReducer, useRef } from "react";
import { createClient } from "../supabase/client";
import { preparaFotoProfilo, type AreaRitaglio, type EsitoPreparazioneFoto } from "./ritaglioFoto";
import {
  cambiaFoto,
  eliminaFoto,
  type EsitoCambioFoto,
  type EsitoEliminaFoto,
} from "./fotoProfilo";
import { prossimoStatoFoto, RIPOSO, type EventoFoto, type StatoFoto } from "./statoCambioFoto";

export interface CambioFoto {
  stato: StatoFoto;
  invia: (evento: EventoFoto) => void;
  usaFoto: (area: AreaRitaglio) => Promise<void>;
  riprova: () => Promise<void>;
  confermaElimina: () => Promise<void>;
}

export function useCambioFoto(userId: string | null | undefined): CambioFoto {
  const [stato, invia] = useReducer(prossimoStatoFoto, RIPOSO);
  const lavoro = useRef(false);

  async function carica(foto: Blob) {
    const esito = await cambiaFoto(createClient(), userId!, foto).catch((): EsitoCambioFoto => ({
      esito: "caricamento-fallito",
    }));
    invia({ tipo: "caricata", esito });
  }

  // Un lavoro alla volta; il ref si libera anche se qualcosa lancia.
  async function inEsclusiva(azione: () => Promise<void>) {
    if (lavoro.current || !userId) return;
    lavoro.current = true;
    try {
      await azione();
    } finally {
      lavoro.current = false;
    }
  }

  function usaFoto(area: AreaRitaglio) {
    if (stato.fase !== "ritaglio") return Promise.resolve();
    const file = stato.file;
    return inEsclusiva(async () => {
      invia({ tipo: "usa-foto" });
      const esito = await preparaFotoProfilo(file, area).catch((): EsitoPreparazioneFoto => ({
        esito: "canvas-non-disponibile",
      }));
      invia({ tipo: "preparata", esito });
      if (esito.esito === "ok") await carica(esito.file);
    });
  }

  function riprova() {
    if (stato.fase !== "caricamento-fallito") return Promise.resolve();
    const foto = stato.foto;
    return inEsclusiva(async () => {
      invia({ tipo: "riprova" });
      await carica(foto);
    });
  }

  function confermaElimina() {
    if (stato.fase !== "conferma-elimina") return Promise.resolve();
    return inEsclusiva(async () => {
      invia({ tipo: "conferma-elimina" });
      const esito = await eliminaFoto(createClient(), userId!).catch((): EsitoEliminaFoto => ({
        esito: "fallito",
      }));
      invia({ tipo: "eliminata", esito });
    });
  }

  return { stato, invia, usaFoto, riprova, confermaElimina };
}
