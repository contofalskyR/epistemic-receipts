"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("resend", { email, redirect: false });
    if (res?.error) {
      setError("Could not send magic link. Try again.");
      setLoading(false);
    } else {
      window.location.href = "/auth/verify";
    }
  }

  return (
    <div className="max-w-xs space-y-6">
      <h1 className="text-lg font-semibold text-white">Sign in</h1>
      <p className="text-sm text-gray-400">
        Enter your email and we&rsquo;ll send a sign-in link. No password needed.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            maxLength={254}
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            placeholder="you@example.com"
          />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email}
          className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          {loading ? "Sending…" : "Send link"}
        </button>
      </form>
    </div>
  );
}
