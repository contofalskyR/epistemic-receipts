// Landmark roll-call subset helpers (B11).
//
// The subset definition lives in data/landmark-rollcalls.json (1,500 entries:
// 713 named landmarks + 787 <0.5%-margin close calls). Member-level stats on
// /members pages are scoped to exactly this set — never extrapolated to the
// full voteview corpus. Bill families come from data/landmark-bill-families.json
// (exact Voteview bill_number per rollcall; entries without one are omitted —
// no title/fuzzy fallback).

import landmarkRollcalls from "@/data/landmark-rollcalls.json";
import billFamilies from "@/data/landmark-bill-families.json";

type SubsetEntry = { legislativeVoteId: string };
type FamilyEntry = { externalId: string; legislativeVoteId: string; billNumber: string };

export const LANDMARK_VOTE_IDS: string[] = (landmarkRollcalls as SubsetEntry[]).map(
  (e) => e.legislativeVoteId,
);

export const LANDMARK_SUBSET_SIZE = LANDMARK_VOTE_IDS.length;

// legislativeVoteId → family key ("congress::BILLNUMBER"). Same congress + same
// exact bill number = same bill family.
export const BILL_FAMILY_BY_VOTE_ID: ReadonlyMap<string, string> = new Map(
  (billFamilies as FamilyEntry[]).map((e) => {
    const congress = e.externalId.split("_")[2];
    return [
      e.legislativeVoteId,
      `${congress}::${e.billNumber.toUpperCase().replace(/\s+/g, "")}`,
    ];
  }),
);
