// Landmark roll-call subset helpers (B11).
//
// The subset definition lives in data/landmark-rollcalls.json (1,500 entries:
// 713 named landmarks + 787 <0.5%-margin close calls). Member-level stats on
// /members pages are scoped to exactly this set — never extrapolated to the
// full voteview corpus. Bill families come from data/landmark-bill-families.json
// (exact Voteview bill_number + vote_question per rollcall; entries without a
// bill number are omitted — no title/fuzzy fallback).

import landmarkRollcalls from "@/data/landmark-rollcalls.json";
import billFamilies from "@/data/landmark-bill-families.json";

type SubsetEntry = { legislativeVoteId: string };
type FamilyEntry = {
  externalId: string;
  legislativeVoteId: string;
  billNumber: string;
  voteQuestion: string;
};

// Reversal detection is deliberately strict: bill-family-only grouping flags
// opposite votes on *different amendments* to the same bill as "reversals"
// (~25 false positives per member, verified 2026-07-16), so a reversal here
// requires the identical passage-type question on the identical bill in the
// same Congress — a member who voted Yea and later Nay on the same question.
// Pre-~100th-Congress rollcalls have an empty vote_question and are excluded.
const PASSAGE_QUESTIONS = new Set([
  "On Passage",
  "On Passage of the Bill",
  "On the Joint Resolution",
  "On the Concurrent Resolution",
  "On the Resolution",
  "On Agreeing to the Resolution",
  "On the Conference Report",
  "On Agreeing to the Conference Report",
  "On Motion to Suspend the Rules and Pass",
  "On Motion to Suspend the Rules and Agree",
]);

export const LANDMARK_VOTE_IDS: string[] = (landmarkRollcalls as SubsetEntry[]).map(
  (e) => e.legislativeVoteId,
);

export const LANDMARK_SUBSET_SIZE = LANDMARK_VOTE_IDS.length;

// legislativeVoteId → reversal-family key ("congress::BILLNUMBER::question"),
// passage-type questions only.
export const REVERSAL_FAMILY_BY_VOTE_ID: ReadonlyMap<string, string> = new Map(
  (billFamilies as FamilyEntry[])
    .filter((e) => PASSAGE_QUESTIONS.has(e.voteQuestion))
    .map((e) => {
      const congress = e.externalId.split("_")[2];
      return [
        e.legislativeVoteId,
        `${congress}::${e.billNumber.toUpperCase().replace(/\s+/g, "")}::${e.voteQuestion}`,
      ];
    }),
);
