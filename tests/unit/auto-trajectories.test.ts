import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// The auto-generated half of /api/trajectories (lib/trajectory-list.ts). It
// used to filter `statusHistory.length >= minMilestones` after `take: 5000`;
// the newest 5,000 claims with history each had one transition, so the list
// was always empty (STATUS.md Phase 5, "Found on the way"). The count filter
// now runs in SQL — these tests pin that, the order and the chunking.

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { AUTO_LIMIT, autoTrajectoryIdsSql, getAutoTrajectories } from "@/lib/trajectory-list";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mp = prisma as any;

type Hist = { community: string; toAxis: string; occurredAt: Date };
const hist = (n: number): Hist[] =>
  Array.from({ length: n }, (_, i) => ({
    community: "INSTITUTIONAL",
    toAxis: i === n - 1 ? "SETTLED" : "OPEN",
    occurredAt: new Date(Date.UTC(1990 + i, 0, 1)),
  }));
const row = (id: string, transitions: number) => ({
  id,
  externalId: null,
  text: `claim ${id}`,
  claimEmergedAt: new Date(Date.UTC(1990, 0, 1)),
  ingestedBy: "voteview_v1",
  statusHistory: hist(transitions),
});

describe("autoTrajectoryIdsSql", () => {
  const q = autoTrajectoryIdsSql(2, AUTO_LIMIT);

  it("filters the transition count in SQL, before the LIMIT, with bind parameters", () => {
    expect(q.values).toEqual([2, AUTO_LIMIT]);
    expect(q.text).toMatch(/HAVING COUNT\(\*\) >= \$1/);
    expect(q.text).toMatch(/LIMIT \$2\s*$/);
    expect(q.text.indexOf("HAVING")).toBeLessThan(q.text.indexOf("LIMIT"));
    expect(q.text).not.toMatch(/\b5000\b/);
  });

  it("keeps the default-view filter, excludes curated rows and orders deterministically", () => {
    expect(q.text).toContain(`c.deleted = false AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'`);
    expect(q.text).toContain(`c."externalId" NOT LIKE 'trajectory:%'`);
    expect(q.text).toMatch(/ORDER BY c\."createdAt" DESC, c\.id DESC/);
  });
});

describe("getAutoTrajectories", () => {
  beforeEach(() => {
    mp.$queryRaw = vi.fn();
    mp.claim.findMany = vi.fn();
  });

  it("returns the SQL order, every card with at least minMilestones transitions", async () => {
    mp.$queryRaw.mockResolvedValue([{ id: "c3" }, { id: "c1" }, { id: "c2" }]);
    // findMany order is arbitrary; c2 lost a transition since the id list was cached
    mp.claim.findMany.mockResolvedValue([row("c1", 3), row("c2", 1), row("c3", 2)]);

    const list = await getAutoTrajectories(AUTO_LIMIT, 2);

    expect(list.map((t) => t.claimId)).toEqual(["c3", "c1"]);
    expect(list.every((t) => t.transitionCount >= 2 && t.milestones.length >= 2 && !t.isCurated)).toBe(true);
  });

  it("caches only full chunks of the full list and slices to limit afterwards", async () => {
    const ids = Array.from({ length: 2500 }, (_, i) => `id${i}`);
    mp.$queryRaw.mockResolvedValue(ids.map((id) => ({ id })));
    mp.claim.findMany.mockImplementation(async ({ where }: { where: { AND: [unknown, { id: { in: string[] } }] } }) =>
      where.AND[1].id.in.map((id) => row(id, 2)),
    );

    const list = await getAutoTrajectories(1500, 2);

    expect(list).toHaveLength(1500);
    expect(list[0].claimId).toBe("id0");
    expect(list[1499].claimId).toBe("id1499");
    const chunkSizes = mp.claim.findMany.mock.calls.map((c: [{ where: { AND: [unknown, { id: { in: string[] } }] } }]) => c[0].where.AND[1].id.in.length);
    expect(chunkSizes).toEqual([1000, 1000]);
  });

  it("falls back to minMilestones=2 on NaN and caps the cache key, not the result", async () => {
    mp.$queryRaw.mockResolvedValue([{ id: "a" }]);
    mp.claim.findMany.mockResolvedValue([row("a", 12)]);

    await getAutoTrajectories(NaN, NaN);
    expect(mp.$queryRaw.mock.calls[0][0].values).toEqual([2, AUTO_LIMIT]);

    const strict = await getAutoTrajectories(AUTO_LIMIT, 50);
    expect(mp.$queryRaw.mock.calls[1][0].values).toEqual([10, AUTO_LIMIT]);
    expect(strict).toEqual([]);
  });
});
