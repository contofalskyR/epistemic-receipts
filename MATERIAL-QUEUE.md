# MATERIAL-QUEUE.md

Managed by RobClaw (material-orchestrator skill). One line per item + status. Edit only during a tick.

---

## findings

- [ ] **rct-orphan-rates** — RCT orphan rates per condition using `scripts/rct-cohort-report.ts`; deliverable: `findings/2026-07-10-rct-orphan-rates/` (report.md, data.csv, checks.md ≥5 executed spot-checks, draft-post.md with claims table) | dispatched 2026-07-10 | worker running, brief did not fix --query — outcome TBD
- [ ] **rct-orphan-rates-fdaaa** — RCT orphan rates on the tightened FDAAA cohort (Phase 2–4 applicable trials, primary completion ≥2008-01-01); deliverable: `findings/2026-07-11-rct-orphan-rates-fdaaa/` (report.md, data.csv, checks.md ≥5 executed spot-checks against clinicaltrials.gov records, draft-post.md with claims table) | dispatched 2026-07-11
- [ ] **retraction-lag** — time-from-publication-to-retraction distribution by field
- [ ] **settling-curve-lifetimes** — median settling-curve lifetimes by domain (feeds homepage Fig. 1)
- [ ] **moved-this-week** — weekly "moved this week" digest from /feed
- [ ] **law-reversals** — "reversals of settled US law" page data

## corpus

- [ ] **briefing-13-18-executor** — OFAC, FDA, WHO tail enrichment; workers produce dry-run diffs + row counts only; NO --execute (Needs-owner)

## site

- [ ] **adaptive-timeline** — adaptive timeline spec (spec in repo)
- [ ] **follow-ui** — follow-UI implementation
- [ ] **nav-trim** — nav trim + /labs consolidation
- [ ] **homepage-convergence** — homepage convergence on docs/design/v1-landing-mockup

## audit

- [ ] **invariant-check** — stamp agreement (Claim.epistemicAxis === latest toAxis), seq coverage, date-precision spot checks, orphaned-diagnostic reconciliation, dead-link sampling | queued-next-tick (at 2-worker cap this tick)
