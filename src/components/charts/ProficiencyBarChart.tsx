"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ProficiencyBarChartProps {
  data: { name: string; score: number }[];
  height?: number;
}

function getBarColor(score: number): string {
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--primary)";
  if (score >= 40) return "var(--warning)";
  return "var(--danger)";
}

export default function ProficiencyBarChart({ data, height = 200 }: ProficiencyBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          angle={-30}
          textAnchor="end"
          interval={0}
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(val) => [`${val}%`, "Proficiency"]} />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getBarColor(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
