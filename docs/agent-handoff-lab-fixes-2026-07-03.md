# Agent Handoff — Lab Pages Fixes (2026-07-03)

You are working in a clone of `contofalskyR/epistemic-receipts`. A full audit of the 15 nav "Lab" pages was completed on another machine on 2026-07-03; the findings are in `docs/lab-pages-triage-2026-07-03.md` (included in the patch below). Seven code fixes were ALREADY WRITTEN and verified. Your job is to (1) apply them, (2) run the follow-up tasks that need this machine's DB access, and (3) investigate two open data questions. Do NOT re-derive or re-implement the fixes from the descriptions — apply the patch.

## Part 1 — Apply the prepared patch

Patch file: `docs/lab-fixes-2026-07-03.patch` (paste/copy it here alongside this doc). It was cut against `main` @ `253f25d` ("corpus-promoter: promote 6 claims (run #6)"). 11 files: 8 modified, 3 new (`app/analysis/votes/loading.tsx`, `lib/coverage-query.ts`, `docs/lab-pages-triage-2026-07-03.md`).

```bash
git status                                   # must be clean before you start
git apply --check docs/lab-fixes-2026-07-03.patch   # dry-run
git apply docs/lab-fixes-2026-07-03.patch
```

**Double-apply sentinels** — if `--check` fails, someone may have already landed these. Before doing anything manual, check for these strings; if ALL are present, the fixes are already in and you should skip to Part 2:

- `lib/legislation-countries.ts` contains `congress_bills_tracker_v1`
- `app/retraction-wall/page.tsx` contains `CITERS_CTE`
- `lib/voteAnalysis.ts` contains `voteview_v1: "United States (all roll-calls)"`
- `lib/coverage-query.ts` exists
- `app/analysis/votes/loading.tsx` exists

If `--check` fails and the sentinels are absent (tree diverged from 253f25d), resolve per-file using the patch hunks as ground truth — the triage doc explains each fix's intent.

**What the patch does (context only, not instructions):** real citation-based "ripple" ranking + honest empty state + clamped 30-day stat on /retraction-wall; US registry tag fix + loading-state "Last pull" on /legislation; voteview_v1 body labels + chamber split on /analysis/votes plus a loading.tsx; generic-query filtering for /stats/media-coverage (script skip + API flag + UI exclusion); zero-count topic pruning toggle on /topics.

## Part 2 — Verify and commit

```bash
npx prisma generate        # required: stale generated clients cause bogus Prisma.sql/ClaimWhereInput type errors
npx tsc --noEmit           # app tree should be clean; scripts/ has known pre-existing implicit-any noise
```

Commit the 11 files on a branch or straight to main per your normal flow, deploy, then spot-check on production: /legislation (US card should show ~17k, not 0), /retraction-wall ("citing papers" counts should vary, not all 1 — see fallback note in Part 3), /analysis/votes (no `voteview_v1` label; instant skeleton on load), /stats/media-coverage ("Most Covered" no longer dominated by 10,000-hit rows), /topics ("Show N empty topics" toggle).

## Part 3 — Follow-up tasks (need this machine's DB/env access)

Guardrails for ALL of these: follow AGENTS.md — admin credentials + `ALLOW_EDITS` only for the duration of writes (then remove from Vercel), verify row counts against DB state after every mutation, never interpolate input into `$queryRawUnsafe`.

### 3a. Re-run NYT coverage with the new query filter
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/populate-bill-coverage.ts --dry-run --limit 5   # sanity
npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/populate-bill-coverage.ts --limit 50
```
Existing junk rows (query = "Recognizing", "establish", "_______ Act", etc.) are only FLAGGED by the API now; optionally delete their `BillCoverage` rows so they get re-fetched or stay excluded.

### 3b. Retraction-wall ripple coverage check
The new ranking counts CITES/CITED_BY edges touching each retracted paper's original. Verify coverage is non-trivial:
```sql
-- how many retraction originals have ≥1 citation edge?
WITH orig AS (
  SELECT r."toClaimId" AS orig_id FROM "ClaimRelation" r
  JOIN "Claim" rc ON rc.id = r."fromClaimId" AND rc."ingestedBy" = 'crossref_retractions_v1'
  WHERE r."relationType" = 'CONTRADICTS'
)
SELECT COUNT(DISTINCT o.orig_id) FROM orig o
JOIN "ClaimRelation" x ON (x."fromClaimId" = o.orig_id AND x."relationType" = 'CITED_BY')
                       OR (x."toClaimId" = o.orig_id AND x."relationType" = 'CITES');
```
If near zero, run `scripts/enrich-openalex-relations.ts` over the retraction originals (the page shows an honest empty state until then, so nothing is broken meanwhile).

### 3c. Investigate: Pakistan Federal Legislation mis-parented in Topic tree
Symptom: "Pakistan Federal Legislation (943)" sits under Academic Literature → Law, and domain badges mislabel the subtree. Find it, decide the correct parent/domain (likely the government/legislation domain used by other country-legislation topics), and fix `parentTopicId` + `domain`:
```sql
SELECT id, name, slug, domain, "parentTopicId" FROM "Topic" WHERE name ILIKE '%pakistan%';
SELECT id, name, slug, domain FROM "Topic" WHERE domain IN ('government','legislation') AND "parentTopicId" IS NULL;
```
This is an editorial DB mutation — human-confirm the target before writing.

### 3d. Investigate: 5 countries report 0 claims on /legislation
Bulgaria, Lithuania, Serbia, Indonesia, Pakistan show 0. Compare actual pipeline tags vs the registry:
```sql
SELECT "ingestedBy", COUNT(*) FROM "Claim" WHERE deleted = false AND "ingestedBy" ILIKE ANY(ARRAY['%bulgaria%','%lithuania%','%serbia%','%indonesia%','%pakistan%']) GROUP BY 1;
```
If rows exist under different tags → fix `lib/legislation-countries.ts` (same class of bug as the US fix). If no rows → those ingesters never ran; schedule them.

### 3e. Design task (larger): stop /analysis/votes blocking for 10–20s
`buildVoteAnalysis()` in `lib/voteAnalysis.ts` scans up to 500k MemberVote rows per revalidation. Precompute to JSON via a script + cron (pattern: `scripts/enrich-party-economic-response.ts` → `scripts/output/party-economic-response.json`), or wrap in `unstable_cache` with a long TTL. The loading.tsx from Part 1 is a stopgap, not the fix.

## Do NOT touch
- `CONSULTANT.md`, `app/components/LinkViewer.tsx`, `app/api/proxy/reader/route.ts` — another session was editing these on 2026-07-03 (~01:26 BST); they are NOT part of this work.
- Security invariants listed in AGENTS.md (middleware deny-by-default, timing-safe comparisons, PUBLIC_WRITE_PATHS, etc.).

When done, append a dated entry to CONSULTANT.md describing what you applied and the results of 3a–3d, per repo convention.
