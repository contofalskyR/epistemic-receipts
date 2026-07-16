import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import IdeologySection from "./IdeologySection";
import LandmarkAnalytics from "./LandmarkAnalytics";

export const revalidate = 600;

export const metadata = {
  title: "Member — Epistemic Receipts",
  description: "Voting history, party unity, and chamber breakdown for a US Congress member.",
};

const PAGE_SIZE = 50;

function formatDate(iso: Date | string | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function partyClass(p: string | null): string {
  if (!p) return "bg-gray-800 text-gray-400 border border-gray-700/50";
  const x = p.toLowerCase();
  if (/republican|gop|\br\b/.test(x)) return "bg-red-950 text-red-300 border border-red-900/60";
  if (/democrat|\bd\b/.test(x)) return "bg-blue-950 text-blue-300 border border-blue-900/60";
  if (/independent|\bi\b/.test(x)) return "bg-purple-950 text-purple-300 border border-purple-900/60";
  return "bg-gray-800 text-gray-400 border border-gray-700/50";
}

function voteStyle(v: string): string {
  if (/^y(ea|es)?$/i.test(v)) return "text-green-400";
  if (/^n(ay|o)?$/i.test(v)) return "text-red-400";
  return "text-gray-500";
}

function resultStyle(r: string | null): string {
  if (r === "passed") return "bg-green-950 text-green-400 border border-green-900/50";
  if (r === "failed") return "bg-red-950 text-red-400 border border-red-900/50";
  if (r === "tied") return "bg-yellow-950 text-yellow-400 border border-yellow-900/50";
  return "bg-gray-800 text-gray-500 border border-gray-700/50";
}

type SearchParams = Promise<{ page?: string }>;

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: SearchParams;
}) {
  const { memberId } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Pull a recent sample of this member's votes (most recent first by vote date)
  // plus aggregate counts.
  const [latestRow, totalVotes, chamberBreakdown, partyMixRows, yeaCount, nayCount] = await Promise.all([
    prisma.memberVote.findFirst({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      select: { memberName: true, memberState: true, memberParty: true },
    }),
    prisma.memberVote.count({ where: { memberId } }),
    prisma.memberVote.groupBy({
      by: ["chamber"],
      where: { memberId },
      _count: { _all: true },
    }),
    prisma.memberVote.groupBy({
      by: ["memberParty"],
      where: { memberId },
      _count: { _all: true },
    }),
    prisma.memberVote.count({
      where: { memberId, vote: { in: ["Yea", "Yes", "yea", "yes"] } },
    }),
    prisma.memberVote.count({
      where: { memberId, vote: { in: ["Nay", "No", "nay", "no"] } },
    }),
  ]);

  if (!latestRow || totalVotes === 0) notFound();

  // Normalize raw Voteview chamber strings: "House of Representatives" → "House".
  const chamberMap: Record<string, number> = {};
  for (const row of chamberBreakdown) {
    const key = row.chamber === "House of Representatives" ? "House" : (row.chamber ?? "Unknown");
    chamberMap[key] = (chamberMap[key] ?? 0) + row._count._all;
  }
  const normalizedChambers = Object.entries(chamberMap).map(([chamber, count]) => ({ chamber, count }));

  // Pull paginated vote history joined to the LegislativeVote + Source.
  const memberRows = await prisma.memberVote.findMany({
    where: { memberId },
    select: {
      id: true,
      vote: true,
      memberParty: true,
      legislativeVote: {
        select: {
          id: true,
          chamber: true,
          voteDate: true,
          result: true,
          yesCount: true,
          noCount: true,
          abstainCount: true,
          source: { select: { name: true } },
        },
      },
    },
    orderBy: { legislativeVote: { voteDate: "desc" } },
    take: PAGE_SIZE,
    skip: offset,
  });

  const pageCount = Math.max(1, Math.ceil(totalVotes / PAGE_SIZE));

  // Compute party-unity %: percentage of decided votes where the member voted with
  // their party majority on the same roll call. We pull all of this member's votes
  // for that calculation, plus the per-vote party majorities — done in a single
  // raw SQL aggregation to keep this fast at 100k+ rows.
  const unityRows = await prisma.$queryRaw<
    { matches: bigint; decided: bigint }[]
  >`
    WITH member_votes AS (
      SELECT mv."legislativeVoteId", mv."vote", mv."memberParty"
      FROM "MemberVote" mv
      WHERE mv."memberId" = ${memberId}
        AND mv."memberParty" IS NOT NULL
        AND (mv."vote" ILIKE 'yea' OR mv."vote" ILIKE 'yes' OR mv."vote" ILIKE 'nay' OR mv."vote" ILIKE 'no')
    ),
    party_majorities AS (
      SELECT
        peer."legislativeVoteId",
        peer."memberParty",
        SUM(CASE WHEN peer."vote" ILIKE 'yea' OR peer."vote" ILIKE 'yes' THEN 1 ELSE 0 END) AS yea,
        SUM(CASE WHEN peer."vote" ILIKE 'nay' OR peer."vote" ILIKE 'no' THEN 1 ELSE 0 END) AS nay
      FROM "MemberVote" peer
      WHERE peer."memberParty" IS NOT NULL
        AND peer."legislativeVoteId" IN (SELECT "legislativeVoteId" FROM member_votes)
      GROUP BY peer."legislativeVoteId", peer."memberParty"
    )
    SELECT
      COUNT(*) FILTER (
        WHERE (
          ((mv."vote" ILIKE 'yea' OR mv."vote" ILIKE 'yes') AND pm.yea > pm.nay)
          OR ((mv."vote" ILIKE 'nay' OR mv."vote" ILIKE 'no') AND pm.nay > pm.yea)
        )
      ) AS matches,
      COUNT(*) FILTER (WHERE pm.yea <> pm.nay) AS decided
    FROM member_votes mv
    JOIN party_majorities pm
      ON pm."legislativeVoteId" = mv."legislativeVoteId"
     AND pm."memberParty" = mv."memberParty"
  `;
  const matches = unityRows[0] ? Number(unityRows[0].matches) : 0;
  const decided = unityRows[0] ? Number(unityRows[0].decided) : 0;
  const unityPct = decided > 0 ? (matches / decided) * 100 : null;

  const otherCount = totalVotes - yeaCount - nayCount;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <div className="text-xs text-gray-500 flex items-center gap-3">
          <Link href="/members" className="hover:text-gray-300 transition-colors">← Search members</Link>
          <span className="text-gray-700">·</span>
          <Link href="/votes" className="hover:text-gray-300 transition-colors">Browse roll calls</Link>
        </div>
        <p className="mt-3 text-xs text-gray-500 font-mono uppercase tracking-widest">Member · bioguide {memberId}</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{latestRow.memberName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-gray-400">{latestRow.memberState ?? "—"}</span>
          <span className={`px-2 py-0.5 rounded-full font-mono ${partyClass(latestRow.memberParty)}`}>
            {latestRow.memberParty ?? "?"}
          </span>
          <span className="text-gray-500">most recent affiliation</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total votes" value={totalVotes.toLocaleString()} />
        <Stat label="Yea" value={yeaCount.toLocaleString()} tint="text-green-400" />
        <Stat label="Nay" value={nayCount.toLocaleString()} tint="text-red-400" />
        <Stat label="Other" value={otherCount.toLocaleString()} tint="text-gray-400" sub="present / not voting" />
        <Stat
          label="Party unity"
          value={unityPct === null ? "—" : `${unityPct.toFixed(1)}%`}
          sub={unityPct === null ? "no decided partisan votes" : `${matches.toLocaleString()} / ${decided.toLocaleString()} aligned`}
        />
      </div>

      <Suspense fallback={null}>
        <IdeologySection memberId={memberId} />
      </Suspense>

      <Suspense fallback={null}>
        <LandmarkAnalytics memberId={memberId} />
      </Suspense>

      <section>
        <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">Chamber breakdown</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {normalizedChambers.map(c => (
            <div key={c.chamber} className="rounded-lg border border-gray-800 bg-gray-900 p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-200">{c.chamber}</div>
                <div className="text-xs text-gray-500 mt-1">{((c.count / totalVotes) * 100).toFixed(1)}% of votes</div>
              </div>
              <div className="text-2xl font-semibold text-white">{c.count.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </section>

      {partyMixRows.length > 1 && (
        <section>
          <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">Party history</h2>
          <div className="rounded-lg border border-gray-800 bg-gray-900 divide-y divide-gray-800">
            {partyMixRows
              .sort((a, b) => b._count._all - a._count._all)
              .map(p => (
                <div key={p.memberParty ?? "_"} className="px-4 py-2 text-sm flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${partyClass(p.memberParty)}`}>
                    {p.memberParty ?? "?"}
                  </span>
                  <span className="text-gray-400 font-mono text-xs">{p._count._all.toLocaleString()} votes</span>
                </div>
              ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest">Vote history</h2>
          <span className="text-xs text-gray-500">
            Page {page.toLocaleString()} of {pageCount.toLocaleString()}
          </span>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 divide-y divide-gray-800">
          {memberRows.map(r => (
            <Link
              key={r.id}
              href={`/votes/${r.legislativeVote.id}`}
              className="block px-4 py-3 hover:bg-gray-800/60 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-200 group-hover:text-white line-clamp-2">{r.legislativeVote.source.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                    <span className="font-mono">{formatDate(r.legislativeVote.voteDate)}</span>
                    <span className="text-gray-700">·</span>
                    <span>{r.legislativeVote.chamber}</span>
                    <span className={`px-1.5 py-0.5 rounded font-mono uppercase ${resultStyle(r.legislativeVote.result)}`}>
                      {r.legislativeVote.result ?? "unknown"}
                    </span>
                    <span className="text-gray-700">·</span>
                    <span className="font-mono text-gray-500">
                      <span className="text-green-400">{r.legislativeVote.yesCount ?? 0}</span>
                      <span className="mx-1 text-gray-700">·</span>
                      <span className="text-red-400">{r.legislativeVote.noCount ?? 0}</span>
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-xs font-semibold ${voteStyle(r.vote)}`}>{r.vote}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {pageCount > 1 && (
          <div className="flex items-center gap-3 text-xs text-gray-500 pt-3">
            {page > 1 ? (
              <Link href={`/members/${encodeURIComponent(memberId)}?page=${page - 1}`} className="hover:text-gray-300 transition-colors">
                ← Previous
              </Link>
            ) : (
              <span className="opacity-30">← Previous</span>
            )}
            <span className="text-gray-700">·</span>
            <span>Page {page.toLocaleString()} of {pageCount.toLocaleString()}</span>
            <span className="text-gray-700">·</span>
            {page < pageCount ? (
              <Link href={`/members/${encodeURIComponent(memberId)}?page=${page + 1}`} className="hover:text-gray-300 transition-colors">
                Next →
              </Link>
            ) : (
              <span className="opacity-30">Next →</span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tint, sub }: { label: string; value: string; tint?: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
      <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${tint ?? "text-gray-100"}`}>{value}</div>
      {sub && <div className="mt-1 text-[10px] text-gray-500">{sub}</div>}
    </div>
  );
}
