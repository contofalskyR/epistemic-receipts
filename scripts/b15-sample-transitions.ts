#!/usr/bin/env npx tsx
/**
 * B15-1 sampler — ClaimStatusHistory error-rate audit (pre-publicity credibility audit)
 *
 * Population:  non-human transitions only
 *   exclude:   c.humanReviewed = true  (explicitly human-reviewed)
 *   exclude:   c.ingestedBy = 'manual' (hand-curated seeds, incl. trajectory: entries)
 *   exclude:   c.deleted = true | c.verificationStatus = 'DEPRECATED'
 *   exclude:   csh.createdAt > CUTOFF_TS (rows written after dispatch time — fable tier etc.)
 *
 * Strata:      pipeline_family × transition_class
 *   families:  openalex | retractions | fda_drugs | votes | archives | legislation | other
 *   classes:   baseline (fromAxis IS NULL) | enrichment (fromAxis IS NOT NULL)
 *
 * Allocation:  proportional to stratum size, floor = 20 per major family, target n=500
 *              actual n may differ slightly; manifest records what was drawn
 *
 * ZERO DB WRITES. Read-only throughout.
 *
 * Run:  cd er-b15-audit-2026-07-16 && npx tsx scripts/b15-sample-transitions.ts
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

// ── Config ────────────────────────────────────────────────────────────────────

const TARGET_N = 500;
const FLOOR_PER_MAJOR_FAMILY = 20; // applied per family (summed across its two transition classes)
const FETCH_TIMEOUT_MS = 12_000;
const MAX_SNIPPET_CHARS = 800;
const OUT_DIR = path.join(__dirname, "../findings/b15-error-audit");

// Seed is the millisecond timestamp frozen at start. Recorded in manifest so the draw is reproducible.
const CUTOFF_TS = new Date();
const SEED_INT = CUTOFF_TS.getTime() % 2_147_483_647; // keep positive int32

// ── PRNG: mulberry32 (deterministic, seedable) ─────────────────────────────

function makePrng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates shuffle with seeded PRNG
function shuffleSeeded<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Pipeline family classification ────────────────────────────────────────────

const MAJOR_FAMILIES = [
  "openalex",
  "retractions",
  "fda_drugs",
  "votes",
  "archives",
  "legislation",
  "other",
] as const;
type PipelineFamily = (typeof MAJOR_FAMILIES)[number];

function classifyFamily(ingestedBy: string): PipelineFamily {
  const p = ingestedBy.toLowerCase();
  if (p.includes("openalex")) return "openalex";
  if (p.includes("retraction") || p.includes("crossref")) return "retractions";
  if (p.includes("fda") || p.includes("drugs") || p.includes("faers")) return "fda_drugs";
  if (p.includes("voteview") || p.includes("congress") || p.includes("openfec")) return "votes";
  if (p.includes("nara") || p.includes("jacar") || p.includes("frus")) return "archives";
  if (
    p.includes("legislation") || p.includes("riksdag") || p.includes("bundestag") ||
    p.includes("stasi") || p.includes("japan_") || p.includes("portugal_") ||
    p.includes("poland_") || p.includes("brunei_") || p.includes("chebi") ||
    p.includes("worldbank") || p.includes("world_bank") || p.includes("miller_center") ||
    p.includes("vdem")
  ) return "legislation";
  return "other";
}

type TransitionClass = "baseline" | "enrichment";
type StratumKey = `${PipelineFamily}:${TransitionClass}`;

function stratumKey(family: PipelineFamily, cls: TransitionClass): StratumKey {
  return `${family}:${cls}`;
}

// ── HTTP fetch helper with timeout ───────────────────────────────────────────

async function fetchSnippet(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), FETCH_TIMEOUT_MS);
    const protocol = url.startsWith("https") ? require("https") : require("http");
    const req = protocol.get(url, { timeout: FETCH_TIMEOUT_MS }, (res: any) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        size += chunk.length;
        if (size > 80_000) req.destroy(); // don't pull enormous pages
      });
      res.on("end", () => {
        clearTimeout(timer);
        const body = Buffer.concat(chunks).toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        resolve(body.slice(0, MAX_SNIPPET_CHARS) || null);
      });
      res.on("error", () => { clearTimeout(timer); resolve(null); });
    });
    req.on("error", () => { clearTimeout(timer); resolve(null); });
    req.on("timeout", () => { req.destroy(); clearTimeout(timer); resolve(null); });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`B15-1 sampler start — cutoff: ${CUTOFF_TS.toISOString()} — seed: ${SEED_INT}`);

  // ── Step 1: count population per stratum ──────────────────────────────────
  console.log("Counting population per stratum…");

  type CountRow = {
    ingestedBy: string;
    isBaseline: boolean;
    n: number;
  };

  const rawCounts = await prisma.$queryRaw<CountRow[]>`
    SELECT
      c."ingestedBy",
      (csh."fromAxis" IS NULL) AS "isBaseline",
      COUNT(*)::int AS n
    FROM "ClaimStatusHistory" csh
    JOIN "Claim" c ON c.id = csh."claimId"
    WHERE c."humanReviewed" = false
      AND c."ingestedBy" != 'manual'
      AND c.deleted = false
      AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
      AND csh."createdAt" <= ${CUTOFF_TS}
    GROUP BY c."ingestedBy", (csh."fromAxis" IS NULL)
  `;

  // Aggregate into stratum counts
  const stratumPop = new Map<StratumKey, number>();
  for (const row of rawCounts) {
    const family = classifyFamily(row.ingestedBy);
    const cls: TransitionClass = row.isBaseline ? "baseline" : "enrichment";
    const key = stratumKey(family, cls);
    stratumPop.set(key, (stratumPop.get(key) ?? 0) + Number(row.n));
  }

  const totalPop = Array.from(stratumPop.values()).reduce((s, n) => s + n, 0);
  console.log(`Total population: ${totalPop.toLocaleString()} rows across ${stratumPop.size} strata`);

  // ── Step 2: proportional allocation with family floor ─────────────────────
  // Compute per-family total population to apply the floor
  const familyPop = new Map<PipelineFamily, number>();
  for (const [key, n] of stratumPop) {
    const family = key.split(":")[0] as PipelineFamily;
    familyPop.set(family, (familyPop.get(family) ?? 0) + n);
  }

  // Proportional targets per stratum
  const stratumTarget = new Map<StratumKey, number>();
  let totalTarget = 0;
  for (const [key, n] of stratumPop) {
    const family = key.split(":")[0] as PipelineFamily;
    const familyTotal = familyPop.get(family) ?? 0;
    // Floor applies per family (split evenly between baseline/enrichment sub-strata)
    const familyFloor = MAJOR_FAMILIES.includes(family as PipelineFamily)
      ? Math.ceil(FLOOR_PER_MAJOR_FAMILY / 2)
      : 0;
    const proportional = Math.round((n / totalPop) * TARGET_N);
    const target = Math.min(n, Math.max(proportional, familyFloor));
    stratumTarget.set(key, target);
    totalTarget += target;
  }

  console.log(`Allocated n=${totalTarget} (target was ${TARGET_N})`);
  console.log("Stratum allocations:");
  for (const [key, target] of [...stratumTarget.entries()].sort()) {
    const pop = stratumPop.get(key) ?? 0;
    console.log(`  ${key.padEnd(30)} pop=${pop.toLocaleString().padStart(8)}  n=${target}`);
  }

  // ── Step 3: sample IDs per stratum ───────────────────────────────────────
  // Pull all eligible row IDs per stratum, then shuffle-select
  console.log("\nPulling eligible row IDs per stratum…");

  type IdRow = { id: string; ingestedBy: string; isBaseline: boolean };
  const allIds = await prisma.$queryRaw<IdRow[]>`
    SELECT
      csh.id,
      c."ingestedBy",
      (csh."fromAxis" IS NULL) AS "isBaseline"
    FROM "ClaimStatusHistory" csh
    JOIN "Claim" c ON c.id = csh."claimId"
    WHERE c."humanReviewed" = false
      AND c."ingestedBy" != 'manual'
      AND c.deleted = false
      AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
      AND csh."createdAt" <= ${CUTOFF_TS}
    ORDER BY csh.id
  `;

  // Group by stratum
  const stratumIds = new Map<StratumKey, string[]>();
  for (const row of allIds) {
    const family = classifyFamily(row.ingestedBy);
    const cls: TransitionClass = row.isBaseline ? "baseline" : "enrichment";
    const key = stratumKey(family, cls);
    if (!stratumIds.has(key)) stratumIds.set(key, []);
    stratumIds.get(key)!.push(row.id);
  }

  // Shuffle and select per stratum using seeded PRNG
  const rand = makePrng(SEED_INT);
  const selectedIds = new Map<StratumKey, string[]>();
  for (const [key, ids] of stratumIds) {
    const target = stratumTarget.get(key) ?? 0;
    const shuffled = shuffleSeeded(ids, rand);
    selectedIds.set(key, shuffled.slice(0, target));
  }

  const allSelectedIds = Array.from(selectedIds.values()).flat();
  console.log(`Selected ${allSelectedIds.length} rows total`);

  // ── Step 4: fetch full details for selected rows ──────────────────────────
  console.log("Fetching row details…");

  type DetailRow = {
    id: string;
    claimId: string;
    claimText: string;
    ingestedBy: string;
    externalId: string | null;
    fromAxis: string | null;
    toAxis: string;
    community: string;
    reason: string | null;
    occurredAt: Date;
    datePrecision: string | null;
    sourceUrl: string | null;
    sourceName: string | null;
  };

  const details = await prisma.$queryRaw<DetailRow[]>`
    SELECT
      csh.id,
      csh."claimId",
      LEFT(c.text, 200) AS "claimText",
      c."ingestedBy",
      c."externalId",
      csh."fromAxis",
      csh."toAxis",
      csh.community::text AS community,
      csh.reason,
      csh."occurredAt",
      csh."datePrecision",
      s.url AS "sourceUrl",
      s.name AS "sourceName"
    FROM "ClaimStatusHistory" csh
    JOIN "Claim" c ON c.id = csh."claimId"
    LEFT JOIN "Source" s ON s.id = csh."sourceId"
    WHERE csh.id = ANY(${allSelectedIds}::text[])
  `;

  // Build a lookup by id
  const detailById = new Map(details.map((d) => [d.id, d]));

  // ── Step 5: emit worksheets stratum by stratum ───────────────────────────
  const manifest: Record<string, unknown> = {
    cutoffTimestamp: CUTOFF_TS.toISOString(),
    seed: SEED_INT,
    totalPopulation: totalPop,
    targetN: TARGET_N,
    actualN: allSelectedIds.length,
    generatedAt: new Date().toISOString(),
    strata: {} as Record<string, { population: number; selected: number }>,
    verdictClasses: [
      "CORRECT",
      "WRONG_DATE",
      "WRONG_AXIS",
      "SOURCE_MISMATCH",
      "IDENTITY_MISMATCH",
      "UNVERIFIABLE",
    ],
    identityMismatchExamples: [
      "Braun & Clarke claim — claim text is actually a citing paper, not the cited work",
      "COSIT 2022 item — claim text does not match the work resolved by the DOI/OpenAlex anchor",
    ],
  };

  for (const [key, ids] of selectedIds) {
    if (ids.length === 0) continue;
    const family = key.split(":")[0];
    const cls = key.split(":")[1];
    const pop = stratumPop.get(key) ?? 0;

    (manifest.strata as any)[key] = { population: pop, selected: ids.length };

    console.log(`\nEmitting worksheet for stratum: ${key} (${ids.length} rows)…`);

    const rows = ids
      .map((id) => detailById.get(id))
      .filter((d): d is DetailRow => d !== undefined);

    let md = `# B15 Error-Rate Audit — Worksheet: ${key}\n\n`;
    md += `**Stratum:** ${family} × ${cls} transition  \n`;
    md += `**Population:** ${pop.toLocaleString()}  \n`;
    md += `**Sampled:** ${ids.length}  \n`;
    md += `**Cutoff:** ${CUTOFF_TS.toISOString()}  \n`;
    md += `**Seed:** ${SEED_INT}  \n\n`;

    md += `## Verdict guide\n\n`;
    md += `| Code | Meaning |\n|------|---------|\n`;
    md += `| CORRECT | Date, axis, community, and source all check out against the live source |\n`;
    md += `| WRONG_DATE | Source supports the event but not the recorded date or precision |\n`;
    md += `| WRONG_AXIS | Event is real but status classification is unsupportable |\n`;
    md += `| SOURCE_MISMATCH | Cited source does not support the transition at all |\n`;
    md += `| IDENTITY_MISMATCH | Claim text does not match the work its DOI/OpenAlex anchor resolves to |\n`;
    md += `| UNVERIFIABLE | Source dead/paywalled; no substitute found (reported separately, not counted as error) |\n\n`;
    md += `*Secondary flags (may co-occur with verdict): DEAD_LINK, PRECISION_SHARPENING*\n\n`;

    md += `---\n\n`;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const transition = row.fromAxis ? `${row.fromAxis} → ${row.toAxis}` : `(entry) → ${row.toAxis}`;
      const dateStr = row.occurredAt.toISOString().slice(0, 10);
      const precision = row.datePrecision ?? "unknown";

      md += `## Row ${i + 1}/${rows.length} · CSH.id: ${row.id}\n\n`;
      md += `**Claim (first 200 chars):** ${row.claimText}${row.claimText.length >= 200 ? "…" : ""}  \n`;
      md += `**Claim ID:** ${row.claimId}  \n`;
      md += `**Pipeline:** ${row.ingestedBy}  \n`;
      if (row.externalId) md += `**External ID:** ${row.externalId}  \n`;
      md += `**Transition:** ${transition}  \n`;
      md += `**Date:** ${dateStr} (precision: ${precision})  \n`;
      md += `**Community:** ${row.community}  \n`;
      if (row.reason) md += `**Reason:** ${row.reason}  \n`;

      if (row.sourceUrl) {
        md += `**Source URL:** ${row.sourceUrl}  \n`;
        if (row.sourceName) md += `**Source name:** ${row.sourceName}  \n`;

        // Pre-fetch evidence snippet
        const snippet = await fetchSnippet(row.sourceUrl);
        if (snippet) {
          md += `\n**Pre-fetched evidence snippet:**\n\n> ${snippet.replace(/\n/g, " ").slice(0, MAX_SNIPPET_CHARS)}\n\n`;
        } else {
          md += `\n**Pre-fetched evidence snippet:** *(fetch failed — candidate UNVERIFIABLE if no archive found)*\n\n`;
        }
      } else {
        md += `**Source:** *(no source URL recorded)*\n\n`;
      }

      md += `**Verdict:** _(fill in: CORRECT | WRONG_DATE | WRONG_AXIS | SOURCE_MISMATCH | IDENTITY_MISMATCH | UNVERIFIABLE)_  \n`;
      md += `**Secondary flags:** _(optional: DEAD_LINK, PRECISION_SHARPENING)_  \n`;
      md += `**Notes:** _(optional)_\n\n`;
      md += `---\n\n`;
    }

    const filename = `worksheet-${key.replace(":", "-")}.md`;
    const outPath = path.join(OUT_DIR, filename);
    fs.writeFileSync(outPath, md, "utf8");
    console.log(`  → wrote ${outPath} (${ids.length} rows)`);
  }

  // ── Step 6: write manifest ────────────────────────────────────────────────
  const manifestPath = path.join(OUT_DIR, "sampling-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\nManifest written: ${manifestPath}`);
  console.log(`\nB15-1 complete. ${allSelectedIds.length} rows sampled across ${selectedIds.size} strata.`);
  console.log(`Next: commit findings/b15-error-audit/ and notify Robert that worksheets are ready stratum by stratum.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("B15-1 error:", e);
  process.exit(1);
});
