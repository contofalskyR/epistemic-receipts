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

1. **NARA item-level sweep** (`scripts/backfill-nara-dates-api.ts`) — BLOCKED on
   NARA_API_KEY. ⚠ `.env.local` currently contains a PLACEHOLDER line
   (`NARA_API_KEY=paste-the-key-here`) — DELETE it before adding the real key
   (dotenv keeps the first occurrence). Key likely already exists on the loop
   machine's `.env.local` (it ran the 258k ingest); else Catalog_API@nara.gov.
   Then: `--direct` (sample 200 → go/no-go coverage %) → `--execute --direct`
   (resumable, ~18h @ 4/s; swept claims stamped metadata.naraDateSweep).
   After: `ingest-auto-trajectories.ts --pipeline nara_catalog_v1` + re-census.
2. **chebi (37k)**: rerun existing `backfill-chebi-dates.ts` (PubMed citation dates),
   then Layer-1 rescan; remainder = residue.
3. **Honest residue, document in methodology**: jacar 31k (no public API — the
   next different beast, per-page scrape if ever), rxnorm 15k, ofac 10k (Treasury
   publishes no per-entity designation dates), mesh 10k / omim 1.5k (NLM/OMIM API
   sweeps possible later), pubchem, small ones. Number goes on the methodology
   page as proof dates are never invented.
4. **Still queued from briefing 08**: SCOTUS/exoplanet pipeline pilots, NZ two-phase,
   rechain fix (pause Layer-1 loop first), curated dedupe `--deprecate`, loop-machine
   `git pull` + install loop-event-pipelines.sh, ordering-semantics decision.
