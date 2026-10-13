import { NextRequest, NextResponse } from "next/server";
import { getCuratedTexts, getCuratedTrajectories } from "@/lib/trajectory-list";
import { getMachineTrajectories } from "@/lib/machine-lens";

// Reading searchParams makes this handler dynamic, so a route-level
// `revalidate` never applied; each lens is instead cached for an hour with
// unstable_cache (STATUS.md Phase 5). Era filtering and paging happen on the
// cached array, so the key space is two entries.
export const dynamic = "force-dynamic";

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

// ── Machine-derived lens ──────────────────────────────────────────────────────
// The notable non-curated curves now live in lib/machine-lens.ts (shared with
// the explorer's ?lens=machine since /trajectories folded into it); this keeps
// /api/history's response shape for any external caller.
async function loadMachineLens(): Promise<EncyclopediaItem[]> {
  return (await getMachineTrajectories()).map((t) => ({
    id: t.claimId, // claim id — machine cards link to /claims/<id>, not /settling-curve
    kind: "machine" as const,
    claim: t.claim,
    startYear: t.firstYear,
    endYear: t.lastYear,
    era: eraForYear(t.firstYear ?? 1990),
    transitionCount: t.transitionCount,
    communities: t.communities,
    hasReversal: t.hasReversal,
    hasAbandonment: t.hasAbandonment,
    milestones: t.milestones,
  }));
}

// The curated lens is the cached curated list (lib/trajectory-list.ts, hourly,
// in <2 MB chunks) reshaped — the previous dedicated query produced a 3.8 MB
// payload that the data cache refused ("items over 2MB can not be cached"),
// so every anonymous visit to /trajectories ran it. The list cards carry a
// 160-char claim; the full text comes from getCuratedTexts() (same rows, its
// own hourly chunks) so the encyclopedia's search reaches every word (phase 6).
// The ~3.6 MB response is built per request from those entries and cached by
// the CDN — never as one Data Cache entry, which would be over the 2 MB limit.
async function loadCuratedLens(): Promise<EncyclopediaItem[]> {
  const [list, texts] = await Promise.all([getCuratedTrajectories(), getCuratedTexts()]);
  return list.map((c) => {
    const years = c.milestones.map((m) => m.year);
    const startYear = years.length ? Math.min(...years) : c.firstYear;
    const endYear = years.length ? Math.max(...years) : c.lastYear;
    const era: EraKey = startYear != null ? eraForYear(startYear) : "modern";
    return {
      id: c.id,
      kind: "curated" as const,
      claim: texts.get(c.id) ?? c.claim, // c.id is the slug
      startYear,
      endYear,
      era,
      transitionCount: c.transitionCount,
      communities: c.communities,
      hasReversal: c.hasReversal,
      hasAbandonment: c.hasAbandonment,
      milestones: c.milestones,
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
