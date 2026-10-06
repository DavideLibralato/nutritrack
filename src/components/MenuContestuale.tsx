"use client";

// Menu contestuale di Oggi (PUNTO_DI_PARTENZA.md, sezione 3, "Tieni
// premuto: sposta, duplica, elimina"): si apre ancorato alla riga di un
// alimento o di un pasto quando il tieni-premuto non diventa un
// trascinamento, o con tasto destro / tastiera (`contextmenu`).
//
// Posizione: sotto la riga se ci sta, altrimenti sopra; mai sotto
// "+ Aggiungi" e la pillola (`limiteBasso`), mai fuori schermo. Il calcolo è
// in posizioneMenu.ts. Il menu si disegna una prima volta invisibile per
// misurarne l'altezza, poi va al suo posto: concetto React, useLayoutEffect
// gira dopo che il DOM è pronto ma PRIMA che il browser lo dipinga, quindi
// la posizione provvisoria non si vede mai.
//
// Chiusura: un tocco in un punto qualsiasi fuori dal menu (uno sfondo
// trasparente su tutto lo schermo, che non lascia passare il tocco a quello
// che c'è sotto) o Esc, senza eseguire niente. Tab lo chiude, come i menu
// di sistema.
//
// Il dito che ha aperto il menu: col ramo "fermo per tutta la finestra" il
// menu compare mentre il dito è ancora giù, e quando si alza il browser
// manda un click proprio lì — che potrebbe cadere sullo sfondo (chiudendo
// il menu appena aperto) o su una voce (eseguendola senza volerlo). Per
// questo sfondo e voci rispondono solo a un tocco COMINCIATO dopo
// l'apertura (`rifToccoNuovo`, acceso da un pointerdown qui dentro). Il
// click da tastiera (Invio/Spazio: `detail === 0`) vale sempre.
//
// Fuoco: alla prima voce all'apertura, frecce su/giù fra le voci; alla
// chiusura torna alla riga da cui è partito (`elementoOrigine`), se c'è
// ancora. Su un tocco, con :focus-visible, l'anello non si vede.

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from "react";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { posizioneMenu, type PosizioneMenu } from "@/lib/posizioneMenu";

export interface VoceMenu {
  etichetta: string;
  // Cancella qualcosa: colore d'avviso invece del testo normale.
  distruttiva?: boolean;
  onSeleziona: () => void;
}

interface Props {
  // Letto dallo screen reader ("Azioni per Mela").
  etichetta: string;
  // Il rettangolo della riga sullo schermo, preso all'apertura.
  ancora: DOMRect;
  // y (px) da cui cominciano "+ Aggiungi" e la pillola.
  limiteBasso: number;
  voci: VoceMenu[];
  elementoOrigine?: HTMLElement | null;
  onChiudi: () => void;
}

export default function MenuContestuale({
  etichetta,
  ancora,
  limiteBasso,
  voci,
  elementoOrigine,
  onChiudi,
}: Props) {
  const rifMenu = useRef<HTMLDivElement>(null);
  const rifToccoNuovo = useRef(false);
  const [posizione, setPosizione] = useState<PosizioneMenu | null>(null);

  useLayoutEffect(() => {
    const menu = rifMenu.current;
    if (!menu) return;
    setPosizione(
      posizioneMenu({
        riga: ancora,
        larghezzaMenu: menu.offsetWidth,
        altezzaMenu: menu.offsetHeight,
        larghezzaSchermo: window.innerWidth,
        limiteBasso,
      })
    );
  }, [ancora, limiteBasso]);

  // Fuoco alla prima voce quando il menu è al suo posto; alla chiusura,
  // di nuovo alla riga.
  useEffect(() => {
    if (!posizione) return;
    rifMenu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus({ preventScroll: true });
  }, [posizione]);
  useEffect(() => {
    return () => {
      if (elementoOrigine?.isConnected) elementoOrigine.focus({ preventScroll: true });
    };
  }, [elementoOrigine]);

  // onChiudi in un ref: l'ascoltatore di Esc si attacca una volta sola.
  const rifOnChiudi = useRef(onChiudi);
  useEffect(() => {
    rifOnChiudi.current = onChiudi;
  }, [onChiudi]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Tab") {
        e.preventDefault();
        rifOnChiudi.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toccoValido(e: MouseEvent) {
    return e.detail === 0 || rifToccoNuovo.current;
  }

  function frecce(e: ReactKeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const elementi = [...(rifMenu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const i = elementi.indexOf(document.activeElement as HTMLElement);
    const passo = e.key === "ArrowDown" ? 1 : -1;
    elementi[(i + passo + elementi.length) % elementi.length]?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-50"
      onPointerDownCapture={() => {
        rifToccoNuovo.current = true;
      }}
      onClick={(e) => {
        if (toccoValido(e)) onChiudi();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={rifMenu}
        role="menu"
        aria-label={etichetta}
        onKeyDown={frecce}
        onClick={(e) => e.stopPropagation()}
        style={{
          top: posizione?.top ?? 0,
          left: posizione?.left ?? 0,
          visibility: posizione ? "visible" : "hidden",
          boxShadow: "var(--ombra-fluttuante)",
        }}
        className="fixed min-w-48 overflow-hidden rounded-xl border border-border bg-surface py-1"
      >
        {voci.map((voce) => (
          <button
            key={voce.etichetta}
            type="button"
            role="menuitem"
            onClick={(e) => {
              if (!toccoValido(e)) return;
              onChiudi();
              voce.onSeleziona();
            }}
            className={`flex min-h-11 w-full items-center px-4 text-left ${voce.distruttiva ? "text-warning" : ""} ${CLASSE_FOCUS}`}
          >
            {voce.etichetta}
          </button>
        ))}
      </div>
    </div>
  );
}
