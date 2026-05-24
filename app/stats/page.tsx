export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

const MIN_TOTAL = 10;

const LEGISLATURE_LABELS: Record<string, string> = {
  uk_legislation_v1: "UK Parliament",
  congress_v1: "US Congress",
  canada_bills_v1: "Canada Parliament",
  eu_parliament_v1: "EU Parliament",
};

type VoteRow = {
  id: string;
  chamber: string;
  yesCount: number;
  noCount: number;
  total: number;
  nayPct: number;
  ingestedBy: string;
  legislature: string;
  sourceName: string | null;
  sourceUrl: string | null;
};

type LegislatureStats = {
  ingestedBy: string;
  label: string;
  billCount: number;
  avgNayPct: number;
};

function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

async function loadVotes(): Promise<VoteRow[]> {
  const ingestedByValues = Object.keys(LEGISLATURE_LABELS);
  const raw = await prisma.legislativeVote.findMany({
    where: {
      yesCount: { not: null },
      noCount: { not: null },
      source: { ingestedBy: { in: ingestedByValues } },
    },
    select: {
      id: true,
      chamber: true,
      yesCount: true,
      noCount: true,
      source: { select: { name: true, url: true, ingestedBy: true } },
    },
  });

  const rows: VoteRow[] = [];
  for (const v of raw) {
    const yes = v.yesCount ?? 0;
    const no = v.noCount ?? 0;
    const total = yes + no;
    if (total < MIN_TOTAL) continue;
    const ingestedBy = v.source?.ingestedBy ?? "unknown";
    rows.push({
      id: v.id,
      chamber: v.chamber,
      yesCount: yes,
      noCount: no,
      total,
      nayPct: (no / total) * 100,
      ingestedBy,
      legislature: LEGISLATURE_LABELS[ingestedBy] ?? ingestedBy,
      sourceName: v.source?.name ?? null,
      sourceUrl: v.source?.url ?? null,
    });
  }
  return rows;
}

function aggregateByLegislature(rows: VoteRow[]): LegislatureStats[] {
  const byTag = new Map<string, VoteRow[]>();
  for (const r of rows) {
    const arr = byTag.get(r.ingestedBy) ?? [];
    arr.push(r);
    byTag.set(r.ingestedBy, arr);
  }
  const out: LegislatureStats[] = [];
  for (const [tag, group] of byTag.entries()) {
    const avg = group.reduce((s, r) => s + r.nayPct, 0) / group.length;
    out.push({
      ingestedBy: tag,
      label: LEGISLATURE_LABELS[tag] ?? tag,
      billCount: group.length,
      avgNayPct: avg,
    });
  }
  out.sort((a, b) => b.avgNayPct - a.avgNayPct);
  return out;
}

function BillCell({ row }: { row: VoteRow }) {
  const label = row.sourceName ?? "(untitled)";
  if (row.sourceUrl) {
    return (
      <a
        href={row.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="text-zinc-100 hover:text-blue-300 transition-colors"
      >
        {label}
      </a>
    );
  }
  return <span className="text-zinc-100">{label}</span>;
}

export default async function StatsPage() {
  const rows = await loadVotes();
  const legislatures = aggregateByLegislature(rows);
  const totalVotes = rows.length;
  const totalLegislatures = legislatures.length;

  const mostContested = [...rows].sort((a, b) => b.nayPct - a.nayPct).slice(0, 10);
  const mostUnanimous = [...rows]
    .sort((a, b) => a.nayPct - b.nayPct || b.total - a.total)
    .slice(0, 10);

  const maxAvgNayPct = Math.max(1, ...legislatures.map((l) => l.avgNayPct));

  return (
    <div className="space-y-10 text-sm text-zinc-300">
      <header>
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Statistics</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Legislative Statistics</h1>
        <p className="mt-2 text-zinc-400">
          Consensus tracking across {totalLegislatures.toLocaleString()} legislatures,{" "}
          {totalVotes.toLocaleString()} votes
        </p>
      </header>

      {/* Polarization by Legislature */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Polarization by Legislature</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Average share of recorded nay votes per bill. Higher = more contested. Excludes bills
            with fewer than {MIN_TOTAL} recorded aye+nay.
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3">
          {legislatures.map((l) => {
            const widthPct = (l.avgNayPct / maxAvgNayPct) * 100;
            return (
              <div key={l.ingestedBy} className="space-y-1">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <span className="text-zinc-100">{l.label}</span>
                    <span className="ml-2 text-xs text-zinc-500 font-mono">
                      {l.ingestedBy}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                    {l.billCount.toLocaleString()} bills · avg{" "}
                    <span className="text-red-300">{pct(l.avgNayPct)}</span> nay
                  </div>
                </div>
                <div className="h-3 rounded-sm bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-red-700/80"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Most Contested Votes */}
      <section className="space-y-2">
        <div>
          <h2 className="text-base font-semibold text-white">Most Contested Votes</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Bills with the highest recorded nay share, across all legislatures.
          </p>
        </div>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Bill</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Yes</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">No</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Nay %</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Chamber</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Legislature</th>
              </tr>
            </thead>
            <tbody>
              {mostContested.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-zinc-800/50 last:border-0 ${
                    i % 2 === 0 ? "" : "bg-zinc-900/20"
                  }`}
                >
                  <td className="px-3 py-2 align-top max-w-md">
                    <BillCell row={r} />
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-300 tabular-nums align-top">
                    {r.yesCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">
                    {r.noCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-red-300 tabular-nums align-top">
                    {pct(r.nayPct)}
                  </td>
                  <td className="px-3 py-2 text-zinc-400 align-top whitespace-nowrap">
                    {r.chamber}
                  </td>
                  <td className="px-3 py-2 text-zinc-400 align-top whitespace-nowrap">
                    {r.legislature}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Most Unanimous Votes */}
      <section className="space-y-2">
        <div>
          <h2 className="text-base font-semibold text-white">Most Unanimous Votes</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Bills with the lowest recorded nay share, ordered by total recorded ayes within ties.
          </p>
        </div>
        <div className="rounded border border-zinc-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Bill</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Yes</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">No</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Nay %</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Chamber</th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Legislature</th>
              </tr>
            </thead>
            <tbody>
              {mostUnanimous.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-zinc-800/50 last:border-0 ${
                    i % 2 === 0 ? "" : "bg-zinc-900/20"
                  }`}
                >
                  <td className="px-3 py-2 align-top max-w-md">
                    <BillCell row={r} />
                  </td>
                  <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">
                    {r.yesCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-500 tabular-nums align-top">
                    {r.noCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-green-300 tabular-nums align-top">
                    {pct(r.nayPct)}
                  </td>
                  <td className="px-3 py-2 text-zinc-400 align-top whitespace-nowrap">
                    {r.chamber}
                  </td>
                  <td className="px-3 py-2 text-zinc-400 align-top whitespace-nowrap">
                    {r.legislature}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
