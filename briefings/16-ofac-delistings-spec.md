# Briefing 16 — OFAC delistings pipeline (advisor spec)

*Written 2026-07-09 by the Opus advisor, lifting the HOLD on the OFAC task. This
is the spec briefing 13's Phase-E-adjacent work and the redirect ("next pipeline
= OFAC delistings, hold for a spec") were waiting on. Executable in one Cowork/
Claude-Code session on the Mac; the advisor protocol (briefing 13) applies —
STOP at the checkpoints below and bring the memo back before proceeding.*

## Why this one

problem-solve.md's steer is "concentrate curves where knowledge status genuinely
MOVES." An OFAC listing is an institutional fact that gets **reversed** when the
entity is delisted — a clean RECORDED→REVERSED arc, and the second half (the
removal) is a dated, sourced government action. The substrate is already in the
corpus: `ofac_sdn_v1` (via `scripts/ingest-ofac-sdn.ts`) holds the SDN listings.
Briefing 08 already fixed the semantics: **OFAC delistings = RECORDED→REVERSED,
community INSTITUTIONAL**. This pipeline appends the reversal arc to the listings
we already hold — no claim creation.

It's also *frictionless* in the sense the redirect wanted after Phase A's
oncology-abstract slog: sanctions notices are short, structured, and English —
no abstract bodies to reason over.

## The gating problem — PROBE THE FEED FIRST (NZ-style), before building anything

The hard part is not the join; it's getting a **dated delisting event** per
entity. The current SDN list is a *snapshot* — it tells you who is listed *now*,
with no removal history. So a delisting is an absence between two snapshots, and
an absence carries no date. Per house rules, **dates are never invented** — a
delisting with no recoverable action date is honest residue, not a guessed arc.

So the first deliverable is a **feed probe**, exactly like the NZ repeal-date
probe (briefings 10 §Thread-1). Candidate sources, in preference order:

1. **OFAC "Recent Actions"** (`ofac.treasury.gov/recent-actions`) — OFAC posts
   dated notices, including removals ("The following … have been removed from the
   SDN List"). These carry the action **date** and the affected names/UIDs. This
   is the ideal feed if it's fetchable and parseable (check for a bot-wall the
   NZ way — try with a normal UA/Accept; note status codes and empty bodies).
2. **OFAC SDN archive / dated list files** — Treasury publishes dated SDN list
   files; diffing consecutive dated snapshots yields removals *bounded* by the
   two snapshot dates (precision = the gap; record honestly, e.g. MONTH if
   monthly). Wayback-CDX over the SDN list is the fallback enumerator (the NATO
   pipeline used this pattern).
3. **A published delistings dataset** with citable action dates (e.g. an
   academic/registry compilation) — only if it traces to a fetchable OFAC record
   per entry (AGENTS.md: curated lists need a verifiable external source; the
   USPTO lesson).

**→ CHECKPOINT (probe): STOP and memo before building the pipeline.** Report:
which feed is fetchable, whether removals are dated and to what precision, a
count of datable delistings found in a bounded sample, and 5 sample
{entity, delisting date, precision, source URL} rows. If no feed yields dated
removals, the memo says so and the pipeline does not get built (the delistings
become documented residue, like the pre-1909 NZ acts). Receipts to `logs/`.

## The pipeline (build only after the probe verdict is "datable")

`scripts/event-pipelines/ofac-delistings.ts`, on the scotus-overrulings template
(the canonical event-pipeline). Reuse `lib/transition-contract.ts`
(`emitTransition`; seq auto-assigned — never touch it) and run
`scripts/audit-chain-integrity.ts --pipeline ofac_sdn_v1` after every `--execute`.

1. **Match** each dated delisting action to its existing `ofac_sdn_v1` claim.
   Prefer the OFAC **UID** (the SDN entry's stable id) if the ingest stored it in
   `metadata`; fall back to normalized entity name (exact-first, then
   conservative fuzzy with **skip+count** — never a loose match). Census the
   match rate first (read-only, `--direct`).
   **→ CHECKPOINT 2 (match rate): memo if the match rate is materially low**
   (e.g. <70% of datable delistings find their listing claim) — rate, 5
   unmatched samples, hypotheses (name-format drift, UID absent from metadata,
   entity type mismatch).
2. **Emit** the transition on the matched claim:
   - `fromAxis: "RECORDED" → toAxis: "REVERSED"` (briefing 08; the SDN listing
     is a RECORDED institutional fact, the delisting reverses it),
   - `community: "INSTITUTIONAL"`,
   - `occurredAt` = the delisting action date at its honest precision,
   - marker source = the Recent Actions notice (or the dated SDN snapshot pair),
   - reason = receipt-grade (who was delisted, the action date, the program).
   **→ CHECKPOINT 1 (first --execute): memo before the first write** —
   preflight counts, 5 sample planned writes, anomalies.
   Note: a handful of SDN entries are listed→delisted→**re-listed**. If the
   feed exposes re-listings, that's a further REVERSED→RECORDED arc — but do
   NOT infer it from snapshot presence; only emit it from a dated re-listing
   notice. If ambiguous, **→ CHECKPOINT (axis): memo the options** (briefing 13
   checkpoint #3) rather than guess.
3. **Guards** (same as every event pipeline): skip+count claims with an existing
   conflicting terminal; idempotent deterministic ids (the contract does this);
   no claim creation — append only; unmatched or undatable delistings →
   `logs/ofac-delistings-residue.jsonl` (listed, never guessed).
4. Preflight → CHECKPOINT 1 memo → pilot `--limit 25 --execute` → Robert
   eyeballs 5 curves → full `--execute` → audit `--pipeline ofac_sdn_v1` →
   update census/methodology from **derived** numbers only (never hand-write).

## Definition of done

Probe verdict memo'd · preflight counts ≈ executed counts ≈ audit green on
`ofac_sdn_v1` (paste all three) · 5 curves eyeballed by Robert · residue JSONL
written · logs in `logs/` · one commit (`curves ofac: <summary>`) · a 5-line
addendum appended to THIS file recording counts + residue so the next session
inherits state.

## Out of scope

Re-listing arcs beyond what a dated notice supports; any non-OFAC sanctions body
(EU/UN consolidated lists are their own feed probes, later); linking OFAC claims
to other pipelines (that's editorial CITES work, not this ingester — AGENTS.md).

## Non-negotiables (inherited)

Dates never invented (an undatable delisting is residue). No loose fuzzy matches
(skip+count). No writes outside the contract. The classifier/state-machine and
seq assignment are untouched. Verify counts against the DB, never the logs.

## Addendum — EXECUTED 2026-07-10 (Fable 5 session; all gates passed)

- Probe DATABLE → built `scripts/event-pipelines/ofac-delistings.ts` + fail-closed
  weekly cron wrapper `scripts/cron/ofac-delistings-weekly.sh` (NOT yet scheduled —
  enabling it is Robert's call). Final preflight: 5 notices ≥ snapshot 2026-06-04,
  37 deletion entries, match 37/37 = 100%, planned 16.
- Executed 16 inserts (pilot 8 + full 8), derived from DB: audit scope went
  8,973 claims / 8,973 transitions → **8,989 transitions**; audit green twice
  (E1/C1/C2/D2/S1/A1/V1 = 0, 0 warnings). Curves eyeballed by Robert
  (MALTSEV cmq006f330x35..., ARSHINOV cmq00e2yd12t1... screenshots).
- Residue: 11 matched-but-baselineless entities (dateless claims — census
  `scripts/_census-ofac-baselines.ts`: **10,061 ofac_sdn_v1 claims have zero
  history rows**; Layer-1 skips claimEmergedAt=null). Follow-up candidate, probe
  first: OFAC Recent Actions ADDITION notices (2001→) could date designations at
  scale — would baseline much of the 10k and unlock these 11 arcs. Residue JSONL
  is per-run (latest run overwrites; canonical snapshots live in the checkpoint
  memos `logs/ofac-delistings-checkpoint{1,2}-2026-07-10.md`).
- Commits: `a60338d` build+cron · `01c3662`/`d17ae13` parser (Cyrillic + nested
  parens, vessels; two preflight iterations under CHECKPOINT 2) · `ff58623`
  census · `c9db2d6` re-run idempotency (terminal-REVERSED flows to the
  contract's exists/conflict logic — cron re-runs are clean).
- Side find: axis-leak site #5 — `/claims/[id]` page + `lib/jsonld.ts` read raw
  `epistemicAxis` (chip said "Settled" on freshly reversed claims). Fixed via
  `resolveDisplayAxis` same day (page badge, metadata label, share text, child
  badges, JSON-LD description).
