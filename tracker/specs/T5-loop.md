# T5 — Polling loop + pilot seed

**Size:** ~half session (+ loop-machine install). **Depends on:** T2, T3
(T4 strongly preferred first; the loop runs with empty activity arrays if it
must, but rule-6 corroboration is then inert). **Blocks:** T7 shadow.

## Objective

One script that advances every live thread one tick, on the loop machine,
daily — preflight-by-default, resumable, non-sticky statuses, Telegram ping
on ORPHANED entry.

## Steps

1. **`scripts/poll-threads.ts`** — for each Thread (archived=false,
   optionally `--domain`, `--limit`, `--thread <id>`):
   fetch GDELT articles + timeline (throttled, ≥5s spacing GLOBALLY across
   threads — one module throttle, not per-thread) → cache coverageCurve →
   `classifyThread` → `applyDomainGuards` (with current ThreadActivitySignals
   + peakDate) → append ThreadStatusHistory row + update Thread.status +
   upsert ThreadEvents from llm.events (idempotent on threadId+articleId).
   Status recomputed every poll, NEVER sticky: an orphan with new coverage
   flips back; a resolved-then-appealed reopens (the engine handles it;
   just don't add "skip if resolved" shortcuts).
   Counters printed house-style: total, classified, skipped (parse), guarded
   (per guard), statusChanges, orphanEntries. Preflight prints would-write;
   `--execute` writes. Tee to logs/.
2. **Telegram ping** on ORPHANED ENTRY only (prior latest status ≠ ORPHANED):
   reuse the notifyTelegram pattern from `app/api/feedback/route.ts` (env
   TELEGRAM_BOT_TOKEN — the token Robert fixed during launch prep). Message:
   question + reason + thread URL. Fires once; return of coverage clears
   naturally on the next poll's status change (ping that too: "orphan
   cleared").
3. **Pilot seed** — `scripts/seed-pilot-threads.ts` (preflight/--execute):
   inserts the four canonical engine examples as real Thread rows
   (venue/gdeltQuery/activityRefs filled properly — the H-1B fee thread gets
   its real docket ids) plus up to 6 more Robert authors with you in-session.
   10 threads is a fine shadow start; 15–20 by week two via the T6 form.
4. **Loop-machine install** — `scripts/loop-thread-tracker.sh` (bash -n
   clean) + launchd plist per the house pattern (see
   scripts/loop-event-pipelines.sh from briefing 08 as the template). Daily.
   Env needed there: ANTHROPIC_API_KEY, DATA_GOV_API_KEY,
   COURTLISTENER_TOKEN, TELEGRAM_BOT_TOKEN, DATABASE_URL/DIRECT_URL.
   NEVER Vercel cron (GDELT 429s on shared egress; report addendum).

## Acceptance criteria (paste output)

- Preflight run over the seeded pilot: every thread classifies or
  skip-counts; zero crashes; counters reconcile (total = classified +
  skipped).
- `--execute` on the pilot: ThreadStatusHistory rows exist (verify via a
  count query against the DB, not the log — house rule); Thread.status
  matches each thread's latest history row (write a 5-line check script,
  keep it — the loop's own audit).
- Non-stickiness proven: rerun immediately → statuses recompute, no dupes
  (event upserts idempotent), history grows by one row per thread.
- Telegram: force one ORPHANED entry with a synthetic thread (venue=none,
  ancient dates) → ping received on Robert's phone → delete synthetic thread
  (threads are operational config, not receipts — deletion is fine HERE,
  unlike claims).
- launchd plist loads on the loop machine; next-morning log shows a clean
  unattended run.

## Do not

- Batch multiple threads into one LLM call.
- Let the loop write anything into claim/transition tables.
- Skip the global GDELT throttle because "it's only ten threads."
