"use client";

import { useState } from "react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    tier: "free" as const,
    requests: "10,000 req/day",
    rateLimit: "60 req/min",
    features: [
      "All /v1 read endpoints",
      "Public provenance data",
      "Attribution required in outputs",
      "Community support",
    ],
    cta: "Get started",
    ctaHref: "/docs/api",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/month",
    tier: "pro" as const,
    requests: "1M req/month included",
    rateLimit: "600 req/min",
    features: [
      "Everything in Free",
      "Full snapshot downloads",
      "600 req/min rate limit",
      "Usage dashboard",
      "Overage: $0.10 per 1k requests",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Team",
    price: "$299",
    period: "/month",
    tier: "team" as const,
    requests: "5M req/month included",
    rateLimit: "3,000 req/min",
    features: [
      "Everything in Pro",
      "3,000 req/min rate limit",
      "Priority support",
      "Overage: $0.06 per 1k requests",
      "Custom data cards",
    ],
    cta: "Upgrade to Team",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    tier: "enterprise" as const,
    requests: "Unlimited",
    rateLimit: "Custom",
    features: [
      "Everything in Team",
      "Manual invoicing",
      "SLA & uptime guarantees",
      "Dedicated support",
      "Custom data exports",
    ],
    cta: "Contact us",
    ctaHref: "mailto:api@epistemic-receipts.app",
    highlight: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(tier: "pro" | "team") {
    setLoading(tier);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-4">API Pricing</h1>
      <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
        Programmatic access to Epistemic Receipts provenance data. All plans include
        full access to the /v1 read API. Free tier requires attribution.
      </p>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 flex flex-col ${
              plan.highlight
                ? "border-blue-500 shadow-lg bg-blue-50"
                : "border-gray-200 bg-white"
            }`}
          >
            {plan.highlight && (
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
                Most popular
              </div>
            )}
            <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
            <div className="text-3xl font-bold mb-1">
              {plan.price}
              <span className="text-base font-normal text-gray-500">{plan.period}</span>
            </div>
            <div className="text-sm text-gray-600 mb-1">{plan.requests}</div>
            <div className="text-sm text-gray-600 mb-6">{plan.rateLimit}</div>

            <ul className="space-y-2 mb-8 flex-1">
              {plan.features.map(f => (
                <li key={f} className="text-sm flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            {plan.ctaHref ? (
              <a
                href={plan.ctaHref}
                className={`text-center py-2 px-4 rounded-lg font-medium transition-colors ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                }`}
              >
                {plan.cta}
              </a>
            ) : plan.tier !== "enterprise" && plan.tier !== "free" ? (
              <button
                onClick={() => startCheckout(plan.tier as "pro" | "team")}
                disabled={loading !== null}
                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:opacity-60"
                }`}
              >
                {loading === plan.tier ? "Redirecting…" : plan.cta}
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-12 text-center text-sm text-gray-500">
        <p>
          Prices in USD. Billed monthly. Cancel anytime via the{" "}
          <a href="/account" className="underline">
            account portal
          </a>
          .
        </p>
        <p className="mt-2">
          Free tier API responses must include attribution:{" "}
          <em>Data from Epistemic Receipts (epistemic-receipts.app)</em>
        </p>
      </div>
    </main>
  );
}
