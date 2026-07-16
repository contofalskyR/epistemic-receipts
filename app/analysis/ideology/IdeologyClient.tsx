"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type IdeologyPoint = {
  dim1: number;
  dim2: number;
  party: string;
  name: string;
  state: string | null;
};

// Voteview stores party as numeric codes; map to abbreviations for coloring/bucketing
const PARTY_CODE_TO_ABBR: Record<string, string> = {
  "100": "D",
  "200": "R",
  "328": "I",
  "329": "I",
  "522": "I",
};
function resolveParty(p: string): string {
  return PARTY_CODE_TO_ABBR[p] ?? (p.length <= 2 ? p.toUpperCase() : "I");
}

const PARTY_COLORS: Record<string, string> = {
  D: "#60a5fa",
  R: "#f87171",
  I: "#a78bfa",
};
function partyColor(p: string): string {
  return PARTY_COLORS[resolveParty(p)] ?? "#94a3b8";
}

type TooltipEntry = { payload?: IdeologyPoint };

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;
  return (
    <div className="rounded border border-gray-700 bg-gray-950/95 px-3 py-2 text-xs shadow-lg">
      <div className="text-gray-200 font-semibold">{pt.name}</div>
      <div className="text-gray-400 mt-0.5">{pt.state} · {pt.party}</div>
      <div className="mt-1 font-mono text-gray-300">
        Dim 1: {pt.dim1 >= 0 ? "+" : ""}{pt.dim1.toFixed(3)}
      </div>
      <div className="font-mono text-gray-300">
        Dim 2: {pt.dim2 >= 0 ? "+" : ""}{pt.dim2.toFixed(3)}
      </div>
    </div>
  );
}

export function ScatterPlot({
  points,
  congress,
  chamber,
  totalMembers,
}: {
  points: IdeologyPoint[];
  congress: number;
  chamber: string;
  totalMembers: number;
}) {
  // Group by party for separate scatter series (different colors)
  const byParty: Record<string, IdeologyPoint[]> = {};
  for (const p of points) {
    const key = resolveParty(p.party);
    if (!byParty[key]) byParty[key] = [];
    byParty[key].push(p);
  }
  const parties = Object.keys(byParty).sort();

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3">
        {parties.map((p) => (
          <span key={p} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: partyColor(p) }}
            />
            {p} ({byParty[p].length})
          </span>
        ))}
        <span className="text-xs text-gray-600">
          {points.length.toLocaleString()} of {totalMembers.toLocaleString()} members with scores
        </span>
      </div>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            type="number"
            dataKey="dim1"
            domain={[-1.1, 1.1]}
            tickCount={9}
            tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "monospace" }}
            label={{
              value: "Dim 1 (economic/redistributive)",
              position: "insideBottom",
              offset: -10,
              fontSize: 10,
              fill: "#4b5563",
            }}
          />
          <YAxis
            type="number"
            dataKey="dim2"
            domain={[-1.1, 1.1]}
            tickCount={9}
            tick={{ fontSize: 10, fill: "#6b7280", fontFamily: "monospace" }}
            label={{
              value: "Dim 2 (social/racial)",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              fontSize: 10,
              fill: "#4b5563",
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {parties.map((p) => (
            <Scatter
              key={p}
              name={p}
              data={byParty[p]}
              fill={partyColor(p)}
              opacity={0.7}
              r={3}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-gray-600 mt-2 text-right">
        {congress}th Congress · {chamber} · DW-NOMINATE via Voteview (Lewis et al.)
      </p>
    </div>
  );
}

// Dim1 distribution as a histogram
export function Dim1Histogram({
  points,
  congress,
  chamber,
}: {
  points: IdeologyPoint[];
  congress: number;
  chamber: string;
}) {
  // 20 bins from -1 to +1
  const BINS = 20;
  const binWidth = 2 / BINS;

  type Bin = { label: string; center: number; D: number; R: number; I: number; total: number };
  const bins: Bin[] = Array.from({ length: BINS }, (_, i) => ({
    label: (-1 + i * binWidth + binWidth / 2).toFixed(2),
    center: -1 + i * binWidth + binWidth / 2,
    D: 0,
    R: 0,
    I: 0,
    total: 0,
  }));

  for (const p of points) {
    const idx = Math.min(BINS - 1, Math.floor((p.dim1 + 1) / binWidth));
    if (idx < 0 || idx >= BINS) continue;
    const b = bins[idx];
    const pk = resolveParty(p.party);
    if (pk === "D") b.D++;
    else if (pk === "R") b.R++;
    else b.I++;
    b.total++;
  }

  const maxTotal = Math.max(...bins.map((b) => b.total), 1);

  return (
    <div>
      <div className="flex gap-3 mb-3">
        {(["D", "R", "I"] as const).map((p) => (
          <span key={p} className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: partyColor(p) }} />
            {p === "D" ? "Democrat" : p === "R" ? "Republican" : "Independent"}
          </span>
        ))}
      </div>
      <div className="flex items-stretch gap-px h-40 w-full">
        {bins.map((b) => (
          <div
            key={b.label}
            className="flex-1 flex flex-col justify-end gap-px"
            title={`${b.label}: D=${b.D} R=${b.R} I=${b.I}`}
          >
            {b.I > 0 && (
              <div
                style={{ height: `${(b.I / maxTotal) * 100}%`, background: partyColor("I") }}
                className="min-h-[1px]"
              />
            )}
            {b.D > 0 && (
              <div
                style={{ height: `${(b.D / maxTotal) * 100}%`, background: partyColor("D") }}
                className="min-h-[1px]"
              />
            )}
            {b.R > 0 && (
              <div
                style={{ height: `${(b.R / maxTotal) * 100}%`, background: partyColor("R") }}
                className="min-h-[1px]"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-gray-600 mt-1">
        <span>−1 Liberal</span>
        <span>0</span>
        <span>+1 Conservative</span>
      </div>
      <p className="text-[10px] text-gray-600 mt-2 text-right">
        {congress}th Congress · {chamber} · DW-NOMINATE via Voteview (Lewis et al.)
      </p>
    </div>
  );
}
