"use client";

/**
 * Follow-this-claim affordance (er-kit packet Phase 5 / handoff §2).
 * Mirrors the topic-page "Watch" pattern (app/topics/[slug]/page.tsx) —
 * inline toggle → email input → POST /api/subscribe/claim { email, claimId }.
 *
 * Handoff constraints honored in copy:
 *  - says exactly what it does ("email when this claim's status moves"),
 *  - surfaces the unsubscribe promise,
 *  - static-pipeline claims get expectation-setting copy instead of being
 *    hidden ("either hide it there or set expectations in the copy").
 */

import { useState } from "react";

export default function FollowClaim({
  claimId,
  liveFed,
}: {
  claimId: string;
  /** True when the claim's pipeline receives ongoing transition events
   *  (SCOTUS overrulings, retraction joins, OFAC delistings cron, FDA
   *  withdrawals) — controls expectation copy, not availability. */
  liveFed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleFollow() {
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, claimId }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-xs text-green-400">
        Following — you&apos;ll get an email when this claim&apos;s status moves. Every email
        includes a one-click unsubscribe.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-200 transition-colors"
        title="Email me when this claim's epistemic status changes"
      >
        {open ? "Cancel" : "Follow this claim"}
      </button>
      {open && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            {liveFed
              ? "Get an email when this claim's status moves (its sources are checked on an ongoing basis). Unsubscribe anytime — every email has a one-click link."
              : "Get an email if this claim's status ever moves. This is a historical record, so changes are rare — you may never hear from us. Unsubscribe anytime — every email has a one-click link."}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="text-xs px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-300 placeholder-gray-600 focus:border-gray-500 focus:outline-none w-56"
            />
            <button
              onClick={handleFollow}
              disabled={status === "loading" || !email.includes("@")}
              className="text-xs px-3 py-1.5 rounded border border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {status === "loading" ? "…" : "Follow"}
            </button>
            {status === "error" && <span className="text-xs text-red-400">Failed. Try again.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
