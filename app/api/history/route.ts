import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 600;

// ─── Eras ────────────────────────────────────────────────────────────────────
// No era field exists on Claim/ClaimStatusHistory, so we infer the era from the
// earliest dated transition (occurredAt) — the point closest to when the claim's
// recorded history begins. Falls back to claimEmergedAt if no transitions exist.

type EraKey =
  | "ancient"
  | "medieval"
  | "early-modern"
  | "industrial"
  | "world-wars"
  | "cold-war"
  | "modern";

const ERAS: { key: EraKey; label: string; range: string; min: number; max: number }[] = [
  { key: "ancient", label: "Ancient", range: "pre-500 CE", min: -Infinity, max: 499 },
  { key: "medieval", label: "Medieval", range: "500–1400", min: 500, max: 1399 },
  { key: "early-modern", label: "Early Modern", range: "1400–1750", min: 1400, max: 1749 },
  { key: "industrial", label: "Industrial", range: "1750–1900", min: 1750, max: 1899 },
  { key: "world-wars", label: "WWI/WWII", range: "1900–1950", min: 1900, max: 1949 },
  { key: "cold-war", label: "Cold War", range: "1950–1990", min: 1950, max: 1989 },
  { key: "modern", label: "Modern", range: "1990–present", min: 1990, max: Infinity },
];

function eraForYear(year: number): EraKey {
  for (const e of ERAS) if (year >= e.min && year <= e.max) return e.key;
  return "modern";
}

const PAGE_SIZE = 24;

// ── Machine-derived lens ──────────────────────────────────────────────────────
// Notable non-curated curves: at least one REVERSED/ABANDONED transition, OR
// 3+ transitions, OR an arc spanning a year or more. This deliberately excludes
// the ~206k wave-1 same-day RECORDED→SETTLED certification pairs (n=2, span=0)
// which are honest receipts but degenerate as browsable curves. Capped and
// ranked: reversals first, then transition count, then time span.
const MACHINE_LENS_LIMIT = 1000;

type MachineAggRow = {
  id: string;
  text: string;
  claimEmergedAt: Date | null;
  n: number;
  first_at: Date;
  last_at: Date;
  has_rev: boolean;
  has_aband: boolean;
};

type EncyclopediaItem = {
  id: string;
  kind: "curated" | "machine";
  claim: string;
  startYear: number | null;
  endYear: number | null;
  era: EraKey;
  transitionCount: number;
  communities: string[];
  hasReversal: boolean;
  hasAbandonment: boolean;
  milestones: { year: number; axis: string }[];
};

async function loadMachineLens(): Promise<EncyclopediaItem[]> {
  // Aggregate pass over ClaimStatusHistory (constants only — no user input).
  const rows = (await prisma.$queryRawUnsafe(
    `WITH agg AS (
       SELECT "claimId",
              COUNT(*)::int AS n,
              MIN("occurredAt") AS first_at,
              MAX("occurredAt") AS last_at,
              BOOL_OR("toAxis" = 'REVERSED')  AS has_rev,
              BOOL_OR("toAxis" = 'ABANDONED') AS has_aband
       FROM "ClaimStatusHistory"
       GROUP BY 1
       HAVING COUNT(*) >= 2
          AND (BOOL_OR("toAxis" = 'REVERSED')
               OR BOOL_OR("toAxis" = 'ABANDONED')
               OR COUNT(*) >= 3
               OR MAX("occurredAt") - MIN("occurredAt") >= interval '365 days')
     )
     SELECT c.id, c.text, c."claimEmergedAt",
            a.n, a.first_at, a.last_at, a.has_rev, a.has_aband
     FROM agg a
     JOIN "Claim" c ON c.id = a."claimId"
     WHERE c.deleted = false
       AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
       AND (c."externalId" IS NULL OR c."externalId" NOT LIKE 'trajectory:%')
     ORDER BY a.has_rev DESC, a.n DESC, (a.last_at - a.first_at) DESC
     LIMIT ${MACHINE_LENS_LIMIT}`,
  )) as MachineAggRow[];

  // Milestones for the selected claims only (~1k claims, few rows each).
  const history = await prisma.claimStatusHistory.findMany({
    where: { claimId: { in: rows.map((r) => r.id) } },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    select: { claimId: true, toAxis: true, community: true, occurredAt: true },
  });
  const byClaim = new Map<string, typeof history>();
  for (const h of history) {
    if (!byClaim.has(h.claimId)) byClaim.set(h.claimId, []);
    byClaim.get(h.claimId)!.push(h);
  }

  return rows.map((r) => {
    const hs = byClaim.get(r.id) ?? [];
    const startYear = r.first_at.getUTCFullYear();
    const endYear = r.last_at.getUTCFullYear();
    return {
      id: r.id, // claim id — machine cards link to /claims/<id>, not /settling-curve
      kind: "machine" as const,
      claim: r.text,
      startYear,
      endYear,
      era: eraForYear(startYear),
      transitionCount: r.n,
      communities: [...new Set(hs.map((s) => String(s.community)))],
      hasReversal: r.has_rev,
      hasAbandonment: r.has_aband,
      milestones: hs.map((s) => ({
        year: s.occurredAt.getUTCFullYear(),
        axis: s.toAxis,
      })),
    };
  });
}

async function loadCuratedLens(): Promise<EncyclopediaItem[]> {
  const claims = await prisma.claim.findMany({
    where: { externalId: { startsWith: "trajectory:" }, deleted: false },
    select: {
      id: true,
      externalId: true,
      text: true,
      claimEmergedAt: true,
      statusHistory: {
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        select: { community: true, toAxis: true, occurredAt: true },
      },
    },
  });

  return claims.map((c) => {
    const years = c.statusHistory.map((s) => s.occurredAt.getUTCFullYear());
    if (years.length === 0 && c.claimEmergedAt) years.push(c.claimEmergedAt.getUTCFullYear());
    const startYear = years.length ? Math.min(...years) : null;
    const endYear = years.length ? Math.max(...years) : null;
    const era: EraKey = startYear != null ? eraForYear(startYear) : "modern";
    return {
      id: c.externalId!.replace(/^trajectory:/, ""),
      kind: "curated" as const,
      claim: c.text,
      startYear,
      endYear,
      era,
      transitionCount: c.statusHistory.length,
      communities: [...new Set(c.statusHistory.map((s) => s.community))],
      hasReversal: c.statusHistory.some((s) => s.toAxis === "REVERSED"),
      hasAbandonment: c.statusHistory.some((s) => s.toAxis === "ABANDONED"),
      // Lean milestone series for the card sparkline (SettlingCurveMini). Only
      // year + axis — kept minimal because every trajectory ships in one payload.
      milestones: c.statusHistory.map((s) => ({
        year: s.occurredAt.getUTCFullYear(),
        axis: s.toAxis,
      })),
    };
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eraFilter = searchParams.get("era");
  const pageParam = searchParams.get("page");
  const lens = searchParams.get("lens") === "machine" ? "machine" : "curated";

  const all = lens === "machine" ? await loadMachineLens() : await loadCuratedLens();

  // Curated lens: chronological, oldest first. Machine lens keeps the SQL
  // ranking (reversals → transition count → span).
  if (lens === "curated") {
    all.sort((a, b) => (a.startYear ?? 9999) - (b.startYear ?? 9999));
  }

  // Era counts are computed over the full set so the tab badges stay stable
  // regardless of which era is currently filtered.
  const eraCounts: Record<string, number> = { all: all.length };
  for (const e of ERAS) eraCounts[e.key] = 0;
  for (const item of all) eraCounts[item.era] = (eraCounts[item.era] ?? 0) + 1;

  let items = all;
  if (eraFilter && eraFilter !== "all") {
    items = all.filter((i) => i.era === eraFilter);
  }

  const total = items.length;

  // Server-side pagination is opt-in via ?page=N. The page UI loads the full
  // set (count is well under 500) and paginates client-side, but the API
  // supports paging for external consumers.
  let page = 1;
  if (pageParam) {
    page = Math.max(1, parseInt(pageParam, 10) || 1);
    const start = (page - 1) * PAGE_SIZE;
    items = items.slice(start, start + PAGE_SIZE);
  }

  return NextResponse.json(
    {
      lens,
      eras: ERAS.map((e) => ({ key: e.key, label: e.label, range: e.range })),
      eraCounts,
      total,
      page,
      pageSize: PAGE_SIZE,
      paginated: Boolean(pageParam),
      items,
    },
    {
      headers: {
        // Machine lens runs a full aggregate over ClaimStatusHistory — serve it
        // from the CDN for an hour and tolerate a day of staleness rather than
        // hitting Neon per visit. Curated lens matches /api/trajectories.
        "Cache-Control":
          lens === "machine"
            ? "public, s-maxage=3600, stale-while-revalidate=86400"
            : "public, s-maxage=300, stale-while-revalidate=3600",
      },
    },
  );
}
