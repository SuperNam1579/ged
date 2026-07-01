"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface GenerationLog {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  worstFitness: number;
}

interface FitnessConvergenceChartProps {
  data: GenerationLog[];
}

export default function FitnessConvergenceChart({ data }: FitnessConvergenceChartProps) {
  const formatted = data.map((d) => ({
    gen: d.generation,
    Best: Math.round(d.bestFitness * 100),
    Average: Math.round(d.avgFitness * 100),
    Worst: Math.round(d.worstFitness * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--muted)" />
        <XAxis dataKey="gen" tick={{ fontSize: 12 }} label={{ value: "Generation", position: "insideBottom", offset: -2 }} />
        <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} unit="%" />
        <Tooltip
          formatter={(val) => [`${val}%`]}
          labelFormatter={(gen) => `Generation ${gen}`}
        />
        <Legend />
        <Line type="monotone" dataKey="Best" stroke="var(--primary)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Average" stroke="var(--success)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="Worst" stroke="var(--warning)" strokeWidth={1} dot={false} strokeDasharray="2 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}
