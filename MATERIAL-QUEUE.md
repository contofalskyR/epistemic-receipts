# MATERIAL-QUEUE.md

Managed by RobClaw (material-orchestrator skill). One line per item + status. Edit only during a tick.

---

## findings

- [x] **rct-orphan-rates** — DECISION-READY | branch: loop/findings-rct-2026-07-10 | 14,684 trials, 67.7% ORPHANED, 6/6 spot-checks PASS, 13-row claims table complete | awaiting: publish / hold / kill
- [x] **rct-orphan-rates-fdaaa** — DECISION-READY | branch: loop/findings-fdaaa-2026-07-11 | 500-study FDAAA sample, 51.6% ORPHANED (258/500), 6/6 spot-checks PASS, claims table complete | awaiting: publish / hold / kill
- [ ] **AA-1-tobacco-whitepaper** — P0 | make tobacco whitepaper claims curation decision-ready; diagnose Müller 1939 + Surgeon General 1964 dormant claims, assemble primary sources, draft proposed transitions extending seed-smoking-cancer.ts — no DB writes, no --execute | dispatched 2026-07-11 | branch: loop/findings-aa1-2026-07-11
- [ ] **AA-5-dietary-fat** — rare CONTESTED arc (Keys 1950s→AHA 1960s SETTLED→2010s CONTESTED); write story text + small site surface; draft-post.md must end with claims-audit table, present both sides with receipts, no verdict; publishing is owner-only | queued, next-run
- [ ] **retraction-lag** — time-from-publication-to-retraction distribution by field
- [ ] **settling-curve-lifetimes** — median settling-curve lifetimes by domain (feeds homepage Fig. 1)
- [ ] **moved-this-week** — weekly "moved this week" digest from /feed
- [ ] **law-reversals** — "reversals of settled US law" page data

## corpus

- [ ] **AA-2-fda-withdrawals-preflight** — Phase B from briefing 13: fda-withdrawals.ts is BUILT (probe memo: logs/fda-withdrawals-probe-2026-07-10.md); run dry-run preflight only; report row counts + CHECKPOINT 1 memo; no --execute; dispatched 2026-07-11 | branch: loop/corpus-aa2-2026-07-11
  NOTE: openalex-retraction-join.ts Phase A is DONE (2026-07-09, 5,525 arcs inserted). AA-2 prompt was written on stale info; actual next step is Phase B FDA withdrawals.
- [ ] **briefing-13-18-executor** — OFAC, FDA, WHO tail enrichment; workers produce dry-run diffs + row counts only; NO --execute (Needs-owner)

## site

- [ ] **AA-3-h-pylori-story** — data complete in seed-trajectories.ts (Marshall & Warren 1984 → NIH Consensus 1994 → Nobel 2005 + stress/acid REVERSED arc); build /stories/h-pylori or featured-arc component; green PR + merge decision to owner | queued, next-run
- [ ] **AA-4-court-reversals-page** — /reversals page with DomainCurveRail; 8 seeded + 11 SCOTUS pipeline arcs; green PR + merge decision to owner | queued, next-run
- [ ] **adaptive-timeline** — adaptive timeline spec (spec in repo)
- [ ] **follow-ui** — follow-UI implementation
- [ ] **nav-trim** — nav trim + /labs consolidation
- [ ] **homepage-convergence** — homepage convergence on docs/design/v1-landing-mockup

## audit

- [ ] **invariant-check** — stamp agreement (Claim.epistemicAxis === latest toAxis), seq coverage, date-precision spot checks, orphaned-diagnostic reconciliation, dead-link sampling | queued-next-tick (at 2-worker cap this tick)
