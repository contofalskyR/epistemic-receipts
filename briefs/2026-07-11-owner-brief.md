# Owner Brief — 2026-07-11

## 1. Publish-ready

### rct-orphan-rates (broad cohort) — `loop/findings-rct-2026-07-10`
67.7% of 14,684 completed randomized trials across 6 conditions have never posted results, >1yr past completion. 6/6 spot-checks PASS, 13-row claims table complete. Worker flag: framing is "non-posting" not "non-incorporation into guidelines" — this distinction is correctly front-and-center in draft-post.md.
**Recommendation: publish after you read the Limitations section.** If the framing is comfortable, it's ready.
**Ask: publish / hold / kill**

### rct-orphan-rates-fdaaa (FDAAA tightened cohort) — `loop/findings-fdaaa-2026-07-11`
500-study Phase 2–4 FDAAA sample, 51.6% ORPHANED (258/500). 6 live-API spot-checks PASS, 9-row claims table. Script query bug fixed in this run (space-separated enum values → OR-joined). Consistent with DeVito/Bacon/Goldacre 2020 Lancet (~59%). This is a 500-row sample of 68,036 matching trials.
Artifacts in worktree `/home/opuser/.openclaw/workspace/er-findings-fdaaa-2026-07-11/findings/2026-07-11-rct-orphan-rates-fdaaa/`
**Recommendation: publish together with the broad cohort finding** — complementary stories (all completed trials vs. FDAAA-obligated ones).
**Ask: publish both / hold / kill**

---

## 2. Merge decisions (AA workers still running — decisions in next brief)

None yet. AA-1 (tobacco claims) and AA-2 (FDA withdrawals preflight) are running in tmux. Next brief will have their artifacts and decision paths.

---

## 3. Blockers

**AA-2 premise correction (for your awareness):** The prompt you sent me said the OpenAlex ↔ CrossRef retraction join still needed to be built. It was already built and executed 2026-07-09 — 5,525 RECORDED→REVERSED arcs are in the DB. I caught this and redirected AA-2 to Phase B (FDA withdrawals of approval, `fda-withdrawals.ts`), which is the actual next step. The dry-run worker is running now.

---

## 4. Shipped autonomously

- Merged origin/main into local main (your Mac pushed `specs/OPENCLAW-DATA-DOCTRINE.md`, `AGENTS.md` additions, `scripts/output/rct-cohort-report-2026-07-10.md`). No conflicts. Pushed to origin.

---

## 5. Next tick's plan (silence = consent for autonomous lanes)

**Running now (notify on done):**
- AA-1 findings: tobacco whitepaper — diagnose why Müller 1939 + Surgeon General 1964 claims are dormant, assemble primary sources, draft proposed transitions extending `seed-smoking-cancer.ts`. No DB writes. Delivers: decision-brief giving you an approve-and-run path under 1 hour.
- AA-2 corpus: FDA withdrawals Phase B dry-run — preflight row counts + CHECKPOINT 1 memo. No --execute. You approve before any write.

**Next run (after AA-1 and AA-2 land):**
- AA-3 site: `/stories/h-pylori` — data complete, pure UI build, green PR for your merge
- AA-4 site: `/reversals` page — DomainCurveRail with 8 seeded + 11 pipeline JUDICIAL arcs, green PR
- AA-5 findings: dietary fat CONTESTED arc story + draft-post with claims-audit table
- audit: invariant-check (stamp agreement, seq coverage, dead-link sampling)
