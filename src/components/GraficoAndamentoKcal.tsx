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

export default function GraficoAndamentoKcal({
  dati,
  obiettivoKcal,
}: {
  dati: Punto[];
  obiettivoKcal: number;
}) {
  return (
    <div className="border rounded p-3 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dati} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorKcal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#000000" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#000000" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="etichetta" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={40} />
          <Tooltip
            formatter={(value: number) => [`${Math.round(value)} kcal`, "Kcal"]}
          />
          <ReferenceLine
            y={obiettivoKcal}
            stroke="#9ca3af"
            strokeDasharray="4 4"
            label={{
              value: "Obiettivo",
              position: "insideTopRight",
              fontSize: 11,
              fill: "#9ca3af",
            }}
          />
          <Area
            type="monotone"
            dataKey="kcal"
            stroke="#000000"
            strokeWidth={2}
            fill="url(#colorKcal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
