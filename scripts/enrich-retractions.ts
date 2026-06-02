/**
 * enrich-retractions.ts
 *
 * Enriches REVERSED ClaimRelation rows with the WHY behind each retraction.
 *
 * Source: Retraction Watch database, distributed publicly by CrossRef Labs at
 *   https://api.labs.crossref.org/data/retractionwatch
 * The endpoint always returns the full CSV (~64MB, ~70k rows) regardless of any
 * `?doi=` query parameter — registration with retractionwatch.com is NOT
 * required for this distribution. CrossRef acquired the Retraction Watch
 * database in Sept 2023 and now publishes it under CC0.
 *
 * Columns of interest (per the Retraction Watch schema):
 *   - OriginalPaperDOI    — our join key (matches followUpContext.doi)
 *   - RetractionDOI       — the published retraction notice's DOI
 *   - RetractionNature    — "Retraction" | "Expression of concern" | "Correction" | "Reinstatement"
 *   - Reason              — semicolon-separated reason tokens (e.g.
 *                           "Falsification/Fabrication of Data;Investigation by Journal/Publisher;")
 *   - Record ID           — Retraction Watch primary key
 *
 * What this script writes:
 *   For each REVERSED ClaimRelation whose followUpContext.doi resolves to a
 *   Retraction Watch record, the followUpContext blob is merged with:
 *     - retractionReason       (string)  — primary reason phrase, e.g. "Falsification/Fabrication of Data"
 *     - retractionCategory     (string)  — short user-facing label, e.g. "Fraud"
 *     - retractionSeverity     ("HIGH" | "MEDIUM" | "LOW")
 *     - retractionNature       (string)  — RW's nature value
 *     - retractionReasonsAll   (string[]) — every reason token, for transparency
 *     - retractionWatchRecordId(number)
 *     - retractionWatchUrl     (string?) — first RW URL when present
 *     - source                 set to "retraction_watch"
 *
 * The script is idempotent: re-running overwrites the same keys but never
 * drops unrelated keys already in followUpContext.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-retractions.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-retractions.ts
 *
 * Flags:
 *   --dry-run     no DB writes, print a sample + coverage stats
 *   --refresh     ignore on-disk cache, re-download the CSV
 *   --limit N     cap the number of REVERSED rows to enrich (debugging)
 */

import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");
const REFRESH = process.argv.includes("--refresh");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i === -1) return 0;
  const n = parseInt(process.argv[i + 1] ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
})();

const RW_URL = "https://api.labs.crossref.org/data/retractionwatch";
const POLITE_EMAIL = "robert.contofalsky@gmail.com";
const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "retraction-watch.csv");
const CACHE_TTL_HOURS = 24;
const UPDATE_BATCH = 500;

// ── Reason → category/severity classification ────────────────────────────────
//
// Severity bands follow the brief:
//   HIGH    fraud, fabrication, falsification, plagiarism, image manipulation,
//           paper mills, fake/compromised peer review
//   MEDIUM  data errors, duplication, authorship/COI, investigations,
//           unreliable results
//   LOW     corrections, editorial concerns, prior-notice updates, vague
//
// Pattern order matters: the first match wins for the primary category,
// and we keep the highest severity seen across all reason tokens.

type Severity = "HIGH" | "MEDIUM" | "LOW";

const CATEGORY_RULES: Array<{
  category: string;
  severity: Severity;
  test: (token: string) => boolean;
}> = [
  {
    category: "Fraud",
    severity: "HIGH",
    test: (t) =>
      /falsif|fabricat|fake.*data|manipulation of (results|data)|hoax|misconduct by author/i.test(
        t,
      ),
  },
  {
    category: "Paper mill",
    severity: "HIGH",
    test: (t) =>
      /paper.?mill|fake peer review|compromised peer review|rogue editor/i.test(
        t,
      ),
  },
  {
    category: "Plagiarism",
    severity: "HIGH",
    test: (t) => /plagiari|euphemisms for plagiar/i.test(t),
  },
  {
    category: "Image manipulation",
    severity: "HIGH",
    test: (t) => /manipulation of image|image manipulation/i.test(t),
  },
  {
    category: "Image issues",
    severity: "MEDIUM",
    test: (t) =>
      /(duplication of\/in image|concerns?\/issues? about image|image duplication)/i.test(
        t,
      ),
  },
  {
    category: "Duplication",
    severity: "MEDIUM",
    test: (t) =>
      /(duplication of\/in (article|text|data)|duplicate (article|publication)|euphemisms for duplication|salami)/i.test(
        t,
      ),
  },
  {
    category: "Data error",
    severity: "MEDIUM",
    test: (t) =>
      /(unreliable data|unreliable results|results not reproducible|original data.*not (provided|available)|concerns?\/issues? about data|error in (data|analyses|results)|concerns?\/issues? about (results|methods))/i.test(
        t,
      ),
  },
  {
    category: "Authorship / COI",
    severity: "MEDIUM",
    test: (t) =>
      /(authorship|conflict of interest|coi|lack of (irb|iacuc|ethics|approval)|breach of policy by author)/i.test(
        t,
      ),
  },
  {
    category: "Investigation",
    severity: "MEDIUM",
    test: (t) => /investigation by (journal|publisher|third party|company|institution)/i.test(t),
  },
  {
    category: "Editorial concern",
    severity: "LOW",
    test: (t) => /expression of concern|concerns?\/issues? about peer review|concerns?\/issues? about referencing|computer-aided content|computer-generated content/i.test(t),
  },
  {
    category: "Correction",
    severity: "LOW",
    test: (t) =>
      /(error in text|upgrade\/update of prior notice|notice -? limited or no information|objections by author|date of article.*unknown|removed|updated to retraction|reinstatement)/i.test(
        t,
      ),
  },
];

const SEVERITY_RANK: Record<Severity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function classifyReasons(rawReason: string): {
  tokens: string[];
  category: string;
  severity: Severity;
  primaryReason: string | null;
} {
  const tokens = rawReason
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { tokens, category: "Unspecified", severity: "LOW", primaryReason: null };
  }

  let best: { rule: (typeof CATEGORY_RULES)[number]; token: string } | null = null;
  for (const token of tokens) {
    for (const rule of CATEGORY_RULES) {
      if (!rule.test(token)) continue;
      if (
        !best ||
        SEVERITY_RANK[rule.severity] > SEVERITY_RANK[best.rule.severity]
      ) {
        best = { rule, token };
      }
      break; // first matching rule wins per token; higher rank may still upgrade
    }
  }

  if (best) {
    return {
      tokens,
      category: best.rule.category,
      severity: best.rule.severity,
      primaryReason: best.token,
    };
  }

  // Token list exists but no rule matched (unclassified reason text).
  return { tokens, category: "Other", severity: "LOW", primaryReason: tokens[0] ?? null };
}

// ── CSV download + parse ─────────────────────────────────────────────────────

async function loadRetractionWatchCsv(): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

  const fresh =
    !REFRESH &&
    fs.existsSync(CACHE_PATH) &&
    Date.now() - fs.statSync(CACHE_PATH).mtimeMs < CACHE_TTL_HOURS * 3600 * 1000;

  if (fresh) {
    const sizeMb = (fs.statSync(CACHE_PATH).size / 1_000_000).toFixed(1);
    console.log(`  Using cached CSV at ${CACHE_PATH} (${sizeMb} MB)`);
    return fs.readFileSync(CACHE_PATH, "utf8");
  }

  console.log(`  Downloading Retraction Watch CSV from ${RW_URL} …`);
  const res = await fetch(RW_URL, {
    headers: {
      Accept: "text/csv",
      "User-Agent": `EpistemicReceipts/1.0 (mailto:${POLITE_EMAIL})`,
    },
  });
  if (!res.ok) throw new Error(`Retraction Watch CSV download failed: HTTP ${res.status}`);
  const body = await res.text();
  fs.writeFileSync(CACHE_PATH, body, "utf8");
  console.log(`  Saved ${(body.length / 1_000_000).toFixed(1)} MB → ${CACHE_PATH}`);
  return body;
}

type RwRecord = {
  recordId: number | null;
  retractionDoi: string | null;
  retractionDate: string | null;
  nature: string | null;
  reasonRaw: string;
  category: string;
  severity: Severity;
  primaryReason: string | null;
  reasonsAll: string[];
  retractionWatchUrl: string | null;
};

function buildRwIndex(csv: string): Map<string, RwRecord> {
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const index = new Map<string, RwRecord>();
  for (const r of rows) {
    const doi = (r["OriginalPaperDOI"] ?? "").trim().toLowerCase();
    if (!doi || doi === "unavailable" || doi === "n/a") continue;
    const reasonRaw = (r["Reason"] ?? "").trim();
    const { tokens, category, severity, primaryReason } = classifyReasons(reasonRaw);
    const urls = (r["URLS"] ?? "").trim();
    const firstUrl = urls.split(";").map((s) => s.trim()).find(Boolean) ?? null;
    const idNum = parseInt(r["Record ID"] ?? "", 10);
    index.set(doi, {
      recordId: Number.isFinite(idNum) ? idNum : null,
      retractionDoi: (r["RetractionDOI"] ?? "").trim() || null,
      retractionDate: (r["RetractionDate"] ?? "").trim() || null,
      nature: (r["RetractionNature"] ?? "").trim() || null,
      reasonRaw,
      category,
      severity,
      primaryReason,
      reasonsAll: tokens,
      retractionWatchUrl: firstUrl,
    });
  }
  return index;
}

// ── Main ─────────────────────────────────────────────────────────────────────

type ContextPatch = {
  retractionReason: string | null;
  retractionCategory: string;
  retractionSeverity: Severity;
  retractionNature: string | null;
  retractionReasonsAll: string[];
  retractionWatchRecordId: number | null;
  retractionWatchUrl: string | null;
  retractionWatchRetractionDoi: string | null;
  retractionWatchRetractionDate: string | null;
  retractionReasonSource: "retraction_watch";
};

async function main() {
  console.log(`\nenrich-retractions.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Source: ${RW_URL} (Retraction Watch via CrossRef Labs)\n`);

  // Step 1 — load and index the CSV
  console.log("=== Step 1: load Retraction Watch CSV ===");
  const csv = await loadRetractionWatchCsv();
  const index = buildRwIndex(csv);
  console.log(`  Indexed ${index.size} unique original-paper DOIs.`);

  // Severity distribution in the source
  const sevDist: Record<Severity, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const catDist: Record<string, number> = {};
  for (const r of index.values()) {
    sevDist[r.severity]++;
    catDist[r.category] = (catDist[r.category] ?? 0) + 1;
  }
  console.log(`  Source severity:`, sevDist);
  console.log(`  Source categories:`);
  for (const [c, n] of Object.entries(catDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${n.toString().padStart(6)} | ${c}`);
  }

  // Step 2 — load REVERSED ClaimRelation rows
  console.log("\n=== Step 2: load REVERSED ClaimRelation rows ===");
  const all = await prisma.claimRelation.findMany({
    where: { relationType: "REVERSED" },
    select: { id: true, followUpContext: true },
  });
  const rows = LIMIT > 0 ? all.slice(0, LIMIT) : all;
  console.log(`  REVERSED rows: ${all.length}${LIMIT ? ` (capped to ${rows.length} via --limit)` : ""}`);

  // Step 3 — match and prepare patches
  console.log("\n=== Step 3: match and prepare enrichment patches ===");
  const patches: Array<{ id: string; merged: Record<string, unknown> }> = [];
  let matched = 0;
  let missing = 0;
  const matchedSev: Record<Severity, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const matchedCat: Record<string, number> = {};

  for (const r of rows) {
    const ctx = (r.followUpContext ?? {}) as Record<string, unknown>;
    const doi = typeof ctx.doi === "string" ? ctx.doi.toLowerCase() : null;
    if (!doi) {
      missing++;
      continue;
    }
    const rw = index.get(doi);
    if (!rw) {
      missing++;
      continue;
    }
    matched++;
    matchedSev[rw.severity]++;
    matchedCat[rw.category] = (matchedCat[rw.category] ?? 0) + 1;

    const patch: ContextPatch = {
      retractionReason: rw.primaryReason,
      retractionCategory: rw.category,
      retractionSeverity: rw.severity,
      retractionNature: rw.nature,
      retractionReasonsAll: rw.reasonsAll,
      retractionWatchRecordId: rw.recordId,
      retractionWatchUrl: rw.retractionWatchUrl,
      retractionWatchRetractionDoi: rw.retractionDoi,
      retractionWatchRetractionDate: rw.retractionDate,
      retractionReasonSource: "retraction_watch",
    };
    patches.push({ id: r.id, merged: { ...ctx, ...patch } });
  }

  console.log(`  Matched: ${matched} · Missing in RW: ${missing}`);
  console.log(`  Matched severity:`, matchedSev);
  console.log(`  Matched categories:`);
  for (const [c, n] of Object.entries(matchedCat).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${n.toString().padStart(6)} | ${c}`);
  }

  // Step 4 — dry-run sample or live writes
  if (DRY_RUN) {
    console.log("\n=== Step 4: DRY RUN — sample patches (no DB writes) ===");
    for (const p of patches.slice(0, 5)) {
      console.log(`\n  ClaimRelation ${p.id}:`);
      console.log(`    doi:        ${(p.merged as Record<string, unknown>).doi}`);
      console.log(`    category:   ${(p.merged as Record<string, unknown>).retractionCategory}`);
      console.log(`    severity:   ${(p.merged as Record<string, unknown>).retractionSeverity}`);
      console.log(`    reason:     ${(p.merged as Record<string, unknown>).retractionReason}`);
      console.log(
        `    nature:     ${(p.merged as Record<string, unknown>).retractionNature ?? "(none)"}`,
      );
    }
    console.log(`\n  Would update ${patches.length} ClaimRelation rows.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n=== Step 4: writing ${patches.length} enrichment patches ===`);
  let written = 0;
  let errors = 0;
  for (let i = 0; i < patches.length; i += UPDATE_BATCH) {
    const batch = patches.slice(i, i + UPDATE_BATCH);
    try {
      await prisma.$transaction(
        batch.map((p) =>
          prisma.claimRelation.update({
            where: { id: p.id },
            data: { followUpContext: p.merged as object },
          }),
        ),
        { timeout: 60_000 },
      );
      written += batch.length;
      if (written % 2_000 === 0 || written === patches.length) {
        console.log(`  ${written}/${patches.length} updated`);
      }
    } catch (e) {
      console.error(`  Batch starting at ${i} failed:`, e);
      errors += batch.length;
    }
  }
  console.log(`\n  Wrote ${written} updates (${errors} errored).`);

  // Step 5 — verify
  console.log("\n=== Step 5: DB verification ===");
  const enriched = await prisma.claimRelation.count({
    where: {
      relationType: "REVERSED",
      followUpContext: { path: ["retractionReasonSource"], equals: "retraction_watch" },
    },
  });
  const enrichedHigh = await prisma.claimRelation.count({
    where: {
      relationType: "REVERSED",
      followUpContext: { path: ["retractionSeverity"], equals: "HIGH" },
    },
  });
  const enrichedMed = await prisma.claimRelation.count({
    where: {
      relationType: "REVERSED",
      followUpContext: { path: ["retractionSeverity"], equals: "MEDIUM" },
    },
  });
  const enrichedLow = await prisma.claimRelation.count({
    where: {
      relationType: "REVERSED",
      followUpContext: { path: ["retractionSeverity"], equals: "LOW" },
    },
  });
  console.log(`  REVERSED rows with retraction_watch enrichment: ${enriched}`);
  console.log(`  Severity buckets — HIGH: ${enrichedHigh} · MEDIUM: ${enrichedMed} · LOW: ${enrichedLow}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
