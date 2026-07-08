/**
 * backfill-nara-dates-api.ts — the "different beast": item-level NARA API sweep
 * for the 258k nara_catalog_v1 claims whose LIST-level ingest carried no date.
 *
 * The catalog's search-list snippets often omit dates that the full item
 * record has (production dates, coverage dates). This script looks each naId
 * up individually (naId parsed from externalId `nara_catalog_<naId>`), scans
 * the FULL record for date-bearing fields, parses with honest precision, and
 * backfills claimEmergedAt. Undatable records get a metadata stamp
 * (`naraDateSweep: "no-date"`) so re-runs skip them — the stamp is the resume
 * marker; interrupted sweeps just continue.
 *
 * SAMPLE MODE BY DEFAULT: fetches --sample N records (default 200) and reports
 * date coverage + a field-name inventory — the go/no-go evidence for spending
 * API budget on the full sweep. Nothing is written without --execute.
 *
 * API mechanics (mirrors ingest-nara-catalog.ts): catalog.archives.gov/api/v2,
 * x-api-key from NARA_API_KEY. The exact naId query param is probed at startup
 * (naId_is → naId → q) against the first claim, so parameter-name drift in the
 * API fails loudly instead of silently returning nothing.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-nara-dates-api.ts --direct              # sample 200
 *   ... --sample 500
 *   ... --execute --direct [--limit 20000]     # full sweep (resumable; ~4/s ⇒ 258k ≈ 18h)
 *
 * After: ingest-auto-trajectories.ts --pipeline nara_catalog_v1, then re-census.
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { parseWestern, parseDateParts, type ParsedDate } from "../lib/date-parsers";

if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

const NARA_BASE = "https://catalog.archives.gov/api/v2";
const PIPELINE = "nara_catalog_v1";

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const SAMPLE = argValue("--sample") ? parseInt(argValue("--sample")!, 10) : 200;
const LIMIT = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : null;
const CONCURRENCY = argValue("--concurrency") ? parseInt(argValue("--concurrency")!, 10) : 4;
const DELAY_MS = 150;
const PAGE = 1000;
const WRITE_BATCH = 500;

const API_KEY = process.env.NARA_API_KEY ?? "";

// ── API access ────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

async function apiGet(path: string): Promise<Json | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${NARA_BASE}${path}`, {
        headers: { "x-api-key": API_KEY, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as Json;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return null;
}

/** hits[]._source.record (+ .fields), as the ingester parses it. */
function extractRecords(data: Json | null): Json[] {
  const hits = (((data?.body as Json)?.hits as Json)?.hits ?? (data?.hits as Json | undefined)?.hits) as
    | Array<{ _source?: { record?: Json }; fields?: Json }>
    | undefined;
  if (!Array.isArray(hits)) return [];
  return hits.map((h) => ({ ...(h._source?.record ?? {}), ...(h.fields ?? {}) })).filter((r) => Object.keys(r).length > 0);
}

/** Probe which query param finds records by naId. Fails loudly if none work. */
async function probeStrategy(testNaId: string): Promise<string> {
  for (const param of ["naId_is", "naId", "q"]) {
    const data = await apiGet(`/records/search?${param}=${encodeURIComponent(testNaId)}&limit=3`);
    const recs = extractRecords(data);
    if (recs.some((r) => String(r.naId) === testNaId)) {
      console.log(`API strategy: ?${param}=<naId> works`);
      return param;
    }
  }
  throw new Error(
    "No naId query strategy returned the test record — check NARA_API_KEY and the API shape " +
    "(compare with ingest-nara-catalog.ts).",
  );
}

// ── Date extraction from a full record ───────────────────────────────────────

const PRIORITY_KEYS = [
  "productionDates", "productionDate", "coverageStartDate", "inclusiveStartDate",
  "beginDate", "coverageEndDate", "inclusiveEndDate", "endDate",
];

function tryValue(v: unknown): ParsedDate | null {
  if (typeof v === "string") return parseWestern(v);
  if (Array.isArray(v)) {
    for (const item of v) {
      const p = tryValue(item);
      if (p) return p;
    }
    return null;
  }
  if (v && typeof v === "object") {
    const o = v as Json;
    const fromParts = parseDateParts(o);
    if (fromParts) return fromParts;
    if (typeof o.logicalDate === "string") return parseWestern(o.logicalDate);
    if (typeof o.dateQualifier !== "undefined" && typeof o.year !== "undefined") return parseDateParts(o);
  }
  return null;
}

/** Priority keys first, then a recursive scan for any /date/i-named field. */
function extractDate(record: Json): { parsed: ParsedDate; field: string } | null {
  for (const key of PRIORITY_KEYS) {
    if (key in record) {
      const p = tryValue(record[key]);
      if (p) return { parsed: p, field: key };
    }
  }
  const found: { parsed: ParsedDate; field: string }[] = [];
  const walk = (obj: Json, prefix: string, depth: number) => {
    if (depth > 3) return;
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (/date/i.test(k)) {
        const p = tryValue(v);
        if (p) found.push({ parsed: p, field: path });
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Json, path, depth + 1);
      }
    }
  };
  walk(record, "", 0);
  return found[0] ?? null;
}

/** Field-name inventory (sample mode): which date-ish fields exist at all. */
function dateFieldInventory(record: Json, into: Map<string, number>) {
  const walk = (obj: Json, prefix: string, depth: number) => {
    if (depth > 3) return;
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (/date/i.test(k) && v != null && v !== "") into.set(path, (into.get(path) ?? 0) + 1);
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v as Json, path, depth + 1);
    }
  };
  walk(record, "", 0);
}

// ── Sweep ─────────────────────────────────────────────────────────────────────

const asMeta = (v: Prisma.JsonValue | null): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};

interface Target { id: string; naId: string; metadata: Json }

async function* targets(): AsyncGenerator<Target[]> {
  let cursor: string | null = null;
  for (;;) {
    const claims: { id: string; externalId: string | null; metadata: Prisma.JsonValue | null }[] =
      await prisma.claim.findMany({
        where: {
          deleted: false,
          ingestedBy: PIPELINE,
          claimEmergedAt: null,
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: { id: true, externalId: true, metadata: true },
        orderBy: { id: "asc" },
        take: PAGE,
      });
    if (claims.length === 0) return;
    cursor = claims[claims.length - 1].id;
    const batch = claims
      .map((c) => ({
        id: c.id,
        naId: c.externalId?.replace(/^nara_catalog_/, "") ?? "",
        metadata: asMeta(c.metadata),
      }))
      .filter((c) => /^\d+$/.test(c.naId) && !c.metadata.naraDateSweep);
    if (batch.length > 0) yield batch;
    if (claims.length < PAGE) return;
  }
}

async function flushWrites(
  dated: { id: string; date: Date; precision: string; field: string }[],
  undated: string[],
) {
  if (dated.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Claim" c
          SET "claimEmergedAt" = v.d, "claimEmergedPrecision" = v.p,
              "metadata" = COALESCE(c."metadata", '{}'::jsonb)
                           || jsonb_build_object('naraDateSweep', 'found', 'naraDateField', v.f)
         FROM (SELECT unnest($1::text[]) AS id, unnest($2::timestamptz[]) AS d,
                      unnest($3::text[]) AS p, unnest($4::text[]) AS f) v
        WHERE c."id" = v.id AND c."claimEmergedAt" IS NULL`,
      dated.map((r) => r.id),
      dated.map((r) => r.date),
      dated.map((r) => r.precision),
      dated.map((r) => r.field),
    );
  }
  if (undated.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Claim" c
          SET "metadata" = COALESCE(c."metadata", '{}'::jsonb) || '{"naraDateSweep":"no-date"}'::jsonb
        WHERE c."id" = ANY($1::text[])`,
      undated,
    );
  }
}

async function main() {
  if (!API_KEY) {
    console.error("NARA_API_KEY is not set (.env.local) — the sweep needs it.");
    process.exitCode = 2;
    return;
  }
  const mode = EXECUTE ? `EXECUTE (full sweep${LIMIT ? `, limit ${LIMIT}` : ""})` : `SAMPLE (${SAMPLE} records, no writes)`;
  console.log(`\n=== NARA item-level date sweep — ${mode} ===\n`);

  const counts = { fetched: 0, apiMiss: 0, dated: 0, undated: 0, written: 0 };
  const inventory = new Map<string, number>();
  const byField = new Map<string, number>();
  const examples: string[] = [];
  let strategy: string | null = null;
  let pendingDated: { id: string; date: Date; precision: string; field: string }[] = [];
  let pendingUndated: string[] = [];
  const cap = EXECUTE ? LIMIT ?? Infinity : SAMPLE;
  const t0 = Date.now();

  outer: for await (const batch of targets()) {
    if (!strategy) strategy = await probeStrategy(batch[0].naId);

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const slice = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map(async (t) => {
          const data = await apiGet(`/records/search?${strategy}=${encodeURIComponent(t.naId)}&limit=1`);
          const rec = extractRecords(data).find((r) => String(r.naId) === t.naId) ?? extractRecords(data)[0] ?? null;
          return { t, rec };
        }),
      );
      await new Promise((r) => setTimeout(r, DELAY_MS));

      for (const { t, rec } of results) {
        counts.fetched++;
        if (!rec) { counts.apiMiss++; continue; }
        dateFieldInventory(rec, inventory);
        const hit = extractDate(rec);
        if (hit) {
          counts.dated++;
          byField.set(hit.field, (byField.get(hit.field) ?? 0) + 1);
          if (examples.length < 8)
            examples.push(`naId ${t.naId}: ${hit.field} → ${hit.parsed.date.toISOString().slice(0, 10)} (${hit.parsed.precision})`);
          if (EXECUTE)
            pendingDated.push({ id: t.id, date: hit.parsed.date, precision: hit.parsed.precision, field: hit.field });
        } else {
          counts.undated++;
          if (EXECUTE) pendingUndated.push(t.id);
        }
      }

      if (EXECUTE && pendingDated.length + pendingUndated.length >= WRITE_BATCH) {
        counts.written += pendingDated.length;
        await flushWrites(pendingDated, pendingUndated);
        pendingDated = [];
        pendingUndated = [];
      }
      if (counts.fetched % 1000 === 0) {
        const rate = counts.fetched / ((Date.now() - t0) / 1000);
        console.log(
          `  … ${counts.fetched.toLocaleString()} fetched · ${counts.dated.toLocaleString()} dated ` +
          `(${Math.round((counts.dated / Math.max(counts.fetched - counts.apiMiss, 1)) * 100)}%) · ${rate.toFixed(1)}/s`,
        );
      }
      // Sanity fuse: if the first 25 fetches all miss, the key/strategy is broken.
      if (counts.fetched >= 25 && counts.apiMiss === counts.fetched)
        throw new Error("First 25 API lookups all failed — aborting (check NARA_API_KEY / API status).");
      if (counts.fetched >= cap) break outer;
    }
  }

  if (EXECUTE && (pendingDated.length > 0 || pendingUndated.length > 0)) {
    counts.written += pendingDated.length;
    await flushWrites(pendingDated, pendingUndated);
  }

  console.log(`\n── Summary ──`);
  console.log(counts);
  const datable = counts.fetched - counts.apiMiss;
  if (datable > 0)
    console.log(`Date coverage: ${counts.dated.toLocaleString()}/${datable.toLocaleString()} (${Math.round((counts.dated / datable) * 100)}%)`);
  if (byField.size > 0)
    console.log(`Winning fields:`, Object.fromEntries([...byField.entries()].sort((a, b) => b[1] - a[1])));
  if (inventory.size > 0)
    console.log(`Date-ish fields seen:`, Object.fromEntries([...inventory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)));
  for (const e of examples) console.log(`  ${e}`);

  if (!EXECUTE) {
    console.log(
      `\nSample only — nothing written. If coverage justifies it:\n` +
      `  npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-nara-dates-api.ts --execute --direct\n` +
      `(resumable — swept claims carry metadata.naraDateSweep and are skipped on re-run)`,
    );
  } else {
    const rows = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `SELECT COUNT(*) AS n FROM "Claim" c
        WHERE c."deleted" = false AND c."ingestedBy" = $1 AND c."claimEmergedAt" IS NULL`,
      PIPELINE,
    );
    console.log(`\nDB verification: ${Number(rows[0].n).toLocaleString()} nara claims still dateless.`);
    console.log(`Next: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts --pipeline ${PIPELINE} --dry-run`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
