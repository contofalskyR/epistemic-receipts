// Restore the full Voteview description in voteview_v1 claim texts
// (LATER §1, owner request 2026-10-13). scripts/ingest-voteview-claims.ts cut
// the quoted description to 77 characters + "..."; everything else in the text
// (chamber, tally, Congress, roll call, date, the — possibly corrected —
// result) stays exactly as stored. Pure rules only;
// scripts/restore-voteview-full-text.ts does the I/O.

export const BATCH_ID = "voteview-full-text-2026-10";
export const SCRIPT = "scripts/restore-voteview-full-text.ts";

/** `The U.S. <chamber> voted <y>-<n> on "<desc>" (Congress …, Roll Call …, YYYY-MM-DD) — <result>.` */
const TEXT_RE =
  /^(The U\.S\. (?:Senate|House of Representatives) voted \d+-\d+ on ")(.*)(" \(Congress \d+, Roll Call \d+, \d{4}-\d{2}-\d{2}\) — (?:passed|failed|tied|unknown)\.)$/s;

/** Voteview's description, as the importer chose it, with whitespace runs collapsed. */
export function fullDescription(r: { dtl_desc?: string; vote_desc?: string; vote_question?: string }): string {
  const raw = (r.dtl_desc || "").trim() || (r.vote_desc || "").trim() || (r.vote_question || "").trim();
  return raw.replace(/\s+/g, " ").trim();
}

const collapse = (s: string) => s.replace(/\s+/g, " ");

export type TextPlan =
  | { ok: true; text: string; before: string }
  | { ok: false; skip: string };

export function planFullText(stored: string, full: string): TextPlan {
  const m = TEXT_RE.exec(stored);
  if (!m) return { ok: false, skip: "text does not have the importer's shape" };
  const quoted = m[2];
  if (!quoted.endsWith("...")) return { ok: false, skip: "description not truncated" };
  const prefix = collapse(quoted.slice(0, -3));
  if (!full) return { ok: false, skip: "Voteview has no description" };
  if (!full.startsWith(prefix.trimEnd())) return { ok: false, skip: "stored prefix does not match Voteview's description" };
  if (full.length <= prefix.trimEnd().length) return { ok: false, skip: "Voteview's description is no longer" };
  return { ok: true, text: `${m[1]}${full}${m[3]}`, before: stored };
}

export function textCorrection(before: string, url: string, retrieved: string, date: string) {
  return {
    batch: BATCH_ID,
    date,
    field: "text" as const,
    reason: "full Voteview description restored (the import cut it to 80 characters)",
    before: { text: before },
    evidence: { source: "Voteview HSall_rollcalls.csv", url, retrieved },
    by: SCRIPT,
  };
}
