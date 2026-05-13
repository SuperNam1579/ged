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
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
        <Tooltip formatter={(val) => [`${val}%`]} />
        <Radar
          name="Current"
          dataKey="score"
          stroke="#2563eb"
          fill="#2563eb"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Radar
          name="Target"
          dataKey="target"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.1}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
