import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

const PAGE_SIZE = 25;

const DOMAIN_INGESTED: Record<string, string[]> = {
  science: [
    "openalex_v1",
    "nih_reporter_v1",
    "nasa_exoplanet_v1",
    "nuclear_tests_v1",
    "periodic_table_v1",
    "usgs_eq_v1",
  ],
  medicine: [
    "clinicaltrials_v1",
    "openfda_labels_v1",
    "faers_normalized_drugs_v1",
    "openfda_v1",
    "rxnorm_v1",
    "chebi_v1",
  ],
  law: [
    "courtlistener_scotus_v1",
    "courtlistener_circuits_v1",
    "un_sc_resolutions_v1",
    "echr_v1",
    "doj_fara_v1",
  ],
  legislation: [
    "congress_v1",
    "riksdag_v1",
    "bundestag_v1",
    "tweedekamer_v1",
    "oireachtas_v1",
    "nationalrat_v1",
    "eu_legislation_v1",
  ],
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const domain = sp.get("domain") ?? "all";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const pipelines = DOMAIN_INGESTED[domain] ?? null;
  const domainClause = pipelines
    ? `AND c."ingestedBy" IN (${pipelines.map((p) => `'${p}'`).join(",")})`
    : "";

  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<
      Array<{
        id: string;
        text: string;
        metadata: unknown;
        epistemicAxis: string | null;
        ingestedBy: string;
        claimEmergedAt: Date | null;
        links: bigint;
      }>
    >(
      `SELECT c.id, c.text, c.metadata, c."epistemicAxis", c."ingestedBy", c."claimEmergedAt",
              COUNT(cr.id) AS links
       FROM "Claim" c
       JOIN "ClaimRelation" cr ON cr."fromClaimId" = c.id
       WHERE c.deleted = false
         AND cr."relationType" IN ('cites', 'SUPERSEDED_BY', 'OUTCOME')
         ${domainClause}
       GROUP BY c.id
       ORDER BY links DESC, c."claimEmergedAt" DESC NULLS LAST
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(DISTINCT c.id) AS count
       FROM "Claim" c
       JOIN "ClaimRelation" cr ON cr."fromClaimId" = c.id
       WHERE c.deleted = false
         AND cr."relationType" IN ('cites', 'SUPERSEDED_BY', 'OUTCOME')
         ${domainClause}`
    ),
  ]);

  const total = Number(countRows[0]?.count ?? 0);

  const claims = rows.map((r) => {
    const m = r.metadata as Record<string, unknown> | null;
    const title =
      (typeof m?.title === "string" && m.title.trim()) || r.text.slice(0, 140);
    return {
      id: r.id,
      title,
      ingestedBy: r.ingestedBy,
      epistemicAxis: r.epistemicAxis,
      date: r.claimEmergedAt
        ? r.claimEmergedAt.toISOString().slice(0, 10)
        : null,
      links: Number(r.links),
    };
  });

  return NextResponse.json(
    { total, claims, page, pageSize: PAGE_SIZE },
    {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200",
      },
    }
  );
}
