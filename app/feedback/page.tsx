"use client";
import { useState, useEffect } from "react";

export default function FeedbackPage() {
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [pageContext, setPageContext] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    setPageContext(document.referrer || "");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setStatus("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim(), email: email.trim() || null, pageContext: pageContext || null }),
    });
    setStatus(res.ok ? "sent" : "error");
  }

  if (status === "sent") {
    return (
      <div className="max-w-md">
        <p className="text-gray-400 text-sm">Thanks, sent.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Feedback</h1>
        <p className="text-xs text-gray-500 mt-1">Thoughts, bugs, or questions — goes straight to Robert.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            required
            rows={5}
            placeholder="What's on your mind?"
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 resize-y"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Email (optional — if you want a reply)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>

        {status === "error" && (
          <p className="text-red-400 text-xs">Something went wrong. Try again.</p>
        )}

        <button
          type="submit"
          disabled={status === "sending" || !body.trim()}
          className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          {status === "sending" ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
