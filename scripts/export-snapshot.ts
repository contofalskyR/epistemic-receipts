/**
 * Spec 12 — Versioned Snapshot Exports
 * export-snapshot.ts: Stream all included tables, gzip JSONL, convert to Parquet,
 * generate manifest + CHANGELOG, upload to R2.
 *
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/export-snapshot.ts [--snapshot-id er-2026-Q3] [--sample] [--dry-run] [--out-dir /tmp/snapshot]
 *
 * Required env vars:
 *   DIRECT_URL          — direct Neon connection string (no pooler)
 *   R2_ACCOUNT_ID       — Cloudflare account ID
 *   R2_ACCESS_KEY_ID    — R2 access key
 *   R2_SECRET_ACCESS_KEY — R2 secret key
 *   R2_BUCKET           — R2 bucket name (e.g. epistemic-receipts-snapshots)
 *
 * Optional (set by CI):
 *   PRISMA_MIGRATION_ID — latest applied migration name (filled from _prisma_migrations)
 */

import 'dotenv/config';
import { createGzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pipeline as pipelineP } from 'node:stream/promises';
import { execSync, spawnSync } from 'node:child_process';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { Upload } from '@aws-sdk/lib-storage';

// ── CLI args ────────────────────────────────────────────────────────────────

function getArg(flag: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : def;
}
const hasFlag = (f: string) => process.argv.includes(f);

const IS_SAMPLE = hasFlag('--sample');
const DRY_RUN = hasFlag('--dry-run');

// Determine snapshot ID from arg or current quarter
function currentQuarter(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const q = Math.ceil((now.getUTCMonth() + 1) / 3);
  return `er-${y}-Q${q}`;
}

const SNAPSHOT_ID = getArg('--snapshot-id') ?? currentQuarter();
const OUT_DIR = getArg('--out-dir') ?? path.join('/tmp', SNAPSHOT_ID);
const PREFIX = IS_SAMPLE ? 'sample' : `snapshots/${SNAPSHOT_ID}`;

// ── Tables to export ─────────────────────────────────────────────────────────

const EXPORT_TABLES = [
  'Claim',
  'Source',
  'Edge',
  'EdgeRevision',
  'MetaEdge',
  'ThresholdEvent',
  'ClaimStatusHistory',
  'ClaimRelation',
  'Topic',
  'ClaimTopic',
  'LegislativeVote',
  'MemberVote',
  'PoliticalContext',
  'Polity',
  'PolityClaim',
  'PolityVote',
  'HistoricalEvent',
  'ClaimHistoricalEvent',
  'WikidataLink',
  'SourceRelationship',
  'SourceCredibilityEvent',
  'ClaimLocation',
] as const;

type TableName = (typeof EXPORT_TABLES)[number];

// File base name for a table (snake_case for output files)
function fileBase(t: TableName): string {
  return t.replace(/([A-Z])/g, (m, ch, i) => (i === 0 ? ch.toLowerCase() : `_${ch.toLowerCase()}`));
}

// Quoted Postgres table name (Prisma uses PascalCase with quotes: "Claim", "EdgeRevision", etc.)
function pgTable(t: TableName): string {
  return `"${t}"`;
}

// PII fields that must never appear in exports (belt-and-suspenders check)
const PII_FIELD_PATTERNS = ['email', 'unsubscribeToken', 'password', 'apiKey', 'token'];

// ── PII grep check (in-process, fast path) ──────────────────────────────────

function scanLineForPii(line: string): string | null {
  for (const pat of PII_FIELD_PATTERNS) {
    if (line.includes(pat)) return pat;
  }
  return null;
}

// ── Streaming export ─────────────────────────────────────────────────────────

const CURSOR_BATCH = 1000; // rows per fetch

interface ExportResult {
  table: TableName;
  jsonlGzPath: string;
  parquetPath: string;
  rows: number;
  sha256Jsonl: string;
  sha256Parquet: string;
}

async function exportTable(
  prisma: PrismaClient,
  table: TableName,
  outDir: string,
  sampleClaimIds?: Set<string>,
): Promise<ExportResult> {
  const baseName = fileBase(table);
  const quotedTable = pgTable(table);
  const outJsonlGz = path.join(outDir, `${baseName}.jsonl.gz`);
  const outParquet = path.join(outDir, `${baseName}.parquet`);

  const gzip = createGzip({ level: 6 });
  const fileStream = createWriteStream(outJsonlGz);
  const sha256Jsonl = createHash('sha256');

  const pass = new (await import('node:stream')).PassThrough();
  pass.on('data', (chunk: Buffer) => sha256Jsonl.update(chunk));

  // Pipe: pass -> gzip -> fileStream
  const writePromise = pipelineP(pass, gzip, fileStream);

  let rows = 0;
  let cursor: string | null = null;
  let done = false;

  // Check if table has a 'deleted' column (used for first batch only)
  let hasDeleted: boolean | null = null;

  while (!done) {
    let rawRows: Record<string, unknown>[];

    // Table names come from our hardcoded EXPORT_TABLES constant — no user input
    if (hasDeleted === null) {
      // First batch: probe for deleted column by trying filtered query first
      try {
        if (cursor === null) {
          rawRows = await (prisma.$queryRawUnsafe as Function)(
            `SELECT * FROM ${quotedTable} WHERE "deleted" IS NOT TRUE ORDER BY "id" LIMIT ${CURSOR_BATCH}`
          );
        } else {
          rawRows = await (prisma.$queryRawUnsafe as Function)(
            `SELECT * FROM ${quotedTable} WHERE "deleted" IS NOT TRUE AND "id" > $1 ORDER BY "id" LIMIT ${CURSOR_BATCH}`,
            cursor
          );
        }
        hasDeleted = true;
      } catch {
        // Column doesn't exist — fall back
        hasDeleted = false;
        if (cursor === null) {
          rawRows = await (prisma.$queryRawUnsafe as Function)(
            `SELECT * FROM ${quotedTable} ORDER BY "id" LIMIT ${CURSOR_BATCH}`
          );
        } else {
          rawRows = await (prisma.$queryRawUnsafe as Function)(
            `SELECT * FROM ${quotedTable} WHERE "id" > $1 ORDER BY "id" LIMIT ${CURSOR_BATCH}`,
            cursor
          );
        }
      }
    } else if (hasDeleted) {
      if (cursor === null) {
        rawRows = await (prisma.$queryRawUnsafe as Function)(
          `SELECT * FROM ${quotedTable} WHERE "deleted" IS NOT TRUE ORDER BY "id" LIMIT ${CURSOR_BATCH}`
        );
      } else {
        rawRows = await (prisma.$queryRawUnsafe as Function)(
          `SELECT * FROM ${quotedTable} WHERE "deleted" IS NOT TRUE AND "id" > $1 ORDER BY "id" LIMIT ${CURSOR_BATCH}`,
          cursor
        );
      }
    } else {
      if (cursor === null) {
        rawRows = await (prisma.$queryRawUnsafe as Function)(
          `SELECT * FROM ${quotedTable} ORDER BY "id" LIMIT ${CURSOR_BATCH}`
        );
      } else {
        rawRows = await (prisma.$queryRawUnsafe as Function)(
          `SELECT * FROM ${quotedTable} WHERE "id" > $1 ORDER BY "id" LIMIT ${CURSOR_BATCH}`,
          cursor
        );
      }
    }

    if (rawRows.length === 0) { done = true; break; }

    for (const row of rawRows) {
      // Apply sample filter for tables that have a claimId FK
      if (sampleClaimIds && table !== 'Claim' && table !== 'Source') {
        const claimId = (row as Record<string, string>).claimId;
        if (claimId && !sampleClaimIds.has(claimId)) continue;
      }

      // Belt-and-suspenders PII check
      const serialized = JSON.stringify(row);
      const piiHit = scanLineForPii(serialized);
      if (piiHit) {
        throw new Error(`PII field "${piiHit}" found in ${table} row id=${row['id']} — aborting export`);
      }

      pass.write(serialized + '\n');
      rows++;
    }

    cursor = String((rawRows[rawRows.length - 1] as Record<string, unknown>)['id']);
    if (rawRows.length < CURSOR_BATCH) done = true;
  }

  pass.end();
  await writePromise;

  const sha256JsonlHex = sha256Jsonl.digest('hex');

  // Convert JSONL.gz -> Parquet via DuckDB CLI
  let sha256ParquetHex = '';
  if (rows > 0) {
    const duckdbResult = spawnSync(
      'duckdb',
      ['-c', `COPY (SELECT * FROM read_json_auto('${outJsonlGz}')) TO '${outParquet}' (FORMAT PARQUET)`],
      { encoding: 'utf-8', timeout: 120_000 }
    );
    if (duckdbResult.status !== 0) {
      throw new Error(`DuckDB failed for ${table}: ${duckdbResult.stderr}`);
    }
    sha256ParquetHex = await hashFile(outParquet);
  } else {
    // Write empty parquet stub — just write an empty file
    fs.writeFileSync(outParquet, '');
    sha256ParquetHex = createHash('sha256').update('').digest('hex');
  }

  return { table, jsonlGzPath: outJsonlGz, parquetPath: outParquet, rows, sha256Jsonl: sha256JsonlHex, sha256Parquet: sha256ParquetHex };
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipelineP(createReadStream(filePath), hash);
  return hash.digest('hex');
}

// ── Manifest ────────────────────────────────────────────────────────────────

interface Manifest {
  snapshotId: string;
  createdAt: string;
  prismaMigrationId: string;
  license: string;
  methodologyUrl: string;
  tables: Record<string, { rows: number; sha256Jsonl: string; sha256Parquet: string }>;
}

async function getPrismaMigrationId(prisma: PrismaClient): Promise<string> {
  try {
    const rows = await (prisma.$queryRaw as Function)`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `;
    return rows?.[0]?.migration_name ?? 'unknown';
  } catch {
    return process.env.PRISMA_MIGRATION_ID ?? 'unknown';
  }
}

function buildManifest(
  snapshotId: string,
  migrationId: string,
  results: ExportResult[],
): Manifest {
  const tables: Manifest['tables'] = {};
  for (const r of results) {
    tables[fileBase(r.table)] = {
      rows: r.rows,
      sha256Jsonl: r.sha256Jsonl,
      sha256Parquet: r.sha256Parquet,
    };
  }
  return {
    snapshotId,
    createdAt: new Date().toISOString(),
    prismaMigrationId: migrationId,
    license: 'CC BY 4.0',
    methodologyUrl: 'https://epistemic-receipts.com/methodology',
    tables,
  };
}

// ── CHANGELOG ───────────────────────────────────────────────────────────────

function buildChangelog(
  snapshotId: string,
  results: ExportResult[],
  priorManifest: Manifest | null,
): string {
  const lines: string[] = [`# Changelog — ${snapshotId}`, ''];

  if (!priorManifest) {
    lines.push('**First snapshot** — baseline release.', '');
    lines.push('## Table row counts', '');
    for (const r of results) {
      lines.push(`- \`${fileBase(r.table)}\`: ${r.rows.toLocaleString()} rows`);
    }
  } else {
    lines.push(`Compared to **${priorManifest.snapshotId}**`, '');
    lines.push('## Row count deltas', '');
    for (const r of results) {
      const tbl = fileBase(r.table);
      const prior = priorManifest.tables[tbl]?.rows ?? 0;
      const delta = r.rows - prior;
      const sign = delta >= 0 ? '+' : '';
      lines.push(`- \`${tbl}\`: ${r.rows.toLocaleString()} (${sign}${delta.toLocaleString()})`);
    }
  }

  lines.push('');
  lines.push('## Notes', '');
  lines.push('- DEPRECATED rows are included with their verificationStatus metadata.');
  lines.push('- Deleted rows (deleted=true) are excluded.');
  return lines.join('\n');
}

// ── Sample slice builder ────────────────────────────────────────────────────

interface SampleSpec {
  claimIds: Set<string>;
  sourceIds: Set<string>;
}

async function buildSampleSpec(prisma: PrismaClient): Promise<SampleSpec> {
  const SAMPLE_CLAIM_COUNT = 100;
  const PIPELINE_COUNT = 10;
  const CASE_STUDY_COUNT = 2;

  // 1. Select ≥2 case-study claims (humanReviewed=true, with StatusHistory)
  const caseStudyClaims = await (prisma.$queryRaw as Function)`
    SELECT DISTINCT c.id FROM "Claim" c
    INNER JOIN "ClaimStatusHistory" csh ON csh."claimId" = c.id
    WHERE c.deleted = false AND c."humanReviewed" = true
    LIMIT ${CASE_STUDY_COUNT}
  ` as { id: string }[];

  // 2. Select claims spread across ≥10 pipelines
  const pipelineRows = await (prisma.$queryRaw as Function)`
    SELECT "ingestedBy", array_agg(id ORDER BY random()) AS ids
    FROM "Claim"
    WHERE deleted = false AND "ingestedBy" != 'manual'
    GROUP BY "ingestedBy"
    HAVING count(*) >= 1
    LIMIT ${PIPELINE_COUNT}
  ` as { ingestedBy: string; ids: string[] }[];

  const claimIds = new Set<string>(caseStudyClaims.map(r => r.id));

  for (const row of pipelineRows) {
    const take = Math.ceil((SAMPLE_CLAIM_COUNT - CASE_STUDY_COUNT) / PIPELINE_COUNT);
    for (const id of row.ids.slice(0, take)) {
      if (claimIds.size >= SAMPLE_CLAIM_COUNT) break;
      claimIds.add(id);
    }
  }

  // Fill to 100 if we don't have enough
  if (claimIds.size < SAMPLE_CLAIM_COUNT) {
    const extra = await (prisma.$queryRaw as Function)`
      SELECT id FROM "Claim" WHERE deleted = false LIMIT ${SAMPLE_CLAIM_COUNT * 2}
    ` as { id: string }[];
    for (const r of extra) {
      if (claimIds.size >= SAMPLE_CLAIM_COUNT) break;
      claimIds.add(r.id);
    }
  }

  // 3. Collect all source IDs referenced by these claims (via Edge)
  const claimIdArr = Array.from(claimIds);
  const edgeRows = await (prisma.$queryRaw as Function)`
    SELECT DISTINCT "sourceId" FROM "Edge" WHERE "claimId" = ANY(${claimIdArr}::text[])
  ` as { sourceId: string }[];
  const sourceIds = new Set(edgeRows.map(r => r.sourceId));

  console.log(`Sample: ${claimIds.size} claims, ${sourceIds.size} sources across ${pipelineRows.length} pipelines`);
  return { claimIds, sourceIds };
}

// ── R2 upload ────────────────────────────────────────────────────────────────

function makeS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 credentials: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY required');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function uploadFile(s3: S3Client, bucket: string, key: string, filePath: string): Promise<void> {
  const fileStream = createReadStream(filePath);
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fileStream,
    },
  });
  await upload.done();
  console.log(`  uploaded → ${key}`);
}

// ── Fetch prior manifest from R2 ────────────────────────────────────────────

async function fetchPriorManifest(s3: S3Client, bucket: string): Promise<Manifest | null> {
  try {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'snapshots/',
      Delimiter: '/',
    }));

    const prefixes = (list.CommonPrefixes ?? []).map(p => p.Prefix ?? '').filter(Boolean);
    const sorted = prefixes.sort();
    if (sorted.length === 0) return null;

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const res = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: `${sorted[sorted.length - 1]}manifest.json`,
    }));
    const body = await res.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

// ── PII scan on JSONL files ─────────────────────────────────────────────────

function piiScanDirectory(dir: string): { clean: boolean; hits: string[] } {
  const hits: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.jsonl.gz')) continue;
    // Decompress to temp and scan
    const tmpPath = path.join(dir, file + '.tmp.jsonl');
    try {
      execSync(`gzip -dc "${path.join(dir, file)}" > "${tmpPath}"`);
      const content = fs.readFileSync(tmpPath, 'utf-8');
      for (const pat of PII_FIELD_PATTERNS) {
        if (content.includes(`"${pat}"`)) {
          hits.push(`${file}: contains field "${pat}"`);
        }
      }
      // Also grep for email-like patterns
      const emailMatch = content.match(/"[^"@\s]{1,64}@[^"@\s]+\.[^"@\s]+"/);
      if (emailMatch) {
        hits.push(`${file}: possible email address found: ${emailMatch[0].substring(0, 50)}`);
      }
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
  return { clean: hits.length === 0, hits };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Epistemic Receipts Snapshot Export ===`);
  console.log(`Snapshot ID:  ${SNAPSHOT_ID}`);
  console.log(`Mode:         ${IS_SAMPLE ? 'SAMPLE' : 'FULL'}`);
  console.log(`Dry run:      ${DRY_RUN}`);
  console.log(`Output dir:   ${OUT_DIR}`);
  console.log(`R2 prefix:    ${PREFIX}`);
  console.log('');

  // Create output dir
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
  });

  try {
    // Get migration ID
    const migrationId = await getPrismaMigrationId(prisma);
    console.log(`Migration:    ${migrationId}\n`);

    // Build sample spec if needed
    let sampleSpec: SampleSpec | undefined;
    if (IS_SAMPLE) {
      sampleSpec = await buildSampleSpec(prisma);
    }

    // Export tables
    const results: ExportResult[] = [];
    for (const table of EXPORT_TABLES) {
      process.stdout.write(`Exporting ${table}... `);
      try {
        const result = await exportTable(prisma, table, OUT_DIR, sampleSpec?.claimIds);
        results.push(result);
        console.log(`${result.rows.toLocaleString()} rows → ${path.basename(result.jsonlGzPath)}`);
      } catch (err) {
        console.error(`FAILED: ${err}`);
        throw err;
      }
    }

    // Run PII scan
    console.log('\nRunning PII scan...');
    const piiScan = piiScanDirectory(OUT_DIR);
    if (!piiScan.clean) {
      console.error('PII SCAN FAILED:');
      for (const hit of piiScan.hits) console.error(' ', hit);
      throw new Error('PII found in export — aborting');
    }
    console.log('PII scan: CLEAN ✓');

    // Build manifest
    const manifest = buildManifest(SNAPSHOT_ID, migrationId, results);
    const manifestPath = path.join(OUT_DIR, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest written → manifest.json`);

    // Fetch prior manifest for changelog (skip in sample mode)
    let priorManifest: Manifest | null = null;
    if (!IS_SAMPLE && !DRY_RUN) {
      const s3 = makeS3Client();
      priorManifest = await fetchPriorManifest(s3, process.env.R2_BUCKET!);
    }

    // Build changelog
    const changelog = buildChangelog(SNAPSHOT_ID, results, priorManifest);
    const changelogPath = path.join(OUT_DIR, 'CHANGELOG.md');
    fs.writeFileSync(changelogPath, changelog);
    console.log(`Changelog written → CHANGELOG.md`);

    // Summary
    const totalRows = results.reduce((s, r) => s + r.rows, 0);
    console.log(`\nTotal rows exported: ${totalRows.toLocaleString()}`);

    if (DRY_RUN) {
      console.log('\nDry-run complete — skipping R2 upload.');
      return;
    }

    // Upload to R2
    const bucket = process.env.R2_BUCKET;
    if (!bucket) {
      throw new Error('R2_BUCKET env var required for upload');
    }

    const s3 = makeS3Client();
    console.log(`\nUploading to R2 bucket "${bucket}" prefix "${PREFIX}"...`);

    for (const result of results) {
      const tbl = fileBase(result.table);
      await uploadFile(s3, bucket, `${PREFIX}/${tbl}.jsonl.gz`, result.jsonlGzPath);
      if (result.rows > 0) {
        await uploadFile(s3, bucket, `${PREFIX}/${tbl}.parquet`, result.parquetPath);
      }
    }
    await uploadFile(s3, bucket, `${PREFIX}/manifest.json`, manifestPath);
    await uploadFile(s3, bucket, `${PREFIX}/CHANGELOG.md`, changelogPath);

    console.log('\n✓ Snapshot upload complete');

    // Print manifest summary for CI logs
    console.log('\n=== Manifest Summary ===');
    console.log(JSON.stringify(manifest, null, 2));

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
