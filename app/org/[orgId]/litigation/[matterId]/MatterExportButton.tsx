"use client";

import { useState } from "react";

export default function MatterExportButton({ matterId }: { matterId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ exportId?: string; error?: string } | null>(null);

  async function handleExport(format: "JSONL" | "CSV") {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/litigation/matters/${matterId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error ?? "Export failed" });
      else setResult({ exportId: data.exportId });
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleExport("JSONL")}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Export JSONL
        </button>
        <button
          onClick={() => handleExport("CSV")}
          disabled={loading}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>
      {loading && <p className="text-xs text-gray-500">Exporting…</p>}
      {result?.exportId && (
        <p className="text-xs text-green-600 dark:text-green-400">Export ready (ID: {result.exportId})</p>
      )}
      {result?.error && <p className="text-xs text-red-600 dark:text-red-400">{result.error}</p>}
    </div>
  );
}
