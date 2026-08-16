"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Punto = {
  etichetta: string;
  proteine: number;
  carboidrati: number;
  grassi: number;
};

const COLORI = {
  proteine: "#2563eb",
  carboidrati: "#16a34a",
  grassi: "#ea580c",
};

export default function GraficoMacro({ dati }: { dati: Punto[] }) {
  return (
    <div className="border rounded p-3 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dati} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="etichetta" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={40} unit="g" />
          <Tooltip formatter={(value: number) => `${Math.round(value)}g`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="proteine" name="Proteine" stackId="macro" fill={COLORI.proteine} />
          <Bar dataKey="carboidrati" name="Carboidrati" stackId="macro" fill={COLORI.carboidrati} />
          <Bar
            dataKey="grassi"
            name="Grassi"
            stackId="macro"
            fill={COLORI.grassi}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
