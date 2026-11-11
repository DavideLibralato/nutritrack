// Il grafico "Calorie giornaliere" di Statistiche (PUNTO_DI_PARTENZA.md §3):
// una barra per giorno, disegnata in SVG dall'app come l'anello di Oggi,
// con i colori dai token (classi fill-* e stroke-*, nessun colore scritto
// qui).
//
// - Il colore della barra: la regola unica (esitoRispettoObiettivo), con il
//   tipo di obiettivo di QUEL giorno.
// - Il segno dell'obiettivo lo decidono i dati (segnoObiettivo): linea
//   tratteggiata con "obiettivo N" se il target è uguale per tutti i giorni
//   fino a oggi, se no un trattino sopra ogni barra.
// - Giorno passato senza voci: un trattino grigio basso. Giorno futuro:
//   solo l'etichetta sbiadita.
// - Tocco su una barra (o Invio / Spazio con la tastiera): la colonna si
//   evidenzia e il valore compare sopra; un secondo tocco chiude. Lo stato
//   lo tiene la pagina, che mostra il dettaglio sotto.
//
// Concetto: un SVG con viewBox si allarga come un'immagine. Le coordinate
// qui sotto sono in un riquadro fisso di 358 × 192 "punti", e il browser
// lo scala alla larghezza dello schermo (width 100%, height auto).

import type { KeyboardEvent } from "react";
import { esitoRispettoObiettivo, type Tono } from "@/lib/esitoObiettivo";
import { formattaDataEstesa } from "@/lib/dataGiorno";
import { etichettaBarra, type ModoPeriodo } from "@/lib/periodiStatistiche";
import type { GiornoStatistiche, SegnoObiettivo } from "@/lib/medieStatistiche";

const LARGHEZZA = 358;
const ALTEZZA = 192;
const ALTO = 22; // spazio sopra la barra più alta, per il valore toccato
const BASE = 160; // la linea di base; sotto, le etichette dei giorni
const MASSIMO_MINIMO = 3200; // la scala non scende sotto, così le barre basse restano basse
// Quanto spazio occupa "obiettivo 2200" a 11,5 punti, con un po' di
// margine (anche per un obiettivo a 5 cifre).
const LARGHEZZA_ETICHETTA = 96;
const STACCO_ETICHETTA = 6;

// Dove finisce la linea dell'obiettivo e dove va la sua etichetta.
// La linea finisce al bordo destro dell'ultima colonna non futura: sopra i
// giorni futuri l'obiettivo non lo sappiamo ancora. L'etichetta resta
// sempre intera e dentro il grafico:
//   - se a destra della linea c'è posto (i giorni futuri, senza barre), va
//     lì, alla sua altezza: non copre nessuna barra;
//   - se no (periodo passato, o oggi è fra gli ultimi giorni), sopra la
//     linea, allineata alla sua fine, come nel mockup.
// Una delle due c'è sempre: l'etichetta è più corta di metà grafico.
export function posizioneLineaObiettivo(
  giorniNonFuturi: number,
  giorniTotali: number
): { fine: number; etichetta: { x: number; ancora: "start" | "end"; sopra: boolean } } {
  const fine = (giorniNonFuturi / giorniTotali) * LARGHEZZA;
  if (LARGHEZZA - fine >= LARGHEZZA_ETICHETTA + STACCO_ETICHETTA) {
    return { fine, etichetta: { x: fine + STACCO_ETICHETTA, ancora: "start", sopra: false } };
  }
  return { fine, etichetta: { x: fine, ancora: "end", sopra: true } };
}

const FILL_TONO: Record<Tono, string> = {
  buono: "fill-accent",
  oltre: "fill-warning",
  neutro: "fill-neutral",
};

interface Props {
  giorni: GiornoStatistiche[];
  modo: ModoPeriodo;
  oggi: string;
  segno: SegnoObiettivo;
  selezionato: string | null;
  onTocca: (data: string) => void;
}

function maiuscola(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

export default function GraficoCalorie({ giorni, modo, oggi, segno, selezionato, onTocca }: Props) {
  const settimana = modo === "settimana";

  // La scala: la barra o l'obiettivo più alto, con un 6% di aria,
  // arrotondato alle centinaia.
  let massimo = MASSIMO_MINIMO;
  for (const g of giorni) {
    if (g.futuro) continue;
    const alto = Math.max(g.totali?.kcal ?? 0, g.target?.kcal ?? 0);
    if (alto * 1.06 > massimo) massimo = Math.ceil((alto * 1.06) / 100) * 100;
  }
  const y = (kcal: number) => BASE - (kcal / massimo) * (BASE - ALTO);

  const colonna = LARGHEZZA / giorni.length;
  // I giorni futuri stanno sempre in fondo al periodo: quelli non futuri
  // sono le prime colonne. Senza nessuno (periodo tutto futuro, che le
  // frecce non permettono) niente linea.
  const nonFuturi = giorni.filter((g) => !g.futuro).length;
  const linea = nonFuturi > 0 ? posizioneLineaObiettivo(nonFuturi, giorni.length) : null;
  const larghezzaBarra = settimana ? 30 : Math.max(4, colonna - 4.5);
  const raggio = settimana ? 6 : 2.5;

  function tasto(e: KeyboardEvent, data: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTocca(data);
    }
  }

  return (
    <svg
      viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
      className="block h-auto w-full overflow-visible tabular-nums"
      role="group"
      aria-label="Calorie giornaliere"
    >
      <line x1={0} x2={LARGHEZZA} y1={BASE} y2={BASE} className="stroke-border" strokeWidth={1} />

      {segno.tipo === "linea" && linea && (
        <g aria-hidden>
          <line
            x1={0}
            x2={linea.fine}
            y1={y(segno.kcal)}
            y2={y(segno.kcal)}
            className="stroke-tick"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            data-segno="linea-obiettivo"
          />
          <text
            x={linea.etichetta.x}
            y={y(segno.kcal)}
            dy={linea.etichetta.sopra ? -6 : 4}
            textAnchor={linea.etichetta.ancora}
            fontSize={11.5}
            className="fill-muted"
            data-segno="etichetta-obiettivo"
          >
            obiettivo {segno.kcal}
          </text>
        </g>
      )}

      {giorni.map((g, i) => {
        const cx = i * colonna + colonna / 2;
        const scelto = selezionato === g.data;
        const conBarra = !g.futuro && g.totali !== null;
        const kcal = g.totali ? Math.round(g.totali.kcal) : 0;
        const obiettivo = g.target?.kcal ?? null;
        const esito = conBarra
          ? esitoRispettoObiettivo(kcal, obiettivo, "kcal", g.tipoObiettivo)
          : null;
        const etichetta = etichettaBarra(modo, g.data, oggi);
        const eOggi = g.data === oggi;

        const disegno = (
          <>
            {scelto && (
              <rect
                x={i * colonna + 1}
                y={4}
                width={colonna - 2}
                height={ALTEZZA - 4}
                rx={settimana ? 10 : 4}
                className="fill-highlight"
              />
            )}
            {conBarra && (
              <rect
                x={cx - larghezzaBarra / 2}
                y={y(kcal)}
                width={larghezzaBarra}
                height={BASE - y(kcal)}
                rx={Math.min(raggio, (BASE - y(kcal)) / 2)}
                className={`${FILL_TONO[esito?.tono ?? "neutro"]} transition-[fill] duration-150 motion-reduce:transition-none`}
              />
            )}
            {conBarra && segno.tipo === "trattini" && obiettivo !== null && (
              <line
                x1={cx - larghezzaBarra / 2 - (settimana ? 6 : 2)}
                x2={cx + larghezzaBarra / 2 + (settimana ? 6 : 2)}
                y1={y(obiettivo)}
                y2={y(obiettivo)}
                className="stroke-tick"
                strokeWidth={settimana ? 2.5 : 2}
                strokeLinecap="round"
              />
            )}
            {!g.futuro && g.totali === null && (
              <rect
                x={cx - larghezzaBarra / 2}
                y={BASE - 7}
                width={larghezzaBarra}
                height={7}
                rx={Math.min(raggio, 3)}
                className="fill-border"
              />
            )}
            {conBarra && scelto && (
              <text
                x={cx}
                y={Math.min(y(kcal), obiettivo !== null ? y(obiettivo) : y(kcal))}
                dy={-8}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                className="fill-foreground"
              >
                {kcal}
              </text>
            )}
            {etichetta && (
              <text
                x={cx}
                y={BASE + 20}
                textAnchor="middle"
                fontSize={settimana ? 13 : 11.5}
                fontWeight={eOggi ? 600 : 400}
                opacity={g.futuro ? 0.5 : 1}
                className={eOggi ? "fill-foreground" : "fill-muted"}
              >
                {etichetta}
              </text>
            )}
            {eOggi && <circle cx={cx} cy={BASE + 28} r={2} className="fill-accent" />}
          </>
        );

        if (!conBarra) return <g key={g.data} aria-hidden>{disegno}</g>;

        // Solo i giorni con una barra si toccano. Il bersaglio è tutta la
        // colonna, non solo la barra: una barra bassa o sottile (nel mese)
        // sarebbe troppo piccola per un dito.
        return (
          <g
            key={g.data}
            role="button"
            tabIndex={0}
            aria-pressed={scelto}
            aria-label={`${maiuscola(formattaDataEstesa(g.data))}, ${kcal} kcal`}
            onClick={() => onTocca(g.data)}
            onKeyDown={(e) => tasto(e, g.data)}
            className="colonna-grafico cursor-pointer"
          >
            {disegno}
            <rect
              x={i * colonna}
              y={0}
              width={colonna}
              height={ALTEZZA}
              fill="transparent"
              className="bersaglio-grafico"
            />
          </g>
        );
      })}
    </svg>
  );
}
