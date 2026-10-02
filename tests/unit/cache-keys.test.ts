import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Front door phase 6 (STATUS.md, 2026-10-01): phase 5 put unstable_cache behind
// /api/opinions, /api/retractions, /split-ledger and /api/trajectories/[id]
// with raw query values as cache-key arguments, so every junk ?court=, ISO
// timestamp, page number or made-up id added a Data Cache entry; prototype keys
// (court=constructor, field=constructor) and a double-decoded pair=%25 threw
// 500s. /canon had the same unbounded ?page key. Arguments are now whitelisted,
// clamped and normalised before the cached call, and a miss is never cached.

// unstable_cache stand-in, one store per wrapper: the key is JSON.stringify(args),
// the value round-trips through JSON like the real cache's stored body (so a
// Date or BigInt in a cached value fails here as it would on a production
// hit), and a throw stores nothing (next/dist/server/web/spec-extension/unstable-cache.js).
const cache = vi.hoisted(() => ({
  calls: [] as { key: string; args: unknown[] }[],
  stores: new Map<string, Map<string, string>>(),
}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => Promise<unknown>, keyParts: string[]) => {
    const key = keyParts.join(",");
    const store = new Map<string, string>();
    cache.stores.set(key, store);
    return async (...args: unknown[]) => {
      cache.calls.push({ key, args });
      const k = JSON.stringify(args);
      const hit = store.get(k);
      if (hit !== undefined) return JSON.parse(hit);
      const v = await fn(...args);
      store.set(k, JSON.stringify(v));
      return v;
    };
  },
}));

import { GET as opinionsGET } from "@/app/api/opinions/route";
import { GET as retractionsGET } from "@/app/api/retractions/route";
import { GET as trajectoryGET } from "@/app/api/trajectories/[id]/route";
import { splitLedgerParams, loadSplitLedgerCounts, TIER2_COMMUNITY_PAIRS } from "@/lib/split-ledger";
import { FIELD_OPTIONS, REASON_OPTIONS } from "@/lib/retraction-filters";
import SplitLedgerPage from "@/app/split-ledger/page";
import CanonPage from "@/app/canon/page";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mp = prisma as any;
const get = (path: string) => new NextRequest(`http://localhost${path}`);
const callsTo = (key: string) => cache.calls.filter((c) => c.key === key).map((c) => c.args);
const sqlText = (q: unknown) => (Array.isArray(q) ? (q as string[]).join("?") : (q as { sql: string }).sql);

beforeEach(() => {
  cache.calls.length = 0;
  for (const s of cache.stores.values()) s.clear();
});

// ── /api/opinions ────────────────────────────────────────────────────────────
describe("/api/opinions", () => {
  const ALL = ["courtlistener_scotus_v1", "courtlistener_circuits_v1", "courtlistener_state_supreme_v1", "courtlistener_bia_v1", "courtlistener_tax_v1"];
  const row = {
    id: "op1",
    text: "The Supreme Court in X v. Y issued an opinion",
    ingestedBy: "courtlistener_scotus_v1",
    claimEmergedAt: new Date("2020-02-03T00:00:00Z"),
    epistemicAxis: "SETTLED",
    externalId: "x",
    edges: [{ source: { url: "https://example.test/x", name: "X v. Y, 1 U.S. 1 — SCOTUS (2020)" } }],
    _count: { relationsFrom: 0 },
  };
  type Where = { ingestedBy: { in: string[] }; claimEmergedAt?: { gte?: Date; lte?: Date } };
  const whereOf = (fn: { mock: { calls: [{ where: Where }][] } }, i = 0) => fn.mock.calls[i][0].where;

  beforeEach(() => {
    mp.claim.count = vi.fn().mockResolvedValue(120);
    mp.claim.findMany = vi.fn().mockResolvedValue([row]);
  });

  it.each(["constructor", "__proto__", "toString", "junk"])("court=%s → 200, keyed and queried as all courts", async (court) => {
    const res = await opinionsGET(get(`/api/opinions?court=${court}`));
    expect(res.status).toBe(200);
    for (const args of [...callsTo("api-opinions-count"), ...callsTo("api-opinions-page")]) expect(args[0]).toBe("all");
    expect(whereOf(mp.claim.findMany).ingestedBy.in).toEqual(ALL);
  });

  it.each([
    "dateFrom=2020-01-01T13:45:00.123Z",
    "dateFrom=2020-02-31",
    "dateTo=2024-13-01",
    "dateTo=2024-00-10",
    "dateTo=2024-01-32",
    "dateFrom=garbage",
  ])("%s is no date filter (200, cached as undated)", async (qs) => {
    const res = await opinionsGET(get(`/api/opinions?${qs}`));
    expect(res.status).toBe(200);
    expect(callsTo("api-opinions-page")).toEqual([["all", null, null, 1, 50]]);
    expect(whereOf(mp.claim.findMany).claimEmergedAt).toBeUndefined();
  });

  it("a real date range filters at UTC midnight, as before, and skips the data cache", async () => {
    await opinionsGET(get("/api/opinions?dateFrom=2020-01-01&dateTo=2020-12-31"));
    expect(whereOf(mp.claim.findMany).claimEmergedAt).toEqual({
      gte: new Date("2020-01-01T00:00:00Z"),
      lte: new Date("2020-12-31T00:00:00Z"),
    });
    expect(callsTo("api-opinions-page")).toEqual([]);
    expect(callsTo("api-opinions-count")).toEqual([["all", null, null]]); // allTotal only
  });

  it("dates outside 1700–2100 are clamped", async () => {
    await opinionsGET(get("/api/opinions?dateFrom=0099-01-01&dateTo=9999-12-31"));
    expect(whereOf(mp.claim.findMany).claimEmergedAt).toEqual({
      gte: new Date("1700-01-01T00:00:00Z"),
      lte: new Date("2100-12-31T00:00:00Z"),
    });
  });

  it("clamps the page to the real page count and reports both totals", async () => {
    const body = await (await opinionsGET(get("/api/opinions?page=999999&limit=50"))).json();
    expect(body).toMatchObject({ page: 3, pages: 3, total: 120, allTotal: 120, limit: 50 });
    expect(mp.claim.findMany.mock.calls[0][0]).toMatchObject({ skip: 100, take: 50 });
  });

  it("limit outside 25/50/100 → 50", async () => {
    await opinionsGET(get("/api/opinions?limit=7"));
    expect(mp.claim.findMany.mock.calls[0][0].take).toBe(50);
  });

  it("allTotal is the unfiltered count under a court filter", async () => {
    mp.claim.count = vi.fn(async ({ where }: { where: Where }) => (where.ingestedBy.in.length === 1 ? 7 : 120));
    const body = await (await opinionsGET(get("/api/opinions?court=scotus"))).json();
    expect(body.total).toBe(7);
    expect(body.allTotal).toBe(120);
  });

  it("junk params share one key, and a cache hit serves JSON-safe rows", async () => {
    await opinionsGET(get("/api/opinions?court=junk1&dateFrom=2020-01-01T12:00:00Z"));
    mp.claim.count.mockClear();
    mp.claim.findMany.mockClear();
    const body = await (await opinionsGET(get("/api/opinions?court=junk2&dateFrom=2020-01-02T12:00:00Z"))).json();
    expect(mp.claim.count).not.toHaveBeenCalled();
    expect(mp.claim.findMany).not.toHaveBeenCalled();
    expect(body.results[0]).toMatchObject({ date: "2020-02-03", caseName: "X v. Y, 1 U.S. 1", court: "SCOTUS" });
  });
});

// ── /api/retractions ─────────────────────────────────────────────────────────
describe("/api/retractions", () => {
  const sqlCalls = () => mp.$queryRawUnsafe.mock.calls as [string, ...unknown[]][];
  const allParams = () => sqlCalls().flatMap(([, ...p]) => p) as string[];
  /** Every $n in the SQL has a parameter and every parameter is used. */
  const expectNumbering = () => {
    expect(sqlCalls().length).toBeGreaterThan(0);
    for (const [sql, ...params] of sqlCalls()) {
      const idx = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
      expect(Math.max(0, ...idx)).toBe(params.length);
      expect(new Set(idx).size).toBe(params.length);
    }
  };

  beforeEach(() => {
    mp.$queryRawUnsafe = vi.fn(async (sql: string) =>
      /COUNT\(\*\)/.test(sql)
        ? [{ count: BigInt(sql.includes("c.text ILIKE") ? 7 : 30) }]
        : [{ id: "r1", text: "t", metadata: { title: "t", journal: "Cell" }, claimEmergedAt: new Date("2020-02-03T00:00:00Z") }],
    );
  });

  it.each(["field=constructor", "field=__proto__", "field=junk", "reason=bogus", "reason=constructor", "reason=retract"])(
    "%s → 200 empty payload with no DB or cache call",
    async (qs) => {
      const res = await retractionsGET(get(`/api/retractions?${qs}`));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ total: 0, papers: [], page: 1, pageSize: 25 });
      expect(mp.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(cache.calls).toEqual([]);
    },
  );

  it("binds the journal keywords as parameters", async () => {
    await retractionsGET(get("/api/retractions?field=Medicine"));
    expect(sqlCalls()).toHaveLength(2);
    for (const [sql, ...params] of sqlCalls()) {
      expect(sql).not.toContain("'%medic%'");
      expect(params).toContain("%medic%");
      expect(params).toContain("%hepat%");
    }
    expectNumbering();
  });

  it.each([...FIELD_OPTIONS.map((f) => `field=${f}`), ...REASON_OPTIONS.map((r) => `reason=${r}`), "field=", "reason="])(
    "%s is a valid filter: the count and page queries both run",
    async (qs) => {
      await retractionsGET(get(`/api/retractions?${qs}`));
      expect(sqlCalls()).toHaveLength(2);
      expectNumbering();
    },
  );

  // The explorer's sub-nav sends these literals (RetractionExplorerClient), not FIELD_OPTIONS/REASON_OPTIONS.
  it.each(["field=Medicine", "field=Psychology", "field=Biology", "reason=Retraction", "reason=Correction"])(
    "%s (an explorer sub-nav value) reaches the database",
    async (qs) => {
      await retractionsGET(get(`/api/retractions?${qs}`));
      expect(sqlCalls()).toHaveLength(2);
    },
  );

  it("keeps the $n numbering with reason, q and field together", async () => {
    await retractionsGET(get("/api/retractions?field=Biology&reason=Retraction&q=rna"));
    expect(sqlCalls()).toHaveLength(2);
    expectNumbering();
    for (const [, ...params] of sqlCalls()) {
      expect(params.slice(0, 3)).toEqual(["%Retraction%", "%rna%", "%rna%"]);
      expect(params).toContain("%rna %");
    }
  });

  it("sortBy other than date → impact", async () => {
    await retractionsGET(get("/api/retractions?sortBy=bogus"));
    const [args] = callsTo("api-retractions-page");
    expect(args).toContain("impact");
    expect(args).not.toContain("bogus");
    expect(sqlCalls().some(([sql]) => sql.includes("CASE"))).toBe(true);
  });

  it("clamps the page to the real page count", async () => {
    const body = await (await retractionsGET(get("/api/retractions?page=999999"))).json();
    expect(body.page).toBe(2);
    expect(body.total).toBe(30);
    expect(sqlCalls().some(([sql]) => /OFFSET 25\s*$/.test(sql))).toBe(true);
  });

  it("free-text q bypasses the data cache, is capped at 200 chars and clamps by its own count", async () => {
    const body = await (await retractionsGET(get(`/api/retractions?page=999999&q=${"x".repeat(500)}`))).json();
    expect(cache.calls).toEqual([]);
    expect(allParams()).toContain(`%${"x".repeat(200)}%`);
    expect(body.total).toBe(7);
    expect(body.page).toBe(1);
  });

  it("escapes LIKE wildcards in q and normalises DOI URLs", async () => {
    await retractionsGET(get(`/api/retractions?q=${encodeURIComponent("https://doi.org/10.1016/J.CELL_50%")}`));
    expect(allParams()).toContain("%10.1016/j.cell\\_50\\%%");
  });

  it("a repeat request is a cache hit with JSON-safe papers", async () => {
    await retractionsGET(get("/api/retractions?field=Physics&sortBy=date&page=1"));
    mp.$queryRawUnsafe.mockClear();
    const body = await (await retractionsGET(get("/api/retractions?field=Physics&sortBy=date&page=1"))).json();
    expect(mp.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(body.papers[0].retractionDate).toBe("2020-02-03");
  });
});

// ── /api/trajectories/[id] ───────────────────────────────────────────────────
describe("/api/trajectories/[id]", () => {
  const call = (id: string, qs = "") =>
    trajectoryGET(get(`/api/trajectories/${id}${qs}`), { params: Promise.resolve({ id }) });
  const store = () => cache.stores.get("api-trajectory-detail")!;
  const row = (over: Record<string, unknown> = {}) => ({
    id: "cmq7e9wie000bsa8h626rfx9j",
    text: "The continents drift",
    ingestedBy: "seed:human-history-trajectories",
    claimEmergedAt: new Date("1912-01-06T00:00:00Z"),
    deleted: false,
    statusHistory: [
      {
        id: "csh:trajectory:continental-drift:1", seq: 1, fromAxis: null, toAxis: "RECORDED", community: "EXPERT_LITERATURE",
        occurredAt: new Date("1912-01-06T00:00:00Z"), datePrecision: "DAY", reason: "Wegener", markerSource: null,
      },
    ],
    ...over,
  });
  // The uncached existence check queries { OR: [slug, id] }; the cached loader
  // queries the slug ({ externalId }) and then the raw id ({ id }).
  type Q = { where: Record<string, unknown>; select: Record<string, unknown> };
  const isExistence = (q: Q) => "OR" in q.where;
  const loaderCalls = () => (mp.claim.findFirst.mock.calls as [Q][]).filter(([q]) => !isExistence(q));

  beforeEach(() => {
    mp.claim.findFirst = vi.fn().mockResolvedValue(null);
  });

  it("an unknown id is a 404 every time, without touching the Data Cache", async () => {
    for (let i = 0; i < 2; i++) {
      const res = await call("nope-xyz");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Not found" });
    }
    expect(mp.claim.findFirst).toHaveBeenCalledTimes(2); // the existence check only
    expect(callsTo("api-trajectory-detail")).toEqual([]);
    expect(store().size).toBe(0);
    expect((await call("nope-xyz", "?format=csv")).status).toBe(404);
  });

  it("checks existence over the slug and the raw id before the cached loader, which reads the slug deleted or not", async () => {
    mp.claim.findFirst = vi.fn(async (q: Q) => (isExistence(q) ? { id: "c1" } : row()));
    await call("continental-drift");
    expect(mp.claim.findFirst.mock.calls[0][0].where).toEqual({
      OR: [{ externalId: "trajectory:continental-drift" }, { id: "continental-drift" }],
    });
    const [[loader]] = loaderCalls();
    expect(loader.where).toEqual({ externalId: "trajectory:continental-drift" });
    expect(loader.select.deleted).toBe(true);
  });

  it("a hit is served from the store the second time (only the existence check runs again)", async () => {
    mp.claim.findFirst = vi.fn(async (q: Q) => (isExistence(q) ? { id: "c1" } : row()));
    const a = await call("continental-drift");
    const b = await call("continental-drift");
    expect(a.status).toBe(200);
    expect(await b.json()).toEqual(await a.json());
    expect(loaderCalls()).toHaveLength(1);
    expect(a.headers.get("cache-control")).toBe("public, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("a row deleted outright (or renamed) after it was cached is a 404 at once — the cached curve is never served", async () => {
    let present = true;
    mp.claim.findFirst = vi.fn(async (q: Q) => (!present ? null : isExistence(q) ? { id: "c1" } : row()));
    expect((await call("old-slug")).status).toBe(200);
    present = false;
    expect((await call("old-slug")).status).toBe(404);
    expect((await call("old-slug", "?format=csv")).status).toBe(404);
    expect(store().size).toBe(1); // the stale entry is still there, and is not consulted
  });

  it("a soft-deleted claim is a cached 404 (bounded by real rows)", async () => {
    mp.claim.findFirst = vi.fn(async (q: Q) =>
      isExistence(q) ? { id: "c1" } : "externalId" in q.where ? row({ deleted: true }) : null,
    );
    expect((await call("old-slug")).status).toBe(404);
    expect((await call("old-slug")).status).toBe(404);
    expect(loaderCalls()).toHaveLength(2); // slug + raw-id fallback, first request only
    expect(store().size).toBe(1);
  });

  it("a live raw-id row wins over a deleted slug row, as before", async () => {
    mp.claim.findFirst = vi.fn(async (q: Q) =>
      isExistence(q) ? { id: "c1" } : "externalId" in q.where ? row({ deleted: true, text: "deleted" }) : row({ text: "live" }),
    );
    const res = await call("cmq7e9wie000bsa8h626rfx9j");
    expect(res.status).toBe(200);
    expect((await res.json()).claim).toBe("live");
  });

  it("a database error rejects — it is never reported as Not found", async () => {
    mp.claim.findFirst = vi.fn().mockRejectedValue(new Error("Connection terminated unexpectedly"));
    await expect(call("continental-drift")).rejects.toThrow("Connection terminated unexpectedly");
  });
});

// ── /split-ledger ────────────────────────────────────────────────────────────
const P_EI = "EXPERT_LITERATURE ↔ INSTITUTIONAL";
const P_IP = "INSTITUTIONAL ↔ PUBLIC";

describe("splitLedgerParams", () => {
  const counts = { tier1: 120, tier2: 500, pairs: { [P_EI]: 60, [P_IP]: 0 } };
  const p = (raw: Record<string, string | string[] | undefined>) => splitLedgerParams(raw, counts);

  it("takes the pair as Next delivered it (decoded once): no second decode, no throw", () => {
    expect(p({ pair: P_EI }).pair).toBe(P_EI);
    expect(p({ pair: [P_EI, P_IP] }).pair).toBe(P_EI);
    for (const bad of ["%", "%ZZ", "constructor", "__proto__", "toString", "", "EXPERT_LITERATURE", encodeURIComponent(P_EI)]) {
      expect(p({ pair: bad }).pair).toBeNull();
    }
  });

  it("clamps t1page to the last real page", () => {
    expect(p({ t1page: "999999" }).t1page).toBe(2); // ceil(120/50) - 1
    expect(p({ t1page: "9".repeat(400) }).t1page).toBe(2); // parseInt → Infinity
    expect(p({ t1page: "-5" }).t1page).toBe(0);
    expect(p({ t1page: "abc" }).t1page).toBe(0);
    expect(p({ t1page: "1.9" }).t1page).toBe(1);
    expect(p({}).t1page).toBe(0);
    expect(splitLedgerParams({ t1page: "3" }, { ...counts, tier1: 0 }).t1page).toBe(0); // never -1
  });

  it("clamps t2page by the active pair's own count", () => {
    expect(p({ t2page: "9" }).t2page).toBe(9); // ceil(500/50) - 1
    expect(p({ t2page: "9", pair: P_EI }).t2page).toBe(1); // ceil(60/50) - 1
    expect(p({ t2page: "9", pair: P_IP }).t2page).toBe(0);
    expect(p({ t2page: "9", pair: "JUDICIAL ↔ MARKET" }).t2page).toBe(0); // listed, absent from counts
    expect(p({ t2page: "9", pair: "bogus" }).t2page).toBe(9); // not a pair → all of tier 2
  });
});

describe("/split-ledger loaders and page", () => {
  // $queryRaw fixture by SQL content: c1 Tier 1; c2 Tier 2 (EI); c3 Tier 2 (IP).
  const d = (y: number) => new Date(Date.UTC(y, 0, 1));
  const latest = [
    { claimId: "c1", community: "EXPERT_LITERATURE", latestAxis: "SETTLED", latestDate: d(2000) },
    { claimId: "c1", community: "INSTITUTIONAL", latestAxis: "CONTESTED", latestDate: d(2001) },
    { claimId: "c2", community: "EXPERT_LITERATURE", latestAxis: "RECORDED", latestDate: d(2002) },
    { claimId: "c2", community: "INSTITUTIONAL", latestAxis: "SETTLED", latestDate: d(2003) },
    { claimId: "c3", community: "INSTITUTIONAL", latestAxis: "RECORDED", latestDate: d(2004) },
    { claimId: "c3", community: "PUBLIC", latestAxis: "SETTLED", latestDate: d(2005) },
  ];
  beforeEach(() => {
    mp.$queryRaw = vi.fn(async (q: unknown) => {
      const text = sqlText(q);
      if (text.includes("HAVING COUNT(DISTINCT community) >= 2")) return [{ claimId: "c1" }, { claimId: "c2" }, { claimId: "c3" }];
      if (text.includes("DISTINCT ON")) return latest;
      if (text.includes("LEFT(c.text, 300)")) {
        return ["c1", "c2", "c3"].map((id) => ({
          claimId: id, text: `claim ${id}`, transitionCount: BigInt(2), firstOccurredAt: d(2000), lastOccurredAt: d(2005),
        }));
      }
      throw new Error("unexpected SQL: " + text.slice(0, 80));
    });
  });

  it("the counts carry every listed pair", async () => {
    const c = await loadSplitLedgerCounts();
    expect(c).toMatchObject({ tier1: 1, tier2: 2 });
    expect(c.pairs[P_EI]).toBe(1);
    expect(c.pairs[P_IP]).toBe(1);
    expect(Object.keys(c.pairs).sort()).toEqual([...TIER2_COMMUNITY_PAIRS].sort());
  });

  it("the page survives pair=% and hands clamped pages to the cached loaders", async () => {
    await expect(
      SplitLedgerPage({ searchParams: Promise.resolve({ pair: "%", t1page: "999999", t2page: "-3" }) }),
    ).resolves.toBeTruthy();
    expect(callsTo("split-ledger-tier1")).toEqual([[0]]);
    expect(callsTo("split-ledger-tier2")).toEqual([[null, 0]]);
  });

  it("the page reads the counts first and clamps t2page by the selected pair", async () => {
    await SplitLedgerPage({ searchParams: Promise.resolve({ pair: P_IP, t2page: "7" }) });
    expect(cache.calls[0].key).toBe("split-ledger-counts");
    expect(callsTo("split-ledger-tier2")).toEqual([[P_IP, 0]]);
  });
});

// ── /canon ───────────────────────────────────────────────────────────────────
describe("/canon", () => {
  beforeEach(() => {
    mp.$queryRaw = vi.fn(async (q: unknown) => {
      const text = sqlText(q);
      if (text.includes("openalex_total")) return [{ total: 120, curved: 10, reversed: 2, reviewed: 5, openalex_total: 1000, no_count: 3 }];
      if (text.includes("COUNT(*)::int AS n")) return [{ n: 120 }];
      return [];
    });
  });

  it("caps ?page at the census page count plus headroom before the cached page loader", async () => {
    await CanonPage({ searchParams: Promise.resolve({ page: "999999" }) });
    await CanonPage({ searchParams: Promise.resolve({ page: "123456" }) });
    expect(callsTo("canon-page")).toEqual([["all", 13], ["all", 13]]); // ceil(120/50) + 10: one key for every large page
  });

  it("a census older than the population still reaches the real last page", async () => {
    // census cached at 100 papers (2 pages); the population has since grown to 120 (3 pages)
    mp.$queryRaw = vi.fn(async (q: unknown) => {
      const text = sqlText(q);
      if (text.includes("openalex_total")) return [{ total: 100, curved: 10, reversed: 2, reviewed: 5, openalex_total: 1000, no_count: 3 }];
      if (text.includes("COUNT(*)::int AS n")) return [{ n: 120 }];
      return [];
    });
    await CanonPage({ searchParams: Promise.resolve({ page: "3" }) });
    expect(callsTo("canon-page")).toEqual([["all", 3]]);
  });

  it("an unknown filter is 'all'", async () => {
    await CanonPage({ searchParams: Promise.resolve({ filter: "constructor", page: "2" }) });
    expect(callsTo("canon-page")).toEqual([["all", 2]]);
  });
});
