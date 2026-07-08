# Briefing 10 — Handoff back to the main agent (2026-07-08, session close)

Written by the Cowork session that picked up your morning handoff. All three of
your threads are CLOSED and launch prep advanced well past the plan. Everything
below EXISTS and is committed + pushed (through `nav: Corrections desc…`) —
verify, don't rebuild. Robert ran every command; all writes were preflighted,
audited, and verified against the DB.

## THE MISSION (unchanged, kept verbatim)

Robert is preparing epistemic-receipts for public launch. The settling curve —
a claim's dated, citable trajectory across epistemic status — is the site's
single most unique feature. Make every claim with a recoverable date an
openable settling curve, even at length 1; count the truly undatable remainder
as honest, documented residue. Dates are never invented.

## Corpus state (verified against DB, end of session)

- **~177k settling curves** (was 10,271 this morning): +166,647 NARA, +442 NZ
  reversal arcs, prior 10,271 + SCOTUS 11 + exoplanets 75.
- Full-corpus audit: **E1 0 · C2 0 · S1 0 · V1 0**; C1 = 5 rows on 3 seed
  claims; A1 = 143 seed rows; D2 = 270 warnings. Scope 1,571,180 claims /
  1,807,374 transitions. Zero script-fixable violations remain — everything
  left is editorial.
- Homepage stat band now shows **Settling curves** (live count, replaced
  Democracy indicators; V-Dem keeps its domain tile).

## Thread 1 — NZ repeal dates: CLOSED ✅

- Probe verdict = path (b), with a twist: www.legislation.govt.nz serves FULL
  pages iff the request carries `X-Api-Key` + UA/Accept; keyless scripted
  fetches get **HTTP 202 / 0 bytes** (202 passes `res.ok` — that's how the old
  run misread the wall as noPattern). Official XML has `date.terminated` but
  404s on old acts; HTML+regex is the path. Receipts: `logs/nz-probe2.log`.
- **Pre-1909 acts carry NO dated repeal note on their pages at all** (probe 2
  proved "Repealed, on" absent from stripped text) → honest residue.
- Phase-1 patched (headers, key guard, emptyBody counter, 30s timeout,
  `--offset`, noPattern decade histogram). Extraction lives in
  `lib/nz-repeal.ts` (shared with probes, unit-tested, handles "the close of"
  variant). Full run: **442 found / 3,923 noPattern / 7 fetchFailed**.
- Phase-2 applied **all 442 arcs** (pilot 24 @ offset 4347 + full 418; the 24
  correctly re-skipped as notSingleStepBaseline on the full pass). Pipeline
  audit fully green: 4,814 transitions = 4,372 + 442 exactly.
- `EVENT_LOOP_INCLUDE_NZ=1` is now sanctioned — the pilot was green. The 7
  fetchFailed are transient; phase-1 is resumable, loop reruns will catch them.

## Thread 2 — NARA: CLOSED ✅

- Sweep final: 3.98M records scanned, **248,439 matched / 160,595 dated /
  91,788 no-date residue** (91,788 verified against DB, stamped).
- Harvest minted **166,647 curves** (ran twice — idempotent, second pass
  Added 0 as designed). Census: total curve-less now **186,581**.
- Methodology "refusal ledger" updated with the final numbers. Optional
  "catalogued"→"produced" wording never done — still available.

## Thread 3 (new) — ordering semantics: DECIDED + BUILT + LIVE ✅

Robert approved **Option B** with two amendments (see
`ORDERING-SEMANTICS-2026-07-08.md`, updated for the record): (1) prepend-aware
renumbering of the whole claim in the insert transaction — a bare max+1 is
unacceptable (NZ phase-2 prepends); (2) `@@unique([claimId, seq])`, assigned
inside the insert transaction. Plus his correction: the killer for Option A is
**branching** (cross-community rows sharing a fromAxis — no single pointer
order), not the circularity I'd argued.

- Migration `20260708150000_add_transition_seq` — **applied to prod**; drift
  gate untouched (schema + migration in lockstep).
- `lib/transition-contract.ts` contract §6: every insert assigns seq
  in-transaction; entry prepends renumber (NULL-phase → finals; NULLs distinct
  under the unique index so shifts never collide). `renumberClaimSeq` exported
  (entry-first, **existing stamps are the order authority**, unstamped rows
  fall back to date order). If callers pass a bare client, emitTransition
  wraps insert+renumber in its own transaction; a passed tx is used as-is.
  amendBaseline deliberately does NOT renumber (the prepend that follows does).
- `scripts/backfill-transition-seq.ts` EXECUTED: pass A 1,169,717 single-row
  claims (one SQL statement); pass B 28,962 date-strict coherent claims; pass C
  pointer-walked 205,875 date-tied claims and resolved **all but 3**
  (orphan-break) — pointer chains beat lying dates, per Robert. Residue:
  `logs/seq-backfill-residue.jsonl` (9 rows total). Batched-VALUES fast path
  for fully-unstamped claims. Resumable; re-run cost ≈ minutes.
- `scripts/audit-chain-integrity.ts`: C1/A1 windows order by `seq NULLS LAST`;
  new **C2** check (partial/non-contiguous stamps). C2 = 0 corpus-wide, held
  through 442 live prepend renumbers.
- Consumers swapped to seq-first (date fallback): trajectory-detail (+seq in
  type/payload), api/trajectories (in-memory date re-sort REMOVED — it undid
  the fix), api/trajectories/[id] (+seq), search, labs/claim-diff,
  v1/trajectories, v1/verify (desc nulls-last), claim-detail (+seq),
  claims/[id] timeline, SettlingCurve `chainOrder` (ORDER by seq; X-POSITIONS
  still by date — visible back-loops on coarse dates are honest and intended).
- `fix-audit-findings.ts` rechain is seq-aware: fully-stamped claims rewrite
  pointers FROM seq; renumbers after mid-chain deletes. **Preflight confirmed
  0 fixable remain** — the rechain queue item is closed; the old 5 tie-skips
  are now: 2 healed by seq order, 3 = the curation trio below.

⚠ **For you on the loop machine:** `git pull` gets all of this. Layer-1
(ingest-auto-trajectories) and apply-enrichment still write OUTSIDE the
contract → their new rows land seq-unstamped (legal; C2 ignores fully-unstamped
claims). Until you wire them into emitTransition, **re-run
backfill-transition-seq after each harvest** (pass A catches baselines in one
statement). Do NOT write raw max+1 seqs anywhere.

## Launch prep (same session, Robert-driven smoke tour)

- **/corrections public form** (`app/corrections/CorrectionForm.tsx`): rides
  the existing /api/feedback (rate-limited, 300-char cap, DB-stored,
  Telegram-notified); flag links prefill claim/transition/date via query
  params. ⚠ `TELEGRAM_BOT_TOKEN` on Vercel is STALE — Robert is swapping it
  (env var + redeploy + must /start the bot); submissions store regardless.
- **Score column removed** from the claims evidence table (owner call during
  tour): weights stay in DB + per-edge revision log; explainer paragraph
  replaced. Resolves the P0 "score legend" item by deletion.
- **SettlingCurve title fix** (tour finding): detail header preferred the
  LIST's 157-char-truncated text over the detail payload's full text — full
  text now wins; >180-char titles collapse with a SHOW FULL affordance
  (click/Enter toggles, resets on curve switch).
- **/sources**: `unmapped` (raw internal tags) omitted from the production
  payload in `app/api/sources-summary/route.ts` (mirrors /pipelines dev-only
  rule).
- **PUBLISH-CHECKLIST.md trued up**: every mechanical P0 is [x] with dates
  (edit-gate//edges//labs/tag-dumps/string-strip were already done in
  middleware `ADMIN_PATHS` by a prior session — boxes were stale); P1
  nav items (corrections in Discover, meta-edges named) also [x].
- Nav desc for Corrections now mentions the flag form.

## What remains (short, mostly Robert)

1. **Whitepaper-cited claims curation** (P0, blocks paper circulation):
   `claims/cmqwoxe6l07dy8o0y6xrs8xnv` (Surgeon General 1964) +
   `claims/cmqoappnu03yxsadpa90nu942` (Müller 1939 — re-verify footnote
   targets). Need real curated curves + review. ~an hour with Robert.
2. **Headline-count decision** (Robert): 1.62M classified-only vs 1.76M
   including verificationStatus=NULL. One sentence, then fix filters + copy.
3. **Curation queues**: the trio (alphago-defeats-lee-sedol-2016,
   pluto-reclassified-dwarf-planet-2006, smiling-buddha-pokhran-i-1974 —
   self-contradicting seed pointers, same 3 as seq residue); A1 143 rows;
   D2 270 warnings; duplicates list (command ready, never run:
   `find-duplicate-trajectories.ts` → Robert picks KEEPs → `--deprecate`).
4. **Loop machine** (you): pull; install `loop-event-pipelines.sh`; unload the
   archived enricher plist; set `EVENT_LOOP_INCLUDE_NZ=1`; adopt the
   backfill-after-harvest rule; longer-term wire Layer-1 + enrichment into the
   contract.
5. Telegram token swap + one re-test flag (Robert, in flight).
6. Optional/queued: NARA reason wording "catalogued"→"produced"; YEAR-dot
   render convention (year-center + whisker — display decision, not data);
   registering major pipelines in the registry; P1 briefings 04/05; P2 polish.

## Logs of record (all in `logs/`)

nz-probe2 · nz-phase1-preflight(-tail) · nz-phase1-run · nz-phase2-preflight ·
nz-phase2-pilot · nz-phase2-apply · audit-nz-final · nara-bulk-run ·
nara-harvest(-dryrun) · seq-backfill-preflight · seq-backfill-run(-rerun) ·
seq-backfill-residue.jsonl · audit-post-seq · audit-post-nara ·
rechain-preflight · chain-integrity-2026-07-08.json · dup list pending.

## Working-relationship notes (additions that helped)

- `2>&1 | tee logs/<name>.log` on every command; the session reads the file —
  Robert just says "done". He does not track checklists; send ONE command at a
  time with plain-language framing of what it does and what to expect.
- When his screenshots disagree with your expectations, believe the
  screenshots and go read the render path — both tour bugs (stuck title,
  stale stat framing) were real.
