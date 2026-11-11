// Il grafico del peso di Statistiche (PUNTO_DI_PARTENZA.md §3, "Peso"):
// le pesate delle ultime 12 settimane su un asse di date vere che arriva
// fino a oggi, un punto per pesata, scritto solo il valore dell'ultimo (il
// primo si leggeva due volte con il numero della scala, e la differenza in
// alto lo dice già; decisione dell'11/11), la
// linea del peso obiettivo se il periodo in corso ne ha uno. SVG dall'app,
// colori dai token. Quali pesate e da dove parte l'asse lo decide
// graficoPeso (pesoStatistiche.ts): qui si disegna e basta.

import { formattaGiornoMese, giorniFra, piuMesi, primoDelMese } from "@/lib/dataGiorno";
import { testoValorePeso, type Pesata } from "@/lib/pesoStatistiche";

const LARGHEZZA = 358;
const ALTEZZA = 150;
const SINISTRA = 30; // spazio per i numeri della scala
const DESTRA = LARGHEZZA - 34;
const ALTO = 20;
const BASSO = 112;
// Una data scritta sotto l'asse occupa circa questo spazio: le etichette
// dei mesi troppo vicine all'inizio o a "oggi" si saltano.
const DISTANZA_ETICHETTE = 34;

interface Props {
  pesate: Pesata[];
  inizioAsse: string;
  fineAsse: string; // oggi
  pesoObiettivo: number | null;
}

// Quanto spazio occupa "obiettivo 80,5" a 11,5 punti, con un po' di
// margine.
const LARGHEZZA_ETICHETTA = 96;
const STACCO = 6;

// Dove va l'etichetta "obiettivo N" della linea del peso obiettivo: mai
// attraversata dalla linea tratteggiata di "oggi". Di solito a sinistra,
// subito dopo i numeri della scala, perché "oggi" sta in fondo a destra.
// Se "oggi" cade lì (una pesata sola, fatta oggi: il punto sta in mezzo,
// ma a sinistra resta comunque libero) si passa a destra.
export function posizioneEtichettaObiettivoPeso(xOggi: number): { x: number; ancora: "start" | "end" } {
  const sinistra = SINISTRA + STACCO;
  if (xOggi < sinistra - STACCO || xOggi > sinistra + LARGHEZZA_ETICHETTA + STACCO) {
    return { x: sinistra, ancora: "start" };
  }
  return { x: LARGHEZZA, ancora: "end" };
}

// Il passo della scala in kg: tre o quattro righe al massimo.
function passoScala(ampiezza: number): number {
  if (ampiezza <= 4) return 1;
  if (ampiezza <= 10) return 2;
  if (ampiezza <= 25) return 5;
  return 10;
}

export default function GraficoPeso({ pesate, inizioAsse, fineAsse, pesoObiettivo }: Props) {
  const giorniAsse = giorniFra(inizioAsse, fineAsse);
  // Con un solo giorno sull'asse (una pesata, fatta oggi) il punto sta in
  // mezzo invece di schiacciarsi a sinistra.
  const x = (data: string) =>
    giorniAsse === 0
      ? (SINISTRA + DESTRA) / 2
      : SINISTRA + (giorniFra(inizioAsse, data) / giorniAsse) * (DESTRA - SINISTRA);

  // La scala comprende le pesate e il peso obiettivo, anche se è lontano
  // (PUNTO §3: da guardare su iPhone), con mezzo chilo di aria.
  const valori = pesate.map((p) => p.valore);
  if (pesoObiettivo !== null) valori.push(pesoObiettivo);
  const minimo = Math.floor(Math.min(...valori) - 0.5);
  const massimo = Math.ceil(Math.max(...valori) + 0.5);
  const y = (kg: number) => BASSO - ((kg - minimo) / (massimo - minimo)) * (BASSO - ALTO);

  const passo = passoScala(massimo - minimo);
  const righe: number[] = [];
  for (let kg = Math.ceil((minimo + 0.01) / passo) * passo; kg < massimo; kg += passo) righe.push(kg);

  // Una tacca al primo di ogni mese dentro l'asse.
  const mesi: string[] = [];
  for (let m = piuMesi(primoDelMese(inizioAsse), 1); m <= fineAsse; m = piuMesi(m, 1)) mesi.push(m);

  const prima = pesate[0];
  const ultima = pesate[pesate.length - 1];
  const xOggi = x(fineAsse);
  const etichettaObiettivo = posizioneEtichettaObiettivoPeso(xOggi);

  return (
    <svg
      viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
      className="block h-auto w-full overflow-visible tabular-nums"
      role="img"
      aria-label={`Andamento del peso, da ${testoValorePeso(prima.valore)} kg del ${formattaGiornoMese(prima.data)} a ${testoValorePeso(ultima.valore)} kg del ${formattaGiornoMese(ultima.data)}`}
    >
      {righe.map((kg) => (
        <g key={kg}>
          <line x1={SINISTRA} x2={LARGHEZZA} y1={y(kg)} y2={y(kg)} className="stroke-border" strokeWidth={1} />
          <text x={0} y={y(kg)} dy={4} fontSize={11.5} className="fill-muted">
            {kg}
          </text>
        </g>
      ))}

      {mesi.map((m) => {
        const xm = x(m);
        const vicina = xm - SINISTRA < DISTANZA_ETICHETTE || xOggi - xm < DISTANZA_ETICHETTE;
        return (
          <g key={m}>
            <line x1={xm} x2={xm} y1={BASSO} y2={BASSO + 5} className="stroke-border" />
            {!vicina && (
              <text x={xm} y={BASSO + 22} textAnchor="middle" fontSize={11.5} className="fill-muted">
                {formattaGiornoMese(m)}
              </text>
            )}
          </g>
        );
      })}

      {giorniAsse > 0 && (
        <text x={SINISTRA} y={BASSO + 22} fontSize={11.5} className="fill-muted">
          {formattaGiornoMese(inizioAsse)}
        </text>
      )}
      <line
        x1={xOggi}
        x2={xOggi}
        y1={ALTO}
        y2={BASSO}
        className="stroke-neutral"
        strokeDasharray="3 4"
        data-segno="linea-oggi"
      />
      <text
        x={xOggi}
        y={BASSO + 22}
        textAnchor={giorniAsse === 0 ? "middle" : "end"}
        fontSize={11.5}
        fontWeight={600}
        className="fill-foreground"
      >
        oggi
      </text>

      {pesoObiettivo !== null && (
        <g>
          <line
            x1={SINISTRA}
            x2={LARGHEZZA}
            y1={y(pesoObiettivo)}
            y2={y(pesoObiettivo)}
            className="stroke-tick"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text
            x={etichettaObiettivo.x}
            y={y(pesoObiettivo)}
            dy={-6}
            textAnchor={etichettaObiettivo.ancora}
            fontSize={11.5}
            className="fill-muted"
            data-segno="etichetta-obiettivo-peso"
          >
            obiettivo {testoValorePeso(pesoObiettivo)}
          </text>
        </g>
      )}

      {pesate.length > 1 && (
        <polyline
          fill="none"
          className="stroke-foreground"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pesate.map((p) => `${x(p.data)},${y(p.valore)}`).join(" ")}
        />
      )}
      {pesate.map((p, i) => {
        const eUltima = i === pesate.length - 1;
        return (
          <circle
            key={p.data}
            cx={x(p.data)}
            cy={y(p.valore)}
            r={eUltima ? 5 : 3.2}
            strokeWidth={2}
            className={eUltima ? "fill-foreground stroke-foreground" : "fill-background stroke-foreground"}
          />
        );
      })}

      <text
        x={x(ultima.data)}
        y={y(ultima.valore)}
        dy={-12}
        textAnchor="middle"
        fontSize={12.5}
        fontWeight={600}
        className="fill-foreground"
      >
        {testoValorePeso(ultima.valore)}
      </text>
    </svg>
  );
}
