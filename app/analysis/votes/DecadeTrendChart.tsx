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
import type { DecadeTrendByBody } from "@/lib/voteAnalysis";

// Stable color per body so the legend / tooltip / line all match.
const BODY_COLORS: Record<string, string> = {
  "US House": "#60a5fa",
  "US Senate": "#818cf8",
  UK: "#f87171",
  "EU Parliament": "#fbbf24",
  Canada: "#34d399",
  "US Congress": "#a78bfa",
};
const FALLBACK_COLORS = ["#22d3ee", "#fb923c", "#a3e635", "#f472b6", "#94a3b8"];

function colorForBody(body: string, idx: number): string {
  return BODY_COLORS[body] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

type FlatPoint = {
  decade: string;
  decadeStart: number;
  // contested % per body (undefined if no data)
  [body: string]: number | string | undefined;
};

// recharts v3's tooltip content callback receives a runtime shape with
// `payload`/`label`/`active`; the exact exported type (`TooltipContentProps`)
// is generic enough that strong typing fights us more than it helps here.
// Keep the prop bag loose and pull what we need.
type TooltipEntry = {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
};

function renderTooltip(
  props: { active?: boolean; payload?: ReadonlyArray<TooltipEntry>; label?: string | number },
  totalsByDecade: Map<string, Record<string, number>>,
): ReactNode {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  const decade = typeof label === "string" ? label : String(label);
  const totals = totalsByDecade.get(decade) ?? {};
  const rows = payload
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (b.value as number) - (a.value as number));
  return (
    <div className="rounded border border-gray-700 bg-gray-950/95 px-3 py-2 text-xs shadow-lg">
      <div className="text-gray-200 font-mono mb-1">{decade}</div>
      <div className="space-y-0.5">
        {rows.map((p) => {
          const body = String(p.dataKey ?? "");
          const total = totals[body];
          return (
            <div key={body} className="flex items-baseline gap-3">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: p.color }}
              />
              <span className="text-gray-300 flex-1">{body}</span>
              <span className="tabular-nums text-red-300">
                {(p.value as number).toFixed(1)}%
              </span>
              {total !== undefined && (
                <span className="tabular-nums text-gray-500">
                  ({total.toLocaleString()})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DecadeTrendChart({ data }: { data: DecadeTrendByBody }) {
  const flat: FlatPoint[] = data.points.map((p) => {
    const out: FlatPoint = { decade: p.decade, decadeStart: p.decadeStart };
    for (const body of data.bodies) {
      const v = p.contestedPct[body];
      if (v !== undefined) out[body] = v;
    }
    return out;
  });

  const totalsByDecade = new Map<string, Record<string, number>>();
  for (const p of data.points) {
    totalsByDecade.set(p.decade, p.totalVotes);
  }

  if (flat.length === 0 || data.bodies.length === 0) {
    return (
      <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-8 text-center text-xs text-gray-500">
        No per-body decade data available.
      </div>
    );
  }

  return (
    <div className="rounded border border-gray-800 bg-gray-900/40 px-2 py-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={flat} margin={{ top: 8, right: 20, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
          <XAxis
            dataKey="decade"
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
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            width={45}
            label={{
              value: "Contested %",
              angle: -90,
              position: "insideLeft",
              offset: 12,
              style: { fill: "#6b7280", fontSize: 11 },
            }}
          />
          <Tooltip
            cursor={{ stroke: "#374151", strokeWidth: 1 }}
            content={(props) =>
              renderTooltip(
                props as unknown as Parameters<typeof renderTooltip>[0],
                totalsByDecade,
              )
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#9ca3af", paddingTop: 4 }}
            iconType="circle"
          />
          {data.bodies.map((body, i) => (
            <Line
              key={body}
              type="monotone"
              dataKey={body}
              stroke={colorForBody(body, i)}
              strokeWidth={2}
              dot={{ r: 2.5, fill: colorForBody(body, i), strokeWidth: 0 }}
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
