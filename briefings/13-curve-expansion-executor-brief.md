# Briefing 13 — Curve expansion in the muscle domains (Sonnet 5 executor brief)

You are a Sonnet 5 Cowork session executing a multi-phase build. You were not
in prior conversations — everything you need is in this repo. You EXECUTE; a
stronger advisor (Fable 5, in another session) DECIDES at defined checkpoints.
This split is deliberate (cf. the advisor-tool pattern): you do the token-heavy
mechanical work; judgment calls stop and go to the advisor. Do not make
advisor-tier decisions yourself, and do not stall on executor-tier ones.

## Where to run this

Robert's call per session — the trade is quota vs. tedium, and HIS usage
budget decides (Cowork has stretched his subscription usage materially;
that is a legitimate reason to prefer it even though its sandbox cannot
reach the DB or most external APIs).

- **In Cowork:** you cannot run DB/network commands yourself. Hand Robert
  commands — BATCHED into blocks wherever consecutive steps don't need your
  inspection in between (label each block "run these in order, say done at
  the end"), always tee'd to logs/ so you read results yourself. Never make
  him paste output back.
- **In Claude Code:** you execute your own commands. `.claude/settings.json`
  pre-approves safe shapes (typecheck, git reads, greps); DB-touching
  `npx dotenv-cli` commands prompt him for a one-keypress approval each —
  that keypress is the human gate on production writes, not friction to
  engineer away.

## Session-start ritual

Read: `AGENTS.md` (house rules — binding), `briefings/10-HANDOFF.md` (state +
working relationship: Robert pastes commands one at a time, tee everything to
logs/, verify against the DB never the logs), `problem-solve.md` (why these
domains), `briefings/08-transition-event-pipelines.md` (the pipeline
skeleton you'll reuse), then this brief. Check `git log --oneline -10` for
which phases already landed.

## Mission

problem-solve.md's steer: concentrate curve-building where knowledge status
actually MOVES — science (OpenAlex), medicine/RCTs, law, legislation. The
corpus holds both halves of thousands of reversal arcs already; your job is
joining and ingesting them into settling curves, through the existing
machinery. You are NOT designing new architecture — every phase reuses
`lib/transition-contract.ts` (emitTransition/amendBaseline; seq is assigned
automatically — never touch it), the event-pipeline skeleton
(`scripts/event-pipelines/*.ts` — scotus-overrulings.ts is the canonical
template), preflight-by-default, and `scripts/audit-chain-integrity.ts`
after every --execute.

## THE ADVISOR PROTOCOL (non-negotiable)

STOP and produce a decision memo — do not proceed — when:
1. You are about to run the FIRST `--execute` of any new pipeline (memo =
   preflight counts, 5 sample planned writes, anomalies).
2. A join/match rate lands materially below expectation (memo = rate, 5
   unmatched samples, hypotheses).
3. Axis semantics are ambiguous for a domain (e.g. is a retraction of an
   openalex paper RECORDED→REVERSED or SETTLED→REVERSED? — memo the options).
4. Anything tempts you to weaken a guard, skip a verification, or write
   outside the contract. (The answer is no; the memo is how you appeal.)

Memo format (≤200 words, paste-ready): CONTEXT one line · FINDING with
numbers · OPTIONS a/b/c with one-line costs · YOUR RECOMMENDATION · WHAT'S
BLOCKED. Robert carries it to the Fable advisor session and returns the
verdict. Never batch two pending memos — one blocking question at a time.

## Phase A — OpenAlex ↔ CrossRef retractions DOI join (start here)

The highest-value item on the board (briefing 08 §Tier-2). Both datasets are
ALREADY IN THE DB: `openalex_v1` (318,775 paper claims) and
`crossref_retractions_v1` (26,624 retraction claims). Where DOIs match, an
openalex paper claim gains its reversal arc from the retraction record we
already hold — no external fetches for the join itself.

1. **Census first** (read-only, --direct): where do DOIs live on each side?
   (Inspect metadata/externalId/Source URLs on samples of both pipelines.)
   Normalize (lowercase, strip https://doi.org/). Report: overlap count,
   collision count, per-side DOI coverage %. → CHECKPOINT 2 memo if overlap
   is under ~2,000 or DOI coverage is poor.
2. **Build** `scripts/event-pipelines/openalex-retraction-join.ts` on the
   scotus template: for each matched pair, the openalex claim gets its
   transition (axis semantics → CHECKPOINT 3 memo BEFORE building: propose
   from how crossref entry rows are shaped — see briefing 08 §5 and the
   inverted-retraction audit history; date = retraction date with honest
   precision from the crossref record; marker source = the retraction
   notice source already in the DB; reason receipt-grade).
   Guards: skip+count claims with existing conflicting history; idempotent
   deterministic ids (the contract does this); no claim creation — this
   pipeline only appends transitions to existing openalex claims.
3. Preflight → CHECKPOINT 1 memo → pilot `--limit 25 --execute` → Robert
   eyeballs 5 curves on /settling-curve → full execute → audit
   `--pipeline openalex_v1` → update the census + methodology counts ONLY via
   derived numbers (never hand-write).

## Phase B — FDA withdrawals of approval (SETTLED→REVERSED)

Briefing 08 next-pipelines #2. Feed: Federal Register withdrawal-of-approval
notices (the FR API is already used by `ingest-federal-register.ts` — reuse
its fetch patterns) joined to `drugsatfda_v1` claims by application number /
drug name (exact-first, then conservative fuzzy with skip+count). Same
skeleton, same gates, CHECKPOINT 1 before execute. Residue JSONL for
unmatched notices (they feed a future loop, not guesses).

## Phase C — WHO Essential Medicines List deletions (SETTLED→REVERSED)

Briefing 08 next-pipelines #3. Feed: WHO TRS biennial reports' deletion
tables vs `who_essential_medicines_v1` (147 claims — small, clean pilot).
If the deletion tables aren't machine-readable, CHECKPOINT memo with the
scraping-vs-manual-seed options BEFORE building anything.

## Phase D — Medical reversals curated seed (STRETCH — advisor gate required)

The Prasad/Cifu medical-reversals corpus (~400 documented reversals of
established practice). HARD GATE (AGENTS.md, the USPTO lesson): every entry
must trace to the actual published table/paper — training-data recall is NOT
a source. If you cannot fetch and parse the published list itself,
CHECKPOINT memo and stop. Entries that pass become curated seeds through the
existing seed pipeline + `check-candidate-dup.ts` dedupe gate per candidate.

## Out of scope (do not start)

EUR-Lex / legislation.gov.uk repeals (Phase E, future — needs its own feed
probe first, NZ-style); anything in tracker/ (separate spec track); UI work;
loop installs (note "loop candidate" in your summary instead).

## Definition of done, per phase

Preflight counts ≈ executed counts ≈ audit green on the touched pipeline
(paste all three), 5 curves eyeballed by Robert, logs in logs/, one commit
per phase (`curves <phase>: <summary>`), and a 5-line addendum appended to
this file recording counts + residue so the next session inherits state.
