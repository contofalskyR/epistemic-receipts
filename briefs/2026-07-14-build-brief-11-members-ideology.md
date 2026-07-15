# Build Brief #11 — Members & ideology: finishing the Voteview layer (post-launch growth track)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-14)
**Lane:** votes/data+UI. **Timing: post-launch.** Contains owner-gated data writes in V-3/V-4; everything else read-only.

**What's already true (don't rebuild it):** `/votes` browses all 113,319 Voteview roll-calls; `/members` has 12,000+ members with `[memberId]` pages; `congress_votes_v1` has full `byPartyJson` on its 505 votes; EU member-level votes are complete (1.35M rows). **The gaps:** zero `MemberVote` rows on `voteview_v1` (documented in CONSULTANT — the Voteview CSV doesn't carry member-level data; backfill needs House Clerk + senate.gov XML), and DW-NOMINATE ideology scores are unsurfaced. This brief closes the gaps in receipt-value order — NOT with a 113k-vote backfill.

**The governing rule (AGENTS.md):** receipt value must exceed audit cost per record. 113,319 XML fetches for votes almost nobody will open fails that test today. ~500–1,500 landmark votes passes it easily.

---

## 0. Gate + orientation

1. **Gate:** public launch complete (this is traffic-facing growth work; it should land on a live site). Sync main; orientation protocol.
2. Read: CONSULTANT.md entries on voteview (the 113k browseability entry, the Bug-6 member-level gap diagnosis), `scripts/ingest-voteview.ts`, `scripts/enrich-member-votes.ts` (and its documented Congress.gov-404 issue in ROADMAP.md), `app/members/[memberId]/`, `app/votes/[id]/`, ROADMAP.md "Long-horizon: Layer 2/3" + "Voting statistics to compute".
3. Standing rails: branch `loop/votes-b11-<date>`, `B11-n:` commits, push + PR, owner merges. All transition-type writes via existing contracts; enrichment writes dry-run by default behind `--execute`; deterministic ids; DB-verified counts; bind-parameterized SQL. Blocked beats invented.

## Phases

### B11-1 — Census (read-only; the brief's premises get verified here)

- What does `/members/[memberId]` render today, from which tables?
- **DW-NOMINATE:** does `ingest-voteview.ts` already capture `nominate_dim1/dim2` (it references nominate — check what lands in the DB: Claim/Source metadata? A column? Nothing?). Count rows carrying scores.
- `MemberVote` coverage by pipeline (expect: congress_votes_v1 505, howtheyvote_eu 1,900, voteview_v1 0 — verify).
- Define the **landmark subset** with a query, not taste: close-call votes (<5% margin, ~84 known), votes linked to `/historical-events` (52,034 vote links → distinct rollcalls), votes cited by curated trajectories/case studies, veto overrides & cloture-at-threshold from the ROADMAP stats list. Report the deduped subset size (expected order: 500–1,500).

### B11-2 — DW-NOMINATE surfacing

**If the census finds scores in the DB:** pure UI — ideology placement on member pages (dim1 economic axis, with era context), a caucus scatter/distribution view per Congress on `/analysis` (reuse dataviz conventions from existing analysis pages), and score display in the members table. Every chart labels its source ("DW-NOMINATE via Voteview") and its coverage denominator.
**If not stored:** STOP after writing a one-page ingest addendum (Voteview's member-ideology CSV is a single reference-tier download; deterministic ids; dry-run→pilot→yes→execute→audit) — owner approves before any ingest runs. Do not proceed to V-3 on an unapproved ingest.

### B11-3 — Member-vote backfill, landmark subset ONLY (owner-gated writes)

- First fix `enrich-member-votes.ts`'s Congress.gov/Clerk URL issue (the documented 404s) — probe current endpoints, fix parsing, `--dry-run` default.
- Pilot 25 landmark rollcalls → verify MemberVote rows against the live XML word-for-word (5 spot-checks) → CHECKPOINT memo (subset size, per-vote fetch cost, failure/residue policy: unfetchable rollcall = skipped and counted, never inferred) → **owner yes** → run the landmark subset → DB-verified counts + residue log.
- The full-113k decision is explicitly NOT this brief's: end V-3 with a half-page cost/value memo for the owner (fetch count, runtime, storage, what it unlocks) and stop.

### B11-4 — Member profile analytics (from data that now exists)

On `[memberId]` pages: party-unity %, attendance, and notable-votes timeline — computed ONLY over rollcalls that have member-level rows, with the denominator printed on the stat ("across the 1,240 landmark roll-calls with member-level records"). No stat ever silently extrapolates from the 505+landmark subset to a career. Flip-flop detection (same member, same bill family, opposite votes) ships only if the query yields real cases in the covered subset — count first, render second. Link members ↔ votes ↔ historical events where junctions exist.

### B11-5 — Verification

tsc/ESLint/vitest green; 5 member pages spot-checked against source XML; every rendered percentage recomputed by an independent query in the report; coverage denominators visible on every stat in view-source; Vercel preview green.

## Report

`briefs/b11-report.md`: census results (especially the NOMINATE answer and the landmark-subset size), what shipped per phase, the spot-check table, the full-corpus cost/value memo, residue log.

## STOP conditions

Census contradicting a premise (report, don't improvise); any write without its checkpoint-yes; the enrichment script wanting fuzzy member matching (exact bioguide/ICPSR joins only — a wrong vote attributed to a real person is this site's worst failure mode); scope pressure toward the 113k backfill; two consecutive failures on one criterion. Blocked beats invented.
