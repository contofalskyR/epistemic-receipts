/**
 * link-omim-clinicaltrials.ts
 *
 * Builds DISEASE_STUDIED ClaimRelation rows from OMIM disease entries
 * (omim_v1) to ClinicalTrials.gov trials (clinicaltrials_v1) when the OMIM
 * disease name appears in the trial's text (condition or title).
 *
 * OMIM text format:
 *   "DISEASE NAME; ABBREV (MIM nnnnnn): <free text>"
 * The semicolon-separated tokens before "(MIM …)" are the official primary
 * name and aliases/abbreviations. Some entries omit the "(MIM N)" suffix or
 * include hyphens that break a strict regex, so we accept either pattern.
 *
 * ClinicalTrials text format:
 *   "Clinical trial NCT… (CODE)? registered to study <intervention> in
 *    <condition[, condition…]>, sponsored by <sponsor>, primary completion …"
 *
 * Matching: for each OMIM disease primary name (length ≥ MIN_NAME_LENGTH and
 * not a stoplist token like "SYNDROME" alone), ILIKE-substring against
 * clinicaltrials_v1 text. Single-word abbreviations (FAP1, MRMV1) are skipped
 * because they collide with unrelated trial-arm codes.
 *
 * Confidence: high (trial text contains the disease primary name verbatim).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-omim-clinicaltrials.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-omim-clinicaltrials.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

const RELATION_TYPE = "DISEASE_STUDIED";
const MIN_NAME_LENGTH = 10; // skip short names that match too broadly
const MAX_TRIALS_PER_DISEASE = 200;
const INSERT_BATCH = 1000;

// Stoplist names which match too broadly across unrelated trials
const STOPWORDS = new Set([
  "syndrome",
  "disease",
  "disorder",
  "deficiency",
  "anemia",
  "anaemia",
  "blood group",
  "complex disease",
  "complex trait",
]);

function parseOmimNames(text: string): string[] {
  // Try "NAME; ALIAS… (MIM N): …" pattern
  let m = text.match(/^(.+?)\s*\(MIM\s+\d+\)\s*:/s);
  if (!m) {
    // Fall back: take everything before the first colon
    const colon = text.indexOf(":");
    if (colon <= 0) return [];
    m = [text, text.slice(0, colon)] as RegExpMatchArray;
  }
  const part = m[1];
  // Split on `;` and strip surrounding whitespace
  return part
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function isAbbrev(name: string): boolean {
  // All upper-case alphanumeric ≤ 8 chars (FAP1, MRMV1, CWS1, AMC4, …)
  return /^[A-Z0-9]{2,8}$/.test(name);
}

function isAcceptableName(name: string): boolean {
  if (name.length < MIN_NAME_LENGTH) return false;
  if (isAbbrev(name)) return false;
  if (STOPWORDS.has(normalizeForCompare(name))) return false;
  return true;
}

// Produce a list of substring search variants for one OMIM primary name.
// OMIM disease names are heavily numbered/qualified (e.g. "FAMILIAL ADENOMATOUS
// POLYPOSIS 1" or "MATURITY-ONSET DIABETES OF THE YOUNG, TYPE 1"); trial text
// usually uses the un-numbered form. We progressively strip type/numeric
// qualifiers and add each form as a candidate.
function nameSearchVariants(name: string): string[] {
  const variants = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length >= MIN_NAME_LENGTH) variants.add(t);
  };
  add(name);

  // Drop "TYPE N", "FORM N", or trailing roman/arabic numerals
  const dropQual = name
    .replace(/,?\s*(TYPE|FORM|SUBTYPE|VARIANT)\s+[IVXLCDM0-9]+\s*$/i, "")
    .replace(/\s+[IVXLCDM0-9]+[A-Z]?\s*$/i, "")
    .trim();
  if (dropQual !== name) add(dropQual);

  // Take prefix before the first comma (drops trailing qualifiers like
  // "JUVENILE", "PEDIATRIC", "ADULT-ONSET")
  const beforeComma = name.split(",")[0].trim();
  if (beforeComma !== name) add(beforeComma);

  // Combine: comma-strip then drop trailing numeric qualifier
  const beforeCommaStripped = beforeComma
    .replace(/,?\s*(TYPE|FORM|SUBTYPE|VARIANT)\s+[IVXLCDM0-9]+\s*$/i, "")
    .replace(/\s+[IVXLCDM0-9]+[A-Z]?\s*$/i, "")
    .trim();
  if (beforeCommaStripped !== beforeComma) add(beforeCommaStripped);

  return [...variants];
}

async function main() {
  console.log(
    `\nlink-omim-clinicaltrials.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`,
  );

  // Load OMIM disease entries
  const omim = await prisma.claim.findMany({
    where: { ingestedBy: "omim_v1", deleted: false },
    select: { id: true, externalId: true, text: true },
  });
  console.log(`  Loaded ${omim.length} OMIM disease entries`);

  // Parse name variants, keep only acceptable primary form (first variant)
  type OmimEntry = {
    id: string;
    externalId: string | null;
    primary: string;
    allNames: string[];
  };
  const omimEntries: OmimEntry[] = [];
  let unparsed = 0;
  for (const o of omim) {
    if (!o.text) continue;
    const names = parseOmimNames(o.text);
    if (names.length === 0) {
      unparsed++;
      continue;
    }
    // Drop trailing aliases that are pure abbreviations; pick first acceptable
    const primary = names.find(isAcceptableName);
    if (!primary) continue;
    omimEntries.push({
      id: o.id,
      externalId: o.externalId,
      primary,
      allNames: names,
    });
  }
  console.log(
    `  OMIM with primary name acceptable: ${omimEntries.length}` +
      ` · unparsed: ${unparsed}` +
      ` · skipped (abbrev/too-short/stopword): ${omim.length - omimEntries.length - unparsed}`,
  );

  // Idempotency
  const existing = await prisma.claimRelation.findMany({
    where: { relationType: RELATION_TYPE },
    select: { fromClaimId: true, toClaimId: true },
  });
  const existingPairs = new Set<string>();
  for (const e of existing) existingPairs.add(`${e.fromClaimId}|${e.toClaimId}`);
  console.log(`  ${existing.length} existing ${RELATION_TYPE} relations`);

  // Per-OMIM ILIKE against clinicaltrials_v1 text. This is 1,500 queries,
  // each well-served by Postgres GIN/btree index on text — perfectly fine.
  type Candidate = {
    omimId: string;
    trialId: string;
    matchedName: string;
  };
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  let omimWithMatch = 0;
  let processed = 0;

  for (const oe of omimEntries) {
    processed++;
    const variants = nameSearchVariants(oe.primary);
    let matchedAny = false;
    let matchedVia = "";
    for (const v of variants) {
      const pattern = `%${v}%`;
      const trials = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Claim"
        WHERE "ingestedBy" = 'clinicaltrials_v1'
          AND deleted = false
          AND text ILIKE ${pattern}
        LIMIT ${MAX_TRIALS_PER_DISEASE}
      `;
      if (trials.length === 0) continue;
      matchedAny = true;
      matchedVia = v;
      for (const t of trials) {
        const key = `${oe.id}|${t.id}`;
        if (seen.has(key) || existingPairs.has(key)) continue;
        seen.add(key);
        candidates.push({
          omimId: oe.id,
          trialId: t.id,
          matchedName: matchedVia,
        });
      }
    }
    if (matchedAny) omimWithMatch++;
    if (processed % 200 === 0) {
      console.log(
        `  [${processed}/${omimEntries.length}] OMIM · ${omimWithMatch} matched · ${candidates.length} candidates so far`,
      );
    }
  }

  console.log(
    `\n  OMIM with ≥1 trial match: ${omimWithMatch}` +
      `\n  Candidate ${RELATION_TYPE} pairs (new): ${candidates.length}`,
  );

  let inserted = 0;
  if (DRY_RUN) {
    inserted = candidates.length;
  } else {
    for (let i = 0; i < candidates.length; i += INSERT_BATCH) {
      const batch = candidates.slice(i, i + INSERT_BATCH);
      const data = batch.map((c) => ({
        fromClaimId: c.omimId,
        toClaimId: c.trialId,
        relationType: RELATION_TYPE,
        followUpContext: {
          heuristic: "disease_name_ilike_trial_text",
          confidence: "high",
          matchedName: c.matchedName,
          pipeline_from: "omim_v1",
          pipeline_to: "clinicaltrials_v1",
        },
      }));
      const result = await prisma.claimRelation.createMany({
        data,
        skipDuplicates: true,
      });
      inserted += result.count;
    }
  }

  console.log(
    `\n  ${RELATION_TYPE} relations ${DRY_RUN ? "would-be-inserted" : "inserted"}: ${inserted}` +
      ` · already-existed: ${existing.length} · mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`,
  );

  if (!DRY_RUN) {
    const total = await prisma.claimRelation.count({
      where: { relationType: RELATION_TYPE },
    });
    console.log(`  Total ${RELATION_TYPE} relations in DB after run: ${total}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
