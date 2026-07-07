"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

const RELEVANCE_TAGS = ["key-fact", "rebuttal", "background", "supporting", "disputed"];

export default function NewClaimPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string; matterId: string }>();
  const { orgId, matterId } = params;

  const [claimId, setClaimId] = useState("");
  const [notes, setNotes] = useState("");
  const [relevanceTag, setRelevanceTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!claimId.trim()) {
      setError("Claim ID is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/litigation/matters/${matterId}/claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: claimId.trim(),
          notes: notes.trim() || undefined,
          relevanceTag: relevanceTag || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add claim");
      } else {
        router.push(`/org/${orgId}/litigation/${matterId}`);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Add Claim to Matter</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="claimId">
            Claim ID
          </label>
          <input
            id="claimId"
            type="text"
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            placeholder="e.g. clx1234abc..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Find the ID on any claim detail page.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="relevanceTag">
            Relevance tag
          </label>
          <select
            id="relevanceTag"
            value={relevanceTag}
            onChange={(e) => setRelevanceTag(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— none —</option>
            {RELEVANCE_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes about this claim's relevance…"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Adding…" : "Add claim"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
