import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format");

  // ── 1. Total claims & source coverage ──────────────────────────────────
  // "Sourced" = structural link: the claim has at least one non-deleted Edge
  // to a Source record. This is provenance, not editorial judgment.
  type CoverageRow = {
    total_claims: number;
    claims_with_source: number;
    pct_sourced: number;
  };

  const coverageRows = await prisma.$queryRaw<CoverageRow[]>`
    SELECT
      COUNT(*)::int                              AS total_claims,
      COUNT(DISTINCT e."claimId")::int           AS claims_with_source,
      ROUND(100.0 * COUNT(DISTINCT e."claimId") / NULLIF(COUNT(*), 0), 1)::float AS pct_sourced
    FROM "Claim" c
    LEFT JOIN "Edge" e ON e."claimId" = c.id AND e.deleted = false
    WHERE c.deleted = false
  `;
  const coverage = coverageRows[0];
  const total_claims = coverage?.total_claims ?? 0;

  // ── 2. Epistemic axis distribution ─────────────────────────────────────
  // epistemicAxis is assigned at ingestion by pipeline constants or a
  // post-hoc backfill script (backfill-epistemic-axis.ts). It is NOT set
  // by a human review action. Every bucket gets classification_method =
  // "ingestion_default" because no review-triggered setter exists.
  type AxisRow = { "epistemicAxis": string | null; n: number };

  const axisRows = await prisma.$queryRaw<AxisRow[]>`
    SELECT "epistemicAxis", COUNT(*)::int AS n
    FROM "Claim"
    WHERE deleted = false
    GROUP BY "epistemicAxis"
    ORDER BY n DESC
  `;

  const epistemic_axis = axisRows
    .filter((r) => r.epistemicAxis !== null)
    .map((r) => ({
      axis: r.epistemicAxis as string,
      n: r.n,
      pct: total_claims > 0 ? Math.round((r.n / total_claims) * 1000) / 10 : 0,
      classification_method: "ingestion_default" as const,
    }));

  // ── 3. Auto-classified percentage ──────────────────────────────────────
  // "Auto-classified" = epistemicAxis is non-null (set by pipeline/backfill).
  // Complement of this is null-axis claims (not yet classified at all).
  const auto_classified_n = axisRows
    .filter((r) => r.epistemicAxis !== null)
    .reduce((s, r) => s + r.n, 0);
  const auto_classified_pct =
    total_claims > 0 ? Math.round((auto_classified_n / total_claims) * 1000) / 10 : 0;

  // ── 4. Genuine review signals ───────────────────────────────────────────
  // ThresholdEvents = human-promoted epistemic transitions (the "receipt").
  // ClaimStatusHistory = trajectory transitions (may be pipeline-seeded too).
  // reviewedBy field is sparsely populated (1,058 rows vs 1.6M total claims).
  // humanReviewed=true is set on <800 seed/Nobel rows — not a live review UI.
  // Conclusion: no reliable claim-level "human reviewed" count exists.
  // We surface ThresholdEvent count as the auditable review-action proxy.
  type ThresholdCount = { n: number };
  const thresholdRows = await prisma.$queryRaw<ThresholdCount[]>`
    SELECT COUNT(*)::int AS n FROM "ThresholdEvent" WHERE deleted = false
  `;
  const threshold_event_n = thresholdRows[0]?.n ?? 0;

  type HistoryCount = { n: number };
  const historyRows = await prisma.$queryRaw<HistoryCount[]>`
    SELECT COUNT(*)::int AS n FROM "ClaimStatusHistory"
  `;
  const status_history_n = historyRows[0]?.n ?? 0;

  // ── 5. Pipeline breakdown (top 20) ─────────────────────────────────────
  type PipelineRow = { "ingestedBy": string | null; n: number };

  const pipelineRows = await prisma.$queryRaw<PipelineRow[]>`
    SELECT "ingestedBy", COUNT(*)::int AS n
    FROM "Claim"
    WHERE deleted = false
    GROUP BY "ingestedBy"
    ORDER BY n DESC
    LIMIT 20
  `;

  const pipeline_breakdown = pipelineRows
    .filter((r) => r.ingestedBy !== null)
    .map((r) => ({
      pipeline: r.ingestedBy as string,
      n: r.n,
      pct: total_claims > 0 ? Math.round((r.n / total_claims) * 1000) / 10 : 0,
    }));

  // ── 6. Build response ───────────────────────────────────────────────────
  const payload = {
    total_claims,
    sourced_pct: coverage?.pct_sourced ?? 0,
    // human_reviewed_n / _pct deliberately omitted: no reliable per-claim
    // human-review flag exists. verificationStatus='VERIFIED' is a pipeline
    // constant (set at ingest), not an editorial action. humanReviewed=true
    // covers <800 seed rows. See coverage_note for full explanation.
    human_reviewed_n: 0,
    human_reviewed_pct: 0,
    auto_classified_pct,
    threshold_event_n,
    status_history_n,
    epistemic_axis,
    pipeline_breakdown,
    coverage_note:
      "\"Sourced\" means the claim has at least one Edge record linking it to a primary Source record. " +
      "This is a structural/provenance link created at ingestion — it is real and auditable. " +
      "\"Epistemic axis\" (SETTLED/RECORDED/CONTESTED/etc.) is assigned at ingestion by pipeline constants or " +
      "a post-hoc backfill script, NOT by a human reviewer. " +
      "There is no reliable per-claim human-review flag: verificationStatus='VERIFIED' is a pipeline ingestion constant " +
      "on 1.25M rows and does NOT represent editorial review. " +
      "The genuine review signals are: ThresholdEvents (human-promoted epistemic transitions) and ClaimStatusHistory (trajectory transitions). " +
      "\"Auto-classified\" = claims where epistemicAxis was assigned at ingestion or backfill (vs. null/unclassified).",
  };

  // ── CSV export ──────────────────────────────────────────────────────────
  if (format === "csv") {
    const lines = [
      "pipeline,n,pct",
      ...pipeline_breakdown.map((r) => [`"${r.pipeline}"`, r.n, r.pct].join(",")),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="corpus-stats.csv"',
      },
    });
  }

  return NextResponse.json(payload);
}
