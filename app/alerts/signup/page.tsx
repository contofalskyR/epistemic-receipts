"use client";

import { useState } from "react";

export default function AlertsSignupPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setStatus("sent");
    } else {
      const d = await res.json().catch(() => ({}));
      setErrorMsg(d.error ?? "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Alerts</p>
        <h1 className="text-2xl font-semibold text-white">Check your inbox</h1>
        <p className="text-gray-400 text-sm">
          We sent a sign-in link to <span className="text-white">{email}</span>. Click it to verify
          your email and start managing alerts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Alerts</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Get email alerts</h1>
        <p className="mt-2 text-gray-400 text-sm max-w-lg leading-relaxed">
          Enter your email to receive digests when new claims match your saved searches. We use a
          magic link — no password needed.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-white text-gray-950 text-sm font-medium rounded px-4 py-2 hover:bg-gray-100 disabled:opacity-50 transition-colors"
        >
          {status === "loading" ? "Sending…" : "Send sign-in link"}
        </button>
        {status === "error" && <p className="text-sm text-red-400">{errorMsg}</p>}
      </form>
    </div>
  );
}
