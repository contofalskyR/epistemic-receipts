"use client";
import { useState } from "react";
import { safeRedirectPath } from "@/lib/safeRedirect";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    let res: Response;
    try {
      res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
    } catch {
      setError("Network error — try again.");
      setLoading(false);
      return;
    }
    if (res.ok) {
      // Back to the page the gate came from — a path on this origin only.
      window.location.href = safeRedirectPath(new URLSearchParams(window.location.search).get("from"), window.location.origin);
    } else {
      // The route answers JSON with an error; the middleware's rate-limit 429
      // is plain text, which must not read as a wrong password.
      const data: { error?: string } = await res.json().catch(() => ({}));
      setError(
        data.error ??
          (res.status === 429
            ? "Too many attempts — wait a minute and try again."
            : res.status === 401
              ? "Incorrect password."
              : `Sign-in failed (HTTP ${res.status}).`),
      );
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xs space-y-6">
      <h1 className="text-lg font-semibold text-white">Epistemic Receipts</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoFocus
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
          />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          {loading ? "…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
