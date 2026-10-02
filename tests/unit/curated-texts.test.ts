import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Front door phase 6 (2026-10-01): /trajectories searched the list cards'
// 160-char claim, so words further into 5,524 of 5,698 curated texts were
// unsearchable. /api/history's curated lens now carries the full text from
// getCuratedTexts() (lib/trajectory-list.ts), cached in 1,000-row chunks.

// unstable_cache stand-in that behaves like a Data Cache HIT: the cached
// callback's result goes through JSON (unstable-cache.js stores
// JSON.stringify(result) and returns JSON.parse(body)). A pass-through mock
// (auto-trajectories.test.ts) would let a non-JSON value (a Map) slip by.
const cache = vi.hoisted(() => ({ calls: [] as { key: string; args: unknown[] }[] }));
vi.mock("next/cache", () => ({
  unstable_cache:
    (fn: (...a: unknown[]) => Promise<unknown>, keyParts: string[]) =>
    async (...args: unknown[]) => {
      cache.calls.push({ key: keyParts.join(","), args });
      return JSON.parse(JSON.stringify(await fn(...args)));
    },
}));

import { CURATED_WHERE, getCuratedTexts } from "@/lib/trajectory-list";
import { GET } from "@/app/api/history/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mp = prisma as any;

const N = 2500;
const slug = (i: number) => `t${String(i).padStart(4, "0")}`;
const fullText = (i: number) => `Claim ${i}: ${"lorem ipsum ".repeat(20)}tailword${i} polystyrene`; // > 160 chars
type FindArgs = { where: unknown; select: Record<string, unknown>; orderBy: unknown; skip: number; take: number };

function mockCurated(n: number) {
  mp.claim.count = vi.fn().mockResolvedValue(n);
  mp.claim.findMany = vi.fn(async ({ select, skip, take }: FindArgs) =>
    Array.from({ length: Math.max(0, Math.min(take, n - skip)) }, (_, k) => {
      const i = skip + k;
      return select.statusHistory
        ? { id: `c${i}`, externalId: `trajectory:${slug(i)}`, text: fullText(i), claimEmergedAt: new Date(Date.UTC(1900 + (i % 100), 0, 1)), ingestedBy: "curated", statusHistory: [{ community: "EXPERT_LITERATURE", toAxis: "SETTLED", occurredAt: new Date(Date.UTC(1900 + (i % 100), 0, 1)) }] }
        : { externalId: `trajectory:${slug(i)}`, text: fullText(i) };
    }),
  );
}

beforeEach(() => {
  cache.calls.length = 0;
});

describe("getCuratedTexts", () => {
  it("reads the curated texts in 1,000-row chunks, same where/order as the list, keyed by slug", async () => {
    mockCurated(N);
    const texts = await getCuratedTexts();
    const calls = mp.claim.findMany.mock.calls.map((c: [FindArgs]) => c[0]);
    expect(calls.map((c: FindArgs) => [c.skip, c.take])).toEqual([[0, 1000], [1000, 1000], [2000, 1000]]);
    for (const c of calls) {
      expect(c.where).toEqual(CURATED_WHERE);
      expect(c.orderBy).toEqual({ externalId: "asc" });
      expect(c.select).toEqual({ externalId: true, text: true }); // no statusHistory join
    }
    expect(texts).toBeInstanceOf(Map);
    expect(texts.size).toBe(N);
    expect(texts.get(slug(1999))).toBe(fullText(1999));
    expect(texts.has(`trajectory:${slug(0)}`)).toBe(false);
    // bounded key space: one entry per chunk index
    expect(cache.calls.filter((c) => c.key === "curated-trajectory-texts-chunk").map((c) => c.args)).toEqual([[0], [1], [2]]);
  });
});

describe("/api/history curated lens", () => {
  it("serves the full curated text, so search reaches words past char 157", async () => {
    mockCurated(5);
    const res = await GET(new NextRequest("http://localhost/api/history"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(5);
    for (const it of body.items) {
      const i = Number(it.id.slice(1));
      expect(it.claim).toBe(fullText(i));
      expect(it.claim.length).toBeGreaterThan(160);
      expect(it.claim.toLowerCase()).toContain("polystyrene");
    }
  });

  it("falls back to the list's 160-char claim when a slug has no text entry", async () => {
    mockCurated(3);
    const realFindMany = mp.claim.findMany;
    mp.claim.findMany = vi.fn(async (a: FindArgs) => (a.select.statusHistory ? realFindMany(a) : []));
    const body = await (await GET(new NextRequest("http://localhost/api/history"))).json();
    expect(body.items.map((i: { claim: string }) => i.claim.length)).toEqual([158, 158, 158]);
  });
});
