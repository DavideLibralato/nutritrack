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

// Terna calda ispirata al cibo invece del blu/verde/arancio generico:
// verde bosco, senape, terracotta (quest'ultima la stessa usata per
// segnalare quando si sfora un obiettivo, coerente in tutta l'app).
const COLORI = {
  proteine: "#4A7856",
  carboidrati: "#C99A3B",
  grassi: "#B5533C",
};

const LINEA = "#E7E0D2";
const TENUE = "#8A8271";
const FONT_TESTO = "var(--font-body), system-ui, sans-serif";

export default function GraficoMacro({ dati }: { dati: Punto[] }) {
  return (
    <div className="border border-border rounded-xl p-3 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dati} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={LINEA} />
          <XAxis dataKey="etichetta" tick={{ fontSize: 12, fontFamily: FONT_TESTO, fill: TENUE }} />
          <YAxis tick={{ fontSize: 12, fontFamily: FONT_TESTO, fill: TENUE }} width={40} unit="g" />
          <Tooltip
            contentStyle={{ fontFamily: FONT_TESTO, borderRadius: 10, borderColor: LINEA }}
            formatter={(value: number) => `${Math.round(value)}g`}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontFamily: FONT_TESTO }} />
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
