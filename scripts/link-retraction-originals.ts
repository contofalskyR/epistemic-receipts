/**
 * link-retraction-originals.ts
 *
 * Pipeline 3 of the follow-up linker batch (2026-06-01).
 *
 * Collects DOIs from both retraction corpora — crossref_retractions_v1 (26,624)
 * and retraction_watch_v1 (55) — then finds the original paper claim in OpenAlex
 * via three signals:
 *   a. OpenAlex metadata->>'doi' (stored as "https://doi.org/<doi>")
 *   b. The DOI value alone (some claims store the bare DOI)
 *   c. Source.url DOI URLs linked via Edge
 *
 * Writes REVERSED relations: original paper claim → retraction record claim.
 *
 * For crossref_retractions_v1, the DOI sits in metadata.doi. For retraction_watch_v1,
 * metadata is null but the externalId encodes the DOI ("rw-claim-<doi>"). Both are
 * normalized to lowercase, bare-DOI form for the lookup.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-retraction-originals.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-retraction-originals.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

const DOI_URL_RE = /^https?:\/\/(?:dx\.)?doi\.org\//i;

function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  d = d.replace(DOI_URL_RE, "");
  d = d.replace(/^doi:\s*/i, "");
  if (!d.startsWith("10.")) return null;
  return d;
}

interface RetractionInfo {
  claimId: string;
  doi: string;
  corpus: string;
  retractionYear: number | null;
  reason: string | null;
}

const YEAR_RE = /retracted on (\d{4})/i;

async function loadRetractions(): Promise<Map<string, RetractionInfo>> {
  const map = new Map<string, RetractionInfo>();

  const crossref = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "crossref_retractions_v1" },
    select: { id: true, externalId: true, text: true, metadata: true },
  });
  let cFromMeta = 0;
  let cFromExt = 0;
  for (const r of crossref) {
    const meta = r.metadata as Record<string, unknown> | null;
    const rawDoi =
      meta && typeof meta.doi === "string"
        ? meta.doi
        : r.externalId?.replace(/^crossref_retraction_/, "").replace(/_/g, "/") ?? null;
    const doi = normalizeDoi(rawDoi);
    if (!doi) continue;
    const yearMatch = r.text.match(YEAR_RE);
    map.set(doi, {
      claimId: r.id,
      doi,
      corpus: "crossref_retractions_v1",
      retractionYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
      reason: null,
    });
    if (meta && typeof meta.doi === "string") cFromMeta++;
    else cFromExt++;
  }
  console.log(
    `  Loaded ${crossref.length} crossref_retractions_v1 claims (DOI from metadata: ${cFromMeta}, externalId fallback: ${cFromExt})`
  );

  const rw = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "retraction_watch_v1" },
    select: { id: true, externalId: true, text: true },
  });
  let rwLoaded = 0;
  for (const r of rw) {
    const rawDoi = r.externalId?.replace(/^rw-claim-/, "") ?? null;
    const doi = normalizeDoi(rawDoi);
    if (!doi) continue;
    if (!map.has(doi)) {
      const yearMatch = r.text.match(YEAR_RE);
      map.set(doi, {
        claimId: r.id,
        doi,
        corpus: "retraction_watch_v1",
        retractionYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
        reason: null,
      });
      rwLoaded++;
    }
  }
  console.log(
    `  Loaded ${rw.length} retraction_watch_v1 claims (${rwLoaded} added to DOI map; rest deduped against crossref)`
  );

  return map;
}

async function main() {
  console.log(`\nlink-retraction-originals.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  const retractionByDoi = await loadRetractions();
  console.log(`  Total unique retraction DOIs: ${retractionByDoi.size}`);

  const dois = Array.from(retractionByDoi.keys());
  const doisWithUrlPrefix = dois.map((d) => `https://doi.org/${d}`);

  // Match A: OpenAlex metadata.doi (URL-prefixed form)
  console.log(`\n  Searching OpenAlex metadata.doi (URL-prefixed form)…`);
  const oaByMetaUrl = await prisma.$queryRaw<
    Array<{ id: string; doi: string }>
  >`
    SELECT id, lower(replace(metadata->>'doi', 'https://doi.org/', '')) AS doi
    FROM "Claim"
    WHERE "ingestedBy" = 'openalex_v1'
      AND deleted = false
      AND metadata->>'doi' = ANY(${doisWithUrlPrefix})
  `;
  console.log(`    → ${oaByMetaUrl.length} matches`);

  // Match B: OpenAlex metadata.doi storing the bare DOI (no prefix)
  console.log(`  Searching OpenAlex metadata.doi (bare form)…`);
  const oaByMetaBare = await prisma.$queryRaw<
    Array<{ id: string; doi: string }>
  >`
    SELECT id, lower(metadata->>'doi') AS doi
    FROM "Claim"
    WHERE "ingestedBy" = 'openalex_v1'
      AND deleted = false
      AND lower(metadata->>'doi') = ANY(${dois})
  `;
  console.log(`    → ${oaByMetaBare.length} matches`);

  // Match C: OpenAlex Source.url DOI URL
  console.log(`  Searching OpenAlex Source.url DOI URLs…`);
  const oaBySrcUrl = await prisma.$queryRaw<
    Array<{ claim_id: string; doi: string }>
  >`
    SELECT DISTINCT c.id AS claim_id,
           lower(replace(s.url, 'https://doi.org/', '')) AS doi
    FROM "Claim" c
    JOIN "Edge" e ON e."claimId" = c.id
    JOIN "Source" s ON s.id = e."sourceId"
    WHERE c."ingestedBy" = 'openalex_v1'
      AND c.deleted = false
      AND lower(s.url) = ANY(${doisWithUrlPrefix.map((u) => u.toLowerCase())})
  `;
  console.log(`    → ${oaBySrcUrl.length} matches`);

  // Combine all matches, deduplicating by (originalClaimId, retractionClaimId)
  type Pair = { originalId: string; doi: string; via: string };
  const byPair = new Map<string, Pair>();

  function add(originalId: string, doi: string, via: string) {
    const ret = retractionByDoi.get(doi);
    if (!ret) return;
    if (originalId === ret.claimId) return; // don't link a claim to itself
    const key = `${originalId}|${ret.claimId}`;
    if (!byPair.has(key)) byPair.set(key, { originalId, doi, via });
  }

  for (const row of oaByMetaUrl) add(row.id, row.doi, "openalex_metadata_doi_url");
  for (const row of oaByMetaBare) add(row.id, row.doi, "openalex_metadata_doi_bare");
  for (const row of oaBySrcUrl) add(row.claim_id, row.doi, "openalex_source_url");

  console.log(`\n  Total unique original→retraction pairs: ${byPair.size}`);

  let inserted = 0;
  let skipped = 0;
  for (const pair of byPair.values()) {
    const ret = retractionByDoi.get(pair.doi);
    if (!ret) continue;
    const followUpContext = {
      doi: pair.doi,
      via: pair.via,
      retractionCorpus: ret.corpus,
      retractionYear: ret.retractionYear,
      retractionReason: ret.reason,
      heuristic: "doi_exact_match",
      confidence: "high",
      pipeline_from: "openalex_v1",
      pipeline_to: ret.corpus,
    };

    if (DRY_RUN) {
      inserted++;
      continue;
    }
    try {
      await prisma.claimRelation.create({
        data: {
          fromClaimId: pair.originalId,
          toClaimId: ret.claimId,
          relationType: "REVERSED",
          followUpContext,
        },
      });
      inserted++;
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        await prisma.claimRelation.updateMany({
          where: {
            fromClaimId: pair.originalId,
            toClaimId: ret.claimId,
            relationType: "REVERSED",
          },
          data: { followUpContext },
        });
        skipped++;
      } else throw e;
    }
  }

  console.log(
    `\n  Inserted: ${inserted} · skipped/updated (already existed): ${skipped} · mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
