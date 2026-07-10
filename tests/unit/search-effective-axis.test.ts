/**
 * Regression guard for axis leak-site #4 (lib/search.ts).
 *
 * Claim.epistemicAxis is stale for reversed/abandoned claims; the search path
 * must filter and display on the EFFECTIVE (terminal-transition) axis instead.
 * Without these assertions the leak silently returns on the next refactor.
 *
 * (a) query builders emit effectiveAxisCondition + terminalAxisLateralJoin when
 *     an axis filter is present.
 * (b) formatRow resolves a terminal REVERSED/ABANDONED row to that axis, not the
 *     stale stored column.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// lib/search.ts imports embeddings at module load; mock so the pure builders
// and formatRow can be tested without a DB connection or OpenAI key.
vi.mock("@/lib/embeddings", () => ({
  embedText3Small: vi.fn().mockResolvedValue(new Array(1536).fill(0)),
}));

import { prisma } from "@/lib/prisma";
import {
  buildTsvectorSql,
  buildVectorSql,
  countClaimsTs,
  formatRow,
  type ClaimRow,
} from "@/lib/search";

const LATERAL_JOIN_RE = /LEFT JOIN LATERAL[\s\S]*?"toAxis" AS term/;
// The effectiveAxisCondition signature. If a refactor reverts to the bare
// `c."epistemicAxis" = $n` filter, this marker vanishes — that's the regression
// guard. (The raw column comparison DOES still appear, correctly, inside the
// non-reversal OR branch of the condition, so we assert on this marker instead.)
const EFFECTIVE_COND_RE = /IN \('REVERSED', 'ABANDONED'\)/;
const TERMINAL_SELECT_RE = /term\."term" AS "terminalAxis"/;

describe("axis leak-site #4 — query builders", () => {
  it("buildTsvectorSql emits effectiveAxisCondition + lateral join when axis is set", () => {
    const { sql } = buildTsvectorSql("q", { axis: "REVERSED" }, 25, 0);
    expect(sql).toMatch(LATERAL_JOIN_RE);
    expect(sql).toMatch(EFFECTIVE_COND_RE);
    expect(sql).toMatch(TERMINAL_SELECT_RE);
  });

  it("buildTsvectorSql still exposes terminalAxis (for display) but no axis condition when unfiltered", () => {
    const { sql } = buildTsvectorSql("q", {}, 25, 0);
    expect(sql).toMatch(LATERAL_JOIN_RE);       // needed to resolve the display axis
    expect(sql).toMatch(TERMINAL_SELECT_RE);
    expect(sql).not.toMatch(EFFECTIVE_COND_RE); // no filter → no condition
  });

  it("buildVectorSql emits effectiveAxisCondition + lateral join when axis is set", () => {
    const { sql } = buildVectorSql("[0.1,0.2]", { axis: "ABANDONED" }, 25, 0);
    expect(sql).toMatch(LATERAL_JOIN_RE);
    expect(sql).toMatch(EFFECTIVE_COND_RE);
    expect(sql).toMatch(TERMINAL_SELECT_RE);
  });

  describe("countClaimsTs SQL", () => {
    let capturedSql = "";
    beforeEach(() => {
      // The global prisma mock (setup.ts) has no $queryRawUnsafe — attach one
      // that captures the SQL string the count query builds.
      (prisma as unknown as { $queryRawUnsafe: unknown }).$queryRawUnsafe = vi
        .fn()
        .mockImplementation((sql: string) => {
          capturedSql = sql;
          return Promise.resolve([{ count: 0n }]);
        });
    });

    it("emits effectiveAxisCondition + lateral join when axis is set", async () => {
      await countClaimsTs("q", { axis: "REVERSED" });
      expect(capturedSql).toMatch(LATERAL_JOIN_RE);
      expect(capturedSql).toMatch(EFFECTIVE_COND_RE);
    });

    it("omits the lateral join entirely when no axis filter is applied", async () => {
      await countClaimsTs("q", {});
      expect(capturedSql).not.toMatch(LATERAL_JOIN_RE);
      expect(capturedSql).not.toMatch(EFFECTIVE_COND_RE);
    });
  });
});

describe("axis leak-site #4 — formatRow display resolution", () => {
  const base: ClaimRow = {
    id: "clm_1",
    text: "t",
    currentStatus: "RECORDED",
    epistemicAxis: "CONTESTED", // stale stored axis
    claimType: "EMPIRICAL",
    ingestedBy: "openalex_v1",
    verificationStatus: "VERIFIED",
    epistemicStatus: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    claimEmergedAt: null,
    claimEmergedPrecision: null,
    externalId: null,
    sourceName: null,
    topicLabel: null,
    terminalAxis: null,
    rank: 0.5,
  };

  it("returns REVERSED when the terminal transition is REVERSED (not the stale CONTESTED)", () => {
    const out = formatRow({ ...base, terminalAxis: "REVERSED" }, "hybrid");
    expect(out.epistemicAxis).toBe("REVERSED");
  });

  it("returns ABANDONED when the terminal transition is ABANDONED", () => {
    const out = formatRow({ ...base, terminalAxis: "ABANDONED" }, "hybrid");
    expect(out.epistemicAxis).toBe("ABANDONED");
  });

  it("keeps the stored axis when there is no terminal transition", () => {
    const out = formatRow({ ...base, terminalAxis: null }, "hybrid");
    expect(out.epistemicAxis).toBe("CONTESTED");
  });

  it("keeps the stored axis when the terminal transition is non-reversal", () => {
    const out = formatRow({ ...base, epistemicAxis: "SETTLED", terminalAxis: "SETTLED" }, "hybrid");
    expect(out.epistemicAxis).toBe("SETTLED");
  });
});
