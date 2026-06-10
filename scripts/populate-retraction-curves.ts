/**
 * populate-retraction-curves.ts  (Settling Curve — Phase A)
 *
 * Turns enriched retraction relations into two-point epistemic trajectories on
 * the EXISTING retracted-paper claim:
 *
 *   Row 0  ∅ → RECORDED   (EXPERT_LITERATURE)  at publication date
 *   Row 1  RECORDED → REVERSED (EXPERT_LITERATURE) at retraction date
 *
 * These are written as ClaimStatusHistory rows onto the paper claim itself (the
 * `fromClaim` of a REVERSED ClaimRelation). The paper claim has NO `trajectory:`
 * externalId prefix, so GET /api/trajectories (which filters externalId
 * startsWith "trajectory:") automatically excludes them from the hero switcher.
 *
 * Source of truth: ClaimRelation rows with relationType = "REVERSED" enriched by
 * scripts/enrich-retractions.ts (followUpContext.retractionReasonSource ===
 * "retraction_watch"), carrying:
 *   - retractionWatchRetractionDate  ("M/D/YYYY H:MM" — Retraction Watch format)
 *   - retractionReason               (primary human-readable reason)
 *   - retractionWatchUrl             (optional Retraction Watch notice URL)
 *
 * Marker sources (every marker resolves to a REAL existing Source — never minted):
 *   Row 0 — the paper's own primary Source (fromClaim's first non-deleted Edge)
 *   Row 1 — the retraction record's Source (toClaim's first non-deleted Edge);
 *           if absent, a Source whose url === followUpContext.retractionWatchUrl
 *
 * Status discipline: entering the literature is RECORDED, never SETTLED. We only
 * upgrade Row 0 to SETTLED when metadata.cited_by_count >= 100 (rare for these
 * OpenAlex claims, whose metadata omits citation counts — so they stay RECORDED).
 *
 * Idempotent: deterministic ids `${claimId}:retraction:0` / `:1`, upsert on id.
 * Skips (and counts) any relation lacking a usable publication date OR retraction
 * date, or lacking a resolvable real marker Source. NEVER fabricates a date.
 *
 * Run (dry-run is the default):
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/populate-retraction-curves.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/populate-retraction-curves.ts --live
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LIVE = process.argv.includes("--live");
const DRY_RUN = !LIVE;
const OP_BATCH = 500; // ClaimStatusHistory upsert operations per transaction

const SETTLED_CITATION_THRESHOLD = 100;

// ── Date parsing ─────────────────────────────────────────────────────────────
// Retraction Watch dates look like "3/25/2026 0:00" (M/D/YYYY [H:MM]).
// Returns a UTC Date at midnight, or null if unparseable. NEVER guesses.
function parseRwDate(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const datePart = s.split(/\s+/)[0]; // drop the time component
  const m = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1600 || year > 2100) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // Fallback: ISO-ish "YYYY-MM-DD"
  const iso = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(`${datePart}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Publication date: prefer claimEmergedAt, then metadata.publication_date,
// then metadata.publicationYear (-> Jan 1). Returns Date or null.
function resolvePublicationDate(
  claimEmergedAt: Date | null,
  metadata: Record<string, unknown> | null,
): Date | null {
  if (claimEmergedAt instanceof Date && !Number.isNaN(claimEmergedAt.getTime())) {
    return claimEmergedAt;
  }
  const md = metadata ?? {};
  const pd = md["publication_date"];
  if (typeof pd === "string" && pd.trim()) {
    const d = new Date(pd.length <= 10 ? `${pd}T00:00:00.000Z` : pd);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const py = md["publicationYear"];
  if (typeof py === "number" && py >= 1600 && py <= 2100) {
    return new Date(Date.UTC(py, 0, 1));
  }
  if (typeof py === "string" && /^\d{4}$/.test(py.trim())) {
    return new Date(Date.UTC(parseInt(py.trim(), 10), 0, 1));
  }
  return null;
}

function citedByCount(metadata: Record<string, unknown> | null): number {
  const v = (metadata ?? {})["cited_by_count"];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return 0;
}

interface HistoryRow {
  id: string;
  claimId: string;
  fromAxis: string | null;
  toAxis: string;
  community: string;
  reason: string;
  occurredAt: Date;
  datePrecision: string;
  sourceId: string;
}

async function main() {
  console.log(`\npopulate-retraction-curves.ts — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);

  // Load enriched REVERSED relations with the two claims and their primary sources.
  console.log("\n=== Loading enriched REVERSED relations ===");
  const relations = await prisma.claimRelation.findMany({
    where: {
      relationType: "REVERSED",
      followUpContext: { path: ["retractionReasonSource"], equals: "retraction_watch" },
    },
    select: {
      id: true,
      followUpContext: true,
      fromClaim: {
        select: {
          id: true,
          claimEmergedAt: true,
          metadata: true,
          edges: {
            where: { deleted: false },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { sourceId: true },
          },
        },
      },
      toClaim: {
        select: {
          id: true,
          edges: {
            where: { deleted: false },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { sourceId: true },
          },
        },
      },
    },
  });
  console.log(`  Enriched REVERSED relations: ${relations.length}`);

  // Build the two history rows per qualifying relation.
  const rows: HistoryRow[] = [];
  const skip = {
    noPubDate: 0,
    noRetractionDate: 0,
    noPaperSource: 0,
    noRetractionSource: 0,
  };
  let settledUpgrades = 0;
  let outOfOrder = 0; // data-quality note: retraction date <= publication date
  const urlSourceCache = new Map<string, string | null>();

  async function resolveUrlSource(url: string): Promise<string | null> {
    if (urlSourceCache.has(url)) return urlSourceCache.get(url)!;
    const s = await prisma.source.findFirst({ where: { url, deleted: false }, select: { id: true } });
    const id = s?.id ?? null;
    urlSourceCache.set(url, id);
    return id;
  }

  for (const rel of relations) {
    const ctx = (rel.followUpContext ?? {}) as Record<string, unknown>;
    const claim = rel.fromClaim;
    const md = (claim.metadata ?? null) as Record<string, unknown> | null;

    const pubDate = resolvePublicationDate(claim.claimEmergedAt, md);
    if (!pubDate) {
      skip.noPubDate++;
      continue;
    }

    const retrDate =
      parseRwDate(ctx["retractionWatchRetractionDate"]) ?? parseRwDate(ctx["retractionDate"]);
    if (!retrDate) {
      skip.noRetractionDate++;
      continue;
    }

    // Row 0 marker — the paper's own primary Source.
    const paperSourceId = claim.edges[0]?.sourceId ?? null;
    if (!paperSourceId) {
      skip.noPaperSource++;
      continue;
    }

    // Row 1 marker — the retraction record's Source, else the URL-matched Source.
    let retractionSourceId = rel.toClaim.edges[0]?.sourceId ?? null;
    if (!retractionSourceId) {
      const url = ctx["retractionWatchUrl"];
      if (typeof url === "string" && url.trim()) {
        retractionSourceId = await resolveUrlSource(url.trim());
      }
    }
    if (!retractionSourceId) {
      skip.noRetractionSource++;
      continue;
    }

    if (retrDate.getTime() <= pubDate.getTime()) outOfOrder++;

    const cites = citedByCount(md);
    const row0Axis = cites >= SETTLED_CITATION_THRESHOLD ? "SETTLED" : "RECORDED";
    if (row0Axis === "SETTLED") settledUpgrades++;

    const reason =
      (typeof ctx["retractionReason"] === "string" && (ctx["retractionReason"] as string).trim()) ||
      "Retracted.";

    rows.push({
      id: `${claim.id}:retraction:0`,
      claimId: claim.id,
      fromAxis: null,
      toAxis: row0Axis,
      community: "EXPERT_LITERATURE",
      reason: "Published; entered the literature.",
      occurredAt: pubDate,
      datePrecision: "DAY",
      sourceId: paperSourceId,
    });
    rows.push({
      id: `${claim.id}:retraction:1`,
      claimId: claim.id,
      fromAxis: row0Axis,
      toAxis: "REVERSED",
      community: "EXPERT_LITERATURE",
      reason,
      occurredAt: retrDate,
      datePrecision: "DAY",
      sourceId: retractionSourceId,
    });
  }

  const qualifying = rows.length / 2;
  const skipped = skip.noPubDate + skip.noRetractionDate + skip.noPaperSource + skip.noRetractionSource;

  console.log("\n=== Summary ===");
  console.log(`  Qualifying claims:     ${qualifying}  (→ ${rows.length} ClaimStatusHistory rows)`);
  console.log(`  Skipped:               ${skipped}`);
  console.log(`    no publication date:   ${skip.noPubDate}`);
  console.log(`    no retraction date:    ${skip.noRetractionDate}`);
  console.log(`    no paper Source:       ${skip.noPaperSource}`);
  console.log(`    no retraction Source:  ${skip.noRetractionSource}`);
  console.log(`  SETTLED upgrades (cited_by_count >= ${SETTLED_CITATION_THRESHOLD}): ${settledUpgrades}`);
  console.log(`  Data-quality note — retraction date <= pub date: ${outOfOrder}`);

  if (DRY_RUN) {
    console.log("\n=== DRY RUN — sample rows (no DB writes) ===");
    for (const r of rows.slice(0, 6)) {
      console.log(
        `  ${r.id}  ${r.fromAxis ?? "∅"} → ${r.toAxis}  (${r.community}, ${r.occurredAt.toISOString().slice(0, 10)})  src=${r.sourceId}  "${r.reason}"`,
      );
    }
    console.log(`\n  Would upsert ${rows.length} ClaimStatusHistory rows. Re-run with --live to apply.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n=== LIVE — upserting ${rows.length} ClaimStatusHistory rows ===`);
  let written = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += OP_BATCH) {
    const batch = rows.slice(i, i + OP_BATCH);
    try {
      await prisma.$transaction(
        batch.map((r) =>
          prisma.claimStatusHistory.upsert({
            where: { id: r.id },
            create: {
              id: r.id,
              claimId: r.claimId,
              fromAxis: r.fromAxis,
              toAxis: r.toAxis,
              community: r.community,
              reason: r.reason,
              occurredAt: r.occurredAt,
              datePrecision: r.datePrecision,
              sourceId: r.sourceId,
            },
            update: {
              fromAxis: r.fromAxis,
              toAxis: r.toAxis,
              community: r.community,
              reason: r.reason,
              occurredAt: r.occurredAt,
              datePrecision: r.datePrecision,
              sourceId: r.sourceId,
            },
          }),
        ),
        { timeout: 30000 },
      );
      written += batch.length;
      if (written % 2000 === 0 || written === rows.length) {
        console.log(`  ${written}/${rows.length} upserted`);
      }
    } catch (e) {
      console.error(`  Batch starting at ${i} failed:`, e);
      errors += batch.length;
    }
  }
  console.log(`\n  Upserted ${written} rows (${errors} errored).`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
