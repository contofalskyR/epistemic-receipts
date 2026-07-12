/**
 * census-aggregates.ts — READ-ONLY DB census (findings/2026-07-11-db-census).
 *
 * Aggregate-only: every query is SELECT COUNT/GROUP BY. No row-level output.
 * Session is forced read-only via SET LOCAL transaction_read_only = on.
 *
 * Usage (repo root):
 *   npx dotenv-cli -e .env.local -- npx tsx findings/2026-07-11-db-census/census-aggregates.ts --direct
 */
import "dotenv/config";

if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) { console.error("--direct passed but DIRECT_URL is not set"); process.exit(1); }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function scrub(s: unknown): string {
  return String(s)
    .replace(/postgres(ql)?:\/\/\S+/gi, "[DB_URL]")
    .replace(/[A-Za-z0-9.-]+neon\.tech\S*/gi, "[DB_HOST]")
    .replace(/at `[^`]*`/g, "at [DB_HOST]");
}

/** One read-only transaction per query batch, house-style timeout. */
async function q<T>(sql: string): Promise<T[]> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL transaction_read_only = on`);
    await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`);
    return tx.$queryRawUnsafe<T[]>(sql);
  }, { timeout: 620_000, maxWait: 30_000 }) as Promise<T[]>;
}

const num = (v: unknown) => Number(v);

/** Parse SOURCE_REGISTRY (tag -> category) live from the sources-summary route. */
function registryCategories(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const src = fs.readFileSync(path.join(__dirname, "../../app/api/sources-summary/route.ts"), "utf8");
    for (const m of src.matchAll(/^\s*"?([A-Za-z0-9_:.\-]+)"?:\s*\{[^}]*?category:\s*"([^"]+)"/gms)) {
      map.set(m[1], m[2]);
    }
  } catch { console.error("(could not parse sources-summary route — category rollup will be empty)"); }
  return map;
}

async function main() {
  const out: Record<string, unknown> = { generatedAt: new Date().toISOString(), basis: "deleted=false unless noted" };

  // ── A. Claim totals ────────────────────────────────────────────────────────
  const totals = await q<{ live: bigint; deleted: bigint; deprecated: bigint }>(`
    SELECT COUNT(*) FILTER (WHERE deleted = false)                                        AS live,
           COUNT(*) FILTER (WHERE deleted = true)                                         AS deleted,
           COUNT(*) FILTER (WHERE deleted = false AND "verificationStatus" = 'DEPRECATED') AS deprecated
    FROM "Claim"`);
  out.claims = {
    total_live: num(totals[0].live),
    deleted: num(totals[0].deleted),
    deprecated_live: num(totals[0].deprecated),
    total_live_excl_deprecated: num(totals[0].live) - num(totals[0].deprecated),
  };
  console.error("A done");

  // ── B. By verificationStatus (incl. NULL) ─────────────────────────────────
  const byVs = await q<{ vs: string | null; n: bigint }>(`
    SELECT "verificationStatus" AS vs, COUNT(*) AS n
    FROM "Claim" WHERE deleted = false GROUP BY 1 ORDER BY 2 DESC`);
  out.by_verification_status = byVs.map(r => ({ status: r.vs ?? "NULL", count: num(r.n) }));
  console.error("B done");

  // ── C. By ingestedBy (full) ───────────────────────────────────────────────
  const byTag = await q<{ tag: string; n: bigint }>(`
    SELECT "ingestedBy" AS tag, COUNT(*) AS n
    FROM "Claim" WHERE deleted = false GROUP BY 1 ORDER BY 2 DESC`);
  out.by_ingested_by = byTag.map(r => ({ tag: r.tag, count: num(r.n) }));
  console.error("C done");

  // Excl-deprecated variant for the category rollup (site basis).
  const byTagActive = await q<{ tag: string; n: bigint }>(`
    SELECT "ingestedBy" AS tag, COUNT(*) AS n
    FROM "Claim"
    WHERE deleted = false AND ("verificationStatus" IS NULL OR "verificationStatus" <> 'DEPRECATED')
    GROUP BY 1 ORDER BY 2 DESC`);

  // ── C2. Source-category rollup (SOURCE_REGISTRY from /api/sources-summary) ─
  const reg = registryCategories();
  const catTotals = new Map<string, { claims: number; sources: number }>();
  const unmapped: Array<{ tag: string; count: number }> = [];
  for (const r of byTagActive) {
    const tag = r.tag; const n = num(r.n);
    let cat = reg.get(tag);
    if (!cat) { const hit = [...reg.keys()].find(k => tag.startsWith(k)); if (hit) cat = reg.get(hit); }
    if (!cat) { unmapped.push({ tag, count: n }); continue; }
    const cur = catTotals.get(cat) ?? { claims: 0, sources: 0 };
    cur.claims += n; cur.sources += 1; catTotals.set(cat, cur);
  }
  out.by_source_category = [...catTotals.entries()]
    .map(([category, v]) => ({ category, sources: v.sources, claims: v.claims }))
    .sort((a, b) => b.claims - a.claims);
  out.source_category_unmapped = unmapped.sort((a, b) => b.count - a.count);
  out.source_category_basis = "deleted=false AND verificationStatus <> 'DEPRECATED' (matches /api/sources-summary)";
  console.error("C2 done");

  // ── D. Curve metrics (per-claim history aggregates) ───────────────────────
  const curveSql = (extra: string) => `
    WITH per AS (
      SELECT h."claimId" AS id,
             COUNT(*)                              AS n,
             COUNT(DISTINCT h."occurredAt"::date)  AS nd,
             COUNT(DISTINCT h.community)           AS nc
      FROM "ClaimStatusHistory" h
      JOIN "Claim" c ON c.id = h."claimId"
      WHERE c.deleted = false
        AND (c."verificationStatus" IS NULL OR c."verificationStatus" <> 'DEPRECATED')
        ${extra}
      GROUP BY 1)
    SELECT COUNT(*)                                                            AS claims_with_history,
           COUNT(*) FILTER (WHERE n > 1)                                       AS multi_step,
           COUNT(*) FILTER (WHERE nd > 1)                                      AS span_gt1_date,
           COUNT(*) FILTER (WHERE n >= 3 OR (n >= 2 AND nd > 1 AND nc > 1))    AS followable,
           COUNT(*) FILTER (WHERE n >= 3)                                      AS followable_via_3plus,
           COUNT(*) FILTER (WHERE n < 3 AND n >= 2 AND nd > 1 AND nc > 1)      AS followable_via_2span_multicommunity,
           COUNT(*) FILTER (WHERE n >= 2 AND nd > 1)                           AS multi_step_spanning,
           COUNT(*) FILTER (WHERE nc > 1)                                      AS multi_community
    FROM per`;
  const curveAll = await q<Record<string, bigint>>(curveSql(""));
  out.curves_all = Object.fromEntries(Object.entries(curveAll[0]).map(([k, v]) => [k, num(v)]));
  console.error("D1 done");
  const curveTraj = await q<Record<string, bigint>>(curveSql(`AND c."externalId" LIKE 'trajectory:%'`));
  out.curves_curated_trajectory_subset = Object.fromEntries(Object.entries(curveTraj[0]).map(([k, v]) => [k, num(v)]));
  console.error("D2 done");

  // Transition-count distribution (same population as curves_all).
  const dist = await q<{ bucket: string; n: bigint }>(`
    WITH per AS (
      SELECT h."claimId" AS id, COUNT(*) AS n
      FROM "ClaimStatusHistory" h
      JOIN "Claim" c ON c.id = h."claimId"
      WHERE c.deleted = false
        AND (c."verificationStatus" IS NULL OR c."verificationStatus" <> 'DEPRECATED')
      GROUP BY 1)
    SELECT CASE WHEN n >= 10 THEN '10+' ELSE n::text END AS bucket, COUNT(*) AS n
    FROM per GROUP BY 1
    ORDER BY MIN(LEAST(n, 10))`);
  out.transition_count_distribution = dist.map(r => ({ transitions: r.bucket, claims: num(r.n) }));
  console.error("D3 done");

  // ── E. History totals + transition matrix ─────────────────────────────────
  const ht = await q<{ total_rows: bigint; claims: bigint }>(`
    SELECT COUNT(*) AS total_rows, COUNT(DISTINCT "claimId") AS claims FROM "ClaimStatusHistory"`);
  out.history_totals = { rows: num(ht[0].total_rows), distinct_claims: num(ht[0].claims) };
  const matrix = await q<{ f: string | null; t: string; n: bigint }>(`
    SELECT "fromAxis" AS f, "toAxis" AS t, COUNT(*) AS n
    FROM "ClaimStatusHistory" GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 25`);
  out.transition_matrix_top25 = matrix.map(r => ({ from: r.f ?? "∅", to: r.t, count: num(r.n) }));
  console.error("E done");

  // ── F. Reversal / retraction arcs ─────────────────────────────────────────
  const rev = await q<{ total: bigint }>(`
    SELECT COUNT(DISTINCT h."claimId") AS total
    FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId" AND c.deleted = false
    WHERE h."toAxis" = 'REVERSED'`);
  const revByComm = await q<{ community: string; n: bigint }>(`
    SELECT h.community AS community, COUNT(DISTINCT h."claimId") AS n
    FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId" AND c.deleted = false
    WHERE h."toAxis" = 'REVERSED' GROUP BY 1 ORDER BY 2 DESC`);
  const retractionPairs = await q<{ total: bigint; valid: bigint; indeterminate: bigint }>(`
    WITH pairs AS (
      SELECT h1."claimId",
             EXTRACT(EPOCH FROM (h2."occurredAt" - h1."occurredAt"))/86400 AS survival_days
      FROM "ClaimStatusHistory" h1
      JOIN "ClaimStatusHistory" h2 ON h1."claimId" = h2."claimId"
      WHERE h1."toAxis" = 'RECORDED' AND h1."fromAxis" IS NULL
        AND h2."toAxis" = 'REVERSED'
        AND h1.community = 'EXPERT_LITERATURE' AND h2.community = 'EXPERT_LITERATURE')
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE survival_days > 0)  AS valid,
           COUNT(*) FILTER (WHERE survival_days <= 0) AS indeterminate
    FROM pairs`);
  const courtRev = await q<{ judicial_reversed_claims: bigint; settled_to_reversed_judicial: bigint }>(`
    SELECT COUNT(DISTINCT h."claimId") FILTER (WHERE h."toAxis" = 'REVERSED')                            AS judicial_reversed_claims,
           COUNT(DISTINCT h."claimId") FILTER (WHERE h."fromAxis" = 'SETTLED' AND h."toAxis" = 'REVERSED') AS settled_to_reversed_judicial
    FROM "ClaimStatusHistory" h JOIN "Claim" c ON c.id = h."claimId" AND c.deleted = false
    WHERE h.community = 'JUDICIAL'`);
  const seedCourt = await q<{ n: bigint }>(`
    SELECT COUNT(*) AS n FROM "Claim" WHERE deleted = false AND "ingestedBy" = 'seed-court-reversals'`);
  out.reversal_arcs = {
    claims_with_reversed_transition: num(rev[0].total),
    by_community: revByComm.map(r => ({ community: r.community, claims: num(r.n) })),
    retraction_pairs_expert_literature: {
      total: num(retractionPairs[0].total), valid_positive_survival: num(retractionPairs[0].valid),
      indeterminate: num(retractionPairs[0].indeterminate),
    },
    court_reversals: {
      judicial_reversed_claims: num(courtRev[0].judicial_reversed_claims),
      judicial_settled_to_reversed_claims: num(courtRev[0].settled_to_reversed_judicial),
      seed_court_reversals_claims: num(seedCourt[0].n),
    },
  };
  console.error("F done");

  // ── G. Seeded trajectories by seed tag ────────────────────────────────────
  const seeds = await q<{ tag: string; claims: bigint; with_history: bigint }>(`
    SELECT c."ingestedBy" AS tag,
           COUNT(*) AS claims,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id)) AS with_history
    FROM "Claim" c
    WHERE c.deleted = false AND (c."ingestedBy" LIKE 'seed%' OR c."ingestedBy" LIKE '%settler%')
    GROUP BY 1 ORDER BY 2 DESC`);
  out.seeded_trajectories = seeds.map(r => ({ tag: r.tag, claims: num(r.claims), with_history: num(r.with_history) }));
  console.error("G done");

  // ── H. Sources ────────────────────────────────────────────────────────────
  const src = await q<{ total: bigint }>(`SELECT COUNT(*) AS total FROM "Source" WHERE deleted = false`);
  const srcByType = await q<{ t: string; n: bigint }>(`
    SELECT "methodologyType" AS t, COUNT(*) AS n FROM "Source" WHERE deleted = false GROUP BY 1 ORDER BY 2 DESC`);
  out.sources = { total_live: num(src[0].total), by_methodology_type: srcByType.map(r => ({ type: r.t, count: num(r.n) })) };
  console.error("H done");

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => { console.error("CENSUS_FAIL", e?.constructor?.name, e?.code ?? "", scrub(e?.message).slice(0, 400)); process.exitCode = 2; })
  .finally(() => prisma.$disconnect());
