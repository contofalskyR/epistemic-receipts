# Spec 00 — Foundations: CI, staging, observability, restore drill

Phase 0 · Depends on: nothing · Model: Sonnet 5 · Scope: ~3–5 agent sessions

## Objective
Make the repo safe to change: automated checks on every PR, a staging environment, error/pipeline observability, and a proven backup-restore path. Nothing here changes product behavior.

## Deliverables

### 1. CI — `.github/workflows/ci.yml`
Runs on PR + main push: `npm ci` → `npx eslint .` → `npx tsc --noEmit` → `npx prisma validate` + migration drift check (`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code`; nonzero diff fails) → integration tests.

Integration tests (Vitest, new `tests/` dir) against a service container. **Use image `pgvector/pgvector:pg16`** — plain postgres will fail on the `vector(384)` column. Apply schema with `prisma migrate deploy` (migrations contain raw SQL for tsvector/vector; `db push` will not reproduce them). Seed minimal fixtures (5 claims, 3 sources, edges, one ClaimStatusHistory chain).

Test ONLY critical paths (keep suite < 5 min):
- Middleware auth: non-GET to `/api/feedback`-adjacent path without credentials → 401; path in `PUBLIC_WRITE_PATHS` → not 401; `/api/review` GET without admin → 401.
- Search API returns seeded claim for a term; ILIKE injection attempt (`%' OR 1=1 --`) returns empty, not error.
- Claim detail API returns edges + sources + statusHistory for a seeded claim.
- `isReadOnly()` behavior with/without `ALLOW_EDITS`.

### 2. Staging
- Second Vercel project `epistemic-receipts-staging` from the same repo, `staging` branch auto-deploys.
- Neon branch `staging` off production as its database. Document the reset procedure (delete + re-branch) in the runbook.
- Env vars mirror production except: `SITE_PASSWORD` SET (staging stays private), distinct `ADMIN_TOKEN`/`CRON_SECRET`, `ALLOW_EDITS` unset.
- Runbook: `docs/runbooks/staging.md` — how to deploy, reset data, and rehearse a migration there before production.

### 3. Observability
- Sentry via `@sentry/nextjs` (client + server + edge configs), tunneled route to dodge ad-blockers, sourcemaps uploaded in CI. DSN via env var.
- Structured pipeline logging: a tiny `lib/log.ts` (JSON lines: `{ts, level, pipeline, event, ...fields}`) — adopt in the ingest harness later (Spec 10); for now wire into the 3 most-run scripts.
- Reconciliation cron: `/api/cron/reconcile-pipelines` (CRON_SECRET, fail closed) — for each pipeline tag with a `PipelineRun` in the last 7 days, compare `rowsWritten` totals vs `SELECT count(*) FROM "Claim" WHERE "ingestedBy" = tag` deltas; on mismatch > 1%, email admin via Resend. Schedule daily in `vercel.json`.
- Uptime: external monitor (UptimeRobot or similar — free tier) on `/`, `/search`, and one `/api/claims` sample URL. Document in runbook; creating the account is a human step — leave a TODO with exact URLs to monitor.

### 4. Restore drill + cost baseline (runbooks, mostly human-executed once)
- `docs/runbooks/restore.md`: exact steps to PITR-restore the Neon project to a new branch, repoint staging at it, verify with row-count queries (include the queries). The agent writes the runbook; a human executes it once and checks the "last drilled" date into the doc.
- `docs/runbooks/costs.md`: table of current monthly Vercel/Neon/Resend spend (placeholders for human to fill), egress notes, and the rule: reprice API tiers if marginal cost changes >2x.

## Out of scope
No refactors, no dependency upgrades beyond what Sentry/Vitest need, no changes to middleware logic (tests observe it, don't modify it).

## Acceptance criteria
- CI red on: introduced type error, introduced schema/migration drift, deliberately broken auth test. Green on clean main.
- Integration suite passes locally via a single documented command (`npm run test:integration`) with dockerized pgvector.
- Staging URL serves the site behind `SITE_PASSWORD` from the Neon branch.
- Sentry receives a test error from server and client. Reconciliation cron sends a real email on an artificially induced mismatch (test by inserting a fake PipelineRun row on staging, then removing it).
- Both runbooks exist with concrete commands, not prose gestures.

## Verification (run and paste output in PR)
`npm run test:integration` · screenshot/log of failed CI on an intentionally broken commit (then revert) · curl staging URL showing password gate · the reconciliation email.
