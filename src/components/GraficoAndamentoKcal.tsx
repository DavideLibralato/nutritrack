"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

type Punto = {
  etichetta: string;
  kcal: number;
};

// Stessa palette "minimal caratteristico" usata nel resto dell'app:
// inchiostro caldo per il tratto principale, tinte tenui per griglia/assi.
const INCHIOSTRO = "#1F1B16";
const LINEA = "#E7E0D2";
const TENUE = "#8A8271";
const FONT_TESTO = "var(--font-body), system-ui, sans-serif";

export default function GraficoAndamentoKcal({
  dati,
  obiettivoKcal,
}: {
  dati: Punto[];
  obiettivoKcal: number;
}) {
  return (
    <div className="border border-border rounded-xl p-3 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dati} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorKcal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={INCHIOSTRO} stopOpacity={0.22} />
              <stop offset="95%" stopColor={INCHIOSTRO} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={LINEA} />
          <XAxis dataKey="etichetta" tick={{ fontSize: 12, fontFamily: FONT_TESTO, fill: TENUE }} />
          <YAxis tick={{ fontSize: 12, fontFamily: FONT_TESTO, fill: TENUE }} width={40} />
          <Tooltip
            contentStyle={{ fontFamily: FONT_TESTO, borderRadius: 10, borderColor: LINEA }}
            formatter={(value: number) => [`${Math.round(value)} kcal`, "Kcal"]}
          />
          <ReferenceLine
            y={obiettivoKcal}
            stroke={TENUE}
            strokeDasharray="4 4"
            label={{
              value: "Obiettivo",
              position: "insideTopRight",
              fontSize: 11,
              fontFamily: FONT_TESTO,
              fill: TENUE,
            }}
          />
          <Area
            type="monotone"
            dataKey="kcal"
            stroke={INCHIOSTRO}
            strokeWidth={2}
            fill="url(#colorKcal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
