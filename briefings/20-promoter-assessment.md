# 20 — Openalex Promoter Assessment: model choice, pre-filters, throughput

**Date:** 2026-07-12
**From:** external assessment session (read-only — no code, DB, or ledger changes were made)
**To:** the agent that authored the 2026-07-12 openalex promoter handoff and maintains `scripts/loop-corpus-promoter.sh`
**Answers:** the handoff's two open questions (Opus→Fable swap; 0-citation pre-filter), plus prompt-quality and loop-robustness findings you should fold in before the sustained run.
**Loop status:** not running. Per `briefings/00-INDEX.md`, only the owner restarts it. Nothing here changes that.

---

## 0. Evidence basis

- Read: `loop-corpus-promoter.sh`, `pick-promotable-claim.ts`, `apply-enrichment.ts`, `lib/transition-contract.ts`, `lib/corpus-completeness.ts`, `prisma/schema.prisma`, `CORPUS-PROMOTER-BULK-PLAN.md`, briefings 00/06/13, `logs/corpus-promoter-attempted.jsonl`, `logs/corpus-promoter-decisions.jsonl` (full raw outputs), `logs/census-openalex-phaseA-full.log`, the four `openalex_v1` enrichment scripts from the 07-05 run window, git history for `scripts/enrichments/`.
- Live A/B probe (2026-07-12): the loop's exact openalex prompt for the Halley claim (`cmq3lldbf4wopsavcucnf5for`) run through `claude --print --output-format json` on both `claude-opus-4-8` and `claude-fable-5`, same harness (Claude Code 2.1.207), usage and cost captured. n=1 — treat as a strong prior, not a conclusion.
- Web-verified: Hadley 1735 (doi.org/10.1098/rstl.1735.0014) and Love 2013 (doi.org/10.1002/grl.50846) are real and correctly characterized by the 07-05 run's two promotions. Current pricing from platform.claude.com/docs/en/about-claude/pricing (fetched 2026-07-12).
- Could NOT do from the assessment sandbox: any Neon query (egress blocked both 5432 and Neon's HTTPS API). §8 has the histogram query to run from the Mac.

## 1. Corrections to the handoff's stated state

| Handoff says | Reality | Evidence |
|---|---|---|
| Picks "highest cited_by_count first" | `cited_by_count` is uniformly absent → the DESC sort is a no-op; effective order is the OLDEST-first tiebreak | `pick-promotable-claim.ts` lines ~106–113 (comment dated 2026-07-05); `ingest-openalex.ts` never stored it |
| — | `backfill-openalex-citations.ts` (briefing 06 Phase A) exists, ready, resumable — but apparently never executed | no execution log anywhere in `logs/`; the phaseA logs there are briefing 13's retraction join. Verify: dry run prints "claims needing citation data: N" — N≈313k ⇒ never ran |
| "Ran once on 2026-07-05 (9 claims)" | True, but 6 of 9 ran BEFORE the `--allowedTools` fix (tools permission-blocked, pure spend); only 3 claims have ever run with web access | `attempted.jsonl` ts gap 11:10:58→11:17:27 + skip reasons citing blocked tools; loop script mtime 11:12 |
| "Fable 5 may be better here" | Fable 5 is the pricier successor: $10/$50 vs Opus 4.8's $5/$25 per M tokens; measured 3.5× cost, 2.5× latency on the same claim, equivalent verdict | §2 probe table; official pricing page |
| apply-enrichment may over-block legit patterns | Opposite: nothing legit was blocked in the run, but the blacklist under-blocks — `prisma.claimStatusHistory.deleteMany()` passes (only SQL `DELETE FROM` is caught) | `apply-enrichment.ts` dangerous-patterns list |
| "URL verification required... must resolve (200)" | Not enforced anywhere. WebFetch was blocked in BOTH observed environments (Mac run: "permission-blocked" / "sandbox permission gate"; probe: "Socket is closed"). Models corroborate via WebSearch and self-report "→ 200" they never observed. `verifyUrl()` sits unused in `lib/transition-contract.ts` for this path | decisions.jsonl raw #7/#9; probe VERIFICATION_LOGs |
| Ledger = "skip if already attempted" | Ledger also permanently burns errors: claim #6 was an API rate-limit error logged as `result:"skipped"` with empty reason; claim #9 (Herschel) was a transient apply failure — the byte-identical file was committed manually the next day (`cea6a40`). Neither will ever be re-picked | attempted.jsonl lines 6, 9; decisions raw #6 = "API Error: … Rate limited"; git log |

## 2. Q1 — Opus vs Fable: don't fleet-swap; use Fable selectively

Probe, same claim, same prompt, same harness:

| | Opus 4.8 | Fable 5 |
|---|---|---|
| CLI-reported cost | $0.573 | $1.977 (3.5×) |
| Wall time | 85 s | 217 s (2.5×) |
| Turns / web searches | 8 / 2 | 17 / 3 |
| Output tokens | 4,510 | 9,578 |
| Verdict | Correct: Hadley 1735 → CONTESTED, canonical DOI | Same, correct |

Fable's real-but-marginal edge: it recovered finer date provenance (read to the Royal Society 8 May 1735, published 22 May — it used 1735-05-22 where Opus used the issue-level date) and wrote an honest verification log explicitly disclosing that fetch tooling was down. For a workload that is 80–90% SKIPs, 3.5× per claim buys little. Extrapolated full-queue (217,421 claims, API rates): Opus ≈ $65–120K, Fable ≈ $230–420K; sequential wall time ≈ 8–11 months vs ~2 years.

**Recommended policy:**

- Default model stays `claude-opus-4-8` for bulk triage.
- Reserve Fable 5 for (a) the top-cited head of the queue once citations are backfilled (say the top 5–10k, where curve quality is user-visible and event probability is highest) and (b) briefing 06 Phase C (quiet reversals) — pre-screened candidates, genuinely hard adjudication, human-gated.
- Consider a Sonnet 5 triage arm ($2/$10 intro until Aug 31, then $3/$15) in the A/B; untested here.
- Decide on data: run the A/B in §6 (P1-6) before any fleet decision.
- Check which auth the Mac CLI uses (API key in launchd env vs Max subscription): it decides whether the constraint is dollars or rate-limit windows. Fable burns either ~3.5× faster.

**Finding that outranks model choice:** under the current inline-only contract, BOTH probe models emitted schema-invalid scripts (Opus: nonexistent `sourceExternalId` column + `Source.title`, missing required `name`/`methodologyType`; Fable: `Source.title`/`publisher`, and `sourceId` pointed at a Source id that was never created). The 07-05 production scripts were valid almost certainly because the model could Read `seed-human-history-trajectories.ts` on the Mac — a 10.8 MB file as a load-bearing crutch. Fix the contract (§4, §6-P1-5) and the model gap narrows further.

## 3. Q2 — pre-filter: yes, but not the 0-citation one, and not at LLM-call time

Why the proposed filter fails as stated: today `cited_by_count` is uniformly 0/absent, so "skip 0 citations" would skip the entire queue. After the backfill, the picker's `ORDER BY cited DESC` means 0-citation claims sit at the tail and wouldn't receive an LLM call for months anyway — a per-call filter saves ≈ nothing. Its correct form is a **queue floor**: an owner decision that claims below N citations are out of LLM scope entirely (their honest curve remains the single-step RECORDED row). Decide N after the backfill using the §8 histogram.

Pre-filters that pay immediately, all deterministic:

1. **Age floor (~2 years) in the picker.** All six pre-fix picks were papers published 2026-05 — six weeks old, all skipped, 100% predictable from `claimEmergedAt` alone. The oldest-first tiebreak masks this today, but the moment citations backfill flips the sort to DESC, hot recent papers resurface. One SQL line; carve out known retractions.
2. **Retraction-notice text exclusion.** Attempted #1 was a claim that is itself a retraction note; the corpus visibly contains claims titled "Retracted: …" / "Notice of Retraction: …". Exclude by text match (preflight the count first, house style) or route them to the deterministic path.
3. **`is_retracted` sweep.** Add `is_retracted` to the `select=` in `backfill-openalex-citations.ts` (one line, same ~6,300 polite-pool calls). Known retractions leave the LLM queue and get exact deterministic curves (populate-retraction-curves pattern) — extending the 11,319 wins the CrossRef DOI join already banked (census log). An LLM call spent discovering a retraction that's in metadata is the most expensive possible way to learn it.

Run the citation backfill first regardless: it also stops the prompt from asserting "Citations (OpenAlex): 0" for every paper — the 07-05 skip reasons visibly cite "0 citations" as evidence, i.e. the prompt is currently feeding the model misinformation that biases toward SKIP.

## 4. Prompt quality — solid core, five gaps (ranked)

The taxonomy/priority order, SKIP-default, and anti-fabrication rules are good, and both 07-05 promotions were verified historically correct. Gaps:

1. **No identifiers.** The prompt passes claim text only. 96.9% of openalex claims carry `metadata.doi` (phase A census); the picker just doesn't select it. Add DOI + `openalex_id` (+ journal/title if available) to the picker output and prompt. Misidentification — enriching the wrong paper's arc — is the worst failure mode at 217k scale, and title-only search invites it.
2. **URL verification is self-reported and fetch is broken in practice.** Enforce deterministically: `apply-enrichment.ts` extracts every `url:` and runs `verifyUrl()` from `lib/transition-contract.ts` before executing; reject non-2xx. Separately, debug why WebFetch is blocked under `--allowedTools "WebSearch,WebFetch"` on the Mac (try `WebFetch(*)` / check CLI sandbox settings), but do not depend on it.
3. **Emitted scripts bypass the transition contract.** Raw upserts leave `seq` NULL (the ordering authority — ORDERING-SEMANTICS-2026-07-08), skip chain-coherence checks, and skip URL verification. Migrate the output contract to `emitTransition()` (skeleton in §7) — it fixes 2, 3, and the schema-fidelity problem in one move. Note: `apply-enrichment.ts` must be updated in the same change — its validator currently *requires* the literal `claimStatusHistory` in the file and would reject emitTransition-style scripts; flip it to whitelist (require the `emitTransition` import; forbid raw `prisma.claimStatusHistory` / `prisma.source` writes).
4. **Inline spec under-specifies the script shape** (probe evidence in §2). If not migrating to emitTransition, inline a complete skeleton with exact `Source` fields (`name`, `methodologyType`) and the `sourceId: source.id` linkage, and delete the "read `seed-human-history-trajectories.ts` first" line.
5. **Small frictions:** "DAY precision preferred" nudges fabricated precision (both models stamped DAY on a 1735 event; production used an issue-level date as a DAY) — replace with "use the precision the adjudicating document supports; never sharpen a month/issue date to a day." Add "print the file inline in your reply; do NOT attempt to create or write files with tools" — both production promotes wasted a turn on a permission-blocked Write.

## 5. Loop defects to patch before any sustained run

1. **API errors are ledgered as skips.** Detect error outputs (e.g. `^API Error`, or absence of both `PROMOTED:` and `SKIPPED:` markers) → retry with backoff, and do NOT write the attempted-ledger line. At 217k sequential calls, rate-limit blips will otherwise silently discard a real slice of the queue (already happened: claim #6).
2. **Transient apply failures burn claims forever.** Retry the apply once; if it still fails, ledger with a distinct `result:"failed"` that a `--retry-failed` picker mode can re-pick. (Herschel is the proof this loses good work.)
3. **No usage capture.** Switch to `--output-format json`; parse `total_cost_usd`, `usage`, `num_turns`, model into `decisions.jsonl`, and add a `model` field to attempted-ledger lines. This is what makes the model decision and cost projections data-driven.
4. **Parallelism (after 1–3):** keep one picker per batch, fan the batch to `xargs -P 4` claude calls, apply + ledger serially after the join (no concurrent ledger writes). ~4× throughput; rate limits become the binding constraint.

## 6. Work queue (priority order; dry-run defaults; owner gates unchanged; per-item build notes in §11)

**P0 — before the loop restarts**

1. Run `backfill-openalex-citations.ts` — first extend `select=` with `is_retracted` (store `metadata.is_retracted`). Dry-run → `--execute` (resumable, circuit-breaker already built). Verify with its own DB-verification count.
2. Patch loop per §5 items 1–3. Verify: inject a fake `API Error` output in a bench test → no ledger line; a claim's decisions line carries cost/usage/model.
3. Add `verifyUrl()` enforcement to `apply-enrichment.ts`. Verify: a script with a 404 URL is rejected pre-execution.
4. Picker: age floor + retraction-notice exclusion + select DOI/openalex_id; prompt gains `DOI:` / `OpenAlex:` lines. Preflight the exclusion counts before enabling.

**P1**

5. Migrate emitted-script contract to `emitTransition` (§7 skeleton) + flip `apply-enrichment.ts` to whitelist validation. Prompt: drop the seed-file read; add precision + no-file-writes lines (§4.5).
6. Model A/B, 50 claims from the post-backfill head: eval mode that writes research outputs + usage to `logs/model-ab/<model>.jsonl`, applies nothing, ledgers nothing. Arms: opus-4-8, fable-5 (optional: sonnet-5). Metrics: $/claim, s/claim, promote rate, audited promote-precision on every proposed promote (owner audits), skip-reason quality sample. Owner picks the fleet policy.
7. In-batch parallelism (§5.4).

**P2**

8. Citation-floor decision (owner) from the §8 histogram; encode as a picker WHERE clause, and count the excluded tail in corpus stats as complete-with-caveat rather than "queued".
9. Deterministic curve sweep for `metadata.is_retracted=true` single-steps (populate-retraction-curves pattern; CrossRef-join residue rules apply).
10. Reserve Fable 5 for briefing 06 Phase C when that lane opens.

## 7. emitTransition skeleton (what the prompt should require scripts to look like)

```ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { emitTransition } from '../../lib/transition-contract'

const prisma = new PrismaClient()

async function main() {
  const r = await emitTransition(prisma, {
    claimId: '<CLAIM_ID>',                    // existing claim — never create a Claim
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1735-05-22',                 // string → parseFlexibleDate infers precision; never sharpen
    reason: '<2–3 sentences, ≥40 chars, names the adjudicating document>',
    source: {
      externalId: 'src:doi:10.1098/rstl.1735.0014',
      name: '<full citation line>',
      url: 'https://doi.org/10.1098/rstl.1735.0014',
      publishedAt: '1735-05-22',
      methodologyType: 'primary',
      ingestedBy: 'enrich:openalex_v1',
    },
  }, { execute: true })                        // verifyUrls defaults true; seq assigned in-transaction

  console.log(r)
  if (r.violations.length) { await prisma.$disconnect(); process.exit(1) }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
```

One `emitTransition` call per transition; the contract enforces vocabulary, reason length, date parsing/precision, chain coherence vs existing history, URL resolution, deterministic id, and seq — everything the prompt currently begs the model to do.

## 8. Queue histogram (run from the Mac; sizes the citation floor and age floor)

```bash
URL=$(grep -m1 '^DIRECT_URL=' .env.local | cut -d'"' -f2) && psql "$URL" <<'SQL'
SET statement_timeout='300s';
SELECT count(*) FILTER (WHERE cited IS NULL)            AS not_backfilled,
       count(*) FILTER (WHERE cited = 0)                AS c0,
       count(*) FILTER (WHERE cited BETWEEN 1 AND 4)    AS c1_4,
       count(*) FILTER (WHERE cited BETWEEN 5 AND 24)   AS c5_24,
       count(*) FILTER (WHERE cited >= 25)              AS c25p,
       count(*) FILTER (WHERE "claimEmergedAt" >= now() - interval '2 years') AS under_2y,
       count(*)                                         AS queue
FROM (SELECT CASE WHEN (c.metadata->>'cited_by_count') ~ '^\d+$'
                  THEN (c.metadata->>'cited_by_count')::int END AS cited,
             c."claimEmergedAt"
      FROM "Claim" c
      JOIN "ClaimStatusHistory" h ON h."claimId" = c.id AND h."fromAxis" IS NULL
      WHERE c."ingestedBy"='openalex_v1' AND c.deleted=false
        AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
        AND c."claimEmergedAt" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" h2
                        WHERE h2."claimId"=c.id AND h2.id<>h.id)) q;
SQL
```

## 9. Cost & throughput reference (assumptions explicit)

- Measured per-claim (probe, promote-type claim): Opus $0.57 / 85 s; Fable $1.98 / 217 s. Web search cost is minor (~$0.05–0.07/claim, billed via the Haiku search sub-agent: 2–3 searches).
- Measured per-claim (07-05 run, web-enabled, n=3): 175 s (promote), 41 s (skip), 180 s (promote+apply). Skips are cheaper than promotes; assume Opus averages $0.30–0.55/claim across the mix.
- Full queue (217,421): Opus ≈ $65–120K and 226–332 days sequential (90–132 s/claim); ÷N for N-way parallelism; Fable ≈ 3.5× cost, 2.5× time. Every 10% of queue removed by §3 filters ≈ $6–12K and ~3–4 weeks saved at Opus rates.
- Pricing (official, 2026-07-12): Opus 4.8 $5/$25; Fable 5 $10/$50; Sonnet 5 $2/$10 intro until Aug 31 then $3/$15; Haiku 4.5 $1/$5; batch API −50% (not usable through the interactive CLI loop); web search $10/1k.

## 10. Do not

- Restart `loop-corpus-promoter.sh` yourself — owner-only rule stands (00-INDEX).
- Trust `VERIFICATION_LOG` lines from the model as evidence a URL resolves — enforce with `verifyUrl()`.
- Ledger API-error outputs, or treat existing `failed` ledger lines as legitimately attempted — Herschel-class losses hide there.
- Rename ledger/log paths (continuity rule), set `humanReviewed` from any script, or hand-write `seq`.
- Re-run wave 1/2 bulk logic; the retraction DOI join (briefing 13 Phase A) is done — build the `is_retracted` sweep as its complement, not a redo.

## 11. Build notes (how, per work-queue item)

### P0-1 — citation backfill + `is_retracted`

Three small edits in `scripts/backfill-openalex-citations.ts`, not one: (a) the fetch URL's `select=id,cited_by_count,counts_by_year` gains `,is_retracted`; (b) the `OAWork` interface gains `is_retracted?: boolean | null`; (c) the pending-patch object gains `is_retracted: w.is_retracted ?? false`. Everything else (resume marker, circuit breaker, flush cadence) stays. Run: dry → `--execute`, optionally `--limit 20000` chunks per its own header. Verify with the script's built-in DB count, plus `SELECT count(*) FROM "Claim" WHERE "ingestedBy"='openalex_v1' AND metadata->>'is_retracted'='true'` for the sweep target size.

### P0-2 — loop robustness patch (`loop-corpus-promoter.sh`, per-claim block)

Replace the single `OUTPUT=$(claude ...)` with a retry wrapper, and gate the ledger write on output validity:

```bash
call_claude() {  # $1 = prompt; echoes CLI JSON on stdout; returns non-zero on invalid output
  local attempt out text
  for attempt in 1 2 3; do
    out=$(cd "$PROJECT_DIR" && claude --allowedTools "WebSearch,WebFetch" --print \
          --model "${PROMOTER_MODEL:-claude-opus-4-8}" --output-format json "$1" 2>>"$LOG") || true
    text=$(echo "$out" | jq -r '.result // empty' 2>/dev/null)
    if [ -n "$text" ] && echo "$text" | grep -qE '^(PROMOTED:|SKIPPED:)' ; then
      echo "$out"; return 0
    fi
    log "    claude call invalid/errored (attempt ${attempt}); backing off"
    sleep $((attempt * 60))
  done
  return 1
}
```

Rules the patch must preserve: on `call_claude` failure, append to `logs/corpus-promoter-errors.jsonl` and **do not** write `ATTEMPTED_LOG` (claim stays pickable); parse `RESULT_TEXT` (`.result`) exactly as `$OUTPUT` is parsed today; extract `COST=$(jq -r '.total_cost_usd')`, `TURNS=$(jq -r '.num_turns')`, and add `"model"` + `"costUsd"` + `"turns"` to both decisions and attempted lines. Model comes from `PROMOTER_MODEL` env (default `claude-opus-4-8`) so the A/B and any future tiering need no further loop edits. On apply failure: `sleep 30`, retry once; second failure ledgers `result:"failed"` as today. Companion picker change: a `--retry-failed` flag that, when set, drops `result:"failed"` lines from the attempted set in `loadAttemptedIds()` (owner runs occasional retry sweeps).

### P0-3 — deterministic URL enforcement (`scripts/apply-enrichment.ts`)

Make `main()` async. After the pattern checks, extract candidate URLs with `/url:\s*['"]([^'"]+)['"]/g` (dedupe), then `import { verifyUrl } from '../lib/transition-contract'` and await each. Gate on the `UrlCheck` result — read the interface at `lib/transition-contract.ts:135` and treat anything that isn't a confirmed 2xx as a rejection (exit 2, listing each failed URL). Add `--skip-url-check` for offline re-runs of already-verified scripts. Note `verifyUrl` caches per-URL in-process and has a 15s default timeout; a 3-URL script adds ≤45s worst case.

### P0-4 — picker + prompt identifiers and filters (`pick-promotable-claim.ts`, loop `build_prompt`)

SELECT gains: `c.metadata->>'doi' AS doi, c.metadata->>'openalex_id' AS "openalexId",` (extend the `Candidate` interface and the emitted JSON accordingly). WHERE gains, in this order of certainty: `AND c."claimEmergedAt" < now() - interval '2 years'`; after P0-1 has run, `AND (c.metadata->>'is_retracted') IS DISTINCT FROM 'true'`; and the retraction-notice text exclusion `AND c.text !~* '^\s*(retracted[: ]|retraction[: ]|notice of retraction|expression of concern|erratum[: ]|correction[: ])'` — preflight this last one first with a count + 20-row sample (house style) since legitimate titles can start with "Correction of…". Loop side: jq out `doi`/`openalexId`, pass into `build_prompt`, and add two prompt lines under the Published/Citations block: `DOI: ${doi}` and `OpenAlex ID: ${openalex_id}` with an instruction to resolve the DOI first before any title search.

### P1-5 — emitTransition contract migration (prompt + validator, one change)

Prompt: delete the "MUST follow the pattern in scripts/seed-human-history-trajectories.ts (read it first)" sentence and the raw-upsert bullet list; paste the §7 skeleton verbatim with "one `emitTransition` call per transition; `execute: true`; exit 1 if any call returns violations". Add the two §4.5 lines (document-supported precision; print inline, no file tools). Validator flip in the same commit — `apply-enrichment.ts` must now require `emitTransition` and the `transition-contract` import, and reject raw writes: forbid `/prisma\.(claimStatusHistory|source)\.(create|update|upsert|delete|createMany|updateMany|deleteMany)/` and keep the existing eval/exec/child_process/raw-SQL bans. Drop the now-obsolete `content.includes('claimStatusHistory')` requirement — it would reject every valid new-style script. Test fixture: run one known-good historical enrichment (e.g. the Halley file) through the new validator and confirm it is *rejected* (raw upserts), and the §7 skeleton with a real claim id passes dry (`execute: false`) before enabling.

### P1-6 — model A/B harness (`scripts/model-ab.sh`, new)

Factor `build_prompt` out of the loop into `scripts/promoter-prompt.sh` and `source` it from both (identical prompts are the point of the test). Harness: pick once with `--count 50 --attempted "$ATTEMPTED_LOG"` (exclude prior attempts, write nothing back); for each claim × each model in `--models "claude-opus-4-8,claude-fable-5[,claude-sonnet-5]"`, call `call_claude` with `PROMOTER_MODEL` set and append `{model, claimId, citedBy, costUsd, turns, durationMs, promoted, skipped, raw}` to `logs/model-ab/results.jsonl`. Applies nothing, ledgers nothing — the 50 claims stay in the queue and get redone under the winning config (~$15–30 of duplicate spend, accepted). Analysis one-liner per model: mean/median cost + duration, promote rate; then the owner audit: every FILE-emitting output gets its event, date, and URL manually checked — promote-precision is the deciding metric, per the house rule that one verified transition beats three plausible ones.

### P1-7 — in-batch parallelism (after P0-2 only)

Extract the per-claim body into `scripts/promoter-one-claim.sh` (args: claim JSON line; writes `$TMPDIR/<claimId>.json` containing the CLI JSON + parsed fields; **no ledger/decisions writes, no apply**). The loop becomes: pick → `printf '%s\n' "$CLAIMS_JSON" | xargs -P "${PARALLEL:-4}" -d '\n' -I{} bash scripts/promoter-one-claim.sh {}` → serial join loop over the temp results in pick order doing apply → ledger → decisions. Applies stay serial (pooler contention, git cleanliness); ledger stays single-writer, so no locking is needed. Telegram/commit block unchanged.

### P2-9 — `is_retracted` deterministic sweep (new script, after P0-1)

Model it on `populate-retraction-curves.ts` + the wave-2 guards: target = single-step openalex claims with `metadata.is_retracted='true'` and no crossref join match (briefing 13 residue rules). The retraction *date* is not in the OpenAlex work object — resolve per DOI from Crossref's update metadata or the publisher notice; claims whose retraction can't be dated from a verifiable source are skipped and counted, never guessed (house rule). Emit through `emitTransition` (`RECORDED → REVERSED`, `EXPERT_LITERATURE`), dry-run default, preflight counts, DB-verified after.
