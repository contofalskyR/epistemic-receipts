import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { liveClaimSql } from "@/lib/corpus";

// Ported from /analysis/corpus (deleted in front door phase 3): the one panel
// on that page nothing else rendered. Genuine status changes only — rows whose
// fromAxis is set — so it shows how claims move between epistemic states once
// already in the record, not their entry stamps. Joined to live claims like
// every other count on /stats (lib/corpus.ts).

type Row = { fromAxis: string; toAxis: string; count: number };

const getTransitionMatrix = unstable_cache(
  async (): Promise<Row[]> =>
    prisma.$queryRaw<Row[]>`
      SELECT h."fromAxis", h."toAxis", COUNT(*)::int AS count
      FROM "ClaimStatusHistory" h
      JOIN "Claim" c ON c.id = h."claimId"
      WHERE h."fromAxis" IS NOT NULL
        AND ${liveClaimSql("c")}
      GROUP BY h."fromAxis", h."toAxis"
      ORDER BY count DESC
      LIMIT 20
    `,
  ["stats-transition-matrix"],
  { revalidate: 3600 },
);

const AXIS_CLASS: Record<string, string> = {
  SETTLED: "text-emerald-300",
  RECORDED: "text-sky-300",
  CONTESTED: "text-amber-300",
  REVERSED: "text-rose-300",
  ABANDONED: "text-zinc-400",
  OPEN: "text-violet-300",
  UNRESOLVABLE: "text-zinc-400",
};

export default async function TransitionMatrixSection() {
  const rows = await getTransitionMatrix();
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <section className="pt-4 border-t border-zinc-800">
      <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Corpus · movement</p>
      <h2 className="mt-1 text-lg font-semibold text-white">Status transitions</h2>
      <p className="mt-1 text-xs text-zinc-500 max-w-2xl">
        How claims move between epistemic states once already in the record — dated status
        changes with a recorded prior state, over live claims. Entry stamps (a claim&apos;s first
        recorded status) are excluded. Top 20 of {total.toLocaleString()} such changes.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
              <th className="px-3 py-2 border-b border-zinc-800">From</th>
              <th className="px-3 py-2 border-b border-zinc-800">To</th>
              <th className="px-3 py-2 border-b border-zinc-800 text-right">Changes</th>
              <th className="px-3 py-2 border-b border-zinc-800 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.fromAxis}→${r.toAxis}`} className="hover:bg-zinc-900/60">
                <td className={`px-3 py-1.5 border-b border-zinc-800/60 font-mono text-xs font-semibold ${AXIS_CLASS[r.fromAxis] ?? "text-zinc-300"}`}>
                  {r.fromAxis}
                </td>
                <td className={`px-3 py-1.5 border-b border-zinc-800/60 font-mono text-xs font-semibold ${AXIS_CLASS[r.toAxis] ?? "text-zinc-300"}`}>
                  {r.toAxis}
                </td>
                <td className="px-3 py-1.5 border-b border-zinc-800/60 text-right tabular-nums text-zinc-200">
                  {r.count.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 border-b border-zinc-800/60 text-right tabular-nums text-zinc-500">
                  {((r.count / total) * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
