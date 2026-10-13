// Phase 7 Q7 (owner decisions 2026-10-12). Pure rules only;
// scripts/dedupe-congress-votes.ts does the I/O.
//
// (a) Retire each congress_votes_v1 vote claim that has exactly one voteview_v1
//     twin: same Congress, chamber, date and official (clerk) roll number in
//     Voteview's HSall_rollcalls.csv, with the same tally and bill number.
//     deleted = true, metadata.duplicateOf = the twin, metadata.retired = why.
// (b) Carry the retired claim's official senate.gov / clerk.house.gov roll-call
//     Source onto the twin as a second FOR edge. Topic tags, locations and
//     PASSED_DURING relations stay behind.
// (c) ENACTED_AS from each congress_bills_tracker_v1 bill to the congress_v1 law
//     with the same Congress, bill type and number.

import { lawExternalId } from "./vote-on";

export const BATCH_ID = "p7-congress-dedup-2026-10";
export const SCRIPT = "scripts/dedupe-congress-votes.ts";
export const EDGE_INGESTED_BY = "p7_congress_dedup";
export const ENACTED_AS = "ENACTED_AS";
export const MATCH_METHOD = "date + official roll number + tally + bill number (Voteview HSall_rollcalls.csv)";
export const EDGE_SCORE = 95;
export const EDGE_REASON =
  "Official roll-call record, carried over from the retired congress_votes_v1 duplicate of this vote (Phase 7 Q7)";

export type CvClaim = {
  id: string;
  externalId: string;
  deleted: boolean;
  meta: {
    congress: number;
    chamber: string;
    voteDate: string;
    rollNumber: number;
    yea: number;
    nay: number;
    billType: string;
    billNumber: string;
    rollUrl?: string;
  };
  /** Live edges from this claim's sources: [sourceId, url]. */
  edges: { sourceId: string; url: string | null }[];
};

export type VoteviewCandidate = {
  claimId: string;
  deleted: boolean;
  yea: number;
  nay: number;
  billNumber: string;
  /** Live edges into this claim, by source id. */
  sourceIds: string[];
};

/** Key into Voteview rows by Congress, chamber, date and official roll number. */
export function clerkKey(congress: number, chamber: "House" | "Senate", date: string, clerkRoll: number): string {
  return `${congress}|${chamber}|${date}|${clerkRoll}`;
}

export function cvChamber(chamber: string): "House" | "Senate" {
  return /^s/i.test(chamber) ? "Senate" : "House";
}

export type RetirePlan =
  | {
      ok: true;
      cvClaimId: string;
      survivorId: string;
      rollSourceId: string;
      addEdge: boolean;
      retired: { batch: string; date: string; reason: string; survivor: string; match: string; by: string };
    }
  | { ok: false; cvClaimId: string; skip: string };

export function planRetire(cv: CvClaim, candidates: VoteviewCandidate[], date: string): RetirePlan {
  const skip = (why: string): RetirePlan => ({ ok: false, cvClaimId: cv.id, skip: why });
  if (cv.deleted) return skip("already deleted");
  const m = cv.meta;
  if (candidates.length === 0) return skip("no Voteview row with this date and official roll number");
  if (candidates.length > 1) return skip("several Voteview rows share this date and official roll number");
  const v = candidates[0];
  if (v.yea !== m.yea || v.nay !== m.nay) return skip(`tally differs (official ${m.yea}–${m.nay}, Voteview ${v.yea}–${v.nay})`);
  const want = `congress_law_${m.congress}_${m.billType.toLowerCase()}_${parseInt(m.billNumber, 10)}`;
  if (lawExternalId(m.congress, v.billNumber) !== want) return skip(`bill number differs (Voteview "${v.billNumber}")`);
  if (v.deleted) return skip("Voteview twin is deleted");
  if (!m.rollUrl) return skip("no official roll URL in metadata");
  const roll = cv.edges.filter((e) => e.url === m.rollUrl);
  if (roll.length !== 1) return skip(`expected one live edge to the official roll source, found ${roll.length}`);
  return {
    ok: true,
    cvClaimId: cv.id,
    survivorId: v.claimId,
    rollSourceId: roll[0].sourceId,
    addEdge: !v.sourceIds.includes(roll[0].sourceId),
    retired: {
      batch: BATCH_ID,
      date,
      reason: "duplicate of the voteview_v1 roll-call claim for the same vote",
      survivor: v.claimId,
      match: MATCH_METHOD,
      by: SCRIPT,
    },
  };
}

/** congress_bill_tracker_<c>_<type>_<n> → congress_law_<c>_<type>_<n>, or null. */
export function trackerToLawExternalId(trackerExternalId: string): string | null {
  const m = /^congress_bill_tracker_(\d+)_(hr|s|hjres|sjres)_(\d+)$/.exec(trackerExternalId);
  return m ? `congress_law_${m[1]}_${m[2]}_${m[3]}` : null;
}

export function enactedAsContext(trackerExternalId: string, lawExternalId: string) {
  return {
    batch: BATCH_ID,
    autoApproved: true as const,
    humanReviewed: false as const,
    method: "exact bill number (congress + bill type + number)",
    evidence: { source: "congress_bills_tracker_v1 + congress_v1 externalIds", tracker: trackerExternalId, law: lawExternalId },
    by: SCRIPT,
  };
}
