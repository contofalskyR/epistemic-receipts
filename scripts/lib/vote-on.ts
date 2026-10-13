// Phase 7 Q6 (owner decision 2026-10-12): a VOTE_ON ClaimRelation from each
// voteview_v1 roll-call claim to the congress_v1 law it voted on, matched on
// the exact bill number (congress + bill type + number) from Voteview's
// bill_number. Deterministic, so allowed as an algorithmic fact; marked
// autoApproved in followUpContext (ClaimRelation has no such column, and Phase 7
// makes no schema change). Pure rules only; scripts/link-votes-to-laws.ts does the I/O.

export const RELATION_TYPE = "VOTE_ON";
export const BATCH_ID = "p7-vote-on-2026-10";
export const SCRIPT = "scripts/link-votes-to-laws.ts";

/** Voteview bill prefixes that can become a public law → congress_v1 bill type.
 *  Resolutions (HRES, SRES, concurrent), nominations (PN) and treaties never do. */
const LAW_TYPES: Record<string, string> = {
  HR: "hr",
  S: "s",
  HJR: "hjres",
  HJRE: "hjres",
  HJRES: "hjres",
  SJR: "sjres",
  SJRE: "sjres",
  SJRES: "sjres",
};

/** congress_v1 externalId for a Voteview bill_number, or null when it cannot be a law. */
export function lawExternalId(congress: number, billNumber: string): string | null {
  const m = /^([A-Z]+)0*(\d+)$/.exec(billNumber.trim().toUpperCase());
  if (!m || !LAW_TYPES[m[1]]) return null;
  return `congress_law_${congress}_${LAW_TYPES[m[1]]}_${parseInt(m[2], 10)}`;
}

export type VoteSide = { claimId: string; deleted: boolean; congress: number; chamber: "h" | "s"; roll: number; date: string; billNumber: string };
export type LawSide = { claimId: string; externalId: string; deleted: boolean; enactedDate: string | null };

export type LinkContext = {
  batch: string;
  autoApproved: true;
  humanReviewed: false;
  method: "exact bill number (congress + bill type + number)";
  evidence: { source: "Voteview HSall_rollcalls.csv"; url: string; retrieved: string; bill_number: string };
  by: string;
};

export type LinkPlan =
  | { ok: true; fromClaimId: string; toClaimId: string; year: number; context: LinkContext }
  | { ok: false; skip: string };

export function voteviewUrl(congress: number, chamber: "h" | "s", roll: number): string {
  return `https://voteview.com/rollcall/R${chamber.toUpperCase()}${String(congress).padStart(3, "0")}${String(roll).padStart(4, "0")}`;
}

/** Every guard must hold, or the pair is skipped and counted, never forced.
 *  `existing` is the relation type already joining the two claims, if any. */
export function planLink(v: VoteSide, law: LawSide | undefined, existing: string | undefined, retrieved: string): LinkPlan {
  const skip = (why: string): LinkPlan => ({ ok: false, skip: why });
  if (!v.billNumber.trim()) return skip("no bill_number");
  const ext = lawExternalId(v.congress, v.billNumber);
  if (!ext) return skip("bill type that cannot become law");
  if (!law) return skip(v.congress < 97 ? "no congress_v1 law (before the 97th Congress)" : "no congress_v1 law with this number");
  if (law.externalId !== ext) return skip("law lookup mismatch");
  if (v.deleted) return skip("vote claim deleted");
  if (law.deleted) return skip("law claim deleted");
  if (existing === RELATION_TYPE) return skip("already linked");
  if (existing) return skip(`already related (${existing})`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return skip("vote date missing");
  if (law.enactedDate && v.date > law.enactedDate) return skip("vote dated after the law's enactment");
  return {
    ok: true,
    fromClaimId: v.claimId,
    toClaimId: law.claimId,
    year: parseInt(v.date.slice(0, 4), 10),
    context: {
      batch: BATCH_ID,
      autoApproved: true,
      humanReviewed: false,
      method: "exact bill number (congress + bill type + number)",
      evidence: {
        source: "Voteview HSall_rollcalls.csv",
        url: voteviewUrl(v.congress, v.chamber, v.roll),
        retrieved,
        bill_number: v.billNumber.trim(),
      },
      by: SCRIPT,
    },
  };
}
