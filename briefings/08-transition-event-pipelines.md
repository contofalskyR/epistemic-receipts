# Briefing 08 — Transition-Event Pipelines (the curvability build)

**Date:** 2026-07-07. Written alongside a working implementation (this briefing documents code that EXISTS — verify, pilot, execute; don't rebuild).

## Context

The corpus question "which claims are curvable?" reduces to: **a claim is curvable iff a second dated, citable document about it exists somewhere.** Layer 1 ingests claims and stamps baselines; waves 1–3 complete predictable arcs; the LLM promoter researches openalex. The missing layer was pipelines that ingest **transition events as first-class objects** — overruling tables, refutation lists, repeal notices — and join them to claims we already hold. Born-settled/born-recorded corpora stay honestly flat (`lib/corpus-completeness.ts` stands); these pipelines find their contested/reversed tails from real event feeds.

## Shipped 2026-07-07 (this session — all preflight-by-default, none executed)

### 1. `lib/transition-contract.ts` — the single write path
`emitTransition()` enforces per-row: document-dated `occurredAt`+`datePrecision` (`parseFlexibleDate`: ISO→DAY, YYYY-MM→MONTH, YYYY→YEAR); fetch-verified marker-source URL; chain coherence (fromAxis = terminal axis; one entry row per claim, ever); deterministic id `${claimId}-${toAxis}-${YYYY-MM-DD}`; receipt-grade reason (length-guarded); P2002 on the unique constraint treated as "exists" (idempotent). `amendBaseline()` is the ONE sanctioned mutation of existing rows (wave-2 prepend semantics), gated behind `allowEntryAmend`. Violations are returned, not thrown; dry-run unless `execute: true`. **All future writers route through this** — including LLM enrich scripts (wire into `apply-enrichment.ts` as a follow-up).

### 2. `scripts/audit-chain-integrity.ts` — structural CI
Read-only, SQL-first: each invariant is one server-side aggregate query (window functions), so the full 1.26M-claim corpus audits in seconds-to-a-minute with per-check progress — entry-row count (E1), chain links (C1), pre-emergence rows (D2, warning), orphan sourceIds (S1), degenerate rows (A1), vocabulary (V1). Statements run with SET LOCAL statement_timeout='600s' (house rule). `--pipeline`, `--samples`, `--json`, `--strict`, `--direct`; exit 1 on hard violations. Run after every `--execute` anywhere, and nightly next to loop-dead-links.

### 3. `scripts/check-candidate-dup.ts` + loop gates — dedupe at the root
Root-cause fix for DUPLICATE-TRAJECTORIES-2026-07-06 (265 groups): candidates are checked against the WHOLE curated DB, not one seed file. Signals: pgvector cosine over ClaimEmbedding (needs OPENAI_API_KEY; threshold 0.86) + token-set Jaccard fetched live (0.55, always available). Exit 2 = duplicate. All seven `loop-settling-curve*.sh` prompts now carry a MANDATORY gate: run the check per candidate; exit 2 → SKIP, list under CONSIDERED as 'dup-check'. (Deploy note: loops run from git on the loop machine — pull there.)

### 4. `scripts/event-pipelines/scotus-overrulings.ts`
Feed: Constitution Annotated "Table of Supreme Court Decisions Overruled" (~300 entries, verified live 2026-07-07). Match: reporter citation in Source.name (precise) → case name+year in claim text → residue. Writes SETTLED→REVERSED (full) / SETTLED→CONTESTED ("in part"; `--partial-as REVERSED` to override) @ overruling decision date (DAY from DB/table, else YEAR), community JUDICIAL, marker = the overruling opinion. Non-SETTLED terminals (already-curated claims) go to residue — editorial owns those. Residue JSONL feeds the law loop.

### 5. `scripts/event-pipelines/exoplanet-retractions.ts`
Feed: NASA Exoplanet Archive removed-targets page (verified live; refutations + FPP dispositions + mass reclassifications + reinstated). Existing `exoplanet_<name>` claims get RECORDED→REVERSED @ refutation year (bibcode year, YEAR precision, EXPERT_LITERATURE). Missing claims (ingester only pulls currently-confirmed) are created with the crossref-retraction entry shape (null→REVERSED @ refutation) + an AGAINST edge to the refuting paper, and listed in residue for the astronomy loop to prepend verified announcement rows. Reinstated planets (confirmed→refuted→re-confirmed) go to residue whole — they need both dates.

### 6. `scripts/event-pipelines/nz-repealed-prepend.ts`
Implements briefing 03's nz_repealed prepend AND fixes a bug the briefing missed: **the Layer-1 REVERSED baseline is dated to the ENACTMENT year** (the works API has no repeal date). Phase 1 backfills `metadata.repealedAt/repealedBy` by parsing each act's own legislation.govt.nz page ("Repealed, on 1 April 1988, by …" — regex tested against tag-stripped variants). Phase 2 (transactional, `--allow-entry-amend`): re-date baseline to the repeal date (DAY) + re-point fromAxis→SETTLED + prepend null→SETTLED @ enactment year (YEAR). Guards: strict single-step baseline; repeal date strictly after Jan-1 of enactment year (equal timestamps would tie-break against the older row); skip+count, never guess. → up to 4,372 drawable reversals.

### 7. Retired `loop-trajectory-enricher.sh` → `scripts/_archived-loops/`
It was broken and dangerous: `fromStatus/toStatus` (not schema fields), community `SCIENTIFIC` (not in the enum), no URL verification, sourceId:null writes. Header explains; unload its launchd plist on the loop machine if one exists.

## Runbook (owner executes — scripts never write without flags)

```bash
# 0. Baseline integrity picture (read-only)
npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --json --direct   # full scans need DIRECT_URL; the Neon pooler kills them (P1017)

# 1. SCOTUS — preflight, eyeball matches, pilot, execute, verify
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/scotus-overrulings.ts
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/scotus-overrulings.ts --limit 20 --execute
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/scotus-overrulings.ts --execute
npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline courtlistener_scotus_v1

# 2. Exoplanets — same shape
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/exoplanet-retractions.ts
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/exoplanet-retractions.ts --limit 10 --execute
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/exoplanet-retractions.ts --execute

# 3. NZ — fetch dates (hours: ~4.4k pages @ 300ms), then apply
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts            # preflight
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --execute  # store metadata
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --phase apply
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --phase apply --limit 25 --execute --allow-entry-amend
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --phase apply --execute --allow-entry-amend
npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline nz_repealed_acts_v1

# 4. Dedupe guard smoke test (should print DUPLICATE against an existing curve)
npx dotenv-cli -e .env.local -- npx tsx scripts/check-candidate-dup.ts \
  --text "Christiaan Barnard performed the first human heart transplant in Cape Town in December 1967"
```

## First live audit — 2026-07-07 findings (and the fixer)

The first full-corpus run (1.39M claims / 1.63M transitions, ~17s) found four populations:

- **C1 = 511** inverted retraction curves: `:retraction:0` publication rows dated AT/AFTER the retraction (the CrossRef deposited-date quirk plan-doc §4 predicted). Real bug — renders as nonsense curves.
- **E1 = 93** claims with zero entry rows (first transition authored mid-chain, e.g. OPEN→RECORDED as row 1). Real bug.
- **A1 = 277** SETTLED→SETTLED rows — mostly cross-community re-ratification, which is the product's multi-lane concept, NOT a bug. The check (and the contract's degenerate rule) is now community-aware: only same-axis + same-community flags.
- **D2 = 582** — mostly YEAR-precision rows inside the emergence year (precision artifact). The check is now precision-aware; what remains after re-run are REAL date inversions in curated seeds (e.g. a transition dated 0140 on a claim emerging 0280) — curation queue.

`scripts/fix-audit-findings.ts` repairs the two real populations (preflight default):
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/fix-audit-findings.ts --direct                                        # preflight both
npx dotenv-cli -e .env.local -- npx tsx scripts/fix-audit-findings.ts --fix inverted-retractions --execute --allow-row-delete --direct
npx dotenv-cli -e .env.local -- npx tsx scripts/fix-audit-findings.ts --fix missing-entry --execute --direct
npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --direct --json                              # re-verify
```
Inverted retractions: pub row deleted (full JSON dumped to logs/ first, restorable), REVERSED row reset to the honest single-step baseline, claim ids appended to `logs/inverted-retraction-residue.jsonl` for the promoter's crossref-residue path. Missing-entry: earliest row's fromAxis normalized to null (originals dumped). If E1 stays >0 after the fix, the remainder are MULTI-entry claims — manual review.

## Post-fix state (2026-07-07, second audit) — the remaining tail

E1 = 0 ✓ (93 normalized). 343 inverted retraction curves repaired. Remaining: C1 293, A1 131, D2 437 — three populations, all pre-contract writes:

1. **Mixed-precision sort scrambles (openalex promoter arcs).** A YEAR-precision row (Jan-1 truncation) sorts BEFORE the same year's DAY-precision predecessor, so a logically-ordered RECORDED→CONTESTED→SETTLED arc renders/chains out of order. The durable fix is an ORDERING DECISION (owner's): either render curves by chain-following (topological on fromAxis→toAxis) instead of raw occurredAt, or add an explicit seq column. Do NOT nudge dates to fix sort order — that fabricates precision.
2. **Layer-1 baselines landing mid-chain.** loop-auto-trajectories adds a null→X baseline @ claimEmergedAt to claims whose promoter arc starts before claimEmergedAt → the entry row sorts rn>1. Same ordering decision covers it; also consider Layer-1 skipping claims that already have ANY history (not just entry rows).
3. **Curated-seed authored-date errors (D2 residue) + same-community degenerates (A1).** Real content issues in seed files → curation queue, not scripts.

⚠ **Pause the loops during fix windows.** The second audit caught cuid baselines written BETWEEN the fixer run and the re-verify — the loop machine writes continuously, so fixes/audits race it. launchctl-pause Layer-1 + promoter before running fixers; resume after the clean re-audit.

## Third pass — the rechain fix (2026-07-07)

C1 breakdown after the first two fixes (293 total): openfda_labels 160 (legacy enrichment arcs with sloppy fromAxis pointers), curated seeds 125 (authored order vs date order), openalex/drugsatfda stragglers 8. `--fix rechain` repairs the derivable ones: where a claim's rows have STRICTLY increasing occurredAt, pointers are rewritten to row[n].fromAxis = row[n-1].toAxis (row[0] = null); mid-chain cuid entry rows (live-loop Layer-1 baselines) are removed when deletion leaves a strict order (dump-first, --allow-row-delete). Same-date ties are SKIPPED to logs/rechain-skipped-*.jsonl — those need the ordering-semantics decision (chain-following render vs seq column), not a script.

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/fix-audit-findings.ts --fix rechain --direct                     # preflight
npx dotenv-cli -e .env.local -- npx tsx scripts/fix-audit-findings.ts --fix rechain --execute --allow-row-delete --direct
```

## Automation — `scripts/loop-event-pipelines.sh` (Loop 7)

Once each pipeline has had its one human pilot, the loop makes curve creation fully automatic: weekly pass (SLEEP_HOURS=168) re-runs scotus + exoplanets with --execute (idempotent — unchanged feeds no-op, feed updates land as new curves), audits the touched pipelines against the DB, Telegram-pings on inserts, and alerts RED if any audit fails. NZ joins the rotation via EVENT_LOOP_INCLUDE_NZ=1 after its phase-apply pilot. Install under launchd (KeepAlive=true) on the loop machine like the other loops.

## Constraints (house rules apply; additions)

- Event pipelines write per-row through the contract — never raw INSERTs. Bulk same-shape completions stay in `bulk-promote-corpus.ts`.
- `event:*_v1` is the ingestedBy namespace for pipelines that CREATE claims (exoplanets); pipelines that only append transitions leave claim.ingestedBy untouched and tag their Sources instead.
- Residue files are queues, not trash: `logs/scotus-overrulings-residue.jsonl` → law loop; `logs/exoplanet-retractions-residue.jsonl` → astronomy loop (announcement prepends, reinstated arcs).
- Feed parsers are validated against live pages as of 2026-07-07; if a preflight suddenly parses 0 rows, the page changed — fix the parser, don't loosen guards.
- constitution.congress.gov (Akamai) may 403 scripted fetches. verifyUrl retries with a browser UA; if the feed fetch still 403s, save the page in a browser and pass `--feed-file <path>` (both scotus and exoplanet scripts support it).
- Full-corpus scans (audit-chain-integrity without --pipeline) require `--direct`; pooled Neon connections die mid-scan with P1017.

## Next pipelines (same skeleton, ordered by wow-per-effort)

1. **OFAC delistings** (RECORDED→REVERSED, INSTITUTIONAL) — SDN removal actions.
2. **FDA withdrawals of approval** (SETTLED→REVERSED) — Federal Register notices ↔ drugsatfda_v1.
3. **WHO EML deletions** (SETTLED→REVERSED) — biennial TRS reports.
4. **SEC 8-K Item 4.02 restatements** (RECORDED→REVERSED) — EDGAR full-text ↔ sec_edgar_v1.
5. **EUR-Lex/legislation.gov.uk repeals** (SETTLED→REVERSED) — the two legislation corpora with machine-readable force-status.
6. **Tier-2 identity joins:** DOI resolution openalex_v1 ↔ crossref_retractions_v1 (both halves of thousands of arcs may already be in the DB); NCT→approval joins clinicaltrials_v1 ↔ drugsatfda_v1 (cross-community arcs).

## Verification

- `npx tsc -p tsconfig.scripts.json --noEmit` — new files clean (pre-existing errors in older scripts are out of scope).
- Pure parsers unit-tested offline: parseFlexibleDate (valid/invalid dates, precisions), NZ repeal extraction (spacing/paren variants), exoplanet name expansion ("HW Vir b & c" etc.), SCOTUS fragment parsing (slip dates, citations, "in part").
- `bash -n` clean on all seven patched loops; enricher archived with explanation header.
- After each --execute: preflight counts ≈ executed counts ≈ audit-chain-integrity clean on the touched pipeline; spot-check 5 curves on /settling-curve?t=<claimId>.
