# B18 Cleanup Report — repo consolidation + stranded-work salvage

**Branch:** `loop/cleanup-b18-2026-07-21` (built on `fix/ci-green`) · **Date:** 2026-07-21
**Built by:** Claude (Cowork session, owner-dispatched: "build all of this as a final clean up project")

## Why

CI had been red since Jul 15/16 (one real tsc error + 22 eslint errors), the nightly
integrity check was structurally broken (`npx ts-node` with ts-node not in
package.json), and an inventory pass found stranded commits on four branches,
four uncommitted briefs, two briefs with unbuilt tooling, and B17 not started.
This branch consolidates all of it. Verification at HEAD of this branch:
**tsc clean · eslint 0 errors (247 pre-existing warnings) · vitest 297/298 passed (1 skipped)**.
Integration tests + migration-drift steps run in CI (they need live Postgres).

## What landed (in commit order)

1. **fix/ci-green** (base): recharts v3 `Scatter onClick` fix in IdeologyClient
   (reads the datum from `.payload`), 18 topic pages `<a href="/settling-curve">`
   → `<Link>`, unescaped-quote fixes on /analysis/ideology and /reversals,
   nightly workflow switched `npx ts-node` → `npx tsx` (tsx is the devDependency;
   ts-node was fetched unpinned from the registry every night).
2. **B14 salvage** (`7469a17` cherry-picked): curated-lag list items clickable →
   settling-curve detail. Was stranded on `loop/site-b14` after PR #18 merged.
3. **B16 salvage** (`bb45124` cherry-picked): dataset rollcall-count caching in
   `/api/analysis/ideology/member`. The quote-fix half was already covered by
   fix/ci-green (kept the `&ldquo;` form). Was stranded on `loop/site-b16` after PR #20.
4. **B6 salvage** from never-merged `loop/site-b6`:
   - B6-4 embed finish (clean cherry-pick): `/api/oembed` discovery route,
     `/api/badge/trajectory/[slug]`, docs/api embeds section, story-page embed touches.
   - B6-report + CONSULTANT.md B6 entry (cherry-picked; the CONSULTANT hunk
     appended at end-of-file — entries are internally dated, order is backfill).
   - B6-1's missing B3 CONSULTANT.md entry (extracted; its reversals hunk was
     superseded by fix/ci-green).
   - **Not salvaged (superseded on main):** B6-2 PUBLIC_ROUTES additions (all
     present), B6-3 /patterns page + curve-shapes lib + tests (landed via B14-era commits).
5. **Promoter ledger merge**: `loop/votes-b11` runs #76–78 (13 enrichment
   scripts) merged — the promoter had been committing to the Mac's checked-out
   branch instead of main since Jul 16.
6. **Briefs committed**: B8, B15, B16, B17 (were untracked on the owner Mac only).
7. **B15-3 tooling**: `scripts/b15-compute-rate.ts` (worksheet parser, Wilson
   CIs, per-stratum table, wrong-rows list; writes `published-rate.json` only
   when verification is complete) + a **"Measured accuracy" section on
   /methodology that renders only once `findings/b15-error-audit/published-rate.json`
   exists** — no placeholder copy before that.
8. **B8-2 tooling**: `scripts/b8-route-sweep.ts` — allowlist 200s+content
   marker, deny-list 404s, /bookmarks + /alerts redirect checks, sitemap-discovered
   deep paths, badge/embed checks, HSTS spot check. Ready for dispatch.
9. **B17-2 build**: `/canon` v1 (ranked ≥5,000-citation papers with audit-state
   chips, minis on multi-step rows, honest denominators + count-coverage fine
   print, server filters + pagination at 50), PUBLIC_ROUTES + sitemap +
   /patterns + /start-here cross-links in the same commit; `scripts/b17-census.ts`
   (B17-1) and `scripts/import-promoter-review-status.ts` (B17-3, dry-run
   default, merge-never-clobber, idempotent, cursor-resumable).

## OWNER ITEMS — in order

1. **Merge this branch.** Push it (bundle instructions in chat), open the PR,
   let CI validate, merge. It contains fix/ci-green, so the separate
   fix/ci-green PR can be closed if this merges first. After merge, the next
   nightly (03:00 UTC) runs the tsx-based integrity check — if it still fails,
   the log now tells the truth (credentials or a real data violation).
2. **Follow migration (b12, still pending per b12-report):** in an owner window,
   verify whether `Follow` exists in prod (`SELECT to_regclass('"Follow"');`)
   and if not: `npx prisma migrate deploy` with prod env, then apply
   `docs/runbooks/er_scoped_writes.sql`. /api/follow + /following are live code
   waiting on this.
3. **B15-2 (only you can):** work `findings/b15-error-audit/worksheet-*.md`
   (~500 rows × ~45s), then `npx tsx scripts/b15-compute-rate.ts`, commit
   `report.md` + `published-rate.json` — /methodology's Measured accuracy
   section lights up on the next deploy. Corrections pass (B15-4) only after.
4. **B8 dispatch:** fill PROJECT_B_URL in the brief, run
   `npx tsx scripts/b8-route-sweep.ts https://<project-B>.vercel.app` (that's
   B8-2 + parts of 4/5/7), work the remaining manual phases, write the go/no-go.
5. **B17 gates:** on the Mac run `npx tsx scripts/b17-census.ts` (paste census
   into a b17-report), review /canon copy against it, then C-3:
   `npx tsx scripts/import-promoter-review-status.ts` (dry-run) → checkpoint
   memo → your recorded yes → `--execute`. Re-run after the fable ≥4,000 tier.
6. **Branch hygiene:** after this merges, run `scripts/cleanup-stale-branches.sh`
   (deletes only salvaged/merged branches; prints review-first candidates).
7. **Mac checkout:** switch `~/Projects/epistemic-receipts` back to `main` once
   merged so the promoter commits land on main again; delete the two bundle
   files at the repo root.
8. **Consider:** a branch-protection rule requiring the CI check before merge —
   PRs #16–#20 all merged red, which is how this pile accumulated.

## Residuals (honest gaps)

- b16-report and b17-report remain unwritten (next loop dispatch or owner).
- B16-2's design-note gate happened only implicitly (panel shipped in PR #20);
  noted here rather than reconstructed after the fact.
- The B6 CONSULTANT.md entries sit at end-of-file out of chronological order
  (backfill, internally dated).
- `/canon`'s explorer-tab cross-link (brief's "if it composes cleanly") was
  skipped — nav-trim discipline; /patterns + /start-here links shipped.
- Older unmerged branches (findings-*, corpus-aa2, aa5, feat/alerts-mvp,
  build/pipeline-19/20) look superseded (alerts → /following; riksdag/
  tweedekamer data already ingested) but were NOT auto-deleted — review list
  in the cleanup script.
