import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export const metadata = {
  title: "Roll Call — Epistemic Receipts",
  description: "Roll-call detail with member-level votes, party breakdown, and party unity score.",
};

function formatDate(iso: Date | string | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function partyClass(party: string | null | undefined): string {
  if (!party) return "bg-gray-800 text-gray-400 border border-gray-700/50";
  const p = party.toLowerCase();
  if (/republican|gop|\br\b/.test(p)) return "bg-red-950 text-red-300 border border-red-900/60";
  if (/democrat|\bd\b/.test(p)) return "bg-blue-950 text-blue-300 border border-blue-900/60";
  if (/independent|\bi\b/.test(p)) return "bg-purple-950 text-purple-300 border border-purple-900/60";
  return "bg-gray-800 text-gray-400 border border-gray-700/50";
}

function partyLabel(p: string | null | undefined): string {
  if (!p) return "?";
  const norm = p.trim();
  if (/^republican$/i.test(norm) || /^gop$/i.test(norm) || /^r$/i.test(norm)) return "R";
  if (/^democrat(ic)?$/i.test(norm) || /^d$/i.test(norm)) return "D";
  if (/^independent$/i.test(norm) || /^i$/i.test(norm)) return "I";
  return norm.length > 4 ? norm.slice(0, 1).toUpperCase() : norm.toUpperCase();
}

function partySortKey(p: string | null | undefined): number {
  const l = partyLabel(p);
  if (l === "D") return 0;
  if (l === "R") return 1;
  if (l === "I") return 2;
  return 3;
}

function isYea(vote: string): boolean {
  return /^y(ea|es)?$/i.test(vote.trim());
}
function isNay(vote: string): boolean {
  return /^n(ay|o)?$/i.test(vote.trim());
}

type MemberVote = {
  id: string;
  memberId: string | null;
  memberName: string;
  memberState: string | null;
  memberParty: string | null;
  vote: string;
};

function unityForParty(members: MemberVote[]): { unity: number; majority: "Yea" | "Nay" | "Split" } {
  const yea = members.filter(m => isYea(m.vote)).length;
  const nay = members.filter(m => isNay(m.vote)).length;
  const decided = yea + nay;
  if (decided === 0) return { unity: 0, majority: "Split" };
  if (yea === nay) return { unity: 50, majority: "Split" };
  const top = Math.max(yea, nay);
  return {
    unity: Math.round((top / decided) * 100),
    majority: yea > nay ? "Yea" : "Nay",
  };
}

export default async function VoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vote = await prisma.legislativeVote.findUnique({
    where: { id },
    select: {
      id: true,
      chamber: true,
      yesCount: true,
      noCount: true,
      abstainCount: true,
      totalSeats: true,
      passageThreshold: true,
      passageType: true,
      voteDate: true,
      result: true,
      topics: true,
      dataSource: true,
      byPartyJson: true,
      source: {
        select: {
          id: true,
          name: true,
          url: true,
          publishedAt: true,
          ingestedBy: true,
        },
      },
      memberVotes: {
        select: {
          id: true,
          memberId: true,
          memberName: true,
          memberState: true,
          memberParty: true,
          vote: true,
        },
        orderBy: [{ memberParty: "asc" }, { memberName: "asc" }],
      },
    },
  });

  if (!vote) notFound();

  const yes = vote.yesCount ?? 0;
  const no = vote.noCount ?? 0;
  const abs = vote.abstainCount ?? 0;
  const total = yes + no + abs;
  const margin = yes - no;

  const topics: string[] = (() => {
    if (!vote.topics) return [];
    try {
      const t = JSON.parse(vote.topics);
      return Array.isArray(t) ? t.filter((x: unknown) => typeof x === "string") : [];
    } catch {
      return [];
    }
  })();

  const members: MemberVote[] = vote.memberVotes;
  const yeaMembers = members.filter(m => isYea(m.vote)).sort(byPartyAndName);
  const nayMembers = members.filter(m => isNay(m.vote)).sort(byPartyAndName);
  const otherMembers = members.filter(m => !isYea(m.vote) && !isNay(m.vote)).sort(byPartyAndName);

  // Party unity by party
  const partyGroups = new Map<string, MemberVote[]>();
  for (const m of members) {
    const key = partyLabel(m.memberParty);
    if (!partyGroups.has(key)) partyGroups.set(key, []);
    partyGroups.get(key)!.push(m);
  }
  const partyUnity = Array.from(partyGroups.entries())
    .map(([party, ms]) => {
      const yea = ms.filter(m => isYea(m.vote)).length;
      const nay = ms.filter(m => isNay(m.vote)).length;
      const other = ms.length - yea - nay;
      const u = unityForParty(ms);
      return { party, total: ms.length, yea, nay, other, unity: u.unity, majority: u.majority };
    })
    .sort((a, b) => partySortKey(a.party) - partySortKey(b.party));

  const resultStyle =
    vote.result === "passed"
      ? "bg-green-950 text-green-400 border-green-900/60"
      : vote.result === "failed"
      ? "bg-red-950 text-red-400 border-red-900/60"
      : vote.result === "tied"
      ? "bg-yellow-950 text-yellow-400 border-yellow-900/60"
      : "bg-gray-800 text-gray-500 border-gray-700/60";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <div className="text-xs text-gray-500">
          <Link href="/votes" className="hover:text-gray-300 transition-colors">← Back to roll calls</Link>
        </div>
        <p className="mt-3 text-xs text-gray-500 font-mono uppercase tracking-widest">Roll call · {vote.chamber}</p>
        <h1 className="mt-1 text-2xl font-semibold text-white leading-snug">{vote.source.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-gray-500">{formatDate(vote.voteDate)}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase border ${resultStyle}`}>
            {vote.result ?? "unknown"}
          </span>
          {vote.passageThreshold && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium border border-gray-700/60 text-gray-400 bg-gray-900">
              {vote.passageThreshold}
            </span>
          )}
          {topics.slice(0, 8).map(t => (
            <span key={t} className="text-xs px-1.5 py-0.5 rounded font-mono bg-gray-800/60 text-gray-500">
              {t}
            </span>
          ))}
          {vote.source.url && (
            <a
              href={vote.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-blue-300 transition-colors underline-offset-2 hover:underline"
            >
              Voteview source ↗
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Yea" value={yes.toLocaleString()} tint="text-green-400" />
        <Stat label="Nay" value={no.toLocaleString()} tint="text-red-400" />
        <Stat label="Not voting / present" value={abs.toLocaleString()} tint="text-gray-400" />
        <Stat label="Total" value={total.toLocaleString()} />
        <Stat label="Margin" value={(margin > 0 ? "+" : "") + margin.toLocaleString()} tint={margin >= 0 ? "text-green-400" : "text-red-400"} />
      </div>

      {total > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-2">Result split</div>
          <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
            <div className="bg-green-500/70" style={{ width: `${(yes / total) * 100}%` }} title={`Yea ${yes}`} />
            <div className="bg-red-500/70" style={{ width: `${(no / total) * 100}%` }} title={`Nay ${no}`} />
            <div className="bg-gray-600" style={{ width: `${(abs / total) * 100}%` }} title={`Other ${abs}`} />
          </div>
          <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-4">
            <span><span className="text-green-400">{((yes / total) * 100).toFixed(1)}%</span> Yea</span>
            <span><span className="text-red-400">{((no / total) * 100).toFixed(1)}%</span> Nay</span>
            <span><span className="text-gray-400">{((abs / total) * 100).toFixed(1)}%</span> Other</span>
          </div>
        </div>
      )}

      {partyUnity.length > 0 && (
        <section>
          <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">Party unity</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {partyUnity.map(p => (
              <div key={p.party} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${partyClass(p.party)}`}>{p.party}</span>
                  <span className="text-xs text-gray-500 font-mono">{p.total} members</span>
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">{p.unity}%</div>
                <div className="text-xs text-gray-500">
                  voted with party majority ({p.majority})
                </div>
                <div className="mt-2 text-xs text-gray-400 font-mono">
                  <span className="text-green-400">{p.yea}</span> Yea · <span className="text-red-400">{p.nay}</span> Nay
                  {p.other > 0 && <> · <span className="text-gray-500">{p.other}</span> other</>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {members.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MemberList title="Yea" count={yeaMembers.length} members={yeaMembers} tint="text-green-400" />
          <MemberList title="Nay" count={nayMembers.length} members={nayMembers} tint="text-red-400" />
          {otherMembers.length > 0 && (
            <div className="md:col-span-2">
              <MemberList title="Not voting / Present" count={otherMembers.length} members={otherMembers} tint="text-gray-400" />
            </div>
          )}
        </section>
      ) : (
        // Data-coverage gap: voteview_v1 rollcalls (1789–present from Voteview's
        // HSall_rollcalls.csv) carry chamber totals but not member-level data —
        // those are fetched separately from House Clerk + senate.gov XML by
        // scripts/enrich-member-votes.ts, which has only been run against the
        // congress_votes_v1 source (505 votes) and howtheyvote_eu (~1,900 votes).
        // All 113k voteview_v1 LegislativeVotes still need member-level enrichment.
        <div className="text-sm text-gray-500 space-y-1">
          <p>No member-level votes recorded for this roll call.</p>
          {vote.dataSource === "voteview_v1" && (
            <p className="text-xs text-gray-600">
              Voteview rollcalls (1789–present) carry chamber totals only; member-level
              votes are backfilled separately from House Clerk and Senate XML and have not
              yet been ingested for this entry.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function byPartyAndName(a: MemberVote, b: MemberVote): number {
  const pa = partySortKey(a.memberParty);
  const pb = partySortKey(b.memberParty);
  if (pa !== pb) return pa - pb;
  return a.memberName.localeCompare(b.memberName);
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
      <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tint ?? "text-gray-100"}`}>{value}</div>
    </div>
  );
}

function MemberList({
  title,
  count,
  members,
  tint,
}: {
  title: string;
  count: number;
  members: MemberVote[];
  tint: string;
}) {
  return (
    <div>
      <h3 className={`text-sm font-semibold mb-2 ${tint}`}>
        {title} <span className="text-gray-500 font-normal">({count})</span>
      </h3>
      <div className="rounded-lg border border-gray-800 bg-gray-900 divide-y divide-gray-800">
        {members.map(m => (
          <div key={m.id} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {m.memberId ? (
                <Link href={`/members/${m.memberId}`} className="text-gray-200 hover:text-white transition-colors truncate block">
                  {m.memberName}
                </Link>
              ) : (
                <span className="text-gray-200 truncate block">{m.memberName}</span>
              )}
              <div className="text-[10px] text-gray-500 font-mono">{m.memberState ?? "—"}</div>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${partyClass(m.memberParty)}`}>
              {partyLabel(m.memberParty)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
