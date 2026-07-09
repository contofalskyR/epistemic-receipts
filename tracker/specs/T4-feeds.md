# T4 — Activity feeds: congress.gov, CourtListener webhooks, Federal Register

**Size:** 1–2 sessions. **Depends on:** T1. **Blocks:** T5 (loop wants
signals), T3 rule 6 (corroboration needs them; T3's function accepts an empty
array until this lands).

## Objective

Populate ThreadActivitySignal with "the situation is still developing"
evidence independent of press coverage — the still-live half of the orphan
conjunction. Stack per briefing 12 (decided; don't re-shop): congress.gov +
CourtListener/RECAP webhooks + Federal Register.

## Steps

1. **congress.gov poller** — `lib/feeds/congress.ts`. For threads with
   `activityRefs.billIds`: fetch each bill's `latestAction`
   (`api.congress.gov/v3/bill/{congress}/{type}/{number}?api_key=…`), write a
   ThreadActivitySignal when latestAction.date is newer than the stored
   latest for that thread+feed (idempotent by construction — check before
   insert). Key: `DATA_GOV_API_KEY` in .env.local + loop machine. 5,000
   req/hr ceiling is far above need; still space calls ~1s politely.
2. **CourtListener RECAP webhooks** — two halves:
   a. Receiver: `app/api/webhooks/courtlistener/route.ts` (POST). Follow the
      security model EXACTLY (SECURITY-REVIEW rules): entry in middleware
      `PUBLIC_WRITE_PATHS`, a rate-limit rule, JSON parse `.catch(() =>
      null)`, length caps on every string, and a shared-secret check —
      CourtListener lets you set a custom header on webhooks; compare
      timing-safe against `COURTLISTENER_WEBHOOK_SECRET`. Map docket id →
      thread via `activityRefs.docketIds`; write ThreadActivitySignal;
      unknown docket ids → log-and-200 (never 500 a webhook).
   b. Subscriptions: docket alerts are created via their API (one rate-limited
      call each — the May-2026 tightening is on search: 5/min; do NOT build
      anything that polls their search endpoint). A small admin script
      `scripts/subscribe-dockets.ts` (preflight/--execute) creates alerts for
      all docketIds present in threads. Token: `COURTLISTENER_TOKEN`.
      Free tier = 5 alerts; note in output when the count approaches it
      (paid tier lifts it — Robert's call later).
3. **Federal Register poller** — `lib/feeds/federal-register.ts`. For
   `activityRefs.frDocketNos`: query the FR API (no key) for documents on
   that docket newer than last seen → signal. Same idempotency shape as (1).
4. **GDELT timeline caching** (bridges to T5): after each timelinevol fetch,
   store the curve + computed peakDate into `Thread.coverageCurve` — T3's
   grace period reads it.

## Acceptance criteria (paste output)

- Unit tests for each mapper (sample API payload fixture → expected signal
  rows), in CI. No live-network tests in CI.
- Live smoke (Robert, tee to logs/): one real bill id → signal row appears;
  `subscribe-dockets.ts` preflight lists intended subscriptions; FR query on
  a known docket returns and maps.
- Webhook receiver: `curl` a fixture payload with the right secret → 200 +
  row; wrong secret → 401; oversized body → 4xx. Middleware entry + rate rule
  present in the diff.
- Typechecks clean; security-review greps clean (no raw interpolation, no
  secrets in code).

## Do not

- Poll CourtListener search as a substitute for webhooks.
- Write signals for threads that don't reference the source (no global
  firehose ingestion — this is per-thread evidence, not a data lake).
- Put any key in code or logs.
