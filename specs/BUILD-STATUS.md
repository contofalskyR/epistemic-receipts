# BUILD-STATUS.md — Scale Build Tracker
_Updated by orchestrator. Last updated: 2026-07-07._

---

## Specs: what landed

| Spec | Title | Status | Notes |
|------|-------|--------|-------|
| 00 | CI, staging, observability, restore drill | ✅ Merged | Foundation — CI is live, staging branch exists |
| 10 | Ingest harness | ✅ Merged | `lib/ingest/`, 3 pilots (congress, doj-fara, paclii), 38 tests, CLI + HTTP endpoint |
| 11 | Provenance + data cards + methodology | ✅ Merged | `/methodology`, `/datasets`, `/datasets/[tag]`, pipeline registry, manifest API |
| 12 | Snapshot exports | ✅ Merged | **Owner actions required before first run** — see below |
| 13 | Licensing & legal scaffolding | ✅ Merged | **Needs lawyer review** before using publicly |
| 20 | /v1 public API | 🔄 In progress | Worker running |
| 21 | Billing + metering | ⏳ Blocked on 20 | |
| 22 | MCP server | ⏳ Blocked on 20 | |
| 23 | Eval set product | ⏳ Blocked on 20 | |
| 30 | Accounts, orgs, entitlements | ⏳ Blocked on owner Phase 3 go-ahead | |
| 31 | Researcher features | ⏳ Blocked on 30 | |
| 40 | Litigation workbench | ⏳ Blocked on 20 + 30 | |
| 50 | Search/embedding upgrade | ✅ Merged | **Owner actions required** — see below |

---

## Owner actions required (blocking production use)

### spec/12 — Snapshots
Before the first export run:
- [ ] Add 5 GitHub Actions secrets: `DIRECT_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- [ ] Configure R2 bucket public-read policy for `sample/` prefix
- [ ] Create SELECT-only Postgres role: `epistemic_export_ro` (SQL in `docs/runbooks/snapshots.md`)
- [ ] After first export: add entry to `data/snapshots-registry.json` and commit

### spec/13 — Legal
- [ ] **Lawyer review** of all 6 files in `legal/` before citing publicly
- [ ] Replace placeholder emails: `commercial@`, `legal@`, `privacy@`
- [ ] Choose jurisdiction for ToS and commercial license
- [ ] Add GitHub repo URL on `/license` page
- [ ] `solar_system_v1` — identify upstream license terms
- [ ] `icd11_v1` — hold until CC BY-ND derivative-works question resolved
- [ ] `omim_v1` — 1,512 records in DB; remove from snapshots until redistribution license obtained

### spec/11 — Methodology page
- [ ] Read through `app/methodology/page.tsx` and sign off on editorial claims (marked `// NEEDS OWNER READ-THROUGH`)

### spec/50 — Search/embedding
- [ ] Add `OPENAI_API_KEY` to Vercel env vars and GitHub Actions secrets
- [ ] Run backfill script after key is set: `npx tsx scripts/embed-backfill.ts`
- [ ] Curate `tests/search-eval/queries.jsonl` — fill in `relevant_claim_ids` via live search
- [ ] Re-run eval to get real nDCG@10 numbers
- [ ] Run p95 latency benchmark on staging after full backfill

---

## Incidents / issues this session (2026-07-07)

| Issue | What happened | Resolution |
|-------|--------------|------------|
| Vercel build fail on spec/13 | `'annual'` missing from `Cadence` type in `lib/pipelines/registry.ts` | Fixed, pushed to spec/13 |
| Orchestrator loop broke | Session died after 11/12/13; spec/10 + 50 weren't auto-launched | Manually resumed; STATE.md + ORCHESTRATOR-LOG.md created |
| Messy git history on main | Parallel workers shared working directory → spec/11 and spec/12 merged twice (once into spec/10 branch by accident, once properly via worktree) | Code is correct; history has duplicates between `0054f1d` and `03733b3` — cosmetic only |
| spec/50 eval queries empty | Worker had no DB access to look up real claim IDs | Correct behavior — do not fabricate IDs. Fill in manually post-deploy |

---

## Orchestrator process notes

- Workers share the same git working directory → **race conditions on branch switches**. Fix: use `isolation: 'worktree'` on future spawns, or serialize workers that do git operations.
- `gh` CLI not installed on VPS → PRs must be opened manually on GitHub.
- Completion events arrive as messages — orchestrator must check STATE.md on each event and launch next unblocked spec without waiting for owner prompt.
