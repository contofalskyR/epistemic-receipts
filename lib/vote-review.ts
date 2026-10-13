// Which voteview_v1 vote results are known to disagree with Voteview's own
// record (Phase 7 census 2026-10-12; LATER §1 "Vote results still wrong").
// The public vote page shows "Result under review" for exactly these votes
// (owner decision 2026-10-13); scripts/build-vote-review-list.ts writes the
// list to data/vote-results-under-review.json. Each group is fixed later in
// its own batch under its own rule. Pure and client-safe (lib/us-votes.ts and
// the build script both use it).

export type ReviewGroup =
  | "house-suspension"
  | "senate-three-fifths"
  | "senate-two-thirds"
  | "senate-tie"
  | "house-tie"
  | "contradiction";

export const REVIEW_GROUP_LABEL: Record<ReviewGroup, string> = {
  "house-suspension": "House motion to suspend the rules, which needs two-thirds",
  "senate-three-fifths": "Senate vote needing three-fifths, other than cloture",
  "senate-two-thirds": "Senate vote needing two-thirds",
  "senate-tie": "Senate tie, decided by the Vice President or failing",
  "house-tie": "House tie",
  "contradiction": "Voteview's result contradicts the tally or the description",
};

/** Why the stored result may be wrong, as the vote page's "Result under review" note says it. */
export const REVIEW_GROUP_REASON: Record<ReviewGroup, string> = {
  "house-suspension":
    "it was computed as more yeas than nays, but a motion to suspend the rules needs two-thirds, and Voteview records a different outcome",
  "senate-three-fifths":
    "it was computed as more yeas than nays, but this vote needed three-fifths, and Voteview records a different outcome",
  "senate-two-thirds":
    "it was computed as more yeas than nays, but this vote needed two-thirds, and Voteview records a different outcome",
  "senate-tie": "the tally is tied, and Voteview records how the tie was resolved differently",
  "house-tie": "the tally is tied, and Voteview records a different outcome",
  contradiction: "Voteview's recorded outcome contradicts the tally or the description, so it needs checking against the official record",
};

/** Voteview vote_result → whether the question carried, or null when it is not a pass/fail outcome. */
export function voteviewOutcome(voteResult: string): "passed" | "failed" | "election" | null {
  const v = voteResult.trim();
  if (!v) return null;
  if (v === "Passed" || v === "Agreed to") return "passed";
  if (v === "Failed" || v === "Veto Sustained") return "failed";
  if (v === "Veto Overridden") return "passed";
  for (const neg of ["Not Sustained", "Not Guilty", "Not Germane", "Not Well Taken", "Rejected", "Defeated", "Failed"])
    if (v.endsWith(neg)) return "failed";
  for (const pos of ["Agreed to", "Passed", "Confirmed", "Overridden", "Guilty", "Germane", "Well Taken", "Sustained"])
    if (v.endsWith(pos)) return "passed";
  if (/^[A-Z][A-Za-z'-]+( \([A-Z]{2}\))?$/.test(v)) return "election"; // Speaker elections
  return null;
}

export type VoteviewRow = {
  congress: string;
  chamber: string;
  vote_result: string;
  majority_requirement: string;
  vote_desc?: string;
  vote_question?: string;
  dtl_desc?: string;
};

/** The review group for a stored result, or null when it is not known to be wrong. */
export function reviewGroup(r: VoteviewRow, stored: string | null): ReviewGroup | null {
  const senate = r.chamber === "Senate";
  // Before 1989 Voteview records no vote_result; the 122 pre-1989 cloture
  // candidates wait for the senate.gov cloture table (LATER §1). Finding them by
  // description text would be a guess, so they carry no note.
  if (!r.vote_result.trim()) return null;
  const truth = voteviewOutcome(r.vote_result);
  if (truth === null || truth === "election" || stored === truth) return null;
  const req = r.majority_requirement.trim();
  if (stored === "tied") return senate ? "senate-tie" : "house-tie";
  if (stored === "failed" && truth === "passed") return "contradiction"; // the yeas lost, yet Voteview says it carried
  if (!senate) return req === "2/3" ? "house-suspension" : "contradiction";
  if (/cloture/i.test(r.vote_result)) return "contradiction"; // batch 1 fixed every rejected cloture
  if (req === "3/5") return "senate-three-fifths";
  if (req === "2/3") return "senate-two-thirds";
  return "contradiction";
}

/** Link label for a vote's primary source, from its URL. */
export function sourceLabel(url: string | null): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (host === "voteview.com") return "Voteview";
  if (host === "senate.gov") return "Senate roll call";
  if (host === "clerk.house.gov") return "House Clerk roll call";
  if (host === "congress.gov") return "Congress.gov";
  return host;
}
