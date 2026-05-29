import {
  getVotingByPresidency,
  getVotingByEra,
  type PresidencyStats,
  type EraStats,
  type PresidencyVoteRef,
} from "@/lib/stats-queries";
import { partyAbbrev, type President } from "@/lib/us-presidents";

function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

function yearRange(start: string, end: string): string {
  const s = start.slice(0, 4);
  const e = end.slice(0, 4);
  return s === e ? s : `${s}–${e}`;
}

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

const PARTY_STYLE: Record<President["party"], string> = {
  Democratic: "bg-blue-950 text-blue-300 border-blue-900/60",
  Republican: "bg-red-950 text-red-300 border-red-900/60",
  Whig: "bg-amber-950 text-amber-300 border-amber-900/60",
  "Democratic-Republican": "bg-emerald-950 text-emerald-300 border-emerald-900/60",
  Federalist: "bg-purple-950 text-purple-300 border-purple-900/60",
  "National Republican": "bg-fuchsia-950 text-fuchsia-300 border-fuchsia-900/60",
  Independent: "bg-zinc-800 text-zinc-300 border-zinc-700/60",
  "No Party": "bg-zinc-800 text-zinc-400 border-zinc-700/60",
};

function PartyBadge({ party }: { party: President["party"] }) {
  const style = PARTY_STYLE[party] ?? "bg-zinc-800 text-zinc-400 border-zinc-700/60";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border ${style}`}
      title={party}
    >
      {partyAbbrev(party)}
    </span>
  );
}

function passRateClass(rate: number): string {
  const pctVal = rate * 100;
  if (pctVal >= 70) return "text-green-300";
  if (pctVal >= 50) return "text-amber-300";
  return "text-red-300";
}

function ContestedCell({ vote }: { vote: PresidencyVoteRef | null }) {
  if (!vote) return <span className="text-zinc-600">—</span>;
  const label = vote.sourceName ? truncate(vote.sourceName, 60) : "(untitled)";
  const counts = `Y:${vote.yesCount.toLocaleString()} / N:${vote.noCount.toLocaleString()}`;
  return (
    <div className="space-y-0.5">
      {vote.sourceUrl ? (
        <a
          href={vote.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-zinc-200 hover:text-blue-300 transition-colors block leading-tight"
        >
          {label}
        </a>
      ) : (
        <span className="text-zinc-200 block leading-tight">{label}</span>
      )}
      <span className="text-[10px] font-mono text-zinc-500 tabular-nums">{counts}</span>
    </div>
  );
}

function MarginBar({ avgMargin }: { avgMargin: number }) {
  const yeaPct = Math.max(0, Math.min(1, avgMargin)) * 100;
  return (
    <div className="space-y-0.5">
      <div className="h-2 w-24 rounded-sm bg-zinc-900 overflow-hidden">
        <div className="h-full bg-green-700/70" style={{ width: `${yeaPct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-zinc-500 tabular-nums">{pct(yeaPct)} yea</span>
    </div>
  );
}

function EraTable({ eras }: { eras: EraStats[] }) {
  const withVotes = eras.filter((e) => e.total > 0);
  if (withVotes.length === 0) return null;
  return (
    <div className="rounded border border-zinc-800 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            <th className="px-3 py-2 text-left font-medium text-zinc-500">Era</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-500">Years</th>
            <th className="px-3 py-2 text-right font-medium text-zinc-500">Votes</th>
            <th className="px-3 py-2 text-right font-medium text-zinc-500">Pass Rate</th>
            <th className="px-3 py-2 text-right font-medium text-zinc-500">Avg Margin</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-500">Most Contested</th>
          </tr>
        </thead>
        <tbody>
          {withVotes.map((era, i) => (
            <tr
              key={era.label}
              className={`border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/50 transition-colors ${
                i % 2 === 0 ? "" : "bg-zinc-900/20"
              }`}
            >
              <td className="px-3 py-2 text-zinc-100 align-top">{era.label}</td>
              <td className="px-3 py-2 text-zinc-400 align-top font-mono whitespace-nowrap">
                {yearRange(era.start, era.end)}
              </td>
              <td className="px-3 py-2 text-right text-zinc-300 tabular-nums align-top">
                {era.total.toLocaleString()}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums align-top ${passRateClass(era.passRate)}`}
              >
                {pct(era.passRate * 100)}
              </td>
              <td className="px-3 py-2 align-top">
                <MarginBar avgMargin={era.avgMargin} />
              </td>
              <td className="px-3 py-2 align-top max-w-sm">
                <ContestedCell vote={era.mostContested} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PresidencyTable({ presidencies }: { presidencies: PresidencyStats[] }) {
  return (
    <div className="rounded border border-zinc-800 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/60">
            <th className="px-3 py-2 text-left font-medium text-zinc-500">President</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-500">Term</th>
            <th className="px-3 py-2 text-right font-medium text-zinc-500">Votes</th>
            <th className="px-3 py-2 text-right font-medium text-zinc-500">Pass Rate</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-500">Avg Margin</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-500">Most Contested</th>
          </tr>
        </thead>
        <tbody>
          {presidencies.map((p, i) => (
            <tr
              key={`${p.name}__${p.start}`}
              className={`border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/50 transition-colors ${
                i % 2 === 0 ? "" : "bg-zinc-900/20"
              }`}
            >
              <td className="px-3 py-2 align-top">
                <div className="flex items-center gap-2">
                  <PartyBadge party={p.party} />
                  <span className="text-zinc-100">{p.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-zinc-400 align-top font-mono whitespace-nowrap">
                {yearRange(p.start, p.end)}
              </td>
              <td className="px-3 py-2 text-right text-zinc-300 tabular-nums align-top">
                {p.total.toLocaleString()}
              </td>
              <td
                className={`px-3 py-2 text-right tabular-nums align-top ${passRateClass(p.passRate)}`}
              >
                {pct(p.passRate * 100)}
              </td>
              <td className="px-3 py-2 align-top">
                <MarginBar avgMargin={p.avgMargin} />
              </td>
              <td className="px-3 py-2 align-top max-w-sm">
                <ContestedCell vote={p.mostContested} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function VotesByPresidencySection() {
  const [byPresidency, byEra] = await Promise.all([
    getVotingByPresidency(),
    getVotingByEra(),
  ]);

  if (byPresidency.length === 0) return null;

  const totalVotes = byPresidency.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-white">By Era</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Voteview roll-call votes grouped into nine historical eras. Pass rate is the share of
            votes recorded as &ldquo;passed&rdquo;; avg margin is the mean yea share per vote.
          </p>
        </div>
        <EraTable eras={byEra} />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-white">By President</h3>
          <p className="text-xs text-zinc-500 mt-1">
            {byPresidency.length} administrations &middot; {totalVotes.toLocaleString()} roll-call
            votes. Most contested = smallest |yes &minus; no| within each term.
          </p>
        </div>
        <PresidencyTable presidencies={byPresidency} />
      </section>
    </div>
  );
}
