"use client";
import { useEffect, useState } from "react";

type Alert = {
  id: string;
  topicKeyword: string;
  topicLabel: string;
  frequency: "daily" | "weekly";
  lastAlertAt?: string | null;
  createdAt: string;
};

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [label, setLabel] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topicKeyword: keyword.trim().toLowerCase(),
        topicLabel: label.trim() || keyword.trim(),
        frequency,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create alert");
    } else {
      setAlerts((prev) => [...prev, data.alert]);
      setKeyword("");
      setLabel("");
    }
    setCreating(false);
  }

  async function remove(id: string) {
    await fetch(`/api/alerts/${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function changeFrequency(id: string, freq: "daily" | "weekly") {
    const res = await fetch(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frequency: freq }),
    });
    if (res.ok) {
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, frequency: freq } : a)));
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Topic Alerts</h1>
        <p className="text-sm text-gray-400 mt-1">
          Get email digests when new claims match your keywords.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : alerts.length === 0 ? (
        <p className="text-gray-500 text-sm">No alerts yet.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{a.topicLabel}</p>
                <p className="text-xs text-gray-500 font-mono">{a.topicKeyword}</p>
              </div>
              <select
                value={a.frequency}
                onChange={(e) =>
                  changeFrequency(a.id, e.target.value as "daily" | "weekly")
                }
                className="bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 px-2 py-1 focus:outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
              <button
                onClick={() => remove(a.id)}
                className="text-xs text-red-700 hover:text-red-500"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Create form */}
      <div className="border-t border-gray-800 pt-6">
        <h2 className="text-sm font-medium text-gray-300 mb-3">Add alert</h2>
        <form onSubmit={create} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Keyword</label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                required
                maxLength={100}
                className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
                placeholder="e.g. climate change"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Display label (optional)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={100}
                className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
                placeholder="Climate Change"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as "daily" | "weekly")}
              className="bg-gray-900 border border-gray-700 rounded text-sm text-white px-3 py-2 focus:outline-none"
            >
              <option value="weekly">Weekly digest</option>
              <option value="daily">Daily digest</option>
            </select>
          </div>
          {error && (
            <p className="text-red-400 text-xs">
              {error.includes("limit") ? (
                <>
                  {error} —{" "}
                  <a href="/pricing" className="underline">
                    upgrade for more
                  </a>
                </>
              ) : (
                error
              )}
            </p>
          )}
          <button
            type="submit"
            disabled={creating || !keyword.trim()}
            className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            {creating ? "Adding…" : "Add alert"}
          </button>
        </form>
      </div>
    </div>
  );
}
