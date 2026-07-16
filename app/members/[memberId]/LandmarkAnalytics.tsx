import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BILL_FAMILY_BY_VOTE_ID, LANDMARK_VOTE_IDS } from "@/lib/landmark";

// Landmark roll-call analytics (B11-4). Every stat here is computed over the
// member's rows inside the 1,500-vote landmark subset only — no extrapolation.
// Renders nothing at all when the member has zero covered votes (D-4).

type LandmarkRow = {
  vote: string;
  legislativeVoteId: string;
  legislativeVote: {
    id: string;
    voteDate: Date | null;
    result: string | null;
    source: { name: string };
  };
};

function formatDate(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

// Plain cast votes plus "Not Voting" count toward attendance; paired/announced
// positions are not cast votes and stay out of every denominator here.
function positionLabel(vote: string): string {
  if (vote === "Not Voting") return "Absent";
  return vote;
}

function positionStyle(vote: string): string {
  if (vote === "Yea") return "text-green-400";
  if (vote === "Nay") return "text-red-400";
  return "text-gray-500";
}

function resultStyle(r: string | null): string {
  if (r === "passed") return "bg-green-950 text-green-400 border border-green-900/50";
  if (r === "failed") return "bg-red-950 text-red-400 border border-red-900/50";
  if (r === "tied") return "bg-yellow-950 text-yellow-400 border border-yellow-900/50";
  return "bg-gray-800 text-gray-500 border border-gray-700/50";
}

export default async function LandmarkAnalytics({ memberId }: { memberId: string }) {
  const rows: LandmarkRow[] = await prisma.memberVote.findMany({
    where: { memberId, legislativeVoteId: { in: LANDMARK_VOTE_IDS } },
    select: {
      vote: true,
      legislativeVoteId: true,
      legislativeVote: {
        select: {
          id: true,
          voteDate: true,
          result: true,
          source: { select: { name: true } },
        },
      },
    },
    orderBy: { legislativeVote: { voteDate: "desc" } },
  });

  if (rows.length === 0) return null;

  const covered = rows.length;
  const denominatorNote = `across ${covered.toLocaleString()} landmark roll-calls with member-level records`;

  // Attendance: cast votes / (cast + absent). Exact labels — the landmark
  // enrichment writes "Yea" | "Nay" | "Not Voting" (+ paired/announced variants).
  const yea = rows.filter((r) => r.vote === "Yea").length;
  const nay = rows.filter((r) => r.vote === "Nay").length;
  const absent = rows.filter((r) => r.vote === "Not Voting").length;
  const attendanceDenom = yea + nay + absent;
  const attendancePct = attendanceDenom > 0 ? ((yea + nay) / attendanceDenom) * 100 : null;

  // Party unity over the landmark subset: share of decided partisan votes where
  // the member voted with their party's majority on the same roll call. Peers
  // and majorities are restricted to plain cast votes on the same subset.
  const unityRows = await prisma.$queryRaw<{ matches: bigint; decided: bigint }[]>`
    WITH member_votes AS (
      SELECT mv."legislativeVoteId", mv."vote", mv."memberParty"
      FROM "MemberVote" mv
      WHERE mv."memberId" = ${memberId}
        AND mv."legislativeVoteId" = ANY(${LANDMARK_VOTE_IDS})
        AND mv."memberParty" IS NOT NULL
        AND mv."vote" IN ('Yea', 'Nay')
    ),
    party_majorities AS (
      SELECT
        peer."legislativeVoteId",
        peer."memberParty",
        COUNT(*) FILTER (WHERE peer."vote" = 'Yea') AS yea,
        COUNT(*) FILTER (WHERE peer."vote" = 'Nay') AS nay
      FROM "MemberVote" peer
      WHERE peer."memberParty" IS NOT NULL
        AND peer."vote" IN ('Yea', 'Nay')
        AND peer."legislativeVoteId" IN (SELECT "legislativeVoteId" FROM member_votes)
      GROUP BY peer."legislativeVoteId", peer."memberParty"
    )
    SELECT
      COUNT(*) FILTER (
        WHERE (mv."vote" = 'Yea' AND pm.yea > pm.nay)
           OR (mv."vote" = 'Nay' AND pm.nay > pm.yea)
      ) AS matches,
      COUNT(*) FILTER (WHERE pm.yea <> pm.nay) AS decided
    FROM member_votes mv
    JOIN party_majorities pm
      ON pm."legislativeVoteId" = mv."legislativeVoteId"
     AND pm."memberParty" = mv."memberParty"
  `;
  const unityMatches = unityRows[0] ? Number(unityRows[0].matches) : 0;
  const unityDecided = unityRows[0] ? Number(unityRows[0].decided) : 0;
  const unityPct = unityDecided > 0 ? (unityMatches / unityDecided) * 100 : null;

  // Notable reversals: same member, same bill family (exact Voteview bill_number
  // within one congress — see lib/landmark.ts), opposite plain cast votes.
  const byFamily = new Map<string, LandmarkRow[]>();
  for (const r of rows) {
    if (r.vote !== "Yea" && r.vote !== "Nay") continue;
    const family = BILL_FAMILY_BY_VOTE_ID.get(r.legislativeVoteId);
    if (!family) continue;
    const list = byFamily.get(family);
    if (list) list.push(r);
    else byFamily.set(family, [r]);
  }
  const reversals = [...byFamily.entries()]
    .filter(([, list]) => list.some((r) => r.vote === "Yea") && list.some((r) => r.vote === "Nay"))
    .map(([family, list]) => ({
      billNumber: family.split("::")[1],
      congress: family.split("::")[0],
      votes: [...list].sort(
        (a, b) =>
          (a.legislativeVote.voteDate?.getTime() ?? 0) - (b.legislativeVote.voteDate?.getTime() ?? 0),
      ),
    }))
    .sort(
      (a, b) =>
        (b.votes[b.votes.length - 1].legislativeVote.voteDate?.getTime() ?? 0) -
        (a.votes[a.votes.length - 1].legislativeVote.voteDate?.getTime() ?? 0),
    );

  const timeline = rows.slice(0, 10);

  return (
    <section>
      <h2 className="text-xs text-gray-500 font-mono uppercase tracking-widest mb-3">
        Landmark roll-call record
      </h2>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {unityPct !== null && (
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                Party unity (landmark subset)
              </div>
              <div className="mt-1 text-xl font-semibold text-gray-100">{unityPct.toFixed(1)}%</div>
              <div className="mt-1 text-[10px] text-gray-500">
                {unityMatches.toLocaleString()} / {unityDecided.toLocaleString()} decided partisan votes with party majority · {denominatorNote}
              </div>
            </div>
          )}
          {attendancePct !== null && (
            <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                Attendance (landmark subset)
              </div>
              <div className="mt-1 text-xl font-semibold text-gray-100">{attendancePct.toFixed(1)}%</div>
              <div className="mt-1 text-[10px] text-gray-500">
                {(yea + nay).toLocaleString()} cast / {attendanceDenom.toLocaleString()} cast-or-absent · {denominatorNote}
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-2">
            Notable votes
          </h3>
          <div className="rounded-lg border border-gray-800 divide-y divide-gray-800">
            {timeline.map((r) => (
              <Link
                key={r.legislativeVote.id}
                href={`/votes/${r.legislativeVote.id}`}
                className="block px-3 py-2.5 hover:bg-gray-800/60 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-200 group-hover:text-white line-clamp-2">
                      {r.legislativeVote.source.name}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                      <span className="font-mono">{formatDate(r.legislativeVote.voteDate)}</span>
                      <span className={`px-1.5 py-0.5 rounded font-mono uppercase ${resultStyle(r.legislativeVote.result)}`}>
                        {r.legislativeVote.result ?? "unknown"}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold ${positionStyle(r.vote)}`}>
                    {positionLabel(r.vote)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-600">
            Most recent {timeline.length.toLocaleString()} of this member&apos;s {covered.toLocaleString()} landmark
            roll-calls with member-level records. Landmark subset: 1,500 roll-calls (713 named acts + 787
            &lt;0.5%-margin close calls); stats never extrapolate beyond it.
          </p>
        </div>

        {reversals.length > 0 && (
          <div>
            <h3 className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-2">
              Notable reversals
            </h3>
            <p className="text-[10px] text-gray-600 mb-2">
              Roll-calls in the landmark subset where this member cast opposite votes on the same bill
              (exact Voteview bill-number match within one Congress — amendments, procedural motions, and
              final passage of the same bill share a family; no fuzzy title matching).
            </p>
            <div className="space-y-2">
              {reversals.map((rev) => (
                <div key={`${rev.congress}-${rev.billNumber}`} className="rounded-lg border border-gray-800 px-3 py-2.5">
                  <div className="text-xs font-mono text-gray-300">
                    {rev.billNumber} · {rev.congress}th Congress
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {rev.votes.map((v) => (
                      <Link
                        key={v.legislativeVote.id}
                        href={`/votes/${v.legislativeVote.id}`}
                        className="flex items-center justify-between gap-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          <span className="font-mono">{formatDate(v.legislativeVote.voteDate)}</span>
                          {" · "}
                          {v.legislativeVote.source.name}
                        </span>
                        <span className={`shrink-0 font-semibold ${positionStyle(v.vote)}`}>{v.vote}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
