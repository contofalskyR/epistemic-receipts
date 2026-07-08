/**
 * backfill-emergence-dates.ts — briefing 02 step 2, shaped by the 2026-07-08
 * census (logs/census-dateless-2026-07-08.json). Copies REAL dates into
 * claimEmergedAt (+ honest precision) for curve-less claims, so Layer 1 can
 * give them their first curve point on its next run.
 *
 * Census-driven pipeline rules:
 *   nara_catalog_v1     (258k)  metadata.beginDate → endDate   (many empty — preflight reports)
 *   jacar_v1            (31k)   metadata.rawDate               (Japanese era dates supported: 昭和16年12月8日)
 *   uk_national_archives_v1 (77) metadata.startDate → coveringDates ("1947 Jan 3-June18" → 1947-01, MONTH)
 *   africanlii_v1       (70)    metadata.year
 *   pdg_particles_v1    (226)   primary Source.publishedAt (census: 100% coverage), YEAR precision
 *
 * Never overwrites an existing claimEmergedAt (WHERE … IS NULL in every UPDATE).
 * Never guesses: empty/unparseable values are skipped and counted; up to 10
 * unparsed samples print per pipeline so parser gaps are visible, not silent.
 * Writes are unnest-batched UPDATEs (1,000 rows per statement).
 *
 * PREFLIGHT BY DEFAULT — parses everything, writes nothing. --execute writes.
 * DB-verified: prints remaining-dateless per pipeline after execution.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-emergence-dates.ts --direct
 *   ... --pipeline nara_catalog_v1        one pipeline only
 *   ... --limit 5000                      first N claims (pilot)
 *   ... --execute --direct                write
 *
 * After executing: re-run Layer 1 per pipeline —
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts --pipeline <tag> --dry-run
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const ONLY = argValue("--pipeline");
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const PAGE = 1000;

type Precision = "DAY" | "MONTH" | "YEAR";
interface Parsed { date: Date; precision: Precision }

// ── Parsers ───────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function utc(y: number, m = 1, d = 1): Date | null {
  if (y < 1 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return isNaN(dt.getTime()) || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d ? null : dt;
}

/** ISO, bare year, year-range start, US M/D/YYYY, "Month D, YYYY". */
function parseWestern(raw: string): Parsed | null {
  const s = raw.trim();
  if (!s) return null;

  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) { const d = utc(+m[1], +m[2], +m[3]); return d ? { date: d, precision: "DAY" } : null; }

  m = /^(\d{4})-(\d{2})$/.exec(s);
  if (m) { const d = utc(+m[1], +m[2]); return d ? { date: d, precision: "MONTH" } : null; }

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); // NARA US-style
  if (m) { const d = utc(+m[3], +m[1], +m[2]); return d ? { date: d, precision: "DAY" } : null; }

  m = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(s); // "December 7, 1941"
  if (m) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) { const d = utc(+m[3], mo, +m[2]); return d ? { date: d, precision: "DAY" } : null; }
  }

  m = /^(\d{4})(?:\s*[-–—/]\s*\d{2,4})?$/.exec(s); // "1941" or range "1941-1945" → start, YEAR
  if (m) { const d = utc(+m[1]); return d ? { date: d, precision: "YEAR" } : null; }

  return null;
}

/** Japanese era dates: 明治/大正/昭和/平成/令和 + 年/月/日, full-width digits ok. */
const ERA_BASE: Record<string, number> = { 明治: 1868, 大正: 1912, 昭和: 1926, 平成: 1989, 令和: 2019 };

function parseJapanese(raw: string): Parsed | null {
  const s = raw.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).trim();
  const m = /(明治|大正|昭和|平成|令和)\s*(\d{1,2}|元)\s*年(?:\s*(\d{1,2})\s*月)?(?:\s*(\d{1,2})\s*日)?/.exec(s);
  if (!m) return null;
  const year = ERA_BASE[m[1]] + (m[2] === "元" ? 1 : +m[2]) - 1;
  if (m[3] && m[4]) { const d = utc(year, +m[3], +m[4]); return d ? { date: d, precision: "DAY" } : null; }
  if (m[3]) { const d = utc(year, +m[3]); return d ? { date: d, precision: "MONTH" } : null; }
  const d = utc(year);
  return d ? { date: d, precision: "YEAR" } : null;
}

function parseJacar(raw: string): Parsed | null {
  return parseWestern(raw) ?? parseJapanese(raw);
}

/** UK covering dates: "1947 Jan 3-June18" / "1946 Jan 22-Nov 12" → start, MONTH|YEAR. */
function parseCoveringDates(raw: string): Parsed | null {
  const m = /^(\d{4})(?:\s+([A-Za-z]{3,9}))?/.exec(raw.trim());
  if (!m) return null;
  const mo = m[2] ? MONTHS[m[2].slice(0, 3).toLowerCase()] : undefined;
  const d = mo ? utc(+m[1], mo) : utc(+m[1]);
  return d ? { date: d, precision: mo ? "MONTH" : "YEAR" } : null;
}

// ── Pipeline rules (from the census) ─────────────────────────────────────────

interface MetadataRule {
  mode: "metadata";
  keys: string[]; // tried in order — first non-empty parseable wins
  parse: (raw: string) => Parsed | null;
}
interface SourceRule {
  mode: "source-published";
  precision: Precision;
}
type Rule = MetadataRule | SourceRule;

const RULES: Record<string, Rule> = {
  nara_catalog_v1: { mode: "metadata", keys: ["beginDate", "endDate"], parse: parseWestern },
  jacar_v1: { mode: "metadata", keys: ["rawDate"], parse: parseJacar },
  uk_national_archives_v1: { mode: "metadata", keys: ["startDate", "coveringDates"], parse: parseCoveringDates },
  africanlii_v1: { mode: "metadata", keys: ["year"], parse: parseWestern },
  // Census: 100% of dateless PDG claims have a dated primary Source (annual
  // Review of Particle Physics editions) — YEAR is the honest grain.
  pdg_particles_v1: { mode: "source-published", precision: "YEAR" },
};

// ── Batched write ─────────────────────────────────────────────────────────────

async function applyBatch(rows: { id: string; date: Date; precision: Precision }[]): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "Claim" c
        SET "claimEmergedAt" = v.d, "claimEmergedPrecision" = v.p
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::timestamptz[]) AS d, unnest($3::text[]) AS p) v
      WHERE c."id" = v.id AND c."claimEmergedAt" IS NULL`,
    rows.map((r) => r.id),
    rows.map((r) => r.date),
    rows.map((r) => r.precision),
  );
  return Number(result);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const asMeta = (v: Prisma.JsonValue | null): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

async function runMetadataRule(pipeline: string, rule: MetadataRule) {
  const counts = { scanned: 0, empty: 0, parsed: 0, unparsed: 0, updated: 0 };
  const byPrecision: Record<string, number> = {};
  const unparsedSamples: string[] = [];
  let cursor: string | null = null;

  for (;;) {
    const claims: { id: string; metadata: Prisma.JsonValue | null }[] = await prisma.claim.findMany({
      where: {
        deleted: false,
        ingestedBy: pipeline,
        claimEmergedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, metadata: true },
      orderBy: { id: "asc" },
      take: PAGE,
    });
    if (claims.length === 0) break;

    const batch: { id: string; date: Date; precision: Precision }[] = [];
    for (const c of claims) {
      counts.scanned++;
      const meta = asMeta(c.metadata);
      let parsed: Parsed | null = null;
      let sawValue = false;
      for (const key of rule.keys) {
        const raw = typeof meta[key] === "string" ? (meta[key] as string).trim() : "";
        if (!raw) continue;
        sawValue = true;
        parsed = rule.parse(raw);
        if (parsed) break;
        if (unparsedSamples.length < 10) unparsedSamples.push(`${key}="${raw.slice(0, 40)}"`);
      }
      if (!sawValue) { counts.empty++; continue; }
      if (!parsed) { counts.unparsed++; continue; }
      counts.parsed++;
      byPrecision[parsed.precision] = (byPrecision[parsed.precision] ?? 0) + 1;
      batch.push({ id: c.id, date: parsed.date, precision: parsed.precision });
    }

    if (EXECUTE) counts.updated += await applyBatch(batch);
    cursor = claims[claims.length - 1].id;
    if (counts.scanned % 20000 === 0)
      console.log(`    … ${counts.scanned.toLocaleString()} scanned, ${counts.parsed.toLocaleString()} parseable`);
    if ((LIMIT && counts.scanned >= LIMIT) || claims.length < PAGE) break;
  }

  console.log(
    `  scanned ${counts.scanned.toLocaleString()} · empty ${counts.empty.toLocaleString()} · ` +
    `parsed ${counts.parsed.toLocaleString()} (${Object.entries(byPrecision).map(([p, n]) => `${p} ${n.toLocaleString()}`).join(", ") || "—"}) · ` +
    `unparsed ${counts.unparsed.toLocaleString()}` +
    (EXECUTE ? ` · UPDATED ${counts.updated.toLocaleString()}` : " · (preflight — nothing written)"),
  );
  if (unparsedSamples.length > 0)
    console.log(`  unparsed samples: ${unparsedSamples.join(" | ")}`);
}

async function runSourceRule(pipeline: string, rule: SourceRule) {
  if (!EXECUTE) {
    const rows = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `SELECT COUNT(*) AS n
         FROM "Claim" c
        WHERE c."deleted" = false AND c."ingestedBy" = $1 AND c."claimEmergedAt" IS NULL
          AND EXISTS (
            SELECT 1 FROM "Edge" e JOIN "Source" s ON s."id" = e."sourceId"
             WHERE e."claimId" = c."id" AND e."deleted" = false AND s."publishedAt" IS NOT NULL
          )`,
      pipeline,
    );
    console.log(`  would set ${Number(rows[0].n).toLocaleString()} claims from Source.publishedAt (${rule.precision}) · (preflight)`);
    return;
  }
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "Claim" c
        SET "claimEmergedAt" = src."publishedAt", "claimEmergedPrecision" = $2
       FROM LATERAL (
         SELECT s."publishedAt"
           FROM "Edge" e JOIN "Source" s ON s."id" = e."sourceId"
          WHERE e."claimId" = c."id" AND e."deleted" = false AND s."publishedAt" IS NOT NULL
          ORDER BY e."createdAt" ASC LIMIT 1
       ) src
      WHERE c."deleted" = false AND c."ingestedBy" = $1 AND c."claimEmergedAt" IS NULL`,
    pipeline,
    rule.precision,
  );
  console.log(`  UPDATED ${Number(updated).toLocaleString()} from Source.publishedAt (${rule.precision})`);
}

async function main() {
  console.log(`\n=== Emergence-date backfill — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${ONLY ? `, pipeline ${ONLY}` : ""}${LIMIT ? `, limit ${LIMIT}` : ""} ===\n`);

  const targets = Object.entries(RULES).filter(([p]) => !ONLY || p === ONLY);
  if (targets.length === 0) {
    console.error(`No rule for pipeline "${ONLY}". Known: ${Object.keys(RULES).join(", ")}`);
    process.exitCode = 2;
    return;
  }

  for (const [pipeline, rule] of targets) {
    console.log(`── ${pipeline} [${rule.mode}]`);
    if (rule.mode === "metadata") await runMetadataRule(pipeline, rule);
    else await runSourceRule(pipeline, rule);
  }

  if (EXECUTE) {
    console.log(`\n── DB verification: remaining dateless per pipeline ──`);
    for (const [pipeline] of targets) {
      const rows = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) AS n FROM "Claim" c
          WHERE c."deleted" = false AND c."ingestedBy" = $1 AND c."claimEmergedAt" IS NULL`,
        pipeline,
      );
      console.log(`  ${pipeline.padEnd(28)} ${Number(rows[0].n).toLocaleString()} still dateless (honest residue or parser gap)`);
    }
    console.log(
      `\nNext: give the newly-dated claims their curves —\n` +
      targets.map(([p]) => `  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts --pipeline ${p} --dry-run`).join("\n") +
      `\n(then without --dry-run; then re-run the census + audit-chain-integrity)`,
    );
  } else {
    console.log(`\nPreflight only. Re-run with --execute --direct to write.`);
  }
}

main()
  .catch((e) => {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P1017") {
      console.error("\nP1017 (pooled connection closed) — re-run with --direct.");
    } else {
      console.error(e);
    }
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
