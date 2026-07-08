# Briefing 09 — Make Everything a Curve (state as of 2026-07-08, ~10pm)

Goal: every claim with a recoverable date is an openable settling curve, even at
length 1; the truly undatable remainder is honest, counted residue. Pipeline:
census → per-pipeline date backfill → ingest-auto-trajectories rescan → re-census.

## Done

- **Census** (`scripts/census-dateless-claims.ts --direct --json`): 363,439 curve-less,
  ALL dateless, 0 untemplated. NARA 258k (71%), chebi 37k, jacar 31k, rxnorm 15k,
  ofac 10k, mesh 10k, rest small. Key finding: NARA/JACAR metadata date keys are
  empty BY CONSTRUCTION — list-level API had no date ⇒ ingester stored none ⇒ no
  claimEmergedAt. The dated ones already have curves.
- **Metadata/source backfill** (`scripts/backfill-emergence-dates.ts`, shared parsers
  in `lib/date-parsers.ts` — western + Japanese-era + covering-dates, all unit-tested):
  uk_national_archives 43 dated (MONTH), pdg_particles 226 (Source.publishedAt, YEAR).
  nara/jacar/africanlii: 0 recoverable from stored metadata (see above).
- **Layer-1 reruns**: pdg (226 SETTLED) + uk archives (43 RECORDED) — **269 new curves
  live**. The assembly line works end-to-end.
- **UI**: explorer renders single-transition claims as a one-dot curve + dashed
  dormant line to today ("N yrs · no new activity"); landing card grid on
  /settling-curve; search surfaces curves (rail + per-hit chips).

## Next (in order)

1. **NARA item-level sweep — GO CONFIRMED 2026-07-08.** Sample: 196/200 (98%)
   dated via `productionDates`, honest mixed precision (DAY/MONTH/YEAR),
   strategy `?naId_is=`. Projection: ~253k of 258k datable. Launch (survives
   sleep + closed terminal; resumable — swept claims stamped, re-run continues):
   ```bash
   nohup caffeinate -i npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-nara-dates-api.ts --execute --direct > logs/nara-sweep-run.log 2>&1 &
   tail -f logs/nara-sweep-run.log
   ```
   **THE HARVEST (run when the sweep finishes — do not lose these):**
   ```bash
   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts --pipeline nara_catalog_v1 --dry-run
   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts --pipeline nara_catalog_v1
   npx dotenv-cli -e .env.local -- npx tsx scripts/census-dateless-claims.ts --direct --json
   ```
   Optional polish before the rescan: NARA Layer-1 reason says "catalogued" but
   these are PRODUCTION dates — one-line template wording fix available on request.
2. **chebi (37k)**: rerun existing `backfill-chebi-dates.ts` (PubMed citation dates),
   then Layer-1 rescan; remainder = residue.
3. **mesh (10k) — RECOVERABLE, 2026-07-08**: `backfill-mesh-dates.ts` sample hit
   100% via meshv:dateIntroduced (GET-only endpoint; -01-01 stored as YEAR).
   Run: `--execute --direct` (~7 min at batch 25/400ms) → Layer-1 rescan mesh_v1.
4. **Honest residue, document in methodology**: jacar 31k (no public API — the
   next different beast, per-page scrape if ever), rxnorm 15k, ofac 10k (Treasury
   publishes no per-entity designation dates), omim 1.5k (API sweep possible,
   needs OMIM key check), pubchem, small ones, + NARA/mesh no-date remainders.
   Number goes on the methodology page as proof dates are never invented.
5. **Still queued from briefing 08**: SCOTUS/exoplanet pipeline pilots, NZ two-phase,
   rechain fix (pause Layer-1 loop first), curated dedupe `--deprecate`, loop-machine
   `git pull` + install loop-event-pipelines.sh, ordering-semantics decision.
