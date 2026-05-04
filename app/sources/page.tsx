"use client";
import { useEffect, useState } from "react";
import { isReadOnly } from "@/lib/isReadOnly";

type Source = { id: string; name: string; url: string | null; methodologyType: string; publishedAt: string | null; createdAt: string };

const METHODOLOGY_LABELS: Record<string, string> = {
  primary: "Primary",
  derivative: "Derivative",
  opinion: "Opinion",
};

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [methodologyType, setMethodologyType] = useState("primary");
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/sources");
    setSources(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, url, publishedAt: publishedAt || null, methodologyType }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create source");
      return;
    }
    setName("");
    setUrl("");
    setPublishedAt("");
    setMethodologyType("primary");
    load();
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-white">Sources</h2>

      {isReadOnly() ? (
        <p className="text-sm text-gray-500 italic">Editing is disabled in this deployment.</p>
      ) : (
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-300">Add a source</h3>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="e.g. Proximal Origin — Andersen et al. 2020"
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">URL (optional)</label>
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            type="url"
            placeholder="https://..."
            className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Published date (optional)</label>
            <input
              value={publishedAt}
              onChange={e => setPublishedAt(e.target.value)}
              type="date"
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Methodology type</label>
            <select
              value={methodologyType}
              onChange={e => setMethodologyType(e.target.value)}
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            >
              <option value="primary">Primary — original research/reporting</option>
              <option value="derivative">Derivative — based on primary sources</option>
              <option value="opinion">Opinion — no primary evidence</option>
            </select>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 transition-colors"
        >
          Add source
        </button>
      </form>
      )}

      <div className="space-y-2">
        {sources.map(s => (
          <div key={s.id} className="rounded-lg border border-gray-800 px-4 py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white">{s.name}</p>
                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">{s.url}</a>}
              </div>
              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                {METHODOLOGY_LABELS[s.methodologyType]}
              </span>
            </div>
            {s.publishedAt && (
              <p className="text-xs text-gray-500 mt-1">{new Date(s.publishedAt).toLocaleDateString()}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
