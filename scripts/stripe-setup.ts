/**
 * Idempotent Stripe product + price + meter setup script.
 *
 * Run once per environment (staging, production) to create the Stripe products,
 * prices, and the Billing Meter for API overage tracking, then copy the printed
 * IDs and event name into Vercel env vars.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... tsx scripts/stripe-setup.ts
 *
 * Idempotency: looks up existing products/meters by metadata/name before creating.
 * Safe to re-run — will print existing IDs if already set up.
 */

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-06-24.dahlia", typescript: true });

interface ProductSpec {
  metaKey: string;
  tier: string;
  name: string;
  description: string;
  monthlyAmount: number; // cents
}

const PRODUCTS: ProductSpec[] = [
  {
    metaKey: "api-pro",
    tier: "pro",
    name: "Epistemic Receipts API — Pro",
    description: "1M requests/month included. $99/mo base.",
    monthlyAmount: 9900,
  },
  {
    metaKey: "api-team",
    tier: "team",
    name: "Epistemic Receipts API — Team",
    description: "5M requests/month included. $299/mo base.",
    monthlyAmount: 29900,
  },
];

const METER_EVENT_NAME = "api_requests_overage";
const OVERAGE_UNIT_PRICE_CENTS = 10; // $0.10 per 1k — same for all paid tiers initially

async function findOrCreateProduct(spec: ProductSpec): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `metadata['key']:'${spec.metaKey}'`,
  });
  if (existing.data.length > 0) {
    console.log(`  [existing] product ${spec.metaKey}: ${existing.data[0].id}`);
    return existing.data[0];
  }
  const product = await stripe.products.create({
    name: spec.name,
    description: spec.description,
    metadata: { key: spec.metaKey, tier: spec.tier },
  });
  console.log(`  [created]  product ${spec.metaKey}: ${product.id}`);
  return product;
}

async function findOrCreateMonthlyPrice(
  productId: string,
  amount: number,
  nickname: string,
): Promise<Stripe.Price> {
  const existing = await stripe.prices.list({ product: productId, active: true });
  const found = existing.data.find(p => p.nickname === nickname);
  if (found) {
    console.log(`  [existing] price ${nickname}: ${found.id}`);
    return found;
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amount,
    recurring: { interval: "month" },
    nickname,
  });
  console.log(`  [created]  price ${nickname}: ${price.id}`);
  return price;
}

async function findOrCreateOverageProduct(): Promise<Stripe.Product> {
  const existing = await stripe.products.search({
    query: `metadata['key']:'api-overage'`,
  });
  if (existing.data.length > 0) {
    console.log(`  [existing] overage product: ${existing.data[0].id}`);
    return existing.data[0];
  }
  const product = await stripe.products.create({
    name: "Epistemic Receipts API — Overage",
    description: `API requests above plan quota. $${(OVERAGE_UNIT_PRICE_CENTS / 100).toFixed(2)} per 1k requests.`,
    metadata: { key: "api-overage" },
  });
  console.log(`  [created]  overage product: ${product.id}`);
  return product;
}

async function findOrCreateBillingMeter(): Promise<Stripe.Billing.Meter> {
  const existing = await stripe.billing.meters.list({ status: "active" });
  const found = existing.data.find(m => m.event_name === METER_EVENT_NAME);
  if (found) {
    console.log(`  [existing] meter ${METER_EVENT_NAME}: ${found.id}`);
    return found;
  }
  const meter = await stripe.billing.meters.create({
    display_name: "API Overage Requests",
    event_name: METER_EVENT_NAME,
    default_aggregation: { formula: "sum" },
    customer_mapping: {
      type: "by_id",
      event_payload_key: "stripe_customer_id",
    },
    value_settings: { event_payload_key: "value" },
  });
  console.log(`  [created]  meter ${METER_EVENT_NAME}: ${meter.id}`);
  return meter;
}

async function main() {
  console.log("Setting up Stripe products, prices, and billing meter…\n");

  // Create the billing meter first (shared across all paid plans)
  console.log("── Billing Meter");
  const meter = await findOrCreateBillingMeter();

  // Create the shared overage product
  console.log("── Overage Product");
  const overageProduct = await findOrCreateOverageProduct();

  // Create an overage price tied to the meter
  const existingOveragePrices = await stripe.prices.list({
    product: overageProduct.id,
    active: true,
  });
  let overagePrice = existingOveragePrices.data.find(p => p.nickname === "api-overage-per-1k");
  if (overagePrice) {
    console.log(`  [existing] overage price: ${overagePrice.id}`);
  } else {
    overagePrice = await stripe.prices.create({
      product: overageProduct.id,
      currency: "usd",
      unit_amount: OVERAGE_UNIT_PRICE_CENTS,
      recurring: {
        interval: "month",
        meter: meter.id,
        usage_type: "metered",
      },
      nickname: "api-overage-per-1k",
    });
    console.log(`  [created]  overage price: ${overagePrice.id}`);
  }
  console.log("");

  const envLines: string[] = [
    `STRIPE_METER_EVENT_NAME=${METER_EVENT_NAME}`,
    `STRIPE_PRICE_OVERAGE=${overagePrice.id}`,
  ];

  for (const spec of PRODUCTS) {
    console.log(`── ${spec.name}`);
    const product = await findOrCreateProduct(spec);

    const tierUpper = spec.tier.toUpperCase();
    const monthly = await findOrCreateMonthlyPrice(
      product.id,
      spec.monthlyAmount,
      `${spec.metaKey}-monthly`,
    );

    envLines.push(`STRIPE_PRICE_${tierUpper}_MONTHLY=${monthly.id}`);
    console.log("");
  }

  console.log("Add these to Vercel env vars (Settings → Environment Variables):\n");
  for (const line of envLines) {
    console.log(`  ${line}`);
  }
  console.log(
    "\nAlso set:\n  STRIPE_SECRET_KEY=<your key>\n  STRIPE_WEBHOOK_SECRET=<from Stripe CLI or dashboard>",
  );
  console.log(
    "\nNote: Both Pro and Team plans share the same overage meter.",
    "\n      Each plan's Checkout session includes the monthly base price + shared overage price.",
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
