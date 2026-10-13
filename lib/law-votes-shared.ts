// Roll-call votes linked to an enacted-law claim by VOTE_ON relations
// (Phase 7 Q6, scripts/link-votes-to-laws.ts). Pure and client-safe; the
// query is in lib/law-votes.ts.

export type LawVote = {
  claimId: string;
  date: string | null;
  chamber: "House" | "Senate" | null;
  roll: number | null;
  tally: string | null;
  result: string | null;
  /** The vote's description, quoted inside the claim text, or the whole text. */
  description: string;
  autoApproved: boolean;
  humanReviewed: boolean;
};

export type LawVoteRow = {
  fromClaim: { id: string; text: string; claimEmergedAt: Date | null; metadata: unknown };
  followUpContext: unknown;
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** `The U.S. Senate voted 59-41 on "DESC" (Congress …) — failed.` → DESC. */
export function voteDescription(text: string): string {
  const m = /\bvoted (?:\d+-\d+ )?on "(.*)" \(Congress \d+/.exec(text);
  return (m?.[1] ?? text).trim();
}

export function serializeLawVote(row: LawVoteRow): LawVote {
  const meta = obj(row.fromClaim.metadata);
  const ctx = obj(row.followUpContext);
  const yes = typeof meta.yesCount === "number" ? meta.yesCount : null;
  const no = typeof meta.noCount === "number" ? meta.noCount : null;
  return {
    claimId: row.fromClaim.id,
    date: row.fromClaim.claimEmergedAt ? row.fromClaim.claimEmergedAt.toISOString().slice(0, 10) : null,
    chamber: meta.chamberCode === "s" ? "Senate" : meta.chamberCode === "h" ? "House" : null,
    roll: typeof meta.rollNumber === "number" ? meta.rollNumber : null,
    tally: yes !== null && no !== null ? `${yes}–${no}` : null,
    result: typeof meta.result === "string" ? meta.result : null,
    description: voteDescription(row.fromClaim.text),
    autoApproved: ctx.autoApproved === true,
    humanReviewed: ctx.humanReviewed === true,
  };
}

/** Oldest first; same-day votes by chamber, then roll-call number. */
export function sortLawVotes(votes: LawVote[]): LawVote[] {
  return [...votes].sort(
    (a, b) =>
      (a.date ?? "").localeCompare(b.date ?? "") ||
      (a.chamber ?? "").localeCompare(b.chamber ?? "") ||
      (a.roll ?? 0) - (b.roll ?? 0),
  );
}
