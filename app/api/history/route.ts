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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eraFilter = searchParams.get("era");
  const pageParam = searchParams.get("page");

  const claims = await prisma.claim.findMany({
    where: { externalId: { startsWith: "trajectory:" }, deleted: false },
    select: {
      id: true,
      externalId: true,
      text: true,
      claimEmergedAt: true,
      statusHistory: {
        orderBy: { occurredAt: "asc" },
        select: { community: true, toAxis: true, occurredAt: true },
      },
    },
  });

  const all = claims.map((c) => {
    const years = c.statusHistory.map((s) => s.occurredAt.getUTCFullYear());
    if (years.length === 0 && c.claimEmergedAt) years.push(c.claimEmergedAt.getUTCFullYear());
    const startYear = years.length ? Math.min(...years) : null;
    const endYear = years.length ? Math.max(...years) : null;
    const era: EraKey = startYear != null ? eraForYear(startYear) : "modern";
    return {
      id: c.externalId!.replace(/^trajectory:/, ""),
      claim: c.text,
      startYear,
      endYear,
      era,
      transitionCount: c.statusHistory.length,
      communities: [...new Set(c.statusHistory.map((s) => s.community))],
      hasReversal: c.statusHistory.some((s) => s.toAxis === "REVERSED"),
      hasAbandonment: c.statusHistory.some((s) => s.toAxis === "ABANDONED"),
    };
  });

  // Chronological ordering — oldest claims first.
  all.sort((a, b) => (a.startYear ?? 9999) - (b.startYear ?? 9999));

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

  return NextResponse.json({
    eras: ERAS.map((e) => ({ key: e.key, label: e.label, range: e.range })),
    eraCounts,
    total,
    page,
    pageSize: PAGE_SIZE,
    paginated: Boolean(pageParam),
    items,
  });
}
