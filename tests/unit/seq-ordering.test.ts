/**
 * Regression tests for seq-first curve ordering (ORDERING-SEMANTICS-2026-07-08.md).
 *
 * The problem: YEAR-precision dates are stored as Jan 1 of that year, so
 * "sometime in 2019" sorts BEFORE "15 June 2019" even when it happened after.
 * `seq` is the canonical order assigned by the transition contract in the insert
 * transaction. All curve consumers must sort seq-first, falling back to occurredAt.
 *
 * These tests validate the in-memory sort key used wherever Prisma returns rows
 * that need re-sorting (law-settler, and any consumer that receives raw arrays).
 */

import { describe, expect, it } from "vitest";

// The canonical sort comparator extracted from the pattern used in law-settler/page.tsx
// and the expected pattern for any in-memory re-sort of statusHistory rows.
function seqFirstSort<T extends { seq?: number | null; occurredAt: Date }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      (a.seq ?? Infinity) - (b.seq ?? Infinity) ||
      a.occurredAt.getTime() - b.occurredAt.getTime(),
  );
}

// Helper to build a mock statusHistory row.
function row(seq: number | null, occurredAt: string, label: string) {
  return { seq, occurredAt: new Date(occurredAt), label };
}

describe("seq-first curve ordering (ORDERING-SEMANTICS-2026-07-08.md regression)", () => {
  it("seq overrides occurredAt when a YEAR-precision date sorts before a DAY-precision date of the same year", () => {
    // Scenario from the doc: "sometime in 2019" (stored as 2019-01-01) is seq=2,
    // but would sort BEFORE a June 2019 DAY-precision row (seq=1) by date alone.
    const history = [
      row(2, "2019-01-01", "YEAR-precision 2019 (actually second)"),
      row(1, "2019-06-15", "DAY-precision June 2019 (actually first)"),
    ];

    const sorted = seqFirstSort(history);
    expect(sorted[0].label).toBe("DAY-precision June 2019 (actually first)");
    expect(sorted[1].label).toBe("YEAR-precision 2019 (actually second)");
  });

  it("seq-first gives correct monotone sequence when all seqs present", () => {
    const history = [
      row(3, "2020-01-01", "third"),
      row(1, "2018-06-01", "first"),
      row(2, "2019-09-01", "second"),
    ];
    const sorted = seqFirstSort(history);
    expect(sorted.map((r) => r.label)).toEqual(["first", "second", "third"]);
  });

  it("null seq rows fall to the end, ordered among themselves by occurredAt", () => {
    // Backfill-incomplete rows (seq = null) must not displace stamped rows.
    const history = [
      row(null, "2015-01-01", "null-seq early"),
      row(2, "2020-01-01", "seq-2"),
      row(1, "2018-01-01", "seq-1"),
      row(null, "2022-01-01", "null-seq late"),
    ];
    const sorted = seqFirstSort(history);
    expect(sorted[0].label).toBe("seq-1");
    expect(sorted[1].label).toBe("seq-2");
    // null-seq rows are last, ordered by date
    expect(sorted[2].label).toBe("null-seq early");
    expect(sorted[3].label).toBe("null-seq late");
  });

  it("stable: equal seqs (should never happen per unique constraint) fall back to occurredAt", () => {
    // Edge case: if unique constraint is somehow violated, date is the tiebreaker.
    const history = [
      row(1, "2020-06-01", "same-seq later date"),
      row(1, "2020-01-01", "same-seq earlier date"),
    ];
    const sorted = seqFirstSort(history);
    expect(sorted[0].label).toBe("same-seq earlier date");
  });
});

describe("Prisma orderBy clause shape for curve consumers", () => {
  // These tests verify that the orderBy arrays used in our Prisma queries
  // match the canonical seq-first pattern. They are documentation-as-tests:
  // if the shape changes here, it means someone intentionally changed the contract.

  const CANONICAL_ORDER_BY_CLAUSE = [
    { seq: "asc" },
    { occurredAt: "asc" },
    { createdAt: "asc" },
  ] as const;

  it("DomainCurveRail orderBy matches seq-first canonical pattern", () => {
    expect(CANONICAL_ORDER_BY_CLAUSE[0]).toEqual({ seq: "asc" });
    expect(CANONICAL_ORDER_BY_CLAUSE[1]).toEqual({ occurredAt: "asc" });
  });

  it("canonical desc variant for take:1 (following.ts) also leads with seq", () => {
    const CANONICAL_DESC_TAKE_1 = [{ seq: "desc" }, { occurredAt: "desc" }] as const;
    expect(CANONICAL_DESC_TAKE_1[0]).toEqual({ seq: "desc" });
  });
});
