import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format");

  // ── 1. Total claims & source coverage ──────────────────────────────────
  type CoverageRow = {
    total_claims: number;
    claims_with_source: number;
    pct_sourced: number;
  };

  const coverageRows = await prisma.$queryRaw<CoverageRow[]>`
    SELECT
      COUNT(*)::int                              AS total_claims,
      COUNT(DISTINCT e."claimId")::int           AS claims_with_source,
      ROUND(100.0 * COUNT(DISTINCT e."claimId") / COUNT(*), 1)::float AS pct_sourced
    FROM "Claim" c
    LEFT JOIN "Edge" e ON e."claimId" = c.id AND e.deleted = false
    WHERE c.deleted = false
  `;
  const coverage = coverageRows[0];

  // ── 2. Human-reviewed stats ─────────────────────────────────────────────
  // "Human reviewed" = verificationStatus is VERIFIED, HARD_FACT, or DISPUTED
  // (not null, not PROVISIONAL, not DEPRECATED — those are pipeline-set)
  type VerifRow = { "verificationStatus": string | null; n: number };

  const verifRows = await prisma.$queryRaw<VerifRow[]>`
    SELECT "verificationStatus", COUNT(*)::int AS n
    FROM "Claim"
    WHERE deleted = false
    GROUP BY "verificationStatus"
  `;

  const HUMAN_REVIEWED_STATUSES = new Set(["VERIFIED", "HARD_FACT", "DISPUTED"]);
  const human_reviewed_n = verifRows
    .filter((r) => r.verificationStatus && HUMAN_REVIEWED_STATUSES.has(r.verificationStatus))
    .reduce((s, r) => s + r.n, 0);
  const total_claims = coverage?.total_claims ?? 0;
  const human_reviewed_pct =
    total_claims > 0 ? Math.round((human_reviewed_n / total_claims) * 1000) / 10 : 0;

  // ── 3. Epistemic axis distribution ─────────────────────────────────────
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
    }));

  // ── 4. Claim type distribution ──────────────────────────────────────────
  type TypeRow = { "claimType": string | null; n: number };

  const typeRows = await prisma.$queryRaw<TypeRow[]>`
    SELECT "claimType", COUNT(*)::int AS n
    FROM "Claim"
    WHERE deleted = false
    GROUP BY "claimType"
    ORDER BY n DESC
    LIMIT 15
  `;

  const claim_type = typeRows
    .filter((r) => r.claimType !== null)
    .map((r) => ({
      type: r.claimType as string,
      n: r.n,
      pct: total_claims > 0 ? Math.round((r.n / total_claims) * 1000) / 10 : 0,
    }));

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
    human_reviewed_n,
    human_reviewed_pct,
    epistemic_axis,
    claim_type,
    pipeline_breakdown,
    coverage_note:
      "\"Sourced\" means the claim has at least one Edge record linking it to a primary Source record (journal, government dataset, regulatory filing, etc). " +
      "This is a structural link, not an editorial judgment — it means the ingestion pipeline recorded where the claim came from. " +
      "\"Human-reviewed\" (verificationStatus VERIFIED, HARD_FACT, or DISPUTED) means a human auditor confirmed or disputed the claim. " +
      "The gap between 97% sourced and ~97% verified reflects that most verification is pipeline-automated, not hand-checked.",
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
