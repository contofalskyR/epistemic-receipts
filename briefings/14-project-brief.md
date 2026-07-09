# Briefing 14 — What this project is, what we're building now, and the journalism angle

*Orientation for another Claude agent picking this up cold. You have repo
access; this points you at the authoritative docs but is self-contained enough
to convey the whole picture without reading all 13 prior briefings first.
Everything below is verified against the repo/DB as of 2026-07-09, not taken on
faith from a handoff.*

---

## 1. What the project IS

**Epistemic Receipts** is a research **observatory**, not a lookup tool. The
distinction is the whole thesis (full version: `problem-solve.md`):

- Google answers *"what is true."* Wikipedia answers *"what happened."*
- Epistemic Receipts answers *"how did we come to believe it, how long did it
  hold, and what does that look like across a million claims"* — and
  concentrates that answer where belief actually moves.

The atomic unit is the **settling curve**: a single claim's dated, sourced
trajectory across epistemic status over time (e.g. a paper goes
`RECORDED → REVERSED` when it's retracted; a law `SETTLED → REVERSED` when
repealed; a precedent overturned). Every status change carries a dated marker
document — **dates are never invented**; claims with no recoverable date are
counted as honest, documented **refusals**, not faked curves.

**Corpus state (verified):** ~1,757,761 claims total = ~1,571,180 curves +
~186,581 documented refusals (the split sums exactly — that discipline is a
feature, "the refusal ledger"). Most curves are length-1; the high-value subset
is the multi-point **reversal arcs**, which is exactly what we're expanding now.

**The product is the "revelation layer," and it's deliberately thin.** The
1.76M claims are substrate (like Our World in Data's datasets); the *product* is
the handful of pages that ask aggregate questions the substrate can now answer:
"the half-life of a scientific consensus," "every reversal of settled US law on
one page," "the year in unraveling." Roughly five such pages exist where there
could be thirty. **The roadmap is more questions asked of the claims we already
have, not more claims.**

**Domain steer (Robert, on record):** concentrate curve-building where knowledge
status genuinely moves — **law/courts, legislation, science (OpenAlex ↔
retractions), medicine/RCTs, and journalism-facing contested claims.** The
born-static reference bulk (NARA archival catalogs, chemical/medical ontologies)
keeps its role as scale/substrate but stops receiving effort and stops leading
demos. It's a re-aim, not a deprecation.

Status: **preparing for public launch.** The corpus is done; launch work is the
revelation pages, demo curation, and the marketing sequence in
`marketing/launch-research-report.md`.

## 2. What we're building RIGHT NOW — Phase A curve expansion

The active build is **briefing 13** (`briefings/13-curve-expansion-executor-brief.md`):
turning reversal arcs that already sit latent in the corpus into settling curves,
through the existing machinery (`lib/transition-contract.ts` —
`emitTransition`/`amendBaseline`; `seq` auto-assigned, never touched;
`scripts/audit-chain-integrity.ts` after every write). No new architecture.

**Phase A = the OpenAlex ↔ CrossRef retraction DOI join** — the highest-value
pipeline on the board. Both datasets are already in the DB: `openalex_v1`
(~318,769 paper claims) and `crossref_retractions_v1` (~26,624 retraction
records). Where DOIs match, an OpenAlex paper claim gains its reversal arc from
a retraction record we already hold — no external fetch for the join itself.

**Current state (as of this session — CHECKPOINT 1 passed, cleared to scale):**
- DOI join = **11,319 matched pairs.** Full-population preflight reconciles
  *exactly*: `planned 5,525 + alreadyReversedMatch 3,190 + conflictingDate 2,522
  + skipped 74 + noiseBeforeEmergence 8 = 11,319`, zero unexplained rows.
  (`sameDate 992` is a tag on planned rows, not a separate bucket.)
- **Axis semantics (advisor-approved):** `RECORDED → REVERSED` where the claim's
  terminal is RECORDED; OpenAlex claims are never SETTLED (full-population
  census), so `SETTLED→REVERSED` is structurally excluded. Marker = the
  retraction notice already in the DB; date = retraction date at honest
  precision. Mirrors the accepted `exoplanet-retractions.ts` precedent exactly.
- **Verified benign:** these claims read `epistemicAxis=CONTESTED` while their
  curve terminal is `REVERSED`. That's fine — the reversal-facing views
  (`SettlingCurve` `hasReversal`, the OVERTURNED badge, `DomainCurveRail`) all
  key off `statusHistory.toAxis === "REVERSED"`, never off `epistemicAxis`. The
  join sets `toAxis` correctly, so all 11k reversals surface right. CONTESTED is
  just the 5-way summary bucket the baseline assigned (REVERSED isn't one of the
  five axis values); the contract leaves it untouched by design.
- **Residue (never guessed, always listed):** 2,522 conflicting-date + 8
  before-emergence rows → `logs/openalex-retraction-conflicts.jsonl` as a future
  curation queue. 74 rows skipped on transient `doi.org` 403s (scattered across
  ~10 publishers = rate-limiting, not a bot-wall); the retraction facts are
  already verified in `crossref_retractions_v1`, and the pipeline is
  resumable/idempotent, so they auto-retry on the next run.
- Pilot (`--limit 25 --execute`) done: 7 inserted, audit green (0 hard
  violations, 1 pre-existing D2 warning). 5 curves spot-checked and honest.

**Immediate next step:** the full `--execute` (~5,525 transition inserts), then
audit `--pipeline openalex_v1`, then a *derived* census/methodology count bump
(never hand-written), one commit (`curves phase-A: …`), and a 5-line addendum to
briefing 13. **Then** Phase B (FDA withdrawals of approval), Phase C (WHO
Essential Medicines deletions), Phase D (Prasad/Cifu medical-reversals curated
seed — hard-gated on a fetchable published source), and OFAC delistings
(NZ-style feed probe first). All `SETTLED→REVERSED` or `RECORDED→REVERSED`.

**Just closed this session:** the two whitepaper-cited claims (Surgeon General
1964, Müller 1939) were confirmed already-built and stamped `humanReviewed`.

## 3. The long journalism angle — the dropped-story / orphaned-story tracker

This is **Phase 2, post-launch** (briefings 11 + 12; engine + specs in
`tracker/`). It's the recurring-pull engine the launch research said the site
lacks, and it's Robert's own journalism project adopted into the product.

**The insight:** the news cycle is present-biased to amnesia — a story breaks,
saturates, disappears, while the underlying situation keeps developing and no
one follows up. The product is a **status board for news threads — the inverse
of a feed** — and its signature capability is detecting **ORPHANED** stories:
*still unresolved, but coverage has died.* Nobody ships a general-purpose,
automated "what stopped being watched" board (surveyed: Ground News, GDELT,
CFR/ICG trackers, etc. — all alert on activity, none on silence).

**The four statuses: OPEN / STALLED / RESOLVED / ORPHANED — and ORPHANED is the
product.** Everything else exists to make the orphan label trustworthy.

**The one non-collapsible invariant:** the LLM does *only* semantic judgment
(extract events, classify materiality); **deterministic code computes status.**
A holistic LLM status call is unauditable and cries wolf. This is literally the
same split as the corpus's promoter/contract architecture. Guardrails baked in:
a known pending trigger short-circuits ORPHANED; ORPHANED needs positive
evidence; uncertainty defaults to STALLED; only *merits* events resolve, and
only at finality. (Origin: a real TPS example a naive rule marks "abandoned"
when it's actually in active appellate litigation — a false "nobody's covering
this" is the product's worst possible error.)

**Data/business shape:** GDELT (free, global, coded events separate from
coverage) + an activity feed (congress.gov / CourtListener webhooks / Federal
Register) + a media-bias dataset. The tool is the paid moat; a small
auto-drafted "Still Developing" newsletter is the free funnel — **human-glanced,
never auto-sent** (Buttondown, draft-by-default). Positioning: go
embarrassingly narrow — **one domain (US immigration), one professional buyer.**
The metric is a **"dropped-story score" = coverage-decay × still-live
activity** — never an "omission/censorship" score (that presupposes an
unobtainable ground truth and is conspiracy-adjacent).

**Build order (specs `tracker/specs/` T1–T7):** schema → port engine (SYSTEM_PROMPT
+ computeStatus survive VERBATIM; four labeled examples wired into CI) → polling
loop → UI (`/threads`, admin-gated authoring) → **STEP 0 quiet-resolution
pre-filter + venue-aware dormancy layer (gates everything public — the single
most important research finding)** → 2–4 week SHADOW RUN → only then public,
gate = zero false ORPHANEDs → public board + digest.

## 4. How the two halves connect (and the boundary between them)

**Shared soul:** a thread (falsifiable question + resolution criteria + computed
status over time) is *a settling curve pointed at the present.* **Reversals =
what stopped being true; orphans = what stopped being watched.** One digest
carries both. Combined story: *"we track how knowledge settles — including the
questions the news dropped before they settled."*

**THE NON-NEGOTIABLE BOUNDARY (do not relitigate):** thread statuses get their
OWN tables (`Thread` / `ThreadEvent` / `ThreadStatusHistory`) and **NEVER**
become `ClaimStatusHistory` rows. ORPHANED/STALLED are computed from *absence* —
no document says "orphaned," and the contract requires every row to carry a
dated marker. Forcing them into the corpus corrupts the contract exactly like
faking a date. The *one* sanctioned join: when a thread RESOLVES via a merits
event, that IS a real dated documented transition — graduate it into the corpus
through `emitTransition` (marker = the ruling/enactment). Tracker beside the
corpus; resolutions minted into it. Both keep their invariants.

## 5. How work actually gets executed here (operational reality)

- **Advisor/executor split (briefing 13):** an executor session does the
  token-heavy mechanical work; a stronger advisor session decides at
  checkpoints. STOP and write a ≤200-word decision memo before: the first
  `--execute` of any pipeline, a match rate materially below expectation,
  ambiguous axis semantics, or any temptation to weaken a guard. One blocking
  question at a time.
- **Discipline (AGENTS.md — binding):** preflight-by-default (no writes without
  `--execute`); verify counts against the DB, never the logs; audit after every
  write; curated lists must trace to a fetchable source (the USPTO fabrication
  lesson); every mutation route calls `requireAdminOrDev`; never write raw
  `max+1` seqs.
- **Safety gate:** production DB writes are fired by a human paying attention,
  not automated — especially pre-launch.
- **Tooling constraint (important):** a **Cowork** session's shell is a
  Linux-ARM64 sandbox with the repo mounted, but the repo's `node_modules` ships
  only macOS + linux-x64 binaries (esbuild `darwin-arm64`; Prisma engines
  `darwin-arm64` + `rhel-x64`). So `tsx`/Prisma **cannot execute in that
  sandbox** — DB commands must run in a Mac shell. A **Claude Code** session on
  the Mac runs them natively (its Bash tool is the real shell) — that's the way
  to have an agent run commands directly instead of handing them over. File
  edits, git, and web work run fine in either.

## 6. Who Robert is (matters for advising)

Cognitive-psychology PhD student (Rutgers); thesis toward information theory +
pedagogy; wants to build an education-consulting company. **The site is a
research instrument** — 1.8M dated epistemic-status transitions are an
operationalization his field lacks (Behavior Research Methods dataset-paper +
advisor-memo are the academic moves). The tracker doubles as his dissertation
instrument: research found **no published construct distinguishing
indefinitely-stalled unresolved stories from ordinary attention decay** (Downs
1972 + Soufan 2026, arXiv:2604.16417 scaffold it) — a named-construct white
space. He hit real launch anxiety; the framing that steadied it is *launch = a
90-day probe with kill signals at near-zero cost basis.* Work style: send one
command at a time with plain-language framing; when his screenshots disagree
with your expectations, believe the screenshots.

---

*Authoritative sources, in order of use: `problem-solve.md` (why), `AGENTS.md`
(house rules, binding), `briefings/10-HANDOFF.md` (corpus + relationship state),
`briefings/13-curve-expansion-executor-brief.md` (current build),
`briefings/11-journalism-angle.md` + `briefings/12-tracker-integration.md` +
`tracker/specs/README.md` (the journalism angle),
`marketing/launch-research-report.md` (the launch sequence).*
