# Restore Runbook — Neon PITR

Last drilled: [TBD — human fills after first drill]

## What this covers

Point-in-time restore (PITR) of the Neon production database to a new branch,
re-pointing staging at that branch, and verifying correctness with row-count queries.

Neon stores WAL for 7 days (Paid plan) or 24h (Free plan). PITR restores to any
second within that window. This runbook does NOT describe restoring to production —
that is a separate emergency procedure requiring explicit owner approval.

---

## Pre-conditions

- Neon project ID: `<your-project-id>` (find at console.neon.tech)
- You have the Neon CLI installed: `npm install -g neonctl` or from neon.tech/docs/reference/cli-install
- You have `psql` available
- `STAGING_DIRECT_URL` env var set to the staging branch direct connection string

---

## Step 1 — Identify the recovery point

```bash
# List branches (to find current production main branch ID)
neonctl branch list --project-id <your-project-id>

# Check timeline of production main branch
neonctl branch describe main --project-id <your-project-id>
```

Pick a timestamp in ISO 8601 format: `YYYY-MM-DDTHH:MM:SSZ`

Example: restore to 2 hours ago:
```bash
RESTORE_TS=$(date -u -d '2 hours ago' '+%Y-%m-%dT%H:%M:%SZ')
# macOS: RESTORE_TS=$(date -u -v-2H '+%Y-%m-%dT%H:%M:%SZ')
echo "Restoring to: $RESTORE_TS"
```

---

## Step 2 — Create a restored branch

```bash
RESTORE_BRANCH="restore-$(date -u '+%Y%m%d-%H%M')"

neonctl branch create \
  --name "${RESTORE_BRANCH}" \
  --project-id <your-project-id> \
  --parent main \
  --created-at "${RESTORE_TS}"

echo "Created branch: ${RESTORE_BRANCH}"
```

This creates a new branch forked from `main` at the specified timestamp.
The original `main` branch is untouched.

---

## Step 3 — Get the connection strings for the restored branch

```bash
# Pooled connection (for DATABASE_URL)
neonctl connection-string "${RESTORE_BRANCH}" \
  --project-id <your-project-id> \
  --pooled

# Direct connection (for DIRECT_URL / psql)
neonctl connection-string "${RESTORE_BRANCH}" \
  --project-id <your-project-id>
```

Save the direct URL as `RESTORE_DIRECT_URL`.

---

## Step 4 — Verify row counts on the restored branch

Connect to the restored branch and run these verification queries:

```bash
psql "${RESTORE_DIRECT_URL}" <<'SQL'
-- Total claims
SELECT count(*) AS total_claims FROM "Claim";

-- Claims by pipeline (top 20)
SELECT "ingestedBy", count(*) AS n
FROM "Claim"
GROUP BY "ingestedBy"
ORDER BY n DESC
LIMIT 20;

-- Non-deleted sources
SELECT count(*) AS total_sources FROM "Source" WHERE "deleted" = false;

-- Edges
SELECT count(*) AS total_edges FROM "Edge" WHERE "deleted" = false;

-- Most recent claim (sanity check for restore timestamp)
SELECT "createdAt", "ingestedBy", LEFT("text", 80) AS text_preview
FROM "Claim"
ORDER BY "createdAt" DESC
LIMIT 5;

-- PipelineRun records
SELECT "pipelineTag", count(*), max("finishedAt") AS last_run
FROM "PipelineRun"
WHERE "status" = 'done'
GROUP BY "pipelineTag"
ORDER BY last_run DESC
LIMIT 10;
SQL
```

Expected: `total_claims` should be close to production count at the restore point.
The `most recent claim` timestamp should be at or before `RESTORE_TS`.

---

## Step 5 — Re-point staging at the restored branch

In the Vercel dashboard (staging project):

1. Go to Settings → Environment Variables
2. Update `DATABASE_URL` to the **pooled** connection string from Step 3
3. Update `DIRECT_URL` to the **direct** connection string from Step 3
4. Trigger a redeploy (or push a trivial commit to `staging`)

Or via Vercel CLI (if installed):
```bash
vercel env rm DATABASE_URL --environment preview   # staging = preview in Vercel
vercel env add DATABASE_URL <pooled-url> --environment preview
vercel env rm DIRECT_URL --environment preview
vercel env add DIRECT_URL <direct-url> --environment preview
```

---

## Step 6 — Verify staging is pointing at restored branch

```bash
STAGING_URL=https://<your-staging-url>

# Claim count via API
curl -s "${STAGING_URL}/api/stats" | jq '.claimCount'

# Row count directly on restored branch
psql "${RESTORE_DIRECT_URL}" -c "SELECT count(*) FROM \"Claim\";"
```

The two counts should match (within a few rows for any inflight writes).

---

## Step 7 — Run migrations if needed

If the restore point predates the latest migration:
```bash
DIRECT_URL="${RESTORE_DIRECT_URL}" npx prisma migrate deploy
```

Verify:
```bash
psql "${RESTORE_DIRECT_URL}" \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

---

## Step 8 — Clean up

After the drill (or after confirming the restore is valid), delete the restored
branch to avoid storage costs:

```bash
neonctl branch delete "${RESTORE_BRANCH}" --project-id <your-project-id>
```

Restore staging to the regular `staging` branch (revert Step 5 env var changes).

---

## Notes

- Neon PITR window: 7 days on Pro plan, 24h on Free plan. Check the plan before scheduling this drill.
- The restored branch is a full read-write copy — do not run ingest scripts against it accidentally.
- If `prisma migrate deploy` fails on the restored branch, the migrations table (`_prisma_migrations`) may be ahead of the schema. Investigate before applying.
- For a production emergency restore (not just drill), follow the same steps but also redirect `DATABASE_URL` on the production Vercel project and notify all relevant parties.
