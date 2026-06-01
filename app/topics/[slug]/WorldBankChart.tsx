"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

const PALETTE = [
  "#60a5fa", // blue
  "#f87171", // red
  "#34d399", // green
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#f472b6", // pink
  "#22d3ee", // cyan
  "#fb923c", // orange
  "#a3e635", // lime
  "#818cf8", // indigo
];

export function colorForIso3(iso3: string, idx: number): string {
  return PALETTE[idx % PALETTE.length];
}

type Point = { year: number; value: number };
type Series = { iso3: string; name: string; points: Point[] };

export type WorldBankChartProps = {
  series: Series[];
  unit: string;
  indicatorLabel: string;
  yFormatter?: (v: number) => string;
  tooltipFormatter?: (v: number) => string;
};

type TooltipEntry = {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  name?: string;
};

function renderTooltip(
  props: { active?: boolean; payload?: ReadonlyArray<TooltipEntry>; label?: string | number },
  iso3ToName: Map<string, string>,
  tooltipFormatter: (v: number) => string,
): ReactNode {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  const year = typeof label === "number" ? label : Number(label);
  const rows = payload
    .filter(p => typeof p.value === "number")
    .sort((a, b) => (b.value as number) - (a.value as number));
  return (
    <div className="rounded border border-gray-700 bg-gray-950/95 px-3 py-2 text-xs shadow-lg max-w-[300px]">
      <div className="text-gray-200 font-mono mb-1">{year}</div>
      <div className="space-y-0.5">
        {rows.map(p => {
          const iso3 = String(p.dataKey ?? "");
          const name = iso3ToName.get(iso3) ?? iso3;
          return (
            <div key={iso3} className="flex items-baseline gap-3">
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: p.color }}
              />
              <span className="text-gray-300 flex-1 truncate">{name}</span>
              <span className="tabular-nums text-gray-100">
                {tooltipFormatter(p.value as number)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function defaultFormatter(v: number): string {
  if (Math.abs(v) >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return v.toFixed(1);
}

export default function WorldBankChart({
  series,
  unit,
  indicatorLabel,
  yFormatter,
  tooltipFormatter,
}: WorldBankChartProps) {
  if (series.length === 0) {
    return (
      <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-12 text-center text-xs text-gray-500">
        Pick at least one country below to see the comparison chart.
      </div>
    );
  }

  // Build year-keyed flat data so each line aligns by year.
  const allYears = new Set<number>();
  for (const s of series) for (const p of s.points) allYears.add(p.year);
  const years = Array.from(allYears).sort((a, b) => a - b);
  const flat = years.map(year => {
    const row: Record<string, number> = { year };
    for (const s of series) {
      const p = s.points.find(q => q.year === year);
      if (p) row[s.iso3] = p.value;
    }
    return row;
  });

  const iso3ToName = new Map(series.map(s => [s.iso3, s.name]));
  const fmtY = yFormatter ?? defaultFormatter;
  const fmtTip = tooltipFormatter ?? defaultFormatter;

  return (
    <div className="rounded border border-gray-800 bg-gray-900/40 px-2 py-4">
      <div className="px-3 pb-2 text-[11px] text-gray-500">
        <span className="text-gray-300">{indicatorLabel}</span>{" "}
        <span className="text-gray-600">({unit})</span> · {series.length} {series.length === 1 ? "country" : "countries"}
      </div>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={flat} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="year"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke="#6b7280"
            tick={{ fill: "#9ca3af", fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}
            tickLine={{ stroke: "#374151" }}
            axisLine={{ stroke: "#374151" }}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickLine={{ stroke: "#374151" }}
            axisLine={{ stroke: "#374151" }}
            tickFormatter={v => fmtY(v as number)}
            width={60}
          />
          <Tooltip
            cursor={{ stroke: "#374151", strokeWidth: 1 }}
            content={(props) =>
              renderTooltip(
                props as unknown as Parameters<typeof renderTooltip>[0],
                iso3ToName,
                fmtTip,
              )
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#9ca3af", paddingTop: 4 }}
            iconType="circle"
            formatter={(value: string) => iso3ToName.get(value) ?? value}
          />
          {series.map((s, i) => (
            <Line
              key={s.iso3}
              type="monotone"
              dataKey={s.iso3}
              stroke={colorForIso3(s.iso3, i)}
              strokeWidth={2}
              dot={{ r: 2, fill: colorForIso3(s.iso3, i), strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
