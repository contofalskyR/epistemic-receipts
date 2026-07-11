# OpenClaw — Data-Layer Operating Doctrine (corpus writes)  ·  v2

To: RobClaw (orchestrator) and every Claude Code worker it spawns on this repo.
Complements `specs/HANDOFF-OPENCLAW.md` (governs code merges). This file governs the other
axis: **anything that mutates Neon.** On conflict: repo `AGENTS.md` wins, then this, then the
scale-build handoff. RobClaw already holds the ethos — `projects/epistemic-receipts.md` "The
trap" (honest curves, not more curves), SOUL.md restraint, "blocked beats invented." This file
does not re-teach that; it adds the DB-write mechanics and one hard rule.

## 1. THE WRITE POSTURE (Robert's rule)
Autonomous loops: yes. Autonomous DB writes: no. **Every database change is owner-approved before
it runs. Every one — no row count small enough to skip it, no lane exempt.** A "DB change" =
any INSERT/UPDATE/DELETE on Neon: new claims, `ClaimStatusHistory` transitions, `epistemicAxis`
stamps, enrichment/backfill `--execute`, date backfills, dedup/curation merges, deprecations.
Read-only queries, `findings/` artifacts, branches, PRs, and tests are not DB changes — do those freely.

How approval is delivered (this harness): a **terse Telegram message to Robert** — row count,
the dry-run diff written to a workspace file, the exact command, "yes?" This is not new
machinery; it is DB writes added to the AGENTS.md hard rail that already says *state an
irreversible action and get a yes first*. Silence is not a yes. A CI-green PR is not a yes.
**Landing code that can write is not permission to run the write** — the merge and the execute
are two separate acts; the execute needs its own yes.

## 2. Writes can be killed mid-run — so every write is resumable (harness-specific, non-obvious)
RobClaw's heartbeat poll or any inbound Telegram message tears down an in-flight background
subagent ("stopped by user" — it killed two runs on 2026-07-06; see MEMORY.md). Therefore an
approved `--execute` **must be idempotent, cursor-checkpointed, and resumable, committing/persisting
incrementally** — the way the set-based axis executor was built (`*.cursor.json`, resumes after any
crash). Assume the write will be interrupted; a non-resumable batch write is itself a STOP condition.
After any killed worker, inspect `git status` and the DB, not just `git log`.

## 3. The contract (untouchable without an owner-approved spec)
- All transition writes go through `lib/transition-contract.ts` (`emitTransition`). No raw SQL
  INSERT into `ClaimStatusHistory`, ever. `seq` is auto-assigned — never hand-write it.
- `epistemicAxis` is stamped in-contract (`stampClaimAxis`) and read via `resolveDisplayAxis`.
  Read the canonical enum from the schema; never recall it. `currentStatus` is deprecated.
- `computeStatus` and the classifier `SYSTEM_PROMPT` (`tracker/dropped_story_classifier.ts`) and
  the contract's ordering survive verbatim. `humanReviewed` = a human reviewed it; no worker sets it.
- Verify counts with a direct query after any write — never a script's own counter (the axis
  census caught 669k mis-stamped rows that way before they became a wrong headline).

## 4. How a corpus change is built (probe → dry-run → census → pilot → approve → execute → audit)
1. Probe: dated source + something in the corpus to match. Undatable → residue, never an invented date.
2. Build on an existing template; exact-match first, conservative fuzzy is skip-and-count.
3. Dry-run by default; report real DB row counts before any `--execute`.
4. If a gate's expectation breaks, HALT and census (read-only) before any verdict. A surprising
   number is a stop sign, not a thing to push past.
5. CHECKPOINT brief → small pilot (e.g. `--limit 25`) → Robert's explicit yes → full `--execute`.
6. Audit after every write; residue → `logs/*.jsonl` (gitignored). Counts pasted, not paraphrased.

## 5. Mechanical enforcement (the part that makes §1 real instead of trusted)
Give loop workers a `DATABASE_URL` for a SELECT-only Postgres role (`er_readonly`) that physically
cannot write; keep the write-capable URL off the worker, used only for the approved execute. Until
that role exists, this whole doctrine is prose a worker is trusted to honor — the weaker form, and
exactly the setup that let the prior executor run gated writes uninstructed. (`er_readonly` is
already a pending owner action in MEMORY.md / spec 12.)

## 6. STOP conditions
A write attempted/run without a recorded yes; a worker holding write-capable DB creds; a write
outside `lib/transition-contract`; a direct `ClaimStatusHistory` insert; a non-resumable batch
write; an invented date; a number in a draft with no data cell; `computeStatus`/`SYSTEM_PROMPT`/
contract-ordering edited without a spec; secrets in output. On this site a wrong loop is worse than
no loop — halt beats improvise.

— Where this is silent, `AGENTS.md` and the spec win. Log what you do; the next model inherits only disk.
