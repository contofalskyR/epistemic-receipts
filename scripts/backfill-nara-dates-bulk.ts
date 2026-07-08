/**
 * backfill-nara-dates-bulk.ts — THE PIVOT (2026-07-08): the item-level API
 * sweep was throttled by NARA's edge after ~8k requests. The right tool for
 * 258k records was always the bulk dataset: NARA publishes the ENTIRE catalog
 * on AWS Open Data — s3://nara-national-archives-catalog/ — organized as
 *   descriptions/record-groups/rg_N/rg_N-M.jsonl   (JSON Lines, ~10-20MB/file)
 * over plain HTTPS, no account, no quota. VERIFIED layout facts (2026-07-08,
 * via live listing — the docs' "rg_021/…json" example is wrong twice):
 *   - record-group dirs are UNPADDED: rg_1/, rg_59/, rg_330/
 *   - files are .jsonl (one description per line), not .json
 * Snapshot is biannual (Apr 2026 currently); post-snapshot records miss and
 * are stamped as residue rather than guessed.
 *
 * Every claim carries metadata.recordGroup, so only the record groups YOUR
 * claims live in are touched. Files are STREAMED line-by-line (nothing written
 * to disk — a record group can be 1-2 GB), each line parsed, matched against
 * the pipeline's undated naIds, dates extracted with the same extractors as
 * the API sweep (lib/nara-dates.ts), then discarded. A record group stops
 * early once all its claims are matched. Writes are unnest-batched UPDATEs +
 * metadata stamps ('found-bulk' / 'no-date-bulk') — fully resumable.
 *
 * PREFLIGHT BY DEFAULT: processes the SMALLEST relevant record group
 * end-to-end, writes nothing. --execute runs all record groups (biggest
 * first). --rg N targets one group.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-nara-dates-bulk.ts --direct
 *   ... --rg 65                        one record group (preflight unless --execute)
 *   ... --execute --direct             full run
 *
 * After: the harvest commands in briefings/09 (ingest-auto-trajectories
 * --pipeline nara_catalog_v1, then the census).
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import * as readline from "readline";
import { Readable } from "stream";
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

// ── S3 over plain HTTPS ───────────────────────────────────────────────────────

/** List keys under a prefix via S3 REST (list-type=2), following continuation.
 *  Prefix goes in RAW (slashes unencoded — verified via curl); zero-key results
 *  print the XML head so failures are diagnosable, never silent. */
async function s3List(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | null = null;
  let lastXml = "";
  for (;;) {
    const url =
      `${S3_HOST}/?list-type=2&max-keys=1000&prefix=${prefix}` +
      (token ? `&continuation-token=${encodeURIComponent(token)}` : "");
    let xml: string | null = null;
    for (let attempt = 0; attempt < 3 && xml == null; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
        if (res.ok) xml = await res.text();
        else if (res.status >= 500 || res.status === 429)
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        else break;
      } catch {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    if (!xml) break;
    lastXml = xml;
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(m[1]);
    const t = /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/.exec(xml);
    if (!t) break;
    token = t[1];
  }
  if (keys.length === 0 && lastXml)
    console.log(`    (s3List empty for "${prefix}" — XML head: ${lastXml.replace(/\s+/g, " ").slice(0, 220)})`);
  return keys;
}

/** Stream a .jsonl object line-by-line; yields parsed records, stores nothing. */
async function* streamJsonl(key: string): AsyncGenerator<NaraJson> {
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${S3_HOST}/${key}`, { signal: AbortSignal.timeout(300000) });
      if (r.ok && r.body) { res = r; break; }
      if (r.status < 500 && r.status !== 429) break;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (!res?.body) {
    console.log(`  ! download failed: ${key}`);
    return;
  }
  const rl = readline.createInterface({
    input: Readable.fromWeb(res.body as import("stream/web").ReadableStream),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    try {
      const obj = JSON.parse(s) as unknown;
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) continue;
      // Bulk lines wrap the description: {"record": {...}} (verified 2026-07-08).
      const inner = (obj as NaraJson).record;
      if (inner && typeof inner === "object" && !Array.isArray(inner)) yield inner as NaraJson;
      else yield obj as NaraJson;
    } catch { /* skip malformed line */ }
  }
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
      const rg = String(meta.recordGroup ?? "").replace(/\D/g, "").replace(/^0+/, "");
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
  console.log(
    `\n=== NARA bulk-dataset date sweep (streaming) — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${ONLY_RG ? `, rg ${ONLY_RG}` : ""} ===\n`,
  );

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

  const targets = ONLY_RG
    ? rgList.filter((r) => r.rg === ONLY_RG.replace(/\D/g, "").replace(/^0+/, ""))
    : EXECUTE
      ? [...rgList].sort((a, b) => b.count - a.count) // biggest first
      : [rgList[0]]; // preflight: smallest RG end-to-end
  if (targets.length === 0) {
    console.error(`--rg ${ONLY_RG}: no undated claims in that record group.`);
    process.exitCode = 2;
    return;
  }

  const totals = { files: 0, records: 0, matched: 0, dated: 0, noDate: 0, written: 0, rgMissing: 0 };
  const inventory = new Map<string, number>();
  const byField = new Map<string, number>();
  const examples: string[] = [];

  for (const { rg, count } of targets) {
    const rgDir = `descriptions/record-groups/rg_${rg}/`;
    console.log(`\n── RG ${rg} (${count.toLocaleString()} undated) → ${rgDir}`);
    const keys = (await s3List(rgDir)).filter((k) => k.endsWith(".jsonl") || k.endsWith(".json"));
    if (keys.length === 0) {
      console.log(`  no data files under ${rgDir} — snapshot gap; leaving unswept.`);
      totals.rgMissing++;
      continue;
    }
    const want = byRg.get(rg)!;
    console.log(`  ${keys.length} files · streaming until ${want.size.toLocaleString()} claims are matched`);

    let dated: { id: string; date: Date; precision: string; field: string }[] = [];
    let matchedNoDate: string[] = [];

    fileLoop: for (const [i, key] of keys.entries()) {
      totals.files++;
      for await (const rec of streamJsonl(key)) {
        totals.records++;
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
        if (want.size === 0) {
          console.log(`  all of RG ${rg}'s claims matched — skipping its remaining files`);
          break fileLoop;
        }
      }
      if ((i + 1) % 5 === 0 || i === keys.length - 1)
        console.log(
          `  … file ${i + 1}/${keys.length} · scanned ${totals.records.toLocaleString()} records · matched ${totals.matched.toLocaleString()} · dated ${totals.dated.toLocaleString()} · ${want.size.toLocaleString()} left`,
        );
    }

    if (EXECUTE && (dated.length > 0 || matchedNoDate.length > 0)) {
      totals.written += await flushWrites(dated, matchedNoDate);
      dated = [];
      matchedNoDate = [];
    }
    // Never seen in any file: post-snapshot ingests or absent naIds → stamp so
    // re-runs skip them; they are honest residue (or a future snapshot top-up).
    if (EXECUTE && want.size > 0) {
      const leftover = [...want.values()];
      for (let i = 0; i < leftover.length; i += 2000)
        await flushWrites([], leftover.slice(i, i + 2000));
      console.log(`  ${want.size.toLocaleString()} claims not found in files → stamped no-date-bulk (snapshot gap)`);
      totals.noDate += want.size;
    }
  }

  console.log(`\n── Summary ──`);
  console.log(totals);
  if (totals.matched > 0)
    console.log(`Date coverage among matched: ${totals.dated.toLocaleString()}/${totals.matched.toLocaleString()} (${Math.round((totals.dated / totals.matched) * 100)}%)`);
  if (byField.size > 0)
    console.log(`Winning fields:`, Object.fromEntries([...byField.entries()].sort((a, b) => b[1] - a[1])));
  if (inventory.size > 0)
    console.log(`Date-ish fields seen (first 200 matches):`, Object.fromEntries([...inventory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)));
  for (const e of examples) console.log(`  ${e}`);

  if (!EXECUTE) {
    console.log(`\nPreflight only — nothing written. If coverage justifies it:\n  caffeinate -i npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-nara-dates-bulk.ts --execute --direct`);
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
