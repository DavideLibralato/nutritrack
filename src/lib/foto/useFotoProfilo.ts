"use client";

// Le foto da mostrare (PUNTO_DI_PARTENZA.md §3, "La foto profilo"): la
// propria, dalla copia sul telefono, e quelle degli amici, con gli
// indirizzi firmati. null / assente = iniziali.

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { createClient } from "../supabase/client";
import {
  blobDaFotoLocale,
  indirizziFotoAmici,
  leggiFotoLocale,
  type FotoLocale,
} from "./fotoProfilo";

// La propria foto, dalla copia in foto_locale: un indirizzo locale
// (URL.createObjectURL, "blob:…") da mettere in un <img>. Funziona anche
// offline. null = nessuna copia (o non ancora letta).
//
// Un indirizzo locale tiene il file in memoria finché non si revoca: qui
// se ne crea UNO per ogni copia (utente + percorso), e si revoca quando la
// copia cambia (foto nuova, foto tolta, un altro utente) e quando il
// componente sparisce. Un'immagine già mostrata resta a schermo anche dopo
// la revoca.
//
// L'effetto dipende dalla chiave (utente + percorso), non dall'oggetto che
// restituisce useLiveQuery: quello è nuovo a ogni rilettura anche se la
// copia è la stessa, e ogni volta nascerebbe un indirizzo nuovo, con
// l'immagine che si ricarica. Per questo i byte si rileggono dentro
// l'effetto.
export function useMiaFoto(userId: string | null | undefined): string | null {
  const chiave = useLiveQuery(async () => {
    if (!userId) return null;
    const foto = await leggiFotoLocale(userId);
    return foto ? chiaveDi(foto) : null;
  }, [userId]);
  const [indirizzo, setIndirizzo] = useState<{ chiave: string; url: string } | null>(null);

  useEffect(() => {
    if (!chiave || !userId) return;
    let valido = true;
    let url: string | null = null;
    void leggiFotoLocale(userId).then((foto) => {
      // Cambiata di nuovo nel frattempo: ci pensa l'effetto della chiave nuova.
      if (!valido || !foto || chiaveDi(foto) !== chiave) return;
      url = URL.createObjectURL(blobDaFotoLocale(foto));
      setIndirizzo({ chiave, url });
    });
    return () => {
      valido = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [chiave, userId]);

  // Solo l'indirizzo della copia di adesso: tolta la copia, o cambiato
  // utente, si torna subito alle iniziali.
  if (!chiave || indirizzo?.chiave !== chiave) return null;
  return indirizzo.url;
}

function chiaveDi(foto: FotoLocale): string {
  return `${foto.user_id}:${foto.percorso}`;
}

// Gli indirizzi firmati delle foto degli amici accettati: { id → indirizzo }.
// Una sola chiamata (indirizziFotoAmici) quando cambia l'elenco degli amici;
// ripetuta al ritorno in primo piano e della rete solo se gli indirizzi
// sono vecchi (validi un'ora) o se l'ultima volta non ne è arrivato
// nessuno. Mentre arrivano, o se la chiamata fallisce: {}, cioè iniziali.
const RINNOVO_MS = 50 * 60 * 1000;

export function useFotoAmici(amici: string[]): Record<string, string> {
  const chiave = [...new Set(amici)].sort().join(",");
  const [stato, setStato] = useState<{
    chiave: string;
    indirizzi: Record<string, string>;
    il: number;
  } | null>(null);

  useEffect(() => {
    if (chiave === "") return;
    const ids = chiave.split(",");
    let valida = true;
    let ultimo: { indirizzi: Record<string, string>; il: number } | null = null;

    function leggi() {
      void indirizziFotoAmici(createClient(), ids).then((indirizzi) => {
        if (!valida) return;
        ultimo = { indirizzi, il: Date.now() };
        setStato({ chiave, ...ultimo });
      });
    }
    function forseRinnova() {
      if (document.visibilityState !== "visible") return;
      if (
        !ultimo ||
        Object.keys(ultimo.indirizzi).length === 0 ||
        Date.now() - ultimo.il > RINNOVO_MS
      ) {
        leggi();
      }
    }

    leggi();
    document.addEventListener("visibilitychange", forseRinnova);
    window.addEventListener("online", forseRinnova);
    return () => {
      valida = false;
      document.removeEventListener("visibilitychange", forseRinnova);
      window.removeEventListener("online", forseRinnova);
    };
  }, [chiave]);

  return stato?.chiave === chiave ? stato.indirizzi : {};
}
