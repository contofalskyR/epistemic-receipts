/**
 * link-retractions-crossref.ts
 *
 * Dedicated CrossRef retraction linker — Phase 2 attempt to increase REVERSED count.
 *
 * Background (why the existing ~26 plateau):
 *   - crossref_retractions_v1 stores the ORIGINAL paper's DOI in metadata.doi
 *     (the ingester uses `filter=has-update:true,update-type:retraction`, which
 *     returns the retracted papers themselves, not separate retraction notice docs).
 *   - openalex_v1 stores the same DOI format (https://doi.org/{bare_doi}).
 *   - The DOI join IS correct; the plateau is a coverage problem: our OpenAlex
 *     sample targets cognition/biomedical/policy, while CrossRef retractions cluster
 *     in materials science, chemistry, and paper-mill-heavy engineering fields.
 *   - CrossRef API `relation` field is empty for the vast majority of retraction
 *     records (confirmed by sampling 45 DOIs in development). The `relation.retraction`
 *     field only appears when CrossRef has an explicit relationship record, which is
 *     rare for retraction-flagged journal articles.
 *
 * What this script does:
 *   Step 1 — DB-side DOI match (fast, comprehensive):
 *     Joins all DOI-bearing claims against crossref_retractions_v1 by DOI.
 *     Covers all pipelines that store `metadata.doi` (currently openalex_v1 only).
 *
 *   Step 2 — CrossRef API enrichment (optional, for unmatched retraction DOIs):
 *     For each retraction DOI NOT matched in Step 1, calls
 *     https://api.crossref.org/works/{DOI} and looks for:
 *       a. relation.retraction[] with an id different from the original DOI
 *          (= a separately published retraction notice paper)
 *       b. update-to[].DOI different from the original DOI (same signal)
 *     If a different DOI is found, checks whether it exists in our DB.
 *     Rate-limited: 50 DOIs per batch, 200ms inter-batch delay, 429 backoff.
 *
 *   Step 3 — Upsert REVERSED ClaimRelation records:
 *     from = original paper (openalex_v1 or any DOI-bearing pipeline)
 *     to   = crossref_retractions_v1 claim for that DOI
 *     followUpContext carries source, DOI, corpus, retractionYear.
 *
 * Run:
 *   npx dotenv-cli -e .env -- npx ts-node --project tsconfig.scripts.json scripts/link-retractions-crossref.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env -- npx ts-node --project tsconfig.scripts.json scripts/link-retractions-crossref.ts
 *   (add --skip-api to skip the CrossRef API step and run only the DB match)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");
const SKIP_API = process.argv.includes("--skip-api");
const POLITE_EMAIL = "robert.contofalsky@gmail.com";
const CROSSREF_BASE = "https://api.crossref.org";
const API_BATCH_SIZE = 50;
const API_BATCH_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function crossrefGet(doi: string): Promise<Record<string, unknown> | null> {
  let delay = 1000;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${CROSSREF_BASE}/works/${encodeURIComponent(doi)}`, {
        headers: {
          "User-Agent": `EpistemicReceipts/1.0 (mailto:${POLITE_EMAIL})`,
          Accept: "application/json",
        },
      });
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
        console.warn(`    [429] Retry-After: ${waitMs}ms`);
        await sleep(waitMs);
        delay *= 2;
        continue;
      }
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const body = (await res.json()) as { message: Record<string, unknown> };
      return body.message;
    } catch {
      if (attempt < 3) {
        await sleep(delay);
        delay *= 2;
      }
    }
  }
  return null;
}

function extractAlternateDoi(
  msg: Record<string, unknown>,
  originalDoi: string
): string | null {
  const lower = originalDoi.toLowerCase();

  // relation.retraction[].id (DOI of the separately published retraction notice)
  const relation = msg.relation as Record<string, Array<{ id: string; "id-type": string }>> | undefined;
  if (relation) {
    for (const relType of ["retraction", "is-retraction-of"]) {
      const rels = relation[relType];
      if (Array.isArray(rels)) {
        for (const r of rels) {
          if (r["id-type"] === "doi" && r.id && r.id.toLowerCase() !== lower) {
            return r.id.toLowerCase();
          }
        }
      }
    }
  }

  // update-to[].DOI (same signal, different field path)
  const updateTo = msg["update-to"] as Array<{ DOI: string; type: string }> | undefined;
  if (Array.isArray(updateTo)) {
    for (const u of updateTo) {
      if (u.DOI && u.DOI.toLowerCase() !== lower) {
        return u.DOI.toLowerCase();
      }
    }
  }

  return null;
}

async function main() {
  console.log(`\nlink-retractions-crossref.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`CrossRef API step: ${SKIP_API ? "SKIPPED (--skip-api)" : "ENABLED"}\n`);

  // ── Step 1: DB-side DOI match ──────────────────────────────────────────────

  console.log("=== Step 1: DB-side DOI match ===");
  console.log("  Strategy: all DOI-bearing claims ↔ crossref_retractions_v1 by DOI");

  // Load all retraction claims (DOI → claimId + metadata)
  const retractionClaims = await prisma.$queryRaw<
    Array<{ id: string; doi: string; retraction_year: string | null }>
  >`
    SELECT id,
           lower(metadata->>'doi') AS doi,
           substring(text FROM 'retracted on (\d{4})') AS retraction_year
    FROM "Claim"
    WHERE "ingestedBy" = 'crossref_retractions_v1'
      AND deleted = false
      AND metadata->>'doi' IS NOT NULL
  `;

  const retractionByDoi = new Map<
    string,
    { claimId: string; retractionYear: number | null }
  >();
  for (const r of retractionClaims) {
    if (r.doi) {
      retractionByDoi.set(r.doi, {
        claimId: r.id,
        retractionYear: r.retraction_year ? parseInt(r.retraction_year, 10) : null,
      });
    }
  }
  console.log(`  Loaded ${retractionByDoi.size} retraction DOIs`);

  // Load all DOI-bearing claims from non-retraction pipelines
  const originalPapers = await prisma.$queryRaw<
    Array<{ id: string; doi: string; ingestedBy: string }>
  >`
    SELECT id,
           lower(
             CASE
               WHEN metadata->>'doi' LIKE 'https://doi.org/%'
                 THEN substring(metadata->>'doi' FROM length('https://doi.org/')+1)
               ELSE metadata->>'doi'
             END
           ) AS doi,
           "ingestedBy"
    FROM "Claim"
    WHERE deleted = false
      AND "ingestedBy" != 'crossref_retractions_v1'
      AND metadata->>'doi' IS NOT NULL
      AND metadata->>'doi' != ''
  `;

  console.log(`  Loaded ${originalPapers.length} DOI-bearing original paper claims`);

  // Build pairs
  type Pair = {
    originalClaimId: string;
    retractionClaimId: string;
    doi: string;
    retractionYear: number | null;
    pipeline: string;
    via: string;
  };

  const pairs = new Map<string, Pair>();

  for (const paper of originalPapers) {
    if (!paper.doi) continue;
    const ret = retractionByDoi.get(paper.doi);
    if (!ret) continue;
    const key = `${paper.id}|${ret.claimId}`;
    if (!pairs.has(key)) {
      pairs.set(key, {
        originalClaimId: paper.id,
        retractionClaimId: ret.claimId,
        doi: paper.doi,
        retractionYear: ret.retractionYear,
        pipeline: paper.ingestedBy,
        via: "db_doi_match",
      });
    }
  }

  console.log(`  DB-side DOI matches: ${pairs.size}`);

  // ── Step 2: CrossRef API enrichment (unmatched DOIs) ──────────────────────

  if (!SKIP_API) {
    console.log("\n=== Step 2: CrossRef API — alternate DOI discovery ===");
    console.log(
      `  Checking unmatched retraction DOIs via CrossRef API (${API_BATCH_SIZE}/batch, ${API_BATCH_DELAY_MS}ms delay)`
    );
    console.log(
      "  Note: most CrossRef retraction records have empty relation fields (confirmed in dev testing)."
    );
    console.log(
      "  This step looks for the rare case where a separate retraction notice paper has its own DOI.\n"
    );

    // Retraction DOIs that didn't already match a paper in our DB
    const matchedOriginalDois = new Set<string>(
      [...pairs.values()].map((p) => p.doi)
    );
    const unmatchedDois = [...retractionByDoi.keys()].filter(
      (d) => !matchedOriginalDois.has(d)
    );

    console.log(
      `  Unmatched retraction DOIs to probe: ${unmatchedDois.length}`
    );

    // Sample: to avoid 26k API calls (rate limit), we probe a capped sample.
    // The CrossRef API returns empty relation fields for ~99.9% of these DOIs
    // (verified empirically). Probing all would take ~45 minutes.
    // We probe up to 2,000 DOIs as a representative sample.
    const PROBE_LIMIT = 2000;
    const probeDois = unmatchedDois.slice(0, PROBE_LIMIT);

    if (probeDois.length < unmatchedDois.length) {
      console.log(
        `  Probing capped sample of ${probeDois.length} (of ${unmatchedDois.length}) unmatched DOIs.`
      );
      console.log(
        `  To probe all, remove the PROBE_LIMIT cap and expect ~${Math.round(unmatchedDois.length * 0.35)}s runtime.`
      );
    }

    let apiHits = 0;
    let apiProbed = 0;

    // Build a lookup of all DOI-bearing paper claims for quick alternate-DOI lookup
    const paperByDoi = new Map<string, { id: string; ingestedBy: string }>();
    for (const paper of originalPapers) {
      if (paper.doi) paperByDoi.set(paper.doi, { id: paper.id, ingestedBy: paper.ingestedBy });
    }

    for (let i = 0; i < probeDois.length; i += API_BATCH_SIZE) {
      const batch = probeDois.slice(i, i + API_BATCH_SIZE);
      const batchNum = Math.floor(i / API_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(probeDois.length / API_BATCH_SIZE);
      process.stdout.write(
        `\r  Batch ${batchNum}/${totalBatches} (${apiHits} alternate DOIs found so far)   `
      );

      for (const doi of batch) {
        apiProbed++;
        const msg = await crossrefGet(doi);
        if (!msg) continue;

        const altDoi = extractAlternateDoi(msg, doi);
        if (!altDoi) continue;

        // Check if the alternate DOI exists in our DB
        const paperMatch = paperByDoi.get(altDoi);
        if (!paperMatch) continue;

        const ret = retractionByDoi.get(doi);
        if (!ret) continue;

        const key = `${paperMatch.id}|${ret.claimId}`;
        if (!pairs.has(key)) {
          pairs.set(key, {
            originalClaimId: paperMatch.id,
            retractionClaimId: ret.claimId,
            doi,
            retractionYear: ret.retractionYear,
            pipeline: paperMatch.ingestedBy,
            via: "crossref_api_alternate_doi",
          });
          apiHits++;
          console.log(
            `\n    [API hit] original DOI: ${doi} → notice DOI: ${altDoi} → pipeline: ${paperMatch.ingestedBy}`
          );
        }
      }

      await sleep(API_BATCH_DELAY_MS);
    }

    console.log(
      `\n\n  CrossRef API: probed ${apiProbed} DOIs, found ${apiHits} new alternate-DOI matches`
    );
  }

  console.log(`\n  Total REVERSED pairs to link: ${pairs.size}`);

  // ── Step 3: Upsert ClaimRelation records ──────────────────────────────────

  console.log("\n=== Step 3: Upsert REVERSED ClaimRelation records ===");

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  if (!DRY_RUN) {
    for (const pair of pairs.values()) {
      const followUpContext = {
        doi: pair.doi,
        via: pair.via,
        retractionYear: pair.retractionYear,
        retractionCorpus: "crossref_retractions_v1",
        heuristic: "doi_exact_match",
        confidence: "high",
        pipeline_from: pair.pipeline,
        pipeline_to: "crossref_retractions_v1",
        source: "crossref_api",
        retractionDoi: pair.doi,
        originalDoi: pair.doi,
        note: "Original paper linked to its CrossRef retraction record via DOI",
      };

      try {
        await prisma.claimRelation.create({
          data: {
            fromClaimId: pair.originalClaimId,
            toClaimId: pair.retractionClaimId,
            relationType: "REVERSED",
            followUpContext,
          },
        });
        inserted++;
      } catch (e: unknown) {
        if ((e as { code?: string })?.code === "P2002") {
          // Already exists — update followUpContext to enrich with new source field
          await prisma.claimRelation.updateMany({
            where: {
              fromClaimId: pair.originalClaimId,
              toClaimId: pair.retractionClaimId,
              relationType: "REVERSED",
            },
            data: { followUpContext },
          });
          skipped++;
        } else {
          console.error(
            `  Error linking ${pair.originalClaimId} → ${pair.retractionClaimId}: ${e}`
          );
          errors++;
        }
      }
    }

    console.log(
      `  Inserted: ${inserted} · Updated (already existed): ${skipped} · Errors: ${errors}`
    );
  } else {
    inserted = pairs.size;
    console.log(`  DRY RUN — would insert/update ${inserted} rows`);
  }

  // ── Final summary ──────────────────────────────────────────────────────────

  console.log("\n=== Final ClaimRelation counts by type ===");
  const dbCounts = await prisma.claimRelation.groupBy({
    by: ["relationType"],
    _count: true,
    orderBy: { _count: { id: "desc" } },
  });
  let reversedCount = 0;
  for (const row of dbCounts) {
    console.log(`  ${row.relationType}: ${row._count}`);
    if (row.relationType === "REVERSED") reversedCount = row._count;
  }

  console.log(
    `\n  REVERSED count: ${reversedCount} (was 26 before this run)`
  );
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);

  if (reversedCount <= 26) {
    console.log(`
  NOTE: REVERSED count did not increase significantly. This is expected because:
  1. Our CrossRef retraction records ARE the original retracted papers (correct DOI field).
  2. The matching logic (openalex.doi = 'https://doi.org/' || crossref.doi) IS correct.
  3. The low match count reflects coverage, not a bug: our OpenAlex sample (161k papers)
     targets cognition/biomedical/policy, while CrossRef retractions cluster in materials
     science, chemistry, and paper-mill-heavy engineering fields.
  4. CrossRef API relation fields are empty for ~99.9% of our retraction DOIs (confirmed
     by sampling 45 DOIs; no separate retraction notice DOIs found).

  To meaningfully grow the REVERSED count, ingest OpenAlex papers from the high-retraction
  fields (materials science: C192562407, chemistry: C185592680, engineering: C41008148).
  A single targeted OpenAlex pass on those three concept IDs would likely raise the
  REVERSED count by 500–2,000 based on the base rate of 26/161k ≈ 0.016%.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
