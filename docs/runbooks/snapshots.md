# Runbook — Snapshot Exports (Spec 12)

Last updated: 2026-07-07

## Overview

Quarterly snapshots export 22 Postgres tables to JSONL + Parquet, upload to Cloudflare R2, and publish a sample slice publicly. The export script (`scripts/export-snapshot.ts`) runs in GitHub Actions — not on Vercel — to avoid function timeout limits.

---

## Required GitHub Actions Secrets

Add the following secrets in the GitHub repo → Settings → Secrets and variables → Actions:

| Secret name | Description |
|---|---|
| `DIRECT_URL` | Direct Neon connection string (bypasses pooler). Find in Neon Console → Connection Details → Direct connection. Format: `postgres://user:pass@host/db?sslmode=require` |
| `R2_ACCOUNT_ID` | Cloudflare account ID. Find in R2 dashboard URL or Cloudflare → Overview → Account ID. |
| `R2_ACCESS_KEY_ID` | R2 API token access key. Create in R2 → Manage R2 API tokens → Create API token with Object Read & Write on the snapshots bucket. |
| `R2_SECRET_ACCESS_KEY` | Paired secret for the R2 API token above. |
| `R2_BUCKET` | R2 bucket name (e.g. `epistemic-receipts-snapshots`). |

---

## Creating the R2 Bucket

1. Cloudflare Dashboard → R2 → Create bucket
2. Name: `epistemic-receipts-snapshots` (or your preference — add as `R2_BUCKET` secret)
3. Under **Public access**: enable public access for the `sample/` prefix only:
   - Go to bucket Settings → Public access
   - Add a CORS rule or bucket policy that allows public GET on `sample/*`
   - Or use a Cloudflare Worker to proxy public reads for `sample/` only

   Example bucket policy (Cloudflare R2 JSON policy):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicSampleRead",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::epistemic-receipts-snapshots/sample/*"
       }
     ]
   }
   ```
4. Full snapshots under `snapshots/er-YYYY-QN/` remain private (signed URL on request).

---

## Creating the SELECT-only Postgres Role

The export script connects using `DIRECT_URL`. For production safety, create a read-only role and use its credentials in the Actions secret:

```sql
-- Run in Neon console or via psql as the owner role

-- 1. Create the role
CREATE ROLE epistemic_export_ro WITH LOGIN PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';

-- 2. Grant connect on the database
GRANT CONNECT ON DATABASE neondb TO epistemic_export_ro;

-- 3. Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO epistemic_export_ro;

-- 4. Grant SELECT on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO epistemic_export_ro;

-- 5. Ensure future tables are also readable (re-run after migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO epistemic_export_ro;

-- 6. Explicitly DENY write (belt-and-suspenders)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM epistemic_export_ro;
```

Then set `DIRECT_URL` secret to the connection string for `epistemic_export_ro`:
```
postgres://epistemic_export_ro:PASSWORD@HOST/neondb?sslmode=require
```

**Note:** After each Prisma migration that adds new tables, re-run step 4:
```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO epistemic_export_ro;
```

---

## Running the Export Manually

In GitHub → Actions → "Snapshot Export" → Run workflow:

- **snapshot_id**: leave blank to auto-detect (`er-YYYY-QN` from the current date), or specify e.g. `er-2026-Q3`
- **sample_only**: check to only build the sample slice (useful for testing R2 upload without a full export)

Or run locally (with R2 creds in `.env.local`):

```bash
# Full export (dry-run — no upload)
npx dotenv-cli -e .env.local -- npx tsx scripts/export-snapshot.ts --dry-run

# Sample slice only
npx dotenv-cli -e .env.local -- npx tsx scripts/export-snapshot.ts --sample

# Verify a locally exported snapshot
npx tsx scripts/verify-snapshot.ts --local-dir /tmp/er-2026-Q3

# Tamper test (flip one byte then verify — should fail)
printf '\x00' | dd of=/tmp/er-2026-Q3/claim.jsonl.gz bs=1 seek=100 conv=notrunc
npx tsx scripts/verify-snapshot.ts --local-dir /tmp/er-2026-Q3  # exits 1
```

---

## After Each Export: Update snapshots-registry.json

The `/datasets/snapshots` page reads from `data/snapshots-registry.json`. After a successful export, add an entry:

```json
{
  "id": "er-2026-Q3",
  "createdAt": "2026-07-01T02:00:00Z",
  "prismaMigrationId": "20260615_add_claim_location",
  "manifestUrl": "https://pub-XXXX.r2.dev/snapshots/er-2026-Q3/manifest.json",
  "changelogUrl": "https://pub-XXXX.r2.dev/snapshots/er-2026-Q3/CHANGELOG.md",
  "sampleDownloadUrl": "https://pub-XXXX.r2.dev/sample/claim.parquet",
  "totalRows": 1234567,
  "tables": {
    "claim": { "rows": 336900 },
    "source": { "rows": 280000 }
  }
}
```

The CI workflow can automate this commit via `gh` CLI if desired.

---

## Quarterly Schedule

The workflow runs automatically via cron on the first day of January, April, July, and October at 02:00 UTC:

```yaml
schedule:
  - cron: "0 2 1 1,4,7,10 *"
```

---

## Installing DuckDB

The Actions workflow installs DuckDB CLI from GitHub releases. For local use:

```bash
# Ubuntu/Debian
curl -fsSL https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip -o duckdb.zip
unzip duckdb.zip && sudo mv duckdb /usr/local/bin/

# macOS
brew install duckdb
```

---

## Troubleshooting

**DuckDB fails on empty table**: Tables with 0 rows skip DuckDB conversion (empty parquet stub is written). This is expected.

**Cursor query fails with "column deleted does not exist"**: Some tables (e.g. `HistoricalEvent`) have no `deleted` column. The export script falls back to a plain ORDER BY id cursor automatically.

**R2 upload times out**: Large snapshots (>1 GB) use multipart upload via `@aws-sdk/lib-storage`. If upload fails mid-way, re-run the workflow — R2 multipart uploads are resumed automatically.

**PII scan fails**: The export aborts immediately if a PII pattern (`email`, `unsubscribeToken`, etc.) is found. This indicates a new table was added to `EXPORT_TABLES` that contains PII — remove it and add to the excluded list in the spec.
