"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

const BODY_MAX = 300; // matches /api/feedback's server-side cap

/**
 * Public "flag a receipt" form. Rides the existing /api/feedback endpoint
 * (public-write allowlisted, rate-limited, length-capped, Telegram-notified) —
 * the receipt reference from the flag link's query params travels in
 * pageContext so a correction is always tied to the exact transition row.
 */
export default function CorrectionForm() {
  const params = useSearchParams();
  const claim = params.get("claim");
  const transition = params.get("transition");
  const date = params.get("date");
  const hasRef = Boolean(claim || transition);

  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "rate" | "error">("idle");

  const pageContext = hasRef
    ? `corrections claim=${claim ?? "?"} transition=${transition ?? "?"} date=${date ?? "?"}`
    : "corrections (no receipt reference)";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          email: email.trim() || undefined,
          pageContext,
        }),
      });
      if (res.status === 429) setState("rate");
      else if (res.ok) setState("sent");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-lg border border-green-900/60 bg-green-950/30 px-5 py-5 text-sm text-green-300 leading-relaxed">
        Flag received. It&apos;s logged with the receipt reference and the maintainer has been
        notified — corrections that check out are applied with a written reason and appear in the
        audit log below.
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-5 space-y-4"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-white">Flag a receipt</h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          {hasRef ? (
            <>
              You&apos;re flagging{" "}
              <span className="font-mono text-gray-400">
                {transition ?? claim}
                {date ? ` @ ${date.slice(0, 10)}` : ""}
              </span>
              . Tell us what&apos;s wrong — a date, a source, an order of events. A link to a
              primary document helps most.
            </>
          ) : (
            <>
              Believe a date, source, or transition on this site is wrong? Tell us what and where —
              a link to a primary document helps most.
            </>
          )}
        </p>
      </div>

      <div className="space-y-1">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          rows={4}
          required
          placeholder="What's wrong, and what does the primary source actually say?"
          className="w-full rounded-md border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-y"
        />
        <p className="text-[10px] text-gray-600 font-mono text-right tabular-nums">
          {body.length}/{BODY_MAX}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.slice(0, 254))}
          placeholder="Email (optional — for follow-up)"
          className="flex-1 rounded-md border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600"
        />
        <button
          type="submit"
          disabled={!body.trim() || state === "sending"}
          className="rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {state === "sending" ? "Sending…" : "Submit correction"}
        </button>
      </div>

      {state === "rate" && (
        <p className="text-xs text-amber-400">
          Too many submissions from this connection — please try again in an hour.
        </p>
      )}
      {state === "error" && (
        <p className="text-xs text-red-400">Something went wrong — please try again.</p>
      )}
    </form>
  );
}
