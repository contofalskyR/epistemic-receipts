/**
 * Spec 12 — verify-snapshot.ts
 * Downloads a snapshot from R2, loads Parquet into DuckDB, checks:
 *  - row counts vs manifest
 *  - referential integrity (Edge.claimId → Claim, etc.)
 *  - SHA-256 checksums
 *  - PII grep (belt-and-suspenders)
 * Exits nonzero on any failure.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/verify-snapshot.ts --snapshot-id er-2026-Q3
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/verify-snapshot.ts --snapshot-id er-2026-Q3 --sample
 *   # Tamper test:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/verify-snapshot.ts --local-dir /tmp/er-2026-Q3
 */

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execSync, spawnSync } from 'node:child_process';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// ── CLI args ─────────────────────────────────────────────────────────────────

function getArg(flag: string, def?: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : def;
}
const hasFlag = (f: string) => process.argv.includes(f);

const SNAPSHOT_ID = getArg('--snapshot-id');
const IS_SAMPLE = hasFlag('--sample');
const LOCAL_DIR = getArg('--local-dir');

// ── Error accumulator ─────────────────────────────────────────────────────────

const FAILURES: string[] = [];
function fail(msg: string): void {
  console.error(`  FAIL: ${msg}`);
  FAILURES.push(msg);
}
function pass(msg: string): void {
  console.log(`  PASS: ${msg}`);
}

// ── Checksum ─────────────────────────────────────────────────────────────────

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

// ── R2 client ─────────────────────────────────────────────────────────────────

function makeS3Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID!;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY!;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function downloadFile(s3: S3Client, bucket: string, key: string, destPath: string): Promise<void> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty body for key: ${key}`);
  const ws = fs.createWriteStream(destPath);
  await pipeline(res.Body as NodeJS.ReadableStream, ws);
}

// ── Download snapshot ─────────────────────────────────────────────────────────

async function downloadSnapshot(snapshotId: string, isSample: boolean): Promise<string> {
  const bucket = process.env.R2_BUCKET!;
  if (!bucket) throw new Error('R2_BUCKET env var required');

  const prefix = isSample ? 'sample' : `snapshots/${snapshotId}`;
  const outDir = path.join('/tmp', `verify-${snapshotId}`);
  fs.mkdirSync(outDir, { recursive: true });

  const s3 = makeS3Client();

  // List all files under prefix
  const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix + '/' }));
  const keys = (list.Contents ?? []).map(o => o.Key!).filter(Boolean);

  if (keys.length === 0) {
    throw new Error(`No files found at R2 prefix "${prefix}/"`);
  }

  console.log(`Downloading ${keys.length} files from R2...`);
  for (const key of keys) {
    const fname = path.basename(key);
    const dest = path.join(outDir, fname);
    process.stdout.write(`  ${fname}... `);
    await downloadFile(s3, bucket, key, dest);
    console.log('done');
  }

  return outDir;
}

// ── Verify a local snapshot directory ────────────────────────────────────────

interface Manifest {
  snapshotId: string;
  createdAt: string;
  prismaMigrationId: string;
  tables: Record<string, { rows: number; sha256Jsonl: string; sha256Parquet: string }>;
}

async function verifyDirectory(dir: string): Promise<void> {
  console.log(`\nVerifying snapshot in: ${dir}\n`);

  // 1. Load manifest
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fail('manifest.json not found');
    return;
  }
  const manifest: Manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Snapshot ID: ${manifest.snapshotId}`);
  console.log(`Created:     ${manifest.createdAt}`);
  console.log(`Migration:   ${manifest.prismaMigrationId}\n`);

  // 2. Checksum verification
  console.log('=== Checksum Verification ===');
  for (const [tbl, info] of Object.entries(manifest.tables)) {
    const jsonlPath = path.join(dir, `${tbl}.jsonl.gz`);
    const parquetPath = path.join(dir, `${tbl}.parquet`);

    if (fs.existsSync(jsonlPath)) {
      const actual = await sha256File(jsonlPath);
      if (actual === info.sha256Jsonl) {
        pass(`${tbl}.jsonl.gz checksum`);
      } else {
        fail(`${tbl}.jsonl.gz checksum mismatch: expected ${info.sha256Jsonl}, got ${actual}`);
      }
    } else {
      fail(`${tbl}.jsonl.gz not found`);
    }

    if (info.rows > 0 && fs.existsSync(parquetPath)) {
      const actual = await sha256File(parquetPath);
      if (actual === info.sha256Parquet) {
        pass(`${tbl}.parquet checksum`);
      } else {
        fail(`${tbl}.parquet checksum mismatch: expected ${info.sha256Parquet}, got ${actual}`);
      }
    }
  }

  // 3. Row count verification via DuckDB
  console.log('\n=== Row Count Verification ===');
  const duckdbBin = 'duckdb';

  for (const [tbl, info] of Object.entries(manifest.tables)) {
    const parquetPath = path.join(dir, `${tbl}.parquet`);
    if (!fs.existsSync(parquetPath) || info.rows === 0) {
      if (info.rows === 0) {
        pass(`${tbl}: 0 rows (empty table, skip DuckDB)`);
      }
      continue;
    }

    const result = spawnSync(
      duckdbBin,
      ['-c', `SELECT count(*) as n FROM read_parquet('${parquetPath}')`],
      { encoding: 'utf-8', timeout: 60_000 }
    );

    if (result.status !== 0) {
      fail(`${tbl}: DuckDB failed to read parquet: ${result.stderr}`);
      continue;
    }

    const match = result.stdout.match(/\b(\d+)\b/);
    const actualRows = match ? parseInt(match[1], 10) : -1;

    if (actualRows === info.rows) {
      pass(`${tbl}: ${actualRows.toLocaleString()} rows`);
    } else {
      fail(`${tbl}: row count mismatch — manifest=${info.rows}, parquet=${actualRows}`);
    }
  }

  // 4. Referential integrity checks via DuckDB
  console.log('\n=== Referential Integrity Checks ===');

  const claimParquet = path.join(dir, 'claim.parquet');
  const sourceParquet = path.join(dir, 'source.parquet');
  const edgeParquet = path.join(dir, 'edge.parquet');
  const edgeRevisionParquet = path.join(dir, 'edge_revision.parquet');
  const metaEdgeParquet = path.join(dir, 'meta_edge.parquet');
  const claimStatusHistoryParquet = path.join(dir, 'claim_status_history.parquet');

  const integrityChecks: Array<{ name: string; sql: string }> = [];

  if (fs.existsSync(edgeParquet) && fs.existsSync(claimParquet)) {
    integrityChecks.push({
      name: 'Edge.claimId → Claim',
      sql: `SELECT count(*) as n FROM read_parquet('${edgeParquet}') e
            WHERE e.claimId NOT IN (SELECT id FROM read_parquet('${claimParquet}'))`,
    });
  }

  if (fs.existsSync(edgeParquet) && fs.existsSync(sourceParquet)) {
    integrityChecks.push({
      name: 'Edge.sourceId → Source',
      sql: `SELECT count(*) as n FROM read_parquet('${edgeParquet}') e
            WHERE e.sourceId NOT IN (SELECT id FROM read_parquet('${sourceParquet}'))`,
    });
  }

  if (fs.existsSync(edgeRevisionParquet) && fs.existsSync(edgeParquet)) {
    integrityChecks.push({
      name: 'EdgeRevision.edgeId → Edge',
      sql: `SELECT count(*) as n FROM read_parquet('${edgeRevisionParquet}') er
            WHERE er.edgeId NOT IN (SELECT id FROM read_parquet('${edgeParquet}'))`,
    });
  }

  if (fs.existsSync(claimStatusHistoryParquet) && fs.existsSync(claimParquet)) {
    integrityChecks.push({
      name: 'ClaimStatusHistory.claimId → Claim',
      sql: `SELECT count(*) as n FROM read_parquet('${claimStatusHistoryParquet}') csh
            WHERE csh.claimId NOT IN (SELECT id FROM read_parquet('${claimParquet}'))`,
    });
  }

  if (fs.existsSync(metaEdgeParquet) && fs.existsSync(claimParquet)) {
    integrityChecks.push({
      name: 'MetaEdge.claimId → Claim',
      sql: `SELECT count(*) as n FROM read_parquet('${metaEdgeParquet}') me
            WHERE me.claimId NOT IN (SELECT id FROM read_parquet('${claimParquet}'))`,
    });
  }

  for (const check of integrityChecks) {
    if (integrityChecks.length === 0) break;
    const result = spawnSync(
      duckdbBin,
      ['-c', check.sql],
      { encoding: 'utf-8', timeout: 60_000 }
    );

    if (result.status !== 0) {
      fail(`${check.name}: DuckDB error: ${result.stderr}`);
      continue;
    }

    const match = result.stdout.match(/\b(\d+)\b/);
    const orphans = match ? parseInt(match[1], 10) : -1;

    if (orphans === 0) {
      pass(`${check.name}: no orphans`);
    } else {
      fail(`${check.name}: ${orphans} orphan row(s)`);
    }
  }

  // 5. PII scan over JSONL files
  console.log('\n=== PII Scan ===');
  const PII_PATTERNS = ['email', 'unsubscribeToken', 'password', 'apiKey'];

  let piiClean = true;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.jsonl.gz')) continue;
    const tmpPath = path.join(dir, file + '.pii-scan.jsonl');
    try {
      execSync(`gzip -dc "${path.join(dir, file)}" > "${tmpPath}"`, { timeout: 30_000 });
      const content = fs.readFileSync(tmpPath, 'utf-8');

      for (const pat of PII_PATTERNS) {
        if (content.includes(`"${pat}"`)) {
          fail(`PII field "${pat}" found in ${file}`);
          piiClean = false;
        }
      }
      const emailMatch = content.match(/"[^"@\s]{1,64}@[^"@\s]+\.[^"@\s]+"/);
      if (emailMatch) {
        fail(`Possible email address in ${file}: ${emailMatch[0].substring(0, 60)}`);
        piiClean = false;
      }
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    }
  }
  if (piiClean) pass('No PII found in any JSONL file');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Epistemic Receipts Snapshot Verifier ===');

  let dir: string;

  if (LOCAL_DIR) {
    // Verify a local directory directly (e.g. for tamper test)
    dir = LOCAL_DIR;
    console.log(`Verifying local directory: ${dir}`);
  } else if (SNAPSHOT_ID) {
    // Download from R2 then verify
    dir = await downloadSnapshot(SNAPSHOT_ID, IS_SAMPLE);
  } else {
    console.error('Usage: --snapshot-id <id> | --local-dir <path>');
    process.exit(1);
  }

  await verifyDirectory(dir);

  console.log('\n=== Summary ===');
  if (FAILURES.length === 0) {
    console.log('ALL CHECKS PASSED ✓');
    process.exit(0);
  } else {
    console.error(`${FAILURES.length} check(s) FAILED:`);
    for (const f of FAILURES) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
