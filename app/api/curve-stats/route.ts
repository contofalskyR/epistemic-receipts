import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SurvivalStatsRow = {
  n: bigint;
  indeterminate_n: bigint;
  median_days: number;
  p25_days: number;
  p75_days: number;
  min_days: number;
  max_days: number;
};

type HistogramRow = { bucket: string; count: bigint };
type TrendRow = { year: number; median_days: number; n: bigint };
type FieldCheckRow = {
  total_retracted: bigint;
  has_concepts: bigint;
  has_primary_topic: bigint;
  has_subject: bigint;
};
type CuratedClaimRow = { id: string; text: string; externalId: string };
type CuratedHistoryRow = {
  claimId: string;
  community: string;
  fromAxis: string | null;
  toAxis: string;
  occurredAt: Date;
};
type CsvRow = {
  claimId: string;
  pub_date: Date;
  retraction_date: Date;
  survival_days: number;
};

// ---------------------------------------------------------------------------
// Shared CTE fragment (survival_days > 0 = valid pairs only)
// ---------------------------------------------------------------------------
const PAIRS_CTE = `
  WITH pairs AS (
    SELECT
      h1."claimId",
      h1."occurredAt" AS pub_date,
      h2."occurredAt" AS retraction_date,
      EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 AS survival_days
    FROM "ClaimStatusHistory" h1
    JOIN "ClaimStatusHistory" h2 ON h1."claimId" = h2."claimId"
    WHERE h1."toAxis" = 'RECORDED' AND h1."fromAxis" IS NULL
      AND h2."toAxis" = 'REVERSED'
      AND h1.community = 'EXPERT_LITERATURE'
      AND h2.community = 'EXPERT_LITERATURE'
  )
`;

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format");

  // ---- CSV export -------------------------------------------------------
  if (format === "csv") {
    const rows = (await prisma.$queryRawUnsafe(`
      ${PAIRS_CTE}
      SELECT
        "claimId",
        pub_date,
        retraction_date,
        survival_days
      FROM pairs
      ORDER BY survival_days DESC
      LIMIT 10000
    `)) as CsvRow[];

    const lines: string[] = [
      "claimId,publicationDate,retractionDate,survivalDays,classification",
    ];
    for (const row of rows) {
      const classification = row.survival_days > 0 ? "valid" : "indeterminate";
      lines.push(
        [
          row.claimId,
          new Date(row.pub_date).toISOString().slice(0, 10),
          new Date(row.retraction_date).toISOString().slice(0, 10),
          Math.round(Number(row.survival_days)),
          classification,
        ].join(",")
      );
    }
    // Also add the indeterminate rows
    const indetRows = (await prisma.$queryRawUnsafe(`
      WITH pairs AS (
        SELECT
          h1."claimId",
          h1."occurredAt" AS pub_date,
          h2."occurredAt" AS retraction_date,
          EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 AS survival_days
        FROM "ClaimStatusHistory" h1
        JOIN "ClaimStatusHistory" h2 ON h1."claimId" = h2."claimId"
        WHERE h1."toAxis" = 'RECORDED' AND h1."fromAxis" IS NULL
          AND h2."toAxis" = 'REVERSED'
          AND h1.community = 'EXPERT_LITERATURE'
          AND h2.community = 'EXPERT_LITERATURE'
      )
      SELECT "claimId", pub_date, retraction_date, survival_days
      FROM pairs
      WHERE survival_days <= 0
      LIMIT 10000
    `)) as CsvRow[];
    for (const row of indetRows) {
      lines.push(
        [
          row.claimId,
          new Date(row.pub_date).toISOString().slice(0, 10),
          new Date(row.retraction_date).toISOString().slice(0, 10),
          Math.round(Number(row.survival_days)),
          "indeterminate",
        ].join(",")
      );
    }

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="retraction-survival.csv"',
      },
    });
  }

  // ---- JSON response ----------------------------------------------------

  // 1. Survival stats (valid pairs only)
  const [survivalStats] = (await prisma.$queryRawUnsafe(`
    ${PAIRS_CTE}
    SELECT
      COUNT(*) FILTER (WHERE survival_days > 0) AS n,
      COUNT(*) FILTER (WHERE survival_days <= 0) AS indeterminate_n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY survival_days) FILTER (WHERE survival_days > 0) AS median_days,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY survival_days) FILTER (WHERE survival_days > 0) AS p25_days,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY survival_days) FILTER (WHERE survival_days > 0) AS p75_days,
      MIN(survival_days) FILTER (WHERE survival_days > 0) AS min_days,
      MAX(survival_days) FILTER (WHERE survival_days > 0) AS max_days
    FROM pairs
  `)) as SurvivalStatsRow[];

  // 2. Histogram (valid pairs only, non-uniform buckets)
  const histogramRows = (await prisma.$queryRawUnsafe(`
    ${PAIRS_CTE}
    SELECT
      CASE
        WHEN survival_days <= 365  THEN '0-1yr'
        WHEN survival_days <= 730  THEN '1-2yr'
        WHEN survival_days <= 1095 THEN '2-3yr'
        WHEN survival_days <= 1825 THEN '3-5yr'
        WHEN survival_days <= 3650 THEN '5-10yr'
        ELSE '10+yr'
      END AS bucket,
      COUNT(*) AS count
    FROM pairs
    WHERE survival_days > 0
    GROUP BY bucket
    ORDER BY MIN(survival_days)
  `)) as HistogramRow[];

  // 3. Detection trend by retraction year (n>=5, valid pairs only)
  const trendRows = (await prisma.$queryRawUnsafe(`
    ${PAIRS_CTE}
    SELECT
      EXTRACT(YEAR FROM retraction_date)::int AS year,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY survival_days) AS median_days,
      COUNT(*)::int AS n
    FROM pairs
    WHERE survival_days > 0
    GROUP BY EXTRACT(YEAR FROM retraction_date)
    HAVING COUNT(*) >= 5
    ORDER BY year
  `)) as TrendRow[];

  // 4. Field breakdown — check metadata signal on retracted claim rows
  const [fieldCheck] = (await prisma.$queryRawUnsafe(`
    ${PAIRS_CTE}
    SELECT
      COUNT(*)::int AS total_retracted,
      COUNT(*) FILTER (WHERE c.metadata->>'concepts'      IS NOT NULL)::int AS has_concepts,
      COUNT(*) FILTER (WHERE c.metadata->>'primary_topic' IS NOT NULL)::int AS has_primary_topic,
      COUNT(*) FILTER (WHERE c.metadata->>'subject'       IS NOT NULL)::int AS has_subject
    FROM pairs
    JOIN "Claim" c ON c.id = pairs."claimId"
    WHERE survival_days > 0
  `)) as FieldCheckRow[];

  const totalRetracted = Number(fieldCheck.total_retracted);
  const hasConcepts = Number(fieldCheck.has_concepts);
  const hasPrimaryTopic = Number(fieldCheck.has_primary_topic);
  const hasSubject = Number(fieldCheck.has_subject);
  const bestFieldCoverage = Math.max(hasConcepts, hasPrimaryTopic, hasSubject);

  let field_breakdown: {
    available: boolean;
    caveat: string;
    data?: Array<{ field: string; median_days: number; n: number }>;
  };

  if (bestFieldCoverage / totalRetracted >= 0.1) {
    // At least 10% coverage — compute median by field
    const fieldCol =
      hasConcepts >= hasPrimaryTopic && hasConcepts >= hasSubject
        ? "concepts"
        : hasPrimaryTopic >= hasSubject
        ? "primary_topic"
        : "subject";

    const fieldData = (await prisma.$queryRawUnsafe(`
      ${PAIRS_CTE}
      SELECT
        c.metadata->>'${fieldCol}' AS field,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY survival_days)::float AS median_days,
        COUNT(*)::int AS n
      FROM pairs
      JOIN "Claim" c ON c.id = pairs."claimId"
      WHERE survival_days > 0
        AND c.metadata->>'${fieldCol}' IS NOT NULL
      GROUP BY c.metadata->>'${fieldCol}'
      HAVING COUNT(*) >= 5
      ORDER BY median_days DESC
      LIMIT 20
    `)) as Array<{ field: string; median_days: number; n: number }>;

    field_breakdown = {
      available: true,
      caveat:
        "Field differences reflect confounds (journal coverage, era, country of origin) not causal mechanisms. Do not interpret as field-level retraction speed.",
      data: fieldData.map((r) => ({
        field: r.field,
        median_days: Math.round(Number(r.median_days)),
        n: Number(r.n),
      })),
    };
  } else {
    field_breakdown = {
      available: false,
      caveat:
        `Field metadata is absent for this retracted-paper population: concepts=${hasConcepts}, primary_topic=${hasPrimaryTopic}, subject=${hasSubject} ` +
        `out of ${totalRetracted} valid pairs (coverage <10%). These papers were ingested from Retraction Watch without OpenAlex enrichment.`,
    };
  }

  // 5. Curated trajectory lag (trajectory:* claims)
  const curatedClaims = (await prisma.$queryRawUnsafe(`
    SELECT c.id, c.text, c."externalId"
    FROM "Claim" c
    WHERE c."externalId" LIKE 'trajectory:%' AND c.deleted = false
    ORDER BY c."externalId"
  `)) as CuratedClaimRow[];

  const curated_lag: Array<{
    trajectory_id: string;
    title: string;
    expert_year: number;
    institutional_year: number | null;
    lag_years: number | null;
  }> = [];

  if (curatedClaims.length > 0) {
    // Bind parameters instead of interpolating IDs into the IN clause
    const placeholders = curatedClaims.map((_, i) => `$${i + 1}`).join(",");
    const historyRows = (await prisma.$queryRawUnsafe(
      `
      SELECT h."claimId", h.community, h."fromAxis", h."toAxis", h."occurredAt"
      FROM "ClaimStatusHistory" h
      WHERE h."claimId" IN (${placeholders})
      ORDER BY h."claimId", h."occurredAt"
    `,
      ...curatedClaims.map((c) => c.id)
    )) as CuratedHistoryRow[];

    // Group by claimId
    const byClaimId: Record<string, CuratedHistoryRow[]> = {};
    for (const row of historyRows) {
      if (!byClaimId[row.claimId]) byClaimId[row.claimId] = [];
      byClaimId[row.claimId].push(row);
    }

    for (const claim of curatedClaims) {
      const rows = byClaimId[claim.id] ?? [];
      const expertRow = rows.find(
        (r) => r.community === "EXPERT_LITERATURE" && r.fromAxis === null
      );
      const institutionalRow = rows.find(
        (r) => r.community === "INSTITUTIONAL"
      );

      if (!expertRow) continue; // no expert transition — skip

      const expertYear = new Date(expertRow.occurredAt).getFullYear();
      const institutionalYear = institutionalRow
        ? new Date(institutionalRow.occurredAt).getFullYear()
        : null;
      const lag_years =
        institutionalYear !== null ? institutionalYear - expertYear : null;

      curated_lag.push({
        trajectory_id: claim.externalId,
        title: claim.text.slice(0, 120),
        expert_year: expertYear,
        institutional_year: institutionalYear,
        lag_years,
      });
    }

    // Sort by lag descending (largest lag first), nulls last
    curated_lag.sort((a, b) => {
      if (a.lag_years === null && b.lag_years === null) return 0;
      if (a.lag_years === null) return 1;
      if (b.lag_years === null) return -1;
      return b.lag_years - a.lag_years;
    });
  }

  const result = {
    retraction_survival: {
      n: Number(survivalStats.n),
      indeterminate_n: Number(survivalStats.indeterminate_n),
      median_days: Math.round(Number(survivalStats.median_days)),
      p25_days: Math.round(Number(survivalStats.p25_days)),
      p75_days: Math.round(Number(survivalStats.p75_days)),
      min_days: Math.round(Number(survivalStats.min_days)),
      max_days: Math.round(Number(survivalStats.max_days)),
      histogram: histogramRows.map((r) => ({
        bucket: r.bucket,
        count: Number(r.count),
      })),
    },
    detection_trend: trendRows.map((r) => ({
      year: Number(r.year),
      median_days: Math.round(Number(r.median_days)),
      n: Number(r.n),
    })),
    field_breakdown,
    curated_lag,
    curated_lag_n: curated_lag.filter((c) => c.lag_years !== null).length,
  };

  return NextResponse.json(result);
}
