import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

// Jurisdiction label mapping (pipeline tag → human name)
const JURISDICTION_LABELS: Record<string, string> = {
  cyprus_legislation_v1: "Cyprus",
  chile_legislation_v1: "Chile",
  luxembourg_legislation_v1: "Luxembourg",
  uk_legislation_v1: "United Kingdom",
  hungary_legislation_v1: "Hungary",
  argentina_legislation_v1: "Argentina",
  czech_legislation_v1: "Czech Republic",
  italy_legislation_v1: "Italy",
  romania_legislation_v1: "Romania",
  brazil_legislation_v1: "Brazil",
  philippines_legislation_v1: "Philippines",
  russia_legislation_v1: "Russia",
  costa_rica_legislation_v1: "Costa Rica",
  colombia_legislation_v1: "Colombia",
  belgium_legislation_v1: "Belgium",
  poland_legislation_v1: "Poland",
  estonia_legislation_v1: "Estonia",
  peru_legislation_v1: "Peru",
  thailand_legislation_v1: "Thailand",
};

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format");

  // ── 1. Per-jurisdiction supersession stats ──────────────────────────────
  type JurisdictionRow = {
    jurisdiction: string;
    superseded_n: number;
    indeterminate_n: number;
    p25_days: number | null;
    median_days: number | null;
    p75_days: number | null;
  };

  const jurisdictionStats = await prisma.$queryRaw<JurisdictionRow[]>`
    SELECT
      c_from."ingestedBy" AS jurisdiction,
      COUNT(*)::int AS superseded_n,
      COUNT(CASE WHEN c_from."claimEmergedAt" IS NULL
                    OR c_to."claimEmergedAt" IS NULL
                    OR c_to."claimEmergedAt" <= c_from."claimEmergedAt"
                 THEN 1 END)::int AS indeterminate_n,
      PERCENTILE_CONT(0.25) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (c_to."claimEmergedAt" - c_from."claimEmergedAt"))/86400
      )::float AS p25_days,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (c_to."claimEmergedAt" - c_from."claimEmergedAt"))/86400
      )::float AS median_days,
      PERCENTILE_CONT(0.75) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (c_to."claimEmergedAt" - c_from."claimEmergedAt"))/86400
      )::float AS p75_days
    FROM "ClaimRelation" cr
    JOIN "Claim" c_from ON c_from.id = cr."fromClaimId"
    JOIN "Claim" c_to   ON c_to.id   = cr."toClaimId"
    WHERE cr."relationType" = 'SUPERSEDED_BY'
      AND c_from."ingestedBy" LIKE '%legislation%'
    GROUP BY c_from."ingestedBy"
    ORDER BY superseded_n DESC
  `;

  // ── 2. Aggregate superseded totals (all legislation jurisdictions) ──────
  type AggRow = {
    total_superseded: number;
    total_indeterminate: number;
    global_p25: number | null;
    global_median: number | null;
    global_p75: number | null;
  };

  const aggStats = await prisma.$queryRaw<AggRow[]>`
    SELECT
      COUNT(*)::int AS total_superseded,
      COUNT(CASE WHEN c_from."claimEmergedAt" IS NULL
                    OR c_to."claimEmergedAt" IS NULL
                    OR c_to."claimEmergedAt" <= c_from."claimEmergedAt"
                 THEN 1 END)::int AS total_indeterminate,
      PERCENTILE_CONT(0.25) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (c_to."claimEmergedAt" - c_from."claimEmergedAt"))/86400
      )::float AS global_p25,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (c_to."claimEmergedAt" - c_from."claimEmergedAt"))/86400
      )::float AS global_median,
      PERCENTILE_CONT(0.75) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (c_to."claimEmergedAt" - c_from."claimEmergedAt"))/86400
      )::float AS global_p75
    FROM "ClaimRelation" cr
    JOIN "Claim" c_from ON c_from.id = cr."fromClaimId"
    JOIN "Claim" c_to   ON c_to.id   = cr."toClaimId"
    WHERE cr."relationType" = 'SUPERSEDED_BY'
      AND c_from."ingestedBy" LIKE '%legislation%'
  `;

  // ── 3. Still-in-force count per corpus ─────────────────────────────────
  type StillInForceRow = { ingested_by: string; n: number };

  const stillInForceRows = await prisma.$queryRaw<StillInForceRow[]>`
    SELECT c."ingestedBy" AS ingested_by, COUNT(*)::int AS n
    FROM "Claim" c
    WHERE c."ingestedBy" LIKE '%legislation%'
      AND c.deleted = false
      AND NOT EXISTS (
        SELECT 1 FROM "ClaimRelation" cr
        WHERE cr."fromClaimId" = c.id AND cr."relationType" = 'SUPERSEDED_BY'
      )
    GROUP BY c."ingestedBy"
    ORDER BY n DESC
  `;

  const still_in_force_total = stillInForceRows.reduce((s, r) => s + r.n, 0);

  // ── 4. Histogram of lifespan (days) — positive-duration events only ─────
  type HistRow = { bucket: string; count: number };

  const histogram = await prisma.$queryRaw<HistRow[]>`
    SELECT
      CASE
        WHEN days <   365 THEN '< 1 year'
        WHEN days <  1825 THEN '1–4 years'
        WHEN days <  3650 THEN '5–9 years'
        WHEN days <  7300 THEN '10–19 years'
        WHEN days < 18250 THEN '20–49 years'
        ELSE                   '50+ years'
      END AS bucket,
      COUNT(*)::int AS count
    FROM (
      SELECT EXTRACT(EPOCH FROM (c_to."claimEmergedAt" - c_from."claimEmergedAt"))/86400 AS days
      FROM "ClaimRelation" cr
      JOIN "Claim" c_from ON c_from.id = cr."fromClaimId"
      JOIN "Claim" c_to   ON c_to.id   = cr."toClaimId"
      WHERE cr."relationType" = 'SUPERSEDED_BY'
        AND c_from."ingestedBy" LIKE '%legislation%'
        AND c_from."claimEmergedAt" IS NOT NULL
        AND c_to."claimEmergedAt"   IS NOT NULL
        AND c_to."claimEmergedAt"   > c_from."claimEmergedAt"
    ) sub
    GROUP BY bucket
    ORDER BY MIN(days)
  `;

  // ── 5. Build response ───────────────────────────────────────────────────
  const agg = aggStats[0];

  const jurisdictions = [
    ...new Set([
      ...jurisdictionStats.map((r) => r.jurisdiction),
      ...stillInForceRows.map((r) => r.ingested_by),
    ]),
  ]
    .map((tag) => JURISDICTION_LABELS[tag] ?? tag)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort();

  const jurisdiction_breakdown = jurisdictionStats.map((r) => ({
    jurisdiction: JURISDICTION_LABELS[r.jurisdiction] ?? r.jurisdiction,
    pipeline: r.jurisdiction,
    superseded_n: r.superseded_n,
    indeterminate_n: r.indeterminate_n,
    still_in_force_n: stillInForceRows.find((s) => s.ingested_by === r.jurisdiction)?.n ?? 0,
    median_days: r.median_days != null ? Math.round(r.median_days) : null,
    p25_days: r.p25_days != null ? Math.round(r.p25_days) : null,
    p75_days: r.p75_days != null ? Math.round(r.p75_days) : null,
  }));

  const payload = {
    jurisdictions,
    superseded: {
      n: agg?.total_superseded ?? 0,
      indeterminate_n: agg?.total_indeterminate ?? 0,
      median_days: agg?.global_median != null ? Math.round(agg.global_median) : null,
      p25_days: agg?.global_p25 != null ? Math.round(agg.global_p25) : null,
      p75_days: agg?.global_p75 != null ? Math.round(agg.global_p75) : null,
      histogram,
    },
    still_in_force: {
      n: still_in_force_total,
    },
    jurisdiction_breakdown,
    coverage_note:
      "Lifespan is computed as supersedingDate − enactmentDate using claimEmergedAt. " +
      "Jurisdictions with supersession data: Cyprus (n=3,122), Chile (n=810), Luxembourg (n=137), UK (n=10). " +
      "Indeterminate rows (non-positive or null date difference) are counted separately and excluded from duration stats. " +
      "Still-in-force counts are censored observations — no duration can be assigned to ongoing laws.",
  };

  // ── CSV export ──────────────────────────────────────────────────────────
  if (format === "csv") {
    const lines = [
      "jurisdiction,pipeline,superseded_n,indeterminate_n,still_in_force_n,median_days,p25_days,p75_days",
      ...jurisdiction_breakdown.map((r) =>
        [
          `"${r.jurisdiction}"`,
          r.pipeline,
          r.superseded_n,
          r.indeterminate_n,
          r.still_in_force_n,
          r.median_days ?? "",
          r.p25_days ?? "",
          r.p75_days ?? "",
        ].join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="legislation-stats.csv"',
      },
    });
  }

  return NextResponse.json(payload);
}
