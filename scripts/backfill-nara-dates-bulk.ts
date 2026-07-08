/**
 * backfill-nara-dates-bulk.ts — THE PIVOT (2026-07-08): the item-level API
 * sweep was cut off by NARA's edge after ~8k requests (HTTP 000 — connection
 * refused; quota/abuse block). The right tool for 258k records was always the
 * bulk dataset: NARA publishes the ENTIRE catalog on AWS Open Data —
 * s3://nara-national-archives-catalog/ — organized as
 *   descriptions/record-groups/rg_XXX/rg_XXX-N.json   (≤10k descriptions/file)
 * downloadable over plain HTTPS, no account, no quota, no rate limit.
 * (Docs: archives.gov/developer/national-archives-catalog-dataset. Snapshot is
 * biannual — Apr 2025 currently — so records ingested after the snapshot may
 * miss; they stay stamped no-date-bulk and are honest residue or a later top-up.)
 *
 * Every claim carries metadata.recordGroup, so only the record groups YOUR
 * claims live in are downloaded (typically a handful of RGs, not 87 GB).
 *
 * Flow per record group: list its files via the S3 REST API (XML, curl-grade
 * HTTPS) → download each JSON to the cache dir → parse → extract dates with
 * the SAME extractors as the API sweep (lib/nara-dates.ts) → match against the
 * pipeline's undated naIds → unnest-batched UPDATE + metadata stamp
 * ('found-bulk' / 'no-date-bulk'). Stamps make everything resumable; files are
 * cached on disk so re-runs don't re-download.
 *
 * PREFLIGHT BY DEFAULT: processes the SMALLEST relevant record group
 * end-to-end (download + parse + coverage report), writes nothing. --execute
 * runs all record groups with writes. --rg N targets one group.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-nara-dates-bulk.ts --direct
 *   ... --rg 59                        one record group (preflight unless --execute)
 *   ... --execute --direct             full run, all record groups
 *   ... --cache-dir /path              default /tmp/nara-bulk (survives within a boot)
 *
 * After: the harvest commands in briefings/09 (ingest-auto-trajectories
 * --pipeline nara_catalog_v1, then the census).
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { extractNaraDate, naraDateFieldInventory, type NaraJson } from "../lib/nara-dates";

if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

const S3_HOST = "https://nara-national-archives-catalog.s3.us-east-2.amazonaws.com";
const PIPELINE = "nara_catalog_v1";

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const ONLY_RG = argValue("--rg");
const CACHE_DIR = argValue("--cache-dir") ?? "/tmp/nara-bulk";

// ── S3 over plain HTTPS ───────────────────────────────────────────────────────

async function httpGet(url: string, asText = true): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "epistemic-receipts/1.0 (nara bulk sweep)" },
        signal: AbortSignal.timeout(120000),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      return asText ? await res.text() : null;
    } catch {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return null;
}

/** List keys under a prefix via S3 REST (list-type=2), following continuation. */
async function s3List(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | null = null;
  for (;;) {
    const url =
      `${S3_HOST}/?list-type=2&prefix=${encodeURIComponent(prefix)}` +
      (token ? `&continuation-token=${encodeURIComponent(token)}` : "");
    const xml = await httpGet(url);
    if (!xml) break;
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
    const t = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml);
    if (!t) break;
    token = t[1];
  }
  return keys;
}

async function downloadToCache(key: string): Promise<string | null> {
  const dest = path.join(CACHE_DIR, key);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const body = await httpGet(`${S3_HOST}/${key}`);
  if (body == null) return null;
  fs.writeFileSync(dest, body);
  return dest;
}

/** Bulk files may be a bare array or wrap records under some key — find them. */
function recordsFrom(parsed: unknown): NaraJson[] {
  if (Array.isArray(parsed)) return parsed.filter((r) => r && typeof r === "object") as NaraJson[];
  if (parsed && typeof parsed === "object") {
    for (const v of Object.values(parsed as NaraJson)) {
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") return v as NaraJson[];
    }
  }
  return [];
}

// ── DB side ───────────────────────────────────────────────────────────────────

const asMeta = (v: Prisma.JsonValue | null): NaraJson =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as NaraJson) : {};

/** recordGroup → { naId → claimId } for undated, unswept-by-bulk claims. */
async function loadTargets(): Promise<Map<string, Map<string, string>>> {
  const byRg = new Map<string, Map<string, string>>();
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
        take: 5000,
      });
    if (claims.length === 0) break;
    cursor = claims[claims.length - 1].id;
    for (const c of claims) {
      const meta = asMeta(c.metadata);
      if (meta.naraDateSweep === "found-bulk" || meta.naraDateSweep === "no-date-bulk") continue;
      const naId = c.externalId?.replace(/^nara_catalog_/, "") ?? "";
      const rg = String(meta.recordGroup ?? "").replace(/\D/g, "");
      if (!/^\d+$/.test(naId) || !rg) continue;
      if (!byRg.has(rg)) byRg.set(rg, new Map());
      byRg.get(rg)!.set(naId, c.id);
    }
    if (claims.length < 5000) break;
  }
  return byRg;
}

async function flushWrites(
  dated: { id: string; date: Date; precision: string; field: string }[],
  undatedIds: string[],
): Promise<number> {
  let written = 0;
  if (dated.length > 0) {
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "Claim" c
          SET "claimEmergedAt" = v.d, "claimEmergedPrecision" = v.p,
              "metadata" = COALESCE(c."metadata", '{}'::jsonb)
                           || jsonb_build_object('naraDateSweep', 'found-bulk', 'naraDateField', v.f)
         FROM (SELECT unnest($1::text[]) AS id, unnest($2::timestamptz[]) AS d,
                      unnest($3::text[]) AS p, unnest($4::text[]) AS f) v
        WHERE c."id" = v.id AND c."claimEmergedAt" IS NULL`,
      dated.map((r) => r.id),
      dated.map((r) => r.date),
      dated.map((r) => r.precision),
      dated.map((r) => r.field),
    );
    written = Number(n);
  }
  if (undatedIds.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Claim" c
          SET "metadata" = COALESCE(c."metadata", '{}'::jsonb) || '{"naraDateSweep":"no-date-bulk"}'::jsonb
        WHERE c."id" = ANY($1::text[]) AND c."claimEmergedAt" IS NULL`,
      undatedIds,
    );
  }
  return written;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== NARA bulk-dataset date sweep — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (smallest RG, no writes)"}${ONLY_RG ? `, rg ${ONLY_RG}` : ""} ===`);
  console.log(`Cache: ${CACHE_DIR} (files are kept; re-runs skip downloads)\n`);

  console.log("Loading undated claims by record group…");
  const byRg = await loadTargets();
  const rgList = [...byRg.entries()]
    .map(([rg, m]) => ({ rg, count: m.size }))
    .sort((a, b) => a.count - b.count);
  if (rgList.length === 0) {
    console.log("Nothing to do — no undated, unswept nara claims remain.");
    return;
  }
  console.log(`Record groups with undated claims: ${rgList.length}`);
  for (const { rg, count } of [...rgList].sort((a, b) => b.count - a.count).slice(0, 15))
    console.log(`  RG ${rg.padStart(4)} · ${count.toLocaleString()} undated`);
  if (rgList.length > 15) console.log(`  … ${rgList.length - 15} more (processed in full on --execute)`);

  const targets = ONLY_RG
    ? rgList.filter((r) => r.rg === ONLY_RG.replace(/\D/g, ""))
    : EXECUTE
      ? [...rgList].sort((a, b) => b.count - a.count) // biggest first — most value early
      : [rgList[0]]; // preflight: smallest RG, end-to-end
  if (targets.length === 0) {
    console.error(`--rg ${ONLY_RG}: no undated claims in that record group.`);
    process.exitCode = 2;
    return;
  }

  const totals = { files: 0, records: 0, matched: 0, dated: 0, noDate: 0, written: 0, filesMissing: 0 };
  const inventory = new Map<string, number>();
  const byField = new Map<string, number>();
  const examples: string[] = [];

  for (const { rg, count } of targets) {
    const rgDir = `descriptions/record-groups/rg_${rg.padStart(3, "0")}/`;
    console.log(`\n── RG ${rg} (${count.toLocaleString()} undated) → ${rgDir}`);
    const keys = (await s3List(rgDir)).filter((k) => k.endsWith(".json"));
    if (keys.length === 0) {
      console.log(`  no files under ${rgDir} — snapshot may predate these records; leaving unswept.`);
      totals.filesMissing++;
      continue;
    }
    console.log(`  ${keys.length} files in bucket`);
    const want = byRg.get(rg)!;

    let dated: { id: string; date: Date; precision: string; field: string }[] = [];
    let matchedNoDate: string[] = [];
    for (const [i, key] of keys.entries()) {
      const file = await downloadToCache(key);
      if (!file) { console.log(`  ! download failed: ${key}`); continue; }
      totals.files++;
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        console.log(`  ! unparsable JSON: ${key}`);
        continue;
      }
      const records = recordsFrom(parsed);
      totals.records += records.length;
      if (records.length === 0 && i === 0)
        console.log(`  ⚠ zero records parsed from first file — top-level keys: ${Object.keys((parsed as NaraJson) ?? {}).slice(0, 8).join(", ")}`);

      for (const rec of records) {
        const naId = String(rec.naId ?? "");
        const claimId = want.get(naId);
        if (!claimId) continue;
        totals.matched++;
        want.delete(naId);
        if (totals.matched <= 200) naraDateFieldInventory(rec, inventory);
        const hit = extractNaraDate(rec);
        if (hit) {
          totals.dated++;
          byField.set(hit.field, (byField.get(hit.field) ?? 0) + 1);
          if (examples.length < 8)
            examples.push(`naId ${naId} (RG ${rg}): ${hit.field} → ${hit.parsed.date.toISOString().slice(0, 10)} (${hit.parsed.precision})`);
          if (EXECUTE) dated.push({ id: claimId, date: hit.parsed.date, precision: hit.parsed.precision, field: hit.field });
        } else {
          totals.noDate++;
          if (EXECUTE) matchedNoDate.push(claimId);
        }
        if (EXECUTE && dated.length + matchedNoDate.length >= 1000) {
          totals.written += await flushWrites(dated, matchedNoDate);
          dated = [];
          matchedNoDate = [];
        }
      }
      if ((i + 1) % 5 === 0 || i === keys.length - 1)
        console.log(`  … file ${i + 1}/${keys.length} · matched ${totals.matched.toLocaleString()} · dated ${totals.dated.toLocaleString()}`);
    }
    if (EXECUTE && (dated.length > 0 || matchedNoDate.length > 0)) {
      totals.written += await flushWrites(dated, matchedNoDate);
      dated = [];
      matchedNoDate = [];
    }
    // Claims of this RG never seen in any file: in-bucket-missing (post-snapshot
    // ingests, or naId not in this RG's files). Stamp as no-date-bulk on execute.
    if (EXECUTE && want.size > 0) {
      const leftover = [...want.values()];
      for (let i = 0; i < leftover.length; i += 2000)
        await flushWrites([], leftover.slice(i, i + 2000));
      console.log(`  ${want.size.toLocaleString()} claims not found in bucket files → stamped no-date-bulk (snapshot gap / genuinely undated)`);
      totals.noDate += want.size;
    }
  }

  console.log(`\n── Summary ──`);
  console.log(totals);
  const seen = totals.matched;
  if (seen > 0)
    console.log(`Date coverage among matched: ${totals.dated.toLocaleString()}/${seen.toLocaleString()} (${Math.round((totals.dated / seen) * 100)}%)`);
  if (byField.size > 0)
    console.log(`Winning fields:`, Object.fromEntries([...byField.entries()].sort((a, b) => b[1] - a[1])));
  if (inventory.size > 0)
    console.log(`Date-ish fields seen (first 200 matches):`, Object.fromEntries([...inventory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)));
  for (const e of examples) console.log(`  ${e}`);

  if (!EXECUTE) {
    console.log(`\nPreflight only (smallest RG). If coverage justifies it:\n  npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-nara-dates-bulk.ts --execute --direct`);
  } else {
    const rows = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `SELECT COUNT(*) AS n FROM "Claim" c
        WHERE c."deleted" = false AND c."ingestedBy" = $1 AND c."claimEmergedAt" IS NULL`,
      PIPELINE,
    );
    console.log(`\nDB verification: ${Number(rows[0].n).toLocaleString()} nara claims still dateless (stamped residue).`);
    console.log(`Next: the harvest — ingest-auto-trajectories.ts --pipeline ${PIPELINE} --dry-run, then real, then the census.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
