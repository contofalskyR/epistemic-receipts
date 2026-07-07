"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type CollectionItem = {
  id: string;
  claimId: string;
  note?: string | null;
  position: number;
  addedAt: string;
  claim: {
    id: string;
    text: string;
    epistemicAxis?: string | null;
    currentStatus?: string;
  };
};

type Collection = {
  id: string;
  name: string;
  description?: string | null;
  items: CollectionItem[];
};

export default function CollectionDetailClient({ id }: { id: string }) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [editNote, setEditNote] = useState<{ itemId: string; claimId: string; value: string } | null>(null);

  useEffect(() => {
    fetch(`/api/collections/${id}`)
      .then((r) => r.json())
      .then((d) => setCollection(d.collection ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  async function removeItem(claimId: string) {
    await fetch(`/api/collections/${id}/items/${claimId}`, { method: "DELETE" });
    setCollection((prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => i.claimId !== claimId) } : prev,
    );
  }

  async function saveNote(claimId: string, note: string) {
    await fetch(`/api/collections/${id}/items/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setCollection((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) =>
              i.claimId === claimId ? { ...i, note: note || null } : i,
            ),
          }
        : prev,
    );
    setEditNote(null);
  }

  if (loading) return <p className="text-gray-500 text-sm p-8">Loading…</p>;
  if (!collection) return <p className="text-red-400 text-sm p-8">Collection not found.</p>;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/collections" className="text-xs text-gray-500 hover:text-gray-300">
            ← Collections
          </Link>
          <h1 className="text-xl font-semibold text-white mt-1">{collection.name}</h1>
          {collection.description && (
            <p className="text-gray-400 text-sm mt-1">{collection.description}</p>
          )}
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <a
            href={`/api/collections/${id}/export?format=bibtex`}
            download
            className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1"
          >
            Export .bib
          </a>
          <a
            href={`/api/collections/${id}/export?format=csv`}
            download
            className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-1"
          >
            Export CSV
          </a>
        </div>
      </div>

      {collection.items.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No claims yet. Add claims using the &ldquo;Add to collection&rdquo; button on any claim page.
        </p>
      ) : (
        <ul className="space-y-3">
          {collection.items.map((item) => (
            <li
              key={item.id}
              className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/claims/${item.claim.id}`}
                  className="text-sm text-white hover:underline flex-1 min-w-0"
                >
                  {item.claim.text.slice(0, 200)}
                  {item.claim.text.length > 200 ? "…" : ""}
                </Link>
                <div className="flex gap-2 flex-shrink-0 text-xs">
                  {item.claim.epistemicAxis && (
                    <span className="text-gray-500">{item.claim.epistemicAxis}</span>
                  )}
                  <button
                    onClick={() =>
                      setEditNote({
                        itemId: item.id,
                        claimId: item.claimId,
                        value: item.note ?? "",
                      })
                    }
                    className="text-gray-500 hover:text-gray-300"
                  >
                    note
                  </button>
                  <button
                    onClick={() => removeItem(item.claimId)}
                    className="text-red-700 hover:text-red-500"
                  >
                    remove
                  </button>
                </div>
              </div>

              {item.note && editNote?.claimId !== item.claimId && (
                <p className="text-xs text-gray-400 italic">{item.note}</p>
              )}

              {editNote?.claimId === item.claimId && (
                <div className="flex gap-2 mt-1">
                  <input
                    autoFocus
                    value={editNote.value}
                    onChange={(e) =>
                      setEditNote((prev) => prev && { ...prev, value: e.target.value })
                    }
                    maxLength={1000}
                    className="flex-1 rounded bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-white focus:outline-none"
                    placeholder="Add a note…"
                  />
                  <button
                    onClick={() => saveNote(item.claimId, editNote.value)}
                    className="text-xs text-white bg-gray-700 rounded px-2 py-1 hover:bg-gray-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditNote(null)}
                    className="text-xs text-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
