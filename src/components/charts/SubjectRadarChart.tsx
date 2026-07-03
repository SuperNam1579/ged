"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface SubjectData {
  subject: string;
  score: number;
  target: number;
}

interface SubjectRadarChartProps {
  data: SubjectData[];
}

export default function SubjectRadarChart({ data }: SubjectRadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <Tooltip formatter={(val) => [`${val}%`]} />
        <Radar
          name="Current"
          dataKey="score"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Radar
          name="Target"
          dataKey="target"
          stroke="var(--success)"
          fill="var(--success)"
          fillOpacity={0.1}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
