"use client";

import { useState } from "react";

interface ApiKeyInfo {
  id: string;
  orgName: string;
  createdAt: Date;
  tier: string;
  lastUsedAt: Date | null;
}

interface OrgInfo {
  id: string;
  name: string;
  tier: string;
  pastDueSince: Date | null;
  enterpriseFlag: boolean;
  stripeCustomerId: string | null;
  apiKeys: ApiKeyInfo[];
}

interface Props {
  org: OrgInfo;
  usageThisMonth: number;
  checkoutSuccess: boolean;
}

export default function AccountClient({ org, usageThisMonth, checkoutSuccess }: Props) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open portal");
      window.location.href = data.url;
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : "Something went wrong");
      setPortalLoading(false);
    }
  }

  const isPastDue = org.pastDueSince !== null;
  const tierLabel = org.enterpriseFlag ? "Enterprise (managed)" : org.tier;

  return (
    <main className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-8">Account</h1>

      {checkoutSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          Subscription activated! Your API keys have been upgraded.
        </div>
      )}

      {isPastDue && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <strong>Payment past due.</strong> Your rate limits will drop to the free tier after 7 days.
          Please update your payment method below.
        </div>
      )}

      {/* Org + tier */}
      <section className="mb-8 p-6 bg-white border border-gray-200 rounded-xl">
        <h2 className="text-lg font-semibold mb-4">Subscription</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Organization</div>
            <div className="font-medium">{org.name}</div>
          </div>
          <div>
            <div className="text-gray-500">Current tier</div>
            <div className="font-medium capitalize">{tierLabel}</div>
          </div>
          <div>
            <div className="text-gray-500">Requests this month</div>
            <div className="font-medium">{usageThisMonth.toLocaleString()}</div>
          </div>
        </div>

        {org.stripeCustomerId && (
          <div className="mt-6">
            {portalError && (
              <p className="mb-3 text-sm text-red-600">{portalError}</p>
            )}
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-60"
            >
              {portalLoading ? "Opening…" : "Manage billing & invoices →"}
            </button>
          </div>
        )}

        {!org.stripeCustomerId && org.tier === "free" && (
          <div className="mt-6">
            <a
              href="/pricing"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Upgrade plan →
            </a>
          </div>
        )}
      </section>

      {/* API Keys */}
      <section className="p-6 bg-white border border-gray-200 rounded-xl">
        <h2 className="text-lg font-semibold mb-4">API Keys</h2>
        {org.apiKeys.length === 0 ? (
          <p className="text-sm text-gray-500">No active API keys.</p>
        ) : (
          <div className="space-y-3">
            {org.apiKeys.map(key => (
              <div key={key.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm font-medium">{key.orgName}</div>
                  <div className="text-xs text-gray-400">
                    Created {new Date(key.createdAt).toLocaleDateString()} ·{" "}
                    {key.lastUsedAt
                      ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded capitalize">
                  {key.tier}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Need a new key?{" "}
          <a href="mailto:api@epistemic-receipts.app" className="underline">
            Contact us
          </a>
        </p>
      </section>
    </main>
  );
}
