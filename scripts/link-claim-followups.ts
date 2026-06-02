/**
 * link-claim-followups.ts
 *
 * Phase 1 Analysis (embedded):
 * ─────────────────────────────────────────────────────────────────────────────
 * PIPELINE → FOLLOW-UP POTENTIAL MAPPING
 *
 * HIGH POTENTIAL (concrete linkable pairs in current DB):
 *
 * 1. crossref_retractions_v1 (26,624 claims)
 *    → Each retraction claim carries a DOI in metadata.doi (plain DOI, no URL prefix).
 *    → OpenAlex claims (openalex_v1, ~155k) store DOI as "https://doi.org/<doi>".
 *    → Strategy: DB-side join: openalex.metadata->>'doi' = 'https://doi.org/' || crossref.metadata->>'doi'
 *    → Relation type: REVERSED (original paper → retraction notice)
 *    → Actual DB match count: 26 (both datasets cover different subfields)
 *    → Future: more OpenAlex domains will increase this count significantly
 *
 * 2. clinicaltrials_v1 (10,957 claims)
 *    → OpenAlex biomedical papers (193 in DB) mention NCT IDs in abstract text.
 *    → Strategy: extract NCT IDs from OpenAlex text; match to clinicaltrials_v1 externalId.
 *    → Relation type: OUTCOME (trial → paper reporting results)
 *    → Note: FDA label text does NOT contain NCT IDs (verified by DB query).
 *
 * 3. congress_v1 (10,360 enacted laws)
 *    → "to amend the [Act Name]" pattern in claim text → detects amendment bills.
 *    → Strategy: regex on claim text; match title fragment to earlier law short titles.
 *    → Relation type: SUPERSEDED_BY (earlier law → amending law)
 *    → Actual match count: 408 (high confidence from text structure)
 *
 * 4. openfda_labels_v1 (85,068 claims)
 *    → Multiple label versions for same drug+manufacturer (e.g., ALCOHOL: 291 versions).
 *    → Strategy: group by metadata->>'generic_name' + metadata->>'manufacturer_name',
 *      order by metadata->>'effective_time' (YYYYMMDD string), chain SUPERSEDED_BY.
 *    → Relation type: SUPERSEDED_BY
 *    → Caution: caps chains at 50 per drug to avoid combinatorial explosion.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * FUTURE PIPELINES THAT SHOULD FEED THIS LAYER:
 *
 * - ClinicalTrials.gov status API: trial completion/termination/results published → OUTCOME
 * - FDA PDUFA action dates: trial → approval/rejection within 12 months → OUTCOME
 * - openFDA recalls: approval → recall notice → REVERSED
 * - CourtListener "cited_with_analysis" field: SCOTUS reversal detection → REVERSED
 * - EUR-Lex amendment tracker: legislation → amending act → EXPANDED / SUPERSEDED_BY
 * - PubPeer API: paper → expression of concern → STATUS_UPDATE, then retraction → REVERSED
 * - Retraction Watch DB: richer retraction metadata than CrossRef alone
 * - Executive Order revocation chain: EO X revokes EO Y → REVERSED
 * - ECHR subsequent decisions on same Article: Article 6 ruling → later Article 6 ruling → STATUS_UPDATE
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-claim-followups.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-claim-followups.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

interface LinkResult {
  type: string;
  pipeline: string;
  inserted: number;
  skipped: number;
}

async function upsertRelation(
  fromClaimId: string,
  toClaimId: string,
  relationType: string,
  followUpContext: object
): Promise<"inserted" | "skipped"> {
  try {
    await prisma.claimRelation.create({
      data: { fromClaimId, toClaimId, relationType, followUpContext },
    });
    return "inserted";
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") return "skipped";
    throw e;
  }
}

// ─── A. CrossRef retractions → OpenAlex papers (REVERSED) ────────────────────

async function linkRetractions(): Promise<LinkResult> {
  console.log("\n=== A. CrossRef Retractions → OpenAlex papers (REVERSED) ===");
  console.log("  Strategy: DOI exact match (openalex doi = 'https://doi.org/' || crossref doi)");

  // DB-side join is fastest and handles the URL-prefix normalization
  const matches = await prisma.$queryRaw<
    Array<{ openalex_id: string; retraction_id: string; doi: string }>
  >`
    SELECT c_openalex.id AS openalex_id,
           c_retract.id  AS retraction_id,
           c_retract.metadata->>'doi' AS doi
    FROM "Claim" c_openalex
    JOIN "Claim" c_retract
      ON c_openalex."ingestedBy" = 'openalex_v1'
     AND c_retract."ingestedBy" = 'crossref_retractions_v1'
     AND c_openalex.deleted = false
     AND c_retract.deleted = false
     AND c_openalex.metadata->>'doi' = 'https://doi.org/' || (c_retract.metadata->>'doi')
  `;

  console.log(`  Found ${matches.length} DOI matches`);

  let inserted = 0;
  let skipped = 0;
  if (!DRY_RUN) {
    for (const m of matches) {
      const result = await upsertRelation(m.openalex_id, m.retraction_id, "REVERSED", {
        heuristic: "doi_exact_match",
        confidence: "high",
        doi: m.doi,
        pipeline_from: "openalex_v1",
        pipeline_to: "crossref_retractions_v1",
        note: "Original paper linked to its CrossRef retraction notice",
      });
      if (result === "inserted") inserted++;
      else skipped++;
    }
    console.log(`  Inserted: ${inserted}, already existed: ${skipped}`);
  } else {
    inserted = matches.length;
    console.log(`  DRY RUN — would insert ${inserted} rows`);
  }

  return { type: "REVERSED", pipeline: "openalex_v1 → crossref_retractions_v1", inserted, skipped };
}

// ─── B. ClinicalTrials → OpenAlex result papers (OUTCOME) ───────────────────

async function linkTrialsToOpenAlex(): Promise<LinkResult> {
  console.log("\n=== B. ClinicalTrials → OpenAlex result papers (OUTCOME) ===");
  console.log("  Strategy: NCT ID appears in OpenAlex paper abstract text");

  const NCT_RE = /NCT\d{8}/g;

  // Build NCT → trial claim ID index
  const trials = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "clinicaltrials_v1" },
    select: { id: true, externalId: true },
  });
  const nctToId = new Map<string, string>();
  for (const t of trials) {
    const nct = t.externalId?.replace("nct_", "").toUpperCase();
    if (nct) nctToId.set(nct, t.id);
  }
  console.log(`  Loaded ${nctToId.size} trial claims`);

  // Scan OpenAlex papers for NCT ID mentions
  const toInsert: Array<{ trialId: string; paperClaimId: string; nct: string }> = [];

  // Use DB query to pull only papers that contain NCT pattern (faster via regex index)
  const papers = await prisma.$queryRaw<Array<{ id: string; text: string }>>`
    SELECT id, text FROM "Claim"
    WHERE "ingestedBy" = 'openalex_v1'
    AND deleted = false
    AND text ~ 'NCT[0-9]{8}'
  `;

  console.log(`  Found ${papers.length} OpenAlex papers with NCT IDs in text`);

  for (const paper of papers) {
    const matches = paper.text.match(NCT_RE);
    if (!matches) continue;
    const seen = new Set<string>();
    for (const nct of matches) {
      if (seen.has(nct)) continue;
      seen.add(nct);
      const trialId = nctToId.get(nct);
      if (trialId) {
        toInsert.push({ trialId, paperClaimId: paper.id, nct });
      }
    }
  }

  console.log(`  Found ${toInsert.length} trial → paper links`);

  let inserted = 0;
  let skipped = 0;
  if (!DRY_RUN) {
    for (const row of toInsert) {
      const result = await upsertRelation(row.trialId, row.paperClaimId, "OUTCOME", {
        heuristic: "nct_id_in_paper_text",
        confidence: "high",
        nct_id: row.nct,
        pipeline_from: "clinicaltrials_v1",
        pipeline_to: "openalex_v1",
        note: "OpenAlex paper text mentions this clinical trial's NCT number",
      });
      if (result === "inserted") inserted++;
      else skipped++;
    }
    console.log(`  Inserted: ${inserted}, already existed: ${skipped}`);
  } else {
    inserted = toInsert.length;
    console.log(`  DRY RUN — would insert ${inserted} rows`);
  }

  return { type: "OUTCOME", pipeline: "clinicaltrials_v1 → openalex_v1", inserted, skipped };
}

// ─── C. Congress enacted laws — amendment detection (SUPERSEDED_BY) ──────────

async function linkCongressAmendments(): Promise<LinkResult> {
  console.log("\n=== C. Congress Laws → Amendments (SUPERSEDED_BY) ===");
  console.log("  Strategy: 'to amend [Act Name]' text pattern → title fragment match");

  const laws = await prisma.claim.findMany({
    where: { deleted: false, ingestedBy: "congress_v1" },
    select: { id: true, text: true, claimEmergedAt: true },
    orderBy: { claimEmergedAt: "asc" },
  });
  console.log(`  Loaded ${laws.length} enacted congress laws`);

  // Build index: short title → claim ID
  const titleToId = new Map<string, string>();
  for (const law of laws) {
    const m = law.text.match(/enacted\s+[—\-]\s+(.+)$/);
    if (m) titleToId.set(m[1].toLowerCase().trim(), law.id);
  }

  // Pattern: "to amend the [Act Name]" or "to amend [Act Name]"
  const AMEND_RE = /\bto amend(?: the)?\s+(.{6,80})(?:,|;|$)/i;

  const toInsert: Array<{ fromClaimId: string; toClaimId: string; matchedTitle: string; fragment: string }> = [];

  for (const law of laws) {
    const amendMatch = law.text.match(AMEND_RE);
    if (!amendMatch) continue;

    const fragment = amendMatch[1].toLowerCase().trim();
    // Fragment is the beginning of the act being amended — match against known titles
    for (const [title, id] of titleToId) {
      if (id === law.id) continue;
      // Fragment must match a prefix of the title or vice versa
      if (title.startsWith(fragment) || fragment.startsWith(title.split(",")[0])) {
        toInsert.push({ fromClaimId: id, toClaimId: law.id, matchedTitle: title, fragment });
        break;
      }
    }
  }

  console.log(`  Found ${toInsert.length} amendment links`);

  let inserted = 0;
  let skipped = 0;
  if (!DRY_RUN) {
    for (const row of toInsert) {
      const result = await upsertRelation(row.fromClaimId, row.toClaimId, "SUPERSEDED_BY", {
        heuristic: "amendment_text_match",
        confidence: "medium",
        matched_title: row.matchedTitle,
        amending_fragment: row.fragment,
        pipeline_from: "congress_v1",
        pipeline_to: "congress_v1",
        note: "Later law explicitly amends this act (detected via 'to amend' text pattern)",
      });
      if (result === "inserted") inserted++;
      else skipped++;
    }
    console.log(`  Inserted: ${inserted}, already existed: ${skipped}`);
  } else {
    inserted = toInsert.length;
    console.log(`  DRY RUN — would insert ${inserted} rows`);
  }

  return { type: "SUPERSEDED_BY", pipeline: "congress_v1 → congress_v1 (amendments)", inserted, skipped };
}

// ─── D. FDA Labels — same drug+manufacturer, newer label supersedes older ────

async function linkFdaLabelVersions(): Promise<LinkResult> {
  console.log("\n=== D. FDA Labels — version chains (SUPERSEDED_BY) ===");
  console.log("  Strategy: same generic_name + manufacturer_name, ordered by effective_time");

  // Pull from DB grouped
  const rows = await prisma.$queryRaw<
    Array<{ id: string; generic_name: string; manufacturer_name: string; effective_time: string }>
  >`
    SELECT id,
           metadata->>'generic_name' AS generic_name,
           metadata->>'manufacturer_name' AS manufacturer_name,
           metadata->>'effective_time' AS effective_time
    FROM "Claim"
    WHERE "ingestedBy" = 'openfda_labels_v1'
    AND deleted = false
    AND metadata->>'generic_name' IS NOT NULL
    AND metadata->>'manufacturer_name' IS NOT NULL
    AND metadata->>'effective_time' IS NOT NULL
    ORDER BY metadata->>'generic_name', metadata->>'manufacturer_name', metadata->>'effective_time' ASC
  `;

  // Group by drug+mfr
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.generic_name}|||${row.manufacturer_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const toInsert: Array<{ fromId: string; toId: string; drug: string; mfr: string }> = [];
  for (const [key, versions] of groups) {
    if (versions.length < 2) continue;
    const [drug, mfr] = key.split("|||");
    // Chain: each version is SUPERSEDED_BY the next one only (not all-pairs)
    // Cap at 50 versions to avoid combinatorial noise
    const capped = versions.slice(0, 50);
    for (let i = 0; i < capped.length - 1; i++) {
      toInsert.push({ fromId: capped[i].id, toId: capped[i + 1].id, drug, mfr });
    }
  }

  console.log(`  ${groups.size} distinct drug+manufacturer groups → ${toInsert.length} SUPERSEDED_BY pairs`);

  let inserted = 0;
  let skipped = 0;
  if (!DRY_RUN && toInsert.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH);
      await prisma.$transaction(
        async (tx) => {
          for (const row of chunk) {
            try {
              await tx.claimRelation.create({
                data: {
                  fromClaimId: row.fromId,
                  toClaimId: row.toId,
                  relationType: "SUPERSEDED_BY",
                  followUpContext: {
                    heuristic: "same_drug_manufacturer_later_effective_date",
                    confidence: "medium",
                    generic_name: row.drug,
                    manufacturer_name: row.mfr,
                    pipeline_from: "openfda_labels_v1",
                    pipeline_to: "openfda_labels_v1",
                    note: "Later FDA label version for same drug+manufacturer",
                  },
                },
              });
              inserted++;
            } catch (e: unknown) {
              if ((e as { code?: string })?.code === "P2002") skipped++;
              else throw e;
            }
          }
        },
        { timeout: 30000 }
      );
      process.stdout.write(`\r  Batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(toInsert.length / BATCH)}: +${inserted}`);
    }
    console.log(`\n  Total inserted: ${inserted}, already existed: ${skipped}`);
  } else if (DRY_RUN) {
    inserted = toInsert.length;
    console.log(`  DRY RUN — would insert ${inserted} rows`);
  }

  return { type: "SUPERSEDED_BY", pipeline: "openfda_labels_v1 version chains", inserted, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nlink-claim-followups.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  const results: LinkResult[] = [];

  results.push(await linkRetractions());
  results.push(await linkTrialsToOpenAlex());
  results.push(await linkCongressAmendments());
  results.push(await linkFdaLabelVersions());

  console.log("\n=== SUMMARY ===");
  let totalInserted = 0;
  for (const r of results) {
    console.log(`  ${r.type} (${r.pipeline}): +${r.inserted} inserted, ${r.skipped} skipped`);
    totalInserted += r.inserted;
  }
  console.log(`\n  Total follow-up links: ${totalInserted}`);
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);

  const dbCounts = await prisma.claimRelation.groupBy({
    by: ["relationType"],
    _count: true,
    orderBy: { _count: { id: "desc" } },
  });
  console.log("\n  DB ClaimRelation counts by type:");
  for (const row of dbCounts) {
    console.log(`    ${row.relationType}: ${row._count}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
