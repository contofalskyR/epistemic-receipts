/**
 * link-chebi-openfda.ts
 *
 * Builds COMPOUND_IN ClaimRelation rows from ChEBI compound claims (fromClaim,
 * chebi_v1) to openFDA drug label claims (toClaim, openfda_labels_v1) when the
 * ChEBI compound name appears as an active ingredient in the drug label's
 * `generic_name` field.
 *
 * Match strategy:
 *   1. Index openFDA labels by ingredient. Each label's `metadata.generic_name`
 *      is uppercased and may list multiple active ingredients separated by
 *      commas or the word "AND" (e.g. "ENALAPRIL MALEATE AND HYDROCHLOROTHIAZIDE").
 *      We split on those separators, lowercase, trim, and de-stopword to a
 *      canonical ingredient form.
 *   2. For each ChEBI claim, parse the compound name from the text prefix
 *      ("<name>: <definition>") and strip HTML tags + stereo prefixes
 *      ((+)-, (-)-, (R)-, (S)-) before normalizing.
 *   3. A match is "high" confidence if the ChEBI name equals a full ingredient
 *      token, "medium" if it equals the ingredient base after stripping common
 *      salt suffixes (hydrochloride, sulfate, sodium, etc.).
 *
 * To keep the relation count tractable, very common compounds are capped:
 *   - MAX_LABELS_PER_COMPOUND limits openFDA matches per ChEBI compound.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/link-chebi-openfda.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-chebi-openfda.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

const RELATION_TYPE = "COMPOUND_IN";
const MIN_NAME_LENGTH = 4; // skip ultra-short names (e.g. "ATP") that cause false positives
const MAX_LABELS_PER_COMPOUND = 500;
const INSERT_BATCH = 1000;

// Salt suffixes commonly appended to drug active ingredients
const SALT_SUFFIXES = [
  "hydrochloride", "hcl", "hci", "sulfate", "sulphate",
  "sodium", "potassium", "calcium", "magnesium",
  "maleate", "tartrate", "citrate", "phosphate", "acetate",
  "fumarate", "succinate", "mesylate", "besylate", "tosylate",
  "monohydrate", "dihydrate", "anhydrous",
];

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function normalizeCompound(s: string): string {
  return stripHtml(s)
    .toLowerCase()
    .replace(/^[\(\[]?[+\-−–]?[)\]]?\s*/, "") // (+)- (-)- prefixes
    .replace(/^\(?[rs]\)-/, "")               // (R)- / (S)-
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSaltSuffix(s: string): string {
  let cur = s;
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const suf of SALT_SUFFIXES) {
      const re = new RegExp(`\\s+${suf}$`);
      if (re.test(cur)) {
        cur = cur.replace(re, "").trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return cur;
}

interface ChebiClaim {
  id: string;
  externalId: string | null;
  name: string;
  normalized: string;
  normalizedBase: string;
}

async function loadChebi(): Promise<ChebiClaim[]> {
  const rows = await prisma.claim.findMany({
    where: { ingestedBy: "chebi_v1", deleted: false },
    select: { id: true, externalId: true, text: true },
  });
  const out: ChebiClaim[] = [];
  for (const r of rows) {
    if (!r.text) continue;
    const colonIdx = r.text.indexOf(":");
    if (colonIdx <= 0) continue;
    const rawName = r.text.slice(0, colonIdx).trim();
    const normalized = normalizeCompound(rawName);
    if (normalized.length < MIN_NAME_LENGTH) continue;
    out.push({
      id: r.id,
      externalId: r.externalId,
      name: stripHtml(rawName),
      normalized,
      normalizedBase: stripSaltSuffix(normalized),
    });
  }
  return out;
}

interface LabelIndex {
  // ingredient key → set of openFDA claim ids
  ingredientToClaimIds: Map<string, Set<string>>;
  // claim id → label info for context
  claimInfo: Map<string, { externalId: string | null; ingredients: string[] }>;
}

async function buildLabelIndex(): Promise<LabelIndex> {
  const rows = await prisma.claim.findMany({
    where: { ingestedBy: "openfda_labels_v1", deleted: false },
    select: { id: true, externalId: true, metadata: true },
  });
  const ingredientToClaimIds = new Map<string, Set<string>>();
  const claimInfo = new Map<
    string,
    { externalId: string | null; ingredients: string[] }
  >();

  for (const r of rows) {
    const meta = r.metadata as Record<string, unknown> | null;
    if (!meta) continue;
    const generic = typeof meta.generic_name === "string" ? meta.generic_name : "";
    if (!generic) continue;
    // Split on commas and the word AND
    const parts = generic
      .split(/,\s*|\s+AND\s+/i)
      .map((p) => p.trim())
      .filter(Boolean);
    const ingredients: string[] = [];
    for (const raw of parts) {
      const norm = normalizeCompound(raw);
      if (norm.length < MIN_NAME_LENGTH) continue;
      ingredients.push(norm);
      let bucket = ingredientToClaimIds.get(norm);
      if (!bucket) {
        bucket = new Set();
        ingredientToClaimIds.set(norm, bucket);
      }
      bucket.add(r.id);
      // Also index the salt-stripped base form
      const base = stripSaltSuffix(norm);
      if (base !== norm && base.length >= MIN_NAME_LENGTH) {
        let baseBucket = ingredientToClaimIds.get(base);
        if (!baseBucket) {
          baseBucket = new Set();
          ingredientToClaimIds.set(base, baseBucket);
        }
        baseBucket.add(r.id);
      }
    }
    claimInfo.set(r.id, { externalId: r.externalId, ingredients });
  }
  return { ingredientToClaimIds, claimInfo };
}

async function main() {
  console.log(
    `\nlink-chebi-openfda.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`,
  );

  console.log("Loading ChEBI compounds...");
  const chebi = await loadChebi();
  console.log(`  Loaded ${chebi.length} ChEBI compounds (after name parse)`);

  console.log("Indexing openFDA labels by ingredient...");
  const { ingredientToClaimIds, claimInfo } = await buildLabelIndex();
  console.log(
    `  Indexed ${claimInfo.size} openFDA labels · ${ingredientToClaimIds.size} unique ingredient keys`,
  );

  // Idempotency: load existing COMPOUND_IN relations and skip dup pairs locally
  const existing = await prisma.claimRelation.findMany({
    where: { relationType: RELATION_TYPE },
    select: { fromClaimId: true, toClaimId: true },
  });
  const existingPairs = new Set<string>();
  for (const e of existing) {
    existingPairs.add(`${e.fromClaimId}|${e.toClaimId}`);
  }
  console.log(`  ${existing.length} existing ${RELATION_TYPE} relations`);

  // Build candidate pairs
  type Candidate = {
    chebiId: string;
    labelId: string;
    confidence: "high" | "medium";
    matchedKey: string;
    chebiName: string;
  };
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  let chebiMatched = 0;
  for (const c of chebi) {
    // Try exact normalized match first (high confidence)
    let matchedLabels = ingredientToClaimIds.get(c.normalized);
    let matchedKey = c.normalized;
    let confidence: "high" | "medium" = "high";

    // Fallback to salt-stripped base (medium confidence)
    if (
      (!matchedLabels || matchedLabels.size === 0) &&
      c.normalizedBase !== c.normalized
    ) {
      matchedLabels = ingredientToClaimIds.get(c.normalizedBase);
      matchedKey = c.normalizedBase;
      confidence = "medium";
    }
    if (!matchedLabels || matchedLabels.size === 0) continue;

    chebiMatched++;
    const labelIds = [...matchedLabels].slice(0, MAX_LABELS_PER_COMPOUND);
    for (const labelId of labelIds) {
      const key = `${c.id}|${labelId}`;
      if (seen.has(key) || existingPairs.has(key)) continue;
      seen.add(key);
      candidates.push({
        chebiId: c.id,
        labelId,
        confidence,
        matchedKey,
        chebiName: c.name,
      });
    }
  }

  console.log(
    `  ChEBI compounds with ≥1 label match: ${chebiMatched}` +
      `\n  Candidate ${RELATION_TYPE} pairs (new): ${candidates.length}`,
  );

  // Insert in batches with skipDuplicates for safety
  let inserted = 0;
  if (DRY_RUN) {
    inserted = candidates.length;
  } else {
    for (let i = 0; i < candidates.length; i += INSERT_BATCH) {
      const batch = candidates.slice(i, i + INSERT_BATCH);
      const data = batch.map((c) => ({
        fromClaimId: c.chebiId,
        toClaimId: c.labelId,
        relationType: RELATION_TYPE,
        followUpContext: {
          heuristic: "ingredient_name_match",
          confidence: c.confidence,
          matchedIngredientKey: c.matchedKey,
          chebiName: c.chebiName,
          pipeline_from: "chebi_v1",
          pipeline_to: "openfda_labels_v1",
        },
      }));
      const result = await prisma.claimRelation.createMany({
        data,
        skipDuplicates: true,
      });
      inserted += result.count;
      if ((i / INSERT_BATCH) % 5 === 0) {
        console.log(`  inserted ${inserted}/${candidates.length}`);
      }
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
