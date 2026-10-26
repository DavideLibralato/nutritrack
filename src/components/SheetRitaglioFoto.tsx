"use client";

// Il foglio "La tua foto" (mockup docs/mockups/foto-profilo.html, proposta
// B, "Foglio dal basso", scelta da Davide il 25/10): l'area del ritaglio
// con il cerchio fisso, il cursore di ingrandimento con − e +, "Usa foto"
// pieno e "Annulla" sotto.
//
// Il ritaglio è react-easy-crop (MIT): si sposta la foto con un dito e la
// si ingrandisce con due, oppure con il cursore. Su Safari il pizzico
// ingrandisce la foto e non la pagina: la libreria blocca il gesturestart
// sul contenitore e i touchmove (listener non passivo), e il nostro CSS
// mette `touch-action: none` sul contenitore (.ritaglio-contenitore in
// globals.css: il CSS della libreria è spento perché ha colori scritti a
// mano). Niente rotazione: senza onRotationChange la libreria non ruota.
//
// La libreria dà, a ogni movimento finito, il quadrato scelto in pixel
// della foto (croppedAreaPixels): "Usa foto" lo passa a chi apre il foglio,
// che lo dà a preparaFotoProfilo. Spento finché la foto non è caricata e
// mentre la foto si prepara.

import { useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { CLASSE_FOCUS } from "@/lib/classeFocus";
import { useIndirizzoBlob } from "@/lib/foto/useFotoProfilo";
import { ETICHETTA_INGRANDIMENTO, ETICHETTA_USA_FOTO, TITOLO_RITAGLIO } from "@/lib/foto/testiFoto";
import type { AreaRitaglio } from "@/lib/foto/ritaglioFoto";
import FoglioDalBasso from "./FoglioDalBasso";

// Da 1 (la foto copre appena il cerchio) a 4 volte, come nel mockup.
const ZOOM_MINIMO = 1;
const ZOOM_MASSIMO = 4;
const PASSO_PULSANTI = 0.25;
// Il cerchio occupa l'84% del lato corto dell'area, come nel mockup:
// intorno si vede un po' di foto velata.
const QUOTA_CERCHIO = 0.84;

export default function SheetRitaglioFoto({
  file,
  inCorso,
  onUsa,
  onAnnulla,
}: {
  file: Blob;
  inCorso: boolean;
  onUsa: (area: AreaRitaglio) => void;
  onAnnulla: () => void;
}) {
  const indirizzo = useIndirizzoBlob(file);
  const [posizione, setPosizione] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(ZOOM_MINIMO);
  const [area, setArea] = useState<Area | null>(null);
  const [latoCerchio, setLatoCerchio] = useState<number | null>(null);
  const contenitore = useRef<HTMLDivElement>(null);

  // La misura del cerchio segue quella dell'area (rotazione del telefono,
  // tastiera). ResizeObserver chiama subito una prima volta.
  useEffect(() => {
    const elemento = contenitore.current;
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const osservatore = new ResizeObserver(() => {
      const lato = Math.min(elemento.clientWidth, elemento.clientHeight);
      setLatoCerchio(Math.round(lato * QUOTA_CERCHIO));
    });
    osservatore.observe(elemento);
    return () => osservatore.disconnect();
  }, []);

  function cambiaZoom(valore: number) {
    setZoom(Math.min(ZOOM_MASSIMO, Math.max(ZOOM_MINIMO, valore)));
  }

  return (
    <FoglioDalBasso titolo={TITOLO_RITAGLIO} bloccato={inCorso} onChiudi={onAnnulla}>
      <div
        ref={contenitore}
        className="relative h-[300px] overflow-hidden rounded-[14px] bg-border"
      >
        {indirizzo && latoCerchio && (
          <Cropper
            image={indirizzo}
            crop={posizione}
            zoom={zoom}
            minZoom={ZOOM_MINIMO}
            maxZoom={ZOOM_MASSIMO}
            aspect={1}
            cropShape="round"
            cropSize={{ width: latoCerchio, height: latoCerchio }}
            showGrid={false}
            objectFit="cover"
            disableAutomaticStylesInjection
            classes={{
              containerClassName: "ritaglio-contenitore",
              mediaClassName: "ritaglio-foto",
              cropAreaClassName: "ritaglio-cerchio",
            }}
            mediaProps={{ alt: "" }}
            cropperProps={{ "aria-label": "Sposta la foto nel cerchio" }}
            onCropChange={setPosizione}
            onZoomChange={cambiaZoom}
            onCropComplete={(_, pixel) => setArea(pixel)}
          />
        )}
      </div>

      <div className="flex items-center gap-1 text-muted">
        <button
          type="button"
          aria-label="Riduci"
          disabled={inCorso || zoom <= ZOOM_MINIMO}
          onClick={() => cambiaZoom(zoom - PASSO_PULSANTI)}
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-xl disabled:opacity-40 ${CLASSE_FOCUS}`}
        >
          −
        </button>
        <input
          type="range"
          aria-label={ETICHETTA_INGRANDIMENTO}
          min={ZOOM_MINIMO}
          max={ZOOM_MASSIMO}
          step={0.01}
          value={zoom}
          disabled={inCorso}
          onChange={(e) => cambiaZoom(Number(e.target.value))}
          className={`min-w-0 flex-1 accent-[var(--accento)] ${CLASSE_FOCUS}`}
        />
        <button
          type="button"
          aria-label="Ingrandisci"
          disabled={inCorso || zoom >= ZOOM_MASSIMO}
          onClick={() => cambiaZoom(zoom + PASSO_PULSANTI)}
          className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-xl disabled:opacity-40 ${CLASSE_FOCUS}`}
        >
          +
        </button>
      </div>

      <button
        type="button"
        autoFocus
        disabled={inCorso || !area}
        onClick={() => area && onUsa(area)}
        className={`min-h-[46px] w-full rounded-[10px] bg-accent-strong font-semibold text-on-strong disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        {inCorso ? "Attendi…" : ETICHETTA_USA_FOTO}
      </button>
      <button
        type="button"
        onClick={onAnnulla}
        disabled={inCorso}
        className={`self-center rounded-lg px-3 py-1 disabled:opacity-50 ${CLASSE_FOCUS}`}
      >
        Annulla
      </button>
    </FoglioDalBasso>
  );
}
