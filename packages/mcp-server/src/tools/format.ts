/**
 * Token-respectful formatting helpers.
 * All tool responses end with a citation field and the attribution line.
 */

export const ATTRIBUTION =
  "Source: Epistemic Receipts (epistemic-receipts.vercel.app) — provenance grades measure documentation depth, not truth.";

export const CLAIM_BASE_URL = "https://epistemic-receipts.vercel.app/claims";

export function claimUrl(id: string): string {
  return `${CLAIM_BASE_URL}/${id}`;
}

export function formatAxis(axis: string | null): string {
  if (!axis) return "unknown";
  const labels: Record<string, string> = {
    SETTLED: "Settled (broad consensus)",
    CONTESTED: "Contested (active debate)",
    RECORDED: "Recorded (documented occurrence)",
    OPEN: "Open (insufficient evidence)",
    UNRESOLVABLE: "Unresolvable (inherently contested)",
    ABANDONED: "Abandoned / deprecated",
  };
  return labels[axis] ?? axis;
}

export function formatGrade(grade: string): string {
  const labels: Record<string, string> = {
    A: "A — Human-reviewed, ≥2 primary sources",
    B: "B — Verified pipeline, ≥1 primary source",
    C: "C — Auto-approved / bulk-ingested",
    D: "D — Provisional",
    X: "X — Deprecated / abandoned",
  };
  return labels[grade] ?? grade;
}

/** Cap a list at maxItems, appending a note when truncated. */
export function capped<T>(items: T[], maxItems: number): { items: T[]; note: string | null } {
  if (items.length <= maxItems) return { items, note: null };
  return {
    items: items.slice(0, maxItems),
    note: `(${items.length - maxItems} more not shown — use the API for full results)`,
  };
}
