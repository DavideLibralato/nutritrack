"use client";

// Posizione e altezza della parte VISIBILE della finestra. Su mobile —
// iOS Safari in particolare — quando si apre la tastiera `100dvh` NON si
// accorcia: la tastiera copre il contenuto senza ridurre il layout, così un
// elemento ancorato in fondo (con `position: fixed`) finisce dietro la
// tastiera, invece di restarci sopra. `visualViewport` riporta l'area
// davvero visibile: `.height` è quanto resta sopra la tastiera, `.offsetTop`
// di quanto iOS ha fatto scorrere il contenuto per tenere a fuoco il campo.
// Un elemento `position: fixed` con questi due valori come `top`/`height`
// resta sempre sopra la tastiera, indipendentemente da quanto Safari ha
// scrollato la pagina. Fallback a tutta la finestra dove l'API non c'è
// (render sul server, browser vecchi).
//
// Condiviso da /aggiungi (il <main> a tutto schermo) e dai due sheet
// (SheetQuantita, SheetNome): stesso problema, stessa correzione.
import { useEffect, useState } from "react";

export interface AreaVisibile {
  top: number;
  height: string;
}

export function useAreaVisibile(): AreaVisibile {
  const [area, setArea] = useState<AreaVisibile>({ top: 0, height: "100dvh" });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const aggiorna = () =>
      setArea({
        top: Math.round(vv.offsetTop),
        height: `${Math.round(vv.height)}px`,
      });
    aggiorna();
    vv.addEventListener("resize", aggiorna);
    vv.addEventListener("scroll", aggiorna);
    window.addEventListener("orientationchange", aggiorna);
    return () => {
      vv.removeEventListener("resize", aggiorna);
      vv.removeEventListener("scroll", aggiorna);
      window.removeEventListener("orientationchange", aggiorna);
    };
  }, []);

  return area;
}
