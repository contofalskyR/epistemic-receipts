# Runbook: Billing (Stripe)

Owner: ops / Robert  
Depends on: Spec 21 (`lib/billing/`, `app/api/stripe/`)

---

## Environment variables required

| Var | Description |
|-----|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` on staging, `sk_live_...` on production |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI (`stripe listen`) or dashboard |
| `STRIPE_PRICE_PRO_MONTHLY` | Set by `scripts/stripe-setup.ts` |
| `STRIPE_PRICE_TEAM_MONTHLY` | Set by `scripts/stripe-setup.ts` |
| `STRIPE_PRICE_OVERAGE` | Shared meter-based price set by `scripts/stripe-setup.ts` |
| `STRIPE_METER_EVENT_NAME` | Default: `api_requests_overage` |
| `RESEND_API_KEY` | For payment_failed emails |
| `NEXT_PUBLIC_BASE_URL` | Base URL for Stripe return URLs (e.g. `https://epistemic-receipts.app`) |

---

## Initial setup

```bash
# 1. Install Stripe CLI (https://stripe.com/docs/stripe-cli)
# 2. Set your test key
export STRIPE_SECRET_KEY=sk_test_...

# 3. Run the idempotent setup script
tsx scripts/stripe-setup.ts

# 4. Copy the printed env vars into Vercel Settings → Environment Variables
# 5. Set STRIPE_WEBHOOK_SECRET from the Stripe dashboard
#    (Developers → Webhooks → Add endpoint → copy signing secret)
```

Endpoint to register in Stripe dashboard: `https://epistemic-receipts.app/api/stripe/webhook`  
Events to subscribe: `checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`

---

## Test-mode full lifecycle walkthrough

1. **Create a test customer and subscription:**
   - Go to `/pricing` on staging
   - Click "Upgrade to Pro" → redirected to Stripe test Checkout
   - Use card `4242 4242 4242 4242` (Visa success)
   - Complete checkout → `checkout.session.completed` fires → org tier = `pro`

2. **Verify DB row:**
   ```sql
   SELECT id, tier, "stripeCustomerId", "stripeSubscriptionId", "pastDueSince"
   FROM "Org" WHERE "stripeCustomerId" = '<id from Stripe>';
   ```

3. **Test usage reporting (test clock):**
   - In Stripe dashboard, create a Test Clock for the subscription
   - Advance the clock by 1 day
   - Run the usage cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/report-stripe-usage`
   - Check `ApiUsage.reportedToStripeAt` is now set

4. **Test renewal invoice with overage:**
   - Advance test clock to renewal date
   - If usage > included quota, invoice should include overage line item

5. **Test cancellation:**
   - Cancel subscription in Stripe dashboard
   - `customer.subscription.deleted` fires → org tier = `free`, keys NOT revoked
   - Verify key still works but at free-tier rate limits

6. **Test payment_failed:**
   - Use card `4000 0000 0000 0341` (payment always fails)
   - Advance test clock past next billing date
   - `invoice.payment_failed` fires → org `pastDueSince` = now, email sent
   - Advance clock 7+ more days → `resolveEffectiveTier` returns `free` for API requests

---

## Common ops tasks

### Issue a refund

Do this directly in the Stripe dashboard: Payments → find payment → Refund.  
No code change needed. If downgrading the tier after refund, either:
- Wait for subscription deletion webhook (if they cancel)
- Or manually update: `UPDATE "Org" SET tier='free' WHERE "stripeCustomerId"='cus_...'`
  and `UPDATE "ApiKey" SET tier='free' WHERE "orgId"='<org_id>'`

### Manual enterprise invoicing

Enterprise customers are added by setting `enterpriseFlag = true` on their Org row. They are excluded from the nightly metered usage cron and should be invoiced manually in Stripe.

```sql
UPDATE "Org" SET "enterpriseFlag" = true, tier = 'enterprise' WHERE id = '<org_id>';
UPDATE "ApiKey" SET tier = 'enterprise' WHERE "orgId" = '<org_id>';
```

### Tier override (without Stripe)

To manually change a customer's tier (e.g. for a trial, partner discount):

```sql
UPDATE "Org" SET tier = 'pro' WHERE id = '<org_id>';
UPDATE "ApiKey" SET tier = 'pro' WHERE "orgId" = '<org_id>';
```

Note: the nightly cron will report metered usage for this org even without a Stripe subscription (it checks `stripeSubscriptionId` before reporting, so if null, no events are sent).

### Clear a past_due flag manually

After verifying payment is resolved in Stripe:

```sql
UPDATE "Org" SET "pastDueSince" = NULL WHERE id = '<org_id>';
```

### Check what the double-report guard looks like

If you suspect double-reporting, check:
```sql
SELECT date, COUNT(*), COUNT("reportedToStripeAt") as reported
FROM "ApiUsage" WHERE "keyId" IN (SELECT id FROM "ApiKey" WHERE "orgId" = '<org_id>')
GROUP BY date
ORDER BY date DESC LIMIT 10;
```
All rows should have `reported` = `COUNT(*)` after the cron runs once.

---

## Webhook tamper test

```bash
curl -X POST https://epistemic-receipts.app/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: t=123,v1=badhash" \
  -d '{"type":"checkout.session.completed"}'
# Expected: 400 {"error":"Webhook signature invalid: ..."}
```

---

## Secrets checklist before going live

- [ ] `STRIPE_SECRET_KEY` is `sk_live_...` (not test)
- [ ] `STRIPE_WEBHOOK_SECRET` is from the live dashboard endpoint
- [ ] No Stripe secret in client bundles: `grep -r "sk_live" .next/` → 0 results
- [ ] Test mode prices replaced with live prices (re-run `stripe-setup.ts` with live key)
- [ ] Stripe Tax enabled in dashboard if charging customers in tax jurisdictions
