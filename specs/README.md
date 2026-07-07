# specs/ — Agent Handoff Specs

Execution-ready specs for every build item in `SCALING.md`. Each spec is self-contained: an agent (Claude Code with Opus 4.8 or Sonnet 5) should be able to complete it without asking what was intended. Written 2026-07-06.

**Orchestrator boot document: `specs/HANDOFF-OPENCLAW.md`** — mission, all-Sonnet model policy, authorization grants, execution order, owner communication contract. An orchestrator session starts there.

## Execution protocol (paste into every agent session)

1. Read `AGENTS.md`, `SECURITY-REVIEW-2026-06-12.md` (if present), and the single spec file you were assigned. Read `node_modules/next/dist/docs/` for any Next.js API you touch — this Next.js 16 differs from training data.
2. Work on a branch named `spec/<number>`. One spec per session. Do not start work outside your spec's Deliverables section — if something adjacent looks broken, log it in the PR description instead.
3. If the spec doesn't answer a design question, STOP and record it under "Open questions" in the PR rather than inventing an answer. Fabricated substitutes for missing data or missing decisions are the known failure mode of this project (see AGENTS.md, Pipeline 5).
4. Every mutation endpoint you add: `requireAdminOrDev()` or `CRON_SECRET` check + `isReadOnly()` + middleware allowlist entry + rate limit + input length caps. No `$queryRawUnsafe` string interpolation ever — bind params only (`likeParam` pattern in `app/api/retractions/route.ts` for ILIKE).
5. Definition of done = every Acceptance criterion demonstrably passes, CI green, and the Verification section's commands were actually run with output pasted into the PR. Never claim done otherwise.
6. Database: verify row counts with direct queries after any write — never trust script counters. `prisma.$transaction(fn, { timeout: 30000 })` for batches >1k rows. Deprecate, never delete.

## Execution order and model guidance

| # | Spec | Phase | Depends on | Model | Why |
|---|------|-------|-----------|-------|-----|
| 00 | foundations (CI, staging, observability) | 0 | — | Sonnet 5 | Well-trodden setup work |
| 10 | ingest harness | 1 | 00 | **Opus 4.8** | Refactor judgment across 388 scripts; highest drift risk |
| 11 | provenance + data cards + methodology | 1 | — | Sonnet 5 | Mostly surfacing existing fields |
| 12 | snapshot exports | 1 | 00 | Sonnet 5 | Mechanical, well-specified |
| 13 | licensing scaffolding | 1 | — | Sonnet 5 | Drafts for human/lawyer review |
| 20 | /v1 API | 2 | 00, 11 | **Opus 4.8** | Architecture + security surface |
| 21 | billing + metering | 2 | 20 | Sonnet 5 | Stripe integration is standard |
| 22 | MCP server | 2 | 20 | Sonnet 5 | Thin wrapper over /v1 |
| 23 | eval set product | 2 | 11 | **Opus 4.8** | Data-quality judgment calls |
| 30 | accounts, orgs, entitlements | 3 | 00 | **Opus 4.8** | Auth architecture; costly to get wrong |
| 31 | researcher features | 3 | 30 | Sonnet 5 | CRUD + export formats |
| 40 | litigation workbench (as-of) | 4 | 20, 30 | **Opus 4.8** | Temporal-correctness subtleties |
| 50 | search/embedding upgrade | 2–3 | 00 | **Opus 4.8** | Quality evaluation requires judgment |

All 13 are within Sonnet 5's capability; Opus 4.8 is recommended where a wrong architectural choice is expensive to unwind. Not in specs (human/GTM work, not buildable): design-partner outreach, institutional pilots, pharma MLR sales, legal entity formation, case-study editorial cadence.

## Global invariants (agents must not violate)

- Security model of 2026-06-12 stays intact: deny-by-default middleware, admin gates, headers, cookie flags, timing-safe comparisons, fail-closed CRON_SECRET. New public surfaces are read-only + rate-limited by default.
- Editorial: `humanReviewed` means a human reviewed it. `autoApproved` means gates passed. Never conflate. Reference-tier test gates any new bulk ingestion. No training-data recall as a data source.
- No secrets in code. `.env.local` stays gitignored.
- No user-generated claims, no truth verdicts/scores, no engagement features. These are product invariants, not just style.
- PII boundary: `Profile`, `Bookmark`, `TopicSubscription`, `Feedback`, and any future `User`/`Org` tables are NEVER exported, never in snapshots, never in /v1 responses.

## Running this as an agentic loop (orchestrator model)

Pattern adapted from steipete's maintainer-orchestrator (github.com/steipete/agent-scripts), adjusted for a single-repo greenfield build with this project's audit constraints.

### Two planes
- **Orchestrator (control plane):** one root session, wakes on a schedule (or is re-invoked in a `while true`). It NEVER implements. It reads `specs/STATE.md`, picks the next unblocked spec, spawns/steers one worker per spec, monitors, prepares owner decisions, and maintains the log. Workers may not sub-delegate or manage other threads — put that rule in every worker prompt.
- **Workers (one spec each):** fresh context per iteration, state on disk (STATE.md + git), follow the execution protocol at the top of this file. `--model` per the table above.

### Decision-ready rule (the owner-time saver)
Never surface a spec to the owner as "please review my work-in-progress." A spec reaches the owner only in one of two states:
1. **Decision-ready:** branch pushed, PR open, CI green, every Acceptance criterion demonstrably met, Verification output pasted. The owner's action is land / reject / pick between documented alternatives — not archaeology.
2. **Blocked:** an exact open question (one decision, its options, the worker's recommendation and rationale, what each choice implies). Never a vague "needs input."

Every ask uses a decision brief: PR URL + title, what changes in plain language, proof completed, residual risks/tradeoffs, recommendation, exact choices. Group briefs when several specs are ready, one brief per item.

### Authorization tiers (explicit, recorded in each worker prompt)
Triage/read < implement-on-branch < push/PR < merge < deploy. Default grants for this repo: workers get implement+push+PR. **Merge is owner-only for every spec** — with one carve-out: the orchestrator may auto-land changes that touch ONLY docs, runbooks, `specs/`, or `lib/pipelines/registry.ts` data entries, with CI green. Schema, middleware, auth, `/v1` contract, billing, and export code NEVER auto-land regardless of CI. Deploys to production: owner-only.

### Monitoring protocol (orchestrator behavior)
Before messaging a worker, read its latest state; assume the owner may have steered it since last poll — newest thread-local instruction wins. Send nothing to a worker that's progressing coherently. Intervene only on: explicit blocker, completed/exhausted work, repeated no-progress iterations (two with no diff and no new open question = halt and flag), or gross deviation from the spec (a different-but-reasonable design choice is not deviation — log it, don't steer). Don't raise the proof bar mid-flight; the spec's Acceptance criteria are the bar.

### Live-proof gate
"Tests pass" is not proof for anything with a runtime boundary. Pre-merge proof means exercising the real boundary the spec names: staging deploy for middleware/auth changes, Stripe test-mode lifecycle for billing, a real snapshot artifact through the verifier, real MCP round-trips. Mocks and fixtures supplement; they never substitute. If the real boundary is unreachable (missing credential, human account step), the worker finishes all autonomous work, then blocks with the exact missing item — it does not infer a waiver.

### Hard rules retained from this repo's history
1. **Spec 00 lands first, owner-gated.** CI is the loop's ground truth; until it exists the loop grades its own homework.
2. **Human sign-offs inside specs (11 methodology read-through, 13 lawyer review, 23 eval review, 40 anachronism audit) are hard stops** — decision-ready means "ready except the sign-off," never "sign-off skipped."
3. **Never run two specs that touch shared surfaces (20, 30: middleware/schema) concurrently.** Independent specs (11 ∥ 12 ∥ 13; later 21 ∥ 22 ∥ 23) may run as parallel workers in separate worktrees.
4. **`blocked` beats invented answers.** Unattended iteration is exactly the condition under which the Pipeline 5 fabrication happened. Budget guard: ~15 iterations per spec, then halt and flag.

### Persistent log
Orchestrator owns `specs/ORCHESTRATOR-LOG.md` (workers don't edit it): dated entries for delegations, interventions, owner decisions, lands, and blockers — with PR URLs. No routine-polling noise. This log is part of the project's audit posture, same spirit as PipelineRun.

### STATE.md format
Per spec: `todo | in_progress (branch, worker, iteration N) | decision_ready (PR url) | blocked (question) | done (merged)`. The orchestrator updates lifecycle states; workers update iteration counts and blocked questions.

## Environment facts (so agents don't rediscover them)

Next.js 16 App Router on Vercel · Prisma 6 + `@prisma/adapter-neon` (driverAdapters) · Neon Postgres with pgvector (`vector(384)` on `TrajectorySearchDoc.embedding`) and a generated tsvector column `Claim.searchVector` (raw-SQL migration, not Prisma-managed) · Resend for email · ~1.04M claims, 160+ pipelines, `PipelineRun` table exists · anonymous `Profile` + `TopicSubscription` alerts shipped 2026-06-06 · epistemicAxis migration (RECORDED/SETTLED/CONTESTED/OPEN/UNRESOLVABLE) in flight — new code uses `epistemicAxis`, treats `currentStatus` as deprecated · GitHub Actions already used for one ingest (`.github/workflows/ingest-loc.yml`) · admin auth via `ADMIN_TOKEN` Bearer or `admin_auth` cookie; `lib/adminAuth.ts`.
