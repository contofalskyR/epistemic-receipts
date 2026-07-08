# Briefing 10 — Session Handoff (updated 2026-07-08, late)

## THE MISSION (why any of this matters)

Robert is preparing epistemic-receipts for public launch. The settling curve —
a claim's dated, citable trajectory across epistemic status (SETTLED →
REVERSED etc.) — is the site's single most unique feature. The project:
**make every claim with a recoverable date an openable settling curve, even at
length 1; count the truly undatable remainder as honest, documented residue
(dates are never invented).** Everything below serves that. The threads are
not cleanup chores — they are the remaining build steps: NZ turns 4,372 flat
baselines into real reversal arcs; NARA converts ~165k dateless claims into
curves; the queue hardens it all for launch. 10,271 curves shipped so far.

You are picking up mid-project. Everything below EXISTS — verify, don't rebuild.
Read `AGENTS.md` (house rules), briefings `08` + `09` for depth, plus
`ORDERING-SEMANTICS-2026-07-08.md` (decided AND built 2026-07-08). This file
is the current thread.

## Working relationship (non-negotiable)

- Robert is not a developer. You write everything; he runs commands in his
  terminal and pastes output back. Give one command at a time, no inline `#`
  comments (zsh eats them), no placeholders he must edit. If the session has
  folder access, prefer `2>&1 | tee logs/<name>.log` and read the file
  yourself instead of asking for pastes.
- Every script: preflight/dry-run by default, writes gated behind `--execute`.
- Never fabricate dates — skip + count as residue. Precision: ISO→DAY,
  YYYY-MM→MONTH, YYYY→YEAR.
- Verify results against the DB, not logs. Long Neon scans need `--direct`
  (pooler kills them, P1017).
- All transition writes go through `lib/transition-contract.ts`
  (emitTransition / amendBaseline / renumberClaimSeq — contract §6: every
  insert assigns seq in the insert transaction). Run
  `scripts/audit-chain-integrity.ts` after every `--execute`. Records are
  retired via verificationStatus, never deleted. Secrets never in chat.
- CI's migration-drift step is allowlist-based and intentionally strict — do
  NOT "fix" it by touching prisma.config.ts or applied migrations. New
  additive migrations committed in lockstep with schema.prisma pass untouched.

## Thread 1 — NZ repeal dates (phase-1 RUNNING, phase-2 next)

Probe verdict (probe 1 pasted in session, probe 2 → `logs/nz-probe2.log`):
**path (b)**. No repeal-date field anywhere in the API JSON, BUT
www.legislation.govt.nz serves full pages when the request carries `X-Api-Key`
+ probe UA/Accept — keyless scripted fetches get **HTTP 202 / 0 bytes** (202
passes res.ok; that's how the old run misread the wall as noPattern 100/100).
Official XML carries `date.terminated` but 404s for old acts — HTML+regex is
the path. Phase-1 of `scripts/event-pipelines/nz-repealed-prepend.ts` is
patched: working headers, key guard, emptyBody counter, 30s timeout,
`--offset`, noPattern decade histogram + sample URLs. Extraction regex moved
to `lib/nz-repeal.ts` (shared with probes, unit-tested; handles "repealed, on
the close of …"). **Pre-consolidation acts (~pre-1909) carry NO dated repeal
note on their pages** (probe 2 proved "Repealed, on" appears nowhere in the
stripped text) — honest noPattern residue. Preflights: first 100 (oldest) =
0/100 found as expected; modern tail (`--offset 4272`) = **99/100 found**, DAY
precision, clean by-clauses.

RUNNING at handoff: full phase-1 via nohup (PID 44388) →
`logs/nz-phase1-run.log`, progress every 250. When its summary prints:

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --phase apply
npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/nz-repealed-prepend.ts --phase apply --limit 25 --execute --allow-entry-amend
```
eyeball 5 curves on /settling-curve → full apply → audit
`--pipeline nz_repealed_acts_v1`. NOTE: the phase-2 pilot is ALSO the live
pilot of prepend-aware seq renumbering — verify seq=1 (entry) / seq=2
(baseline) on amended claims while eyeballing.

## Thread 2 — NARA bulk sweep (~finished at handoff)

`backfill-nara-dates-bulk.ts` nohup. Last seen: file 320/399, dated
**159,550**, only 88 left — check `logs/nara-bulk-run.log` for the final
summary, then THE HARVEST (briefing 09 §1): ingest-auto-trajectories
`--pipeline nara_catalog_v1` dry-run → real → re-census → audit. **NEW STEP:
after the harvest, re-run `scripts/backfill-transition-seq.ts --direct
--execute`** — Layer-1 writes baselines outside the contract, so harvest rows
land unstamped (legal; pass A stamps them in one statement, script is
resumable). Then swap the one sentence in `app/methodology/page.tsx` for the
final residue number. Optional first: reason wording "catalogued"→"produced".

## Thread 3 — seq / ordering semantics (BUILT 2026-07-08, backfill RUNNING)

Decision: **Option B approved with Robert's amendments** (prepend-aware
renumbering in-transaction — never max+1; unique (claimId, seq); pointer
chains beat lying dates; branching, not circularity, is what kills Option A).
Full rationale + amendments recorded in `ORDERING-SEMANTICS-2026-07-08.md`.
Built, typechecked (app 0 errors; scripts 0 new vs 92 pre-existing), renumber
+ walk unit-tested 9/9:

- Migration `20260708150000_add_transition_seq` — **applied to prod** via
  migrate deploy; prisma generate done.
- `lib/transition-contract.ts` — contract §6; `renumberClaimSeq` exported
  (entry-first, stamped order preserved, NULL-phase collision safety).
- `scripts/backfill-transition-seq.ts` — passes A (single-row, SQL), B
  (date-strict+coherent, SQL), C (pointer walk, app; batched VALUES fast
  path). Preflight: A=1,169,717 rows · B=28,962 claims/58,824 rows ·
  C=205,875 claims, walk resolved all but **3** (orphan-break) →
  `logs/seq-backfill-residue.jsonl` → curation. RUNNING at handoff via nohup
  (PID 45632) → `logs/seq-backfill-run.log` (~20-30 min).
- `scripts/audit-chain-integrity.ts` — C1/A1 windows order by seq NULLS LAST;
  new **C2** check (partial/non-contiguous stamps). Run `--direct` after the
  backfill; C2 must be green before anything else writes.
- Consumers swapped to seq-first (date fallback, NULLS LAST): trajectory-detail
  (+seq in payload/type), api/trajectories (now trusts DB order — its date
  re-sort was undoing the fix), api/trajectories/[id] (+seq in payload),
  search, labs/claim-diff, v1/trajectories, v1/verify (desc), claim-detail
  (+seq), claims/[id] timeline, SettlingCurve `chainOrder` (x-positions still
  date-based; visible back-loops on coarse dates are honest and expected).
- `scripts/fix-audit-findings.ts` rechain is seq-aware: fully-stamped claims
  rewrite pointers FROM seq (the old 5 tie-skips now resolve); renumbers after
  mid-chain deletes.

## Queue after those (in order)

1. Post-backfill audit `--direct` — C2 green + full board.
2. rechain fix — PAUSE loop-auto-trajectories on the loop machine first, then
   `fix-audit-findings.ts --fix rechain --execute --allow-row-delete --direct`.
3. Curated dedupe (launch gate, deliberately deferred):
   `find-duplicate-trajectories.ts` list → Robert picks KEEPs → `--deprecate`.
4. Loop machine: `git pull` (gets ALL of 2026-07-08's work); install
   `scripts/loop-event-pipelines.sh` under launchd; unload archived enricher
   plist; set `EVENT_LOOP_INCLUDE_NZ=1` only after the NZ pilot is green.
5. Wire Layer-1 (ingest-auto-trajectories) + apply-enrichment into the
   contract so their rows get seq at write time; until then re-run the seq
   backfill after each harvest.
6. Optional display decision (owner's call, separate from seq): render
   YEAR-precision dots at year-center with a year-wide whisker instead of
   Jan-1. A visualization convention, not date nudging.
7. Curation queues: 3 seq orphan-breaks, A1=131 same-community rows, D2=437
   authored-date warnings, SCOTUS residue 276, exoplanet residue, NZ pre-1909
   noPattern remainder → law/astronomy loops.
8. Pre-launch stragglers: dead robertcontofalsky.com footer link, /corrections
   real form, whitepaper-cited claims curation, prod smoke tour.

## State

- Everything-a-curve total: **10,271 curves** (mesh 10,000 + pdg 226 + uk 43 +
  chebi 2 pending rescan) + SCOTUS 11 reversal arcs + 75 exoplanet
  retractions. NARA ~159.5k dated pending harvest; NZ up to ~4.4k reversal
  re-dates pending phase-2.
- Residue ledger (methodology page): chebi 36,591; jacar ~31k; rxnorm ~15k;
  ofac ~10k; omim ~1.5k; + NZ pre-1909 remainder (count lands in phase-1
  summary); + 3 seq orphan-breaks; NARA remainder pending final summary.
- UI shipped: /settling-curve landing card grid, one-dot dormant curves,
  search surfaces curves, provenance chips + flag links, Reversals showcase,
  methodology "Where dates come from".
- Background jobs at handoff: NZ phase-1 (PID 44388), seq backfill (PID
  45632) — both nohup'd, logs in `logs/`.
