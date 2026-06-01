"use client";
import type { TopicZRow } from "@/lib/voteAnalysis";

type Props = {
  rows: TopicZRow[];
  decades: string[];
};

function cellColor(z: number): string {
  if (z >= 2) return "bg-red-500";
  if (z >= 1) return "bg-red-800";
  if (z >= 0) return "bg-gray-800";
  if (z >= -1) return "bg-blue-900";
  return "bg-blue-600";
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export default function TopicHeatmap({ rows, decades }: Props) {
  if (rows.length === 0 || decades.length === 0) {
    return (
      <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs text-gray-500">
        Not enough decade coverage to compute topic z-score trajectories.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded border border-gray-800 bg-gray-900/40">
        <table className="border-separate" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-[10px] font-mono text-gray-500 sticky left-0 bg-gray-900/40">
                Topic
              </th>
              {decades.map((d) => (
                <th
                  key={d}
                  className="px-1 py-1 text-[10px] font-mono text-gray-500 text-center"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const byDecade = new Map(row.decades.map((d) => [d.decade, d]));
              return (
                <tr key={row.topic}>
                  <td
                    className="px-2 py-0.5 text-xs text-gray-400 sticky left-0 bg-gray-900/40 whitespace-nowrap"
                    title={row.topic}
                  >
                    {truncate(row.topic, 20)}
                  </td>
                  {decades.map((d) => {
                    const cell = byDecade.get(d);
                    if (!cell) {
                      return (
                        <td key={d} className="p-0">
                          <div className="w-6 h-5 bg-gray-950 border border-gray-900" />
                        </td>
                      );
                    }
                    const tip = `${row.topic} ${d} z=${cell.z.toFixed(2)} raw=${(cell.raw * 100).toFixed(1)}%`;
                    return (
                      <td key={d} className="p-0">
                        <div
                          className={`w-6 h-5 ${cellColor(cell.z)}`}
                          title={tip}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-gray-500">
        <span className="text-gray-400">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 bg-red-500" /> z ≥ 2
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 bg-red-800" /> z ≥ 1
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 bg-gray-800" /> ~baseline
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 bg-blue-900" /> z ≤ −0
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-3 bg-blue-600" /> z &lt; −1
        </span>
        <span className="text-gray-600">
          (red = above topic baseline, blue = below)
        </span>
      </div>
    </div>
  );
}
