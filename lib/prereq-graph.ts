import { prisma } from "@/lib/prisma";

// Evidence Chains (/prereq-graph): ONE population definition shared by the
// page header and the API body. Before this module the header counted
// `DISTINCT fromClaimId FROM ClaimRelation` with no Claim join and no deleted
// filter, while the body joined Claim with deleted = false — the same number
// today, but two queries that would drift apart on the first soft-delete.

/** Relation types that count as an evidence link. */
export const LINK_TYPES = ["CITES", "SUPERSEDED_BY", "OUTCOME"] as const;

/** SQL list literal of LINK_TYPES — constants, not user input. */
export const LINK_TYPES_SQL = `(${LINK_TYPES.map((t) => `'${t}'`).join(", ")})`;

export const PREREQ_DOMAINS: Record<string, string[]> = {
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

export type LinkedClaimsFilter = { domain?: string; q?: string };

/**
 * WHERE fragment + bind params for "live claims with ≥1 evidence link", with
 * the optional domain chip and text search applied. The domain clause is built
 * from the PREREQ_DOMAINS allowlist (Object.hasOwn guards prototype keys such
 * as ?domain=constructor); the search string is always a bind parameter.
 */
export function linkedClaimsWhere({ domain = "all", q = "" }: LinkedClaimsFilter = {}): {
  clause: string;
  params: unknown[];
} {
  const pipelines = Object.hasOwn(PREREQ_DOMAINS, domain) ? PREREQ_DOMAINS[domain] : null;
  const domainClause = pipelines
    ? `AND c."ingestedBy" IN (${pipelines.map((p) => `'${p}'`).join(",")})`
    : "";

  const params: unknown[] = [];
  let searchClause = "";
  const term = q.trim();
  if (term) {
    const escaped = term.replace(/[\\%_]/g, (m) => `\\${m}`);
    params.push(`%${escaped}%`);
    searchClause = `AND (c.text ILIKE $1 OR c.metadata->>'title' ILIKE $1)`;
  }

  return {
    clause: `FROM "Claim" c
       JOIN "ClaimRelation" cr ON cr."fromClaimId" = c.id
       WHERE c.deleted = false
         AND cr."relationType" IN ${LINK_TYPES_SQL}
         ${domainClause}
         ${searchClause}`,
    params,
  };
}

/** Distinct live claims with ≥1 evidence link under the given filter. */
export async function countLinkedClaims(filter: LinkedClaimsFilter = {}): Promise<number> {
  const { clause, params } = linkedClaimsWhere(filter);
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(DISTINCT c.id) AS count ${clause}`,
    ...params,
  );
  return Number(rows[0]?.count ?? 0);
}

/** Every relation row in the graph (the "Total relations" tile). */
export async function countRelations(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count FROM "ClaimRelation"`,
  );
  return Number(rows[0]?.count ?? 0);
}
