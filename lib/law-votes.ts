import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { serializeLawVote, sortLawVotes, type LawVote } from "@/lib/law-votes-shared";

/** Upper bound per law; the largest today has 75 linked votes. */
export const LAW_VOTES_LIMIT = 300;

/** Roll-call vote claims linked to this law by VOTE_ON (indexed on
 *  [toClaimId, relationType]). Only called for congress_v1 law claims. */
export const getLawVotes = cache(async (lawClaimId: string): Promise<LawVote[]> => {
  const rows = await prisma.claimRelation.findMany({
    where: { toClaimId: lawClaimId, relationType: "VOTE_ON", fromClaim: { deleted: false } },
    select: {
      followUpContext: true,
      fromClaim: { select: { id: true, text: true, claimEmergedAt: true, metadata: true } },
    },
    take: LAW_VOTES_LIMIT,
  });
  return sortLawVotes(rows.map(serializeLawVote));
});
