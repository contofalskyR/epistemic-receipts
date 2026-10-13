// Phase 7 batch 1: Senate cloture votes since 1989 that voteview_v1 labels
// "passed" or "tied" although Voteview's own vote_result says the cloture
// motion was rejected (scripts/ingest-voteview.ts inferred results as
// yea > nay). Pure rules only; scripts/correct-senate-cloture.ts does the I/O.
//
// Owner decision 2026-10-12: the correction lives in Claim.metadata
// (before, after, Voteview evidence, date) plus one /corrections entry.
// No ClaimStatusHistory rows, no schema change. Pre-1989 votes (no
// vote_result) and every non-cloture mismatch are out of scope.

export const BATCH_ID = "p7-senate-cloture-2026-10";
export const SCRIPT = "scripts/correct-senate-cloture.ts";

export type VoteviewRow = {
  congress: string;
  chamber: string;
  rollnumber: string;
  date: string;
  yea_count: string;
  nay_count: string;
  vote_result: string;
  majority_requirement: string;
};

export type StoredVote = {
  claimId: string;
  claimText: string;
  claimDeleted: boolean;
  metaResult: string | null;
  metaVoteId: string | null;
  voteId: string;
  voteResult: string | null;
  yesCount: number | null;
  noCount: number | null;
};

export type Correction = {
  batch: string;
  date: string;
  field: "result";
  before: { result: string; text: string };
  after: { result: "failed"; text: string };
  evidence: {
    source: "Voteview HSall_rollcalls.csv";
    url: string;
    retrieved: string;
    vote_result: string;
    majority_requirement: string;
    yea: number;
    nay: number;
  };
  by: string;
};

export type Plan =
  | { ok: true; claimId: string; voteId: string; text: string; threshold: string; correction: Correction }
  | { ok: false; claimId: string; skip: string };

/** Voteview says the Senate rejected a cloture motion (any cloture form). */
export function isRejectedCloture(r: Pick<VoteviewRow, "chamber" | "vote_result">): boolean {
  return r.chamber === "Senate" && /cloture/i.test(r.vote_result) && r.vote_result.trim().endsWith("Rejected");
}

/** LegislativeVote.passageThreshold from Voteview's majority_requirement. */
export function thresholdFor(req: string): string | null {
  return ({ "1/2": "simple_majority", "3/5": "three_fifths", "2/3": "two_thirds" } as Record<string, string>)[req.trim()] ?? null;
}

export function voteviewUrl(congress: number, roll: number): string {
  return `https://voteview.com/rollcall/RS${String(congress).padStart(3, "0")}${String(roll).padStart(4, "0")}`;
}

export function sourceExternalId(r: Pick<VoteviewRow, "congress" | "rollnumber">): string {
  return `voteview_source_${parseInt(r.congress, 10)}_s_${parseInt(r.rollnumber, 10)}`;
}

/** Claim text with its trailing " — passed." / " — tied." replaced, or null. */
export function correctedText(text: string, stored: string): string | null {
  const suffix = ` — ${stored}.`;
  return text.endsWith(suffix) ? `${text.slice(0, -suffix.length)} — failed.` : null;
}

/** Every guard must hold, or the row is skipped and reported, never forced. */
export function planCorrection(v: VoteviewRow, s: StoredVote, date: string, retrieved: string): Plan {
  const skip = (why: string): Plan => ({ ok: false, claimId: s.claimId, skip: why });
  if (!isRejectedCloture(v)) return skip("Voteview does not say cloture was rejected");
  if (s.claimDeleted) return skip("claim is deleted");
  if (s.metaVoteId !== s.voteId) return skip("metadata.legislativeVoteId does not match the vote");
  const stored = s.voteResult;
  if (stored !== "passed" && stored !== "tied") return skip(`stored result is ${stored ?? "null"}, not passed/tied`);
  if (s.metaResult !== stored) return skip("metadata.result differs from LegislativeVote.result");
  const yea = parseInt(v.yea_count, 10);
  const nay = parseInt(v.nay_count, 10);
  if (s.yesCount !== yea || s.noCount !== nay) return skip("tally differs from Voteview");
  const threshold = thresholdFor(v.majority_requirement);
  if (!threshold) return skip(`unknown majority_requirement "${v.majority_requirement}"`);
  if (threshold === "three_fifths" && yea >= 60) return skip("3/5 vote with 60+ yeas");
  const text = correctedText(s.claimText, stored);
  if (!text) return skip(`claim text does not end with " — ${stored}."`);
  const congress = parseInt(v.congress, 10);
  const roll = parseInt(v.rollnumber, 10);
  return {
    ok: true,
    claimId: s.claimId,
    voteId: s.voteId,
    text,
    threshold,
    correction: {
      batch: BATCH_ID,
      date,
      field: "result",
      before: { result: stored, text: s.claimText },
      after: { result: "failed", text },
      evidence: {
        source: "Voteview HSall_rollcalls.csv",
        url: voteviewUrl(congress, roll),
        retrieved,
        vote_result: v.vote_result.trim(),
        majority_requirement: v.majority_requirement.trim(),
        yea,
        nay,
      },
      by: SCRIPT,
    },
  };
}
