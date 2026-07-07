# Spec 21 — Billing & Metering (Stripe)

Phase 2 · Depends on: 20 · Model: Sonnet 5 · Scope: ~2–3 agent sessions

## Objective
Self-serve paid tiers for the /v1 API and gated snapshot downloads, with Stripe owning all money movement. Build no billing logic that Stripe already provides.

## Design (decided)
- Stripe Products: `api-pro` ($99/mo, 1M req/mo included), `api-team` ($299/mo, 5M included), overage as metered usage price per 1k requests on both. Enterprise = manual invoicing, no code. Prices created via a checked-in idempotent setup script (`scripts/stripe-setup.ts`), IDs stored in env vars — never hardcoded.
- Checkout: Stripe Checkout (hosted) from a `/pricing` page. Post-checkout webhook provisions the ApiKey org: `checkout.session.completed` → create/update `Org` billing record + set `ApiKey.tier`. Customer portal (hosted) for card/cancel/invoices — link from a minimal `/account` page.
- Usage reporting: nightly cron reads the day's `ApiUsage` rows (from Spec 20's flush) and reports usage records to the Stripe subscription item. Idempotency: usage record `timestamp` = day bucket; store `reportedToStripeAt` on ApiUsage rows; never double-report.
- Webhooks: `/api/stripe/webhook` — verify signature (raw body), handle `checkout.session.completed`, `customer.subscription.updated` (tier change), `customer.subscription.deleted` (downgrade key to free, do NOT revoke), `invoice.payment_failed` (email owner + flag org `past_due`; enforcement = drop to free-tier rate limits after 7 days past_due, implemented as a tier check in the Spec 20 limiter). Add route to `PUBLIC_WRITE_PATHS` with signature verification as the gate + rate limit rule.
- Snapshot gating: full-snapshot downloads via short-lived R2 signed URLs issued by `GET /v1/snapshots/{id}/download` — requires key with tier ≥ pro (or an enterprise flag). Sample stays public.
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Vercel env; test mode on staging with Stripe test clocks for renewal testing.

## Deliverables
1. Prisma additions: `Org` (billing fields: stripeCustomerId, stripeSubscriptionId, tier, pastDueSince?) — designed to be forward-compatible with Spec 30's fuller Org model (coordinate field names with that spec; if 30 lands first, extend rather than duplicate).
2. `/pricing` page (tiers, what's included, attribution requirement on free), `/account` (portal link, key display, usage this month from ApiUsage).
3. Webhook route + nightly usage-report cron + `stripe-setup.ts`.
4. Runbook `docs/runbooks/billing.md`: refunds, manual enterprise invoicing, tier overrides, test-mode walkthrough.

## Out of scope
Seats/SSO (Spec 30). Invoicing UI. Taxes beyond enabling Stripe Tax. Coupons.

## Acceptance criteria
- Full lifecycle on staging in test mode, evidenced with Stripe dashboard screenshots + DB rows: checkout → key upgraded → usage reported → test-clock renewal invoice includes overage → cancel → key drops to free (not revoked).
- Webhook signature check: tampered payload → 400, nothing written. Replay of a processed event → idempotent no-op.
- Double-report guard: run usage cron twice for the same day → Stripe shows usage once.
- `payment_failed` path: org flagged, email sent, limiter drops tier after simulated 7 days (test with clock).
- No Stripe secret in client bundles (grep build output).

## Verification
Paste: lifecycle evidence, webhook tamper/replay results, double-run cron output, bundle grep.
