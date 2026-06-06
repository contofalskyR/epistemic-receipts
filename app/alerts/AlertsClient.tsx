"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SavedQuery = {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  frequency: string;
  lastRunAt: string | null;
  createdAt: string;
};

type NewQueryForm = {
  name: string;
  q: string;
  frequency: "instant" | "daily" | "weekly";
};

const DEFAULT_FORM: NewQueryForm = { name: "", q: "", frequency: "daily" };

export default function AlertsClient({ initialEmail }: { initialEmail: string }) {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewQueryForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch("/api/queries")
      .then(r => r.json())
      .then(d => {
        setQueries(d.queries ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function createQuery(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    const filters: Record<string, string> = {};
    if (form.q) filters.q = form.q;
    const res = await fetch("/api/queries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, filters, frequency: form.frequency }),
    });
    if (res.ok) {
      const d = await res.json();
      setQueries(prev => [d.query, ...prev]);
      setForm(DEFAULT_FORM);
      setShowForm(false);
    } else {
      const d = await res.json().catch(() => ({}));
      setFormError(d.error ?? "Failed to save alert.");
    }
    setSaving(false);
  }

  async function deleteQuery(id: string) {
    const res = await fetch(`/api/queries/${id}`, { method: "DELETE" });
    if (res.ok) setQueries(prev => prev.filter(q => q.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Alerts</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Your alerts</h1>
          <p className="mt-1 text-xs text-gray-500">{initialEmail}</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="shrink-0 text-sm px-3 py-1.5 rounded border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          {showForm ? "Cancel" : "+ New alert"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={createQuery}
          className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-4 space-y-3"
        >
          <h2 className="text-sm font-medium text-white">Create alert</h2>
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Climate policy claims"
              className="w-full bg-gray-950 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">Search query</label>
            <input
              type="text"
              value={form.q}
              onChange={e => setForm(f => ({ ...f, q: e.target.value }))}
              placeholder="e.g. climate change"
              className="w-full bg-gray-950 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-gray-500">Frequency</label>
            <select
              value={form.frequency}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  frequency: e.target.value as "instant" | "daily" | "weekly",
                }))
              }
              className="bg-gray-950 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-gray-500"
            >
              <option value="instant">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <button
            type="submit"
            disabled={saving}
            className="text-sm px-4 py-2 bg-white text-gray-950 font-medium rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save alert"}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!loading && queries.length === 0 && !showForm && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-6 text-sm text-gray-500 italic">
          No alerts yet.{" "}
          <button
            onClick={() => setShowForm(true)}
            className="text-gray-300 hover:text-white underline"
          >
            Create one
          </button>{" "}
          or{" "}
          <Link href="/search" className="text-gray-300 hover:text-white underline">
            start from search
          </Link>
          .
        </div>
      )}

      {queries.length > 0 && (
        <div className="space-y-2">
          {queries.map(q => (
            <div
              key={q.id}
              className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{q.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {q.frequency} ·{" "}
                  {q.lastRunAt
                    ? `last sent ${new Date(q.lastRunAt).toLocaleDateString()}`
                    : "never sent"}
                </p>
                {Boolean((q.filters as Record<string, unknown>).q) && (
                  <p className="text-xs text-gray-600 mt-0.5 font-mono">
                    q: {String((q.filters as Record<string, unknown>).q)}
                  </p>
                )}
              </div>
              <button
                onClick={() => deleteQuery(q.id)}
                className="shrink-0 text-xs text-gray-600 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
