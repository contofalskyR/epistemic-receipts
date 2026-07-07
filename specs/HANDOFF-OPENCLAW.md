# HANDOFF — OpenClaw Orchestrator: Execute the Scale Build with Sonnet 5

To: OpenClaw orchestrator session (control plane)
From: planning session, 2026-07-06 · Owner: Robert
Working model for all workers: **Sonnet 5**. Read this file, then `specs/README.md`, then nothing else until you have created STATE.md.

## Mission

Execute the build plan in `SCALING.md` via the specs in `specs/` (00–50), following the orchestrator model in `specs/README.md`. End state per phase: Phase 0 = repo safe to change (CI/staging/observability); Phase 1 = corpus consumable as a product (harness, data cards, snapshots, license drafts); Phase 2 = first revenue surface (/v1 API, billing, MCP server, eval set). Phases 3–4 (30/31/40) start only when the owner says the Phase 2 surface has a design partner.

Context you already hold: `~/.openclaw/workspace/memory/project_epistemic_receipts_monetization.md`. Repo doctrine: `AGENTS.md` (its rules override anything here on conflict). The site is live, public, read-only — nothing you do may degrade it.

## Why all-Sonnet works here, and what it demands of you

The spec table recommends Opus 4.8 for 10, 20, 23, 30, 40 because those have expensive-to-unwind architecture. Running them on Sonnet 5 is approved, because the specs pre-made the architectural decisions — every "Design (decided — do not revisit)" block exists so the worker doesn't design, it executes. Your compensating controls as orchestrator:

1. **Design-note checkpoint (specs 10, 20, 23, 30, 40 only).** Before a worker writes code: it produces a ≤1-page design note (interfaces, tables, routes, and a line-item mapping to every "decided" item in its spec). You diff that note against the spec text. Any deviation or reinterpretation → the worker does not proceed; state becomes `blocked` with a decision brief. A different-but-reasonable idea is still a deviation at this stage.
2. **Small increments on those five specs.** Cap ~400 changed lines per iteration. Big-bang diffs from a fast model are where drift hides.
3. **Escalation rule.** Two consecutive iterations failing the same acceptance criterion, or a worker asking to reinterpret a decided item → halt that spec, write a decision brief; the owner may approve a one-off Opus 4.8 session for that item. Never quietly retry a third time.
4. **Verification is not self-attested.** You (orchestrator) re-run each spec's Verification commands yourself, or in a fresh clean worker, before marking `decision_ready`. Sonnet grading its own homework is the failure mode; CI + your re-run are the graders.

## Authorization grants (record verbatim in every worker prompt)

- All workers: read/triage + implement-on-branch + push + open PR. **No merge. No production deploy. No sub-delegation.**
- Orchestrator auto-land carve-out: changes touching ONLY `docs/`, runbooks, `specs/`, or data entries in `lib/pipelines/registry.ts`, with CI green. Everything else — schema, middleware, auth, `/v1`, billing, exports — owner-merges, no exceptions.
- Pre-approved vendors (as spec'd, staging/test mode): GitHub Actions, Sentry, Upstash Redis, Cloudflare R2, Stripe **test mode only**, UptimeRobot, OpenAI embeddings API. Anything else → decision brief first.
- Spend caps: embedding backfill hard cap env (spec 50) set to $25/run until owner raises; eval baseline runs (spec 23) $50 total; alert the owner at 80% of any cap. Stripe live mode, npm publish (spec 22), and DNS/domain changes are owner-executed actions — prepare, then brief.
- Production env vars: read-only to you. Never set `ALLOW_EDITS`. Never weaken anything in the AGENTS.md security-model block to "fix" a 401.

## Execution order

1. **Boot:** create `specs/STATE.md` (all specs `todo`) and `specs/ORCHESTRATOR-LOG.md`. Log this handoff as entry #1.
2. **Spec 00 first, single worker, owner-gated merge.** Nothing else runs until 00 is `done` — CI is your ground truth for everything after.
3. Then parallel workers in separate worktrees: **11 ∥ 12 ∥ 13**. Then **10** (alone — it defines patterns others reuse). Then **20** (alone — shared surfaces). After 20: **21 ∥ 22 ∥ 23**. **50** anytime after 00, but must be `done` before /v1 search is marketed. **30** waits for owner go-ahead, then **31**; **40** last.
4. Never concurrent: 20 and 30, or anything else touching middleware/schema simultaneously.

## Communication contract with the owner

- Decision briefs exactly per `specs/README.md` — URL, plain-language change, proof completed, tradeoffs, recommendation, exact choices. Batch briefs; one brief per item; never a bare URL + "land?".
- Hard stops that only the owner clears: spec 11 methodology read-through, spec 13 lawyer review, spec 23 eval sign-off, spec 40 anachronism audit, phase-3 go-ahead, every merge outside the carve-out.
- Weekly ledger to the owner even if nothing is decision-ready: Active / Decision-ready / Blocked / Auto-landed / Spend vs caps.
- `blocked` beats invented answers — Pipeline 5 (fabricated USPTO records under unattended iteration) is this repo's founding cautionary tale. A worker that invents a value, source, or requirement to keep moving has failed even if CI is green.

## Boundaries that are product, not preference

No PII in any export, snapshot, or /v1 response (`Profile`, `Bookmark`, `TopicSubscription`, `Feedback`, future `User`/`Org`). No truth verdicts or scores anywhere — provenance grades measure documentation depth only. No user-generated claims. No training-data recall as a data source. `humanReviewed` means a human reviewed it — no worker ever sets it.

## Definition of done for this handoff

All specs `done` through phase 2, weekly ledgers sent, ORCHESTRATOR-LOG.md complete enough that a future session (or a different model) can reconstruct every decision without this conversation. You are the continuity plan — the planning session that wrote this will not be available for questions. Where this document is silent, the spec wins; where the spec is silent, block and brief.
