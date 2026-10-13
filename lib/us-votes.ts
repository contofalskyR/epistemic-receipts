import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import reviewList from "@/data/vote-results-under-review.json";
import type { ReviewGroup } from "@/lib/vote-review";

// Which roll calls and members are public, and the claim behind each vote
// (Phase 7 Q13, owner decisions 2026-10-13). A vote page exists publicly only
// when its LegislativeVote reaches a live US claim:
//   voteview_v1       → the claim with externalId voteview_claim_<id>
//   congress_votes_v1 → the claim whose metadata.legislativeVoteId is the vote;
//                       when Q7 retired that claim as a duplicate, its live
//                       voteview twin (metadata.duplicateOf)
// EU / UK / Canadian votes have no claims yet, so they 404.

export const US_VOTE_SOURCES = ["voteview_v1", "congress_votes_v1"] as const;
export const BIOGUIDE_RE = /^[A-Z][0-9]{6}$/;

type CongressVoteLinks = {
  /** congress_votes_v1 vote id → the live claim it reaches. */
  claimByVote: Record<string, string>;
  /** congress_votes_v1 vote id → its voteview twin's vote id. */
  twinVote: Record<string, string>;
  /** congress_votes_v1 votes whose voteview twin holds the same member votes:
   *  member pages skip these so a roll call is not counted twice. */
  doubled: string[];
};

/** One indexed read of the ~1,100 congress_votes_v1 claims, cached for a day. */
export const congressVoteLinks = unstable_cache(
  async (): Promise<CongressVoteLinks> => {
    const rows = await prisma.$queryRaw<{ lv: string; id: string; deleted: boolean; twin: string | null; twinLive: boolean | null; twinLv: string | null }[]>`
      SELECT c.metadata->>'legislativeVoteId' AS lv, c.id, c.deleted,
             t.id AS twin, NOT t.deleted AS "twinLive", t.metadata->>'legislativeVoteId' AS "twinLv"
      FROM "Claim" c
      LEFT JOIN "Claim" t ON t.id = c.metadata->>'duplicateOf'
      WHERE c."ingestedBy" = 'congress_votes_v1' AND c.metadata ? 'legislativeVoteId'`;
    const claimByVote: Record<string, string> = {};
    const twinVote: Record<string, string> = {};
    for (const r of rows) {
      if (!r.deleted) claimByVote[r.lv] = r.id;
      else if (r.twin && r.twinLive) claimByVote[r.lv] = r.twin;
      if (r.twinLv) twinVote[r.lv] = r.twinLv;
    }
    const twins = Object.values(twinVote);
    const withMembers = twins.length
      ? await prisma.memberVote.findMany({
          where: { legislativeVoteId: { in: twins } },
          distinct: ["legislativeVoteId"],
          select: { legislativeVoteId: true },
        })
      : [];
    const twinHasMembers = new Set(withMembers.map(m => m.legislativeVoteId));
    const doubled = Object.entries(twinVote).filter(([, t]) => twinHasMembers.has(t)).map(([lv]) => lv);
    return { claimByVote, twinVote, doubled };
  },
  ["congress-vote-links", "v1"],
  { revalidate: 86400, tags: ["congress-vote-links"] },
);

export type VoteClaim = { id: string; text: string };

/** The live US claim behind a vote, or null (→ the public page 404s). */
export const voteClaim = cache(async (voteId: string, dataSource: string | null): Promise<VoteClaim | null> => {
  let claimId: string | null = null;
  if (dataSource === "voteview_v1") {
    const c = await prisma.claim.findUnique({ where: { externalId: `voteview_claim_${voteId}` }, select: { id: true, deleted: true } });
    claimId = c && !c.deleted ? c.id : null;
  } else if (dataSource === "congress_votes_v1") {
    claimId = (await congressVoteLinks()).claimByVote[voteId] ?? null;
  }
  if (!claimId) return null;
  const c = await prisma.claim.findUnique({ where: { id: claimId }, select: { id: true, text: true, deleted: true } });
  return c && !c.deleted ? { id: c.id, text: c.text } : null;
});

/** Which of these votes have a public page (voteview_v1 always does). */
export async function publicVoteIds(votes: { id: string; dataSource: string | null }[]): Promise<Set<string>> {
  const { claimByVote } = await congressVoteLinks();
  return new Set(
    votes.filter(v => v.dataSource === "voteview_v1" || (v.dataSource === "congress_votes_v1" && claimByVote[v.id])).map(v => v.id),
  );
}

const REVIEW = new Map<string, ReviewGroup>((reviewList.votes as [string, ReviewGroup][]).map(([id, g]) => [id, g]));

/** "Result under review" group for a vote: listed in data/vote-results-under-review.json,
 *  directly or through its voteview twin. */
export async function voteReviewGroup(voteId: string, dataSource: string | null): Promise<ReviewGroup | null> {
  const direct = REVIEW.get(voteId);
  if (direct) return direct;
  if (dataSource !== "congress_votes_v1") return null;
  const twin = (await congressVoteLinks()).twinVote[voteId];
  return twin ? (REVIEW.get(twin) ?? null) : null;
}

/** A member page is public when the bioguide id has at least one vote on a US roll call with a claim. */
export const isPublicMember = cache(async (memberId: string): Promise<boolean> => {
  if (!BIOGUIDE_RE.test(memberId)) return false;
  const keyed = Object.keys((await congressVoteLinks()).claimByVote);
  const rows = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "MemberVote" m JOIN "LegislativeVote" lv ON lv.id = m."legislativeVoteId"
      WHERE m."memberId" = ${memberId}
        AND (lv."dataSource" = 'voteview_v1' OR lv.id = ANY(${keyed}::text[]))
    ) AS ok`;
  return rows[0]?.ok === true;
});
