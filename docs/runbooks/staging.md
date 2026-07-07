# Staging Runbook

## Architecture

| Component | Production | Staging |
|-----------|-----------|---------|
| Vercel project | `epistemic-receipts` | `epistemic-receipts-staging` |
| Git branch | `main` | `staging` |
| Neon database | `epistemic-receipts` (main branch) | `epistemic-receipts` → branch `staging` |
| Domain | (your custom domain) | Vercel auto-preview URL |
| `SITE_PASSWORD` | unset (public) | SET (staging stays private) |

The `staging` git branch is already in the repo. The Vercel project and Neon branch are human-created once (see Setup below).

---

## One-time Setup (human-executed)

### 1. Create the Neon staging branch

In the [Neon Console](https://console.neon.tech):

```
Project: epistemic-receipts
Dashboard → Branches → New Branch
  Name: staging
  Branch from: main (production)
  Compute: Keep default
```

Or via Neon CLI:
```bash
neonctl branch create --name staging --project-id <your-project-id>
```

After creation, copy the connection strings:
```bash
neonctl connection-string staging --project-id <your-project-id>
# → postgresql://...@ep-xxx-staging.us-east-2.aws.neon.tech/neondb?sslmode=require
```

You'll need both a **pooled** URL (for `DATABASE_URL`) and a **direct** URL (for `DIRECT_URL` / migrations).

### 2. Create the Vercel staging project

In the [Vercel dashboard](https://vercel.com):

```
New Project → Import Git Repository → epistemic-receipts
  Project Name: epistemic-receipts-staging
  Framework Preset: Next.js
  Root Directory: ./  (same repo root)
  Production Branch: staging
```

Set these environment variables on the staging project:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon staging branch pooled URL |
| `DIRECT_URL` | Neon staging branch direct URL |
| `ADMIN_TOKEN` | A distinct token from production (generate with: `openssl rand -hex 32`) |
| `CRON_SECRET` | A distinct secret from production |
| `SITE_PASSWORD` | SET to any password (keeps staging private) |
| `RESEND_API_KEY` | Same as production (or a test key) |
| `RESEND_FROM_EMAIL` | Same as production |
| `SENTRY_DSN` | Same as production SENTRY_DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Same as production |
| `ALLOW_EDITS` | DO NOT SET (leave unset) |
| `NEXT_PUBLIC_EDITION` | Leave unset (same edition as production) |

Do NOT set `ALLOW_EDITS` on staging. It must be absent.

### 3. Verify auto-deploy

Push any commit to the `staging` branch. Vercel should trigger a deploy automatically. Confirm at the project dashboard.

---

## Deploying to Staging

Staging auto-deploys when commits are pushed to the `staging` branch.

### Promote from main to staging

```bash
git checkout staging
git merge main --ff-only    # fast-forward only; rebase if needed
git push origin staging
```

Vercel picks up the push and deploys within ~2 minutes.

### Check deploy status

```bash
vercel ls --project epistemic-receipts-staging  # if Vercel CLI is installed
# or check the Vercel dashboard
```

### Verify the site is up

```bash
STAGING_URL=https://<your-staging-url>
# Should redirect to /login (SITE_PASSWORD is set):
curl -I "${STAGING_URL}/"
# Expect: HTTP/2 307 → /login
```

---

## Resetting Staging Data

When you want staging to reflect production's current dataset:

### Option A — Delete and re-create the Neon staging branch

```bash
# Delete
neonctl branch delete staging --project-id <your-project-id>

# Re-create from production main branch
neonctl branch create --name staging --project-id <your-project-id>
# (same as one-time setup step 1)
```

After re-creating, get new connection strings and update Vercel env vars if they changed.

### Option B — Reset data via pg_dump/restore (partial)

```bash
# Dump from production (use DIRECT_URL):
pg_dump "${PROD_DIRECT_URL}" --data-only --no-owner --no-acl \
  --table='"Claim"' --table='"Source"' --table='"Edge"' \
  -f staging-data-snapshot.sql

# Restore to staging:
psql "${STAGING_DIRECT_URL}" < staging-data-snapshot.sql
```

---

## Rehearsing a Migration Before Production

**Always test migrations on staging first.** Steps:

```bash
# 1. Make sure staging branch has the new migration file
git checkout staging
git merge main   # or cherry-pick the migration commit

# 2. Run migrate deploy against staging
DIRECT_URL="${STAGING_DIRECT_URL}" npx prisma migrate deploy

# 3. Verify schema applied correctly
psql "${STAGING_DIRECT_URL}" -c "\dt"
# or check a specific column:
psql "${STAGING_DIRECT_URL}" -c "\d \"Claim\""

# 4. Smoke-test the staging site
curl -s "${STAGING_URL}/api/stats" | jq .

# 5. If OK, apply to production:
DIRECT_URL="${PROD_DIRECT_URL}" npx prisma migrate deploy
```

### Check for migration drift before each deploy

```bash
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code
# Exit code 0 = no drift. Non-zero = unapplied changes in schema.prisma.
```

---

## Uptime Monitoring

TODO: Create an UptimeRobot (or equivalent) free-tier monitor for the following URLs
on both production and staging. Creating the account is a human step.

URLs to monitor:
- `<STAGING_URL>/` — homepage
- `<STAGING_URL>/search?q=aspirin` — search endpoint
- `<STAGING_URL>/api/claims/<any-claim-id>` — claims API sample

Suggested tool: [UptimeRobot](https://uptimerobot.com) (free tier: 5-minute checks, 50 monitors).

---

## Environment Checklist (before promoting to production)

- [ ] `npm run test:integration` passes locally or in CI on the `staging` branch
- [ ] Migration drift check passes: `prisma migrate diff` exits 0
- [ ] `prisma migrate deploy` succeeded on staging
- [ ] Smoke test: staging homepage loads, search returns results
- [ ] No new secrets or keys committed to the repo
- [ ] Sentry receiving errors from staging (test at `/api/debug-sentry` if wired)
