"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Collection = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  _count: { items: number };
};

export default function CollectionsClient() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => setCollections(d.collections ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create collection");
    } else {
      setCollections((prev) => [
        ...prev,
        { ...data.collection, _count: { items: 0 } },
      ]);
      setNewName("");
      setNewDesc("");
    }
    setCreating(false);
  }

  async function del(id: string) {
    if (!confirm("Delete this collection?")) return;
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      <h1 className="text-xl font-semibold text-white">My Collections</h1>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : collections.length === 0 ? (
        <p className="text-gray-500 text-sm">No collections yet.</p>
      ) : (
        <ul className="space-y-3">
          {collections.map((col) => (
            <li
              key={col.id}
              className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-start justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/collections/${col.id}`}
                  className="text-white text-sm font-medium hover:underline"
                >
                  {col.name}
                </Link>
                {col.description && (
                  <p className="text-gray-500 text-xs mt-0.5 truncate">{col.description}</p>
                )}
                <p className="text-gray-600 text-xs mt-1">
                  {col._count.items} {col._count.items === 1 ? "claim" : "claims"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`/api/collections/${col.id}/export?format=bibtex`}
                  className="text-xs text-gray-400 hover:text-white"
                  download
                >
                  .bib
                </a>
                <a
                  href={`/api/collections/${col.id}/export?format=csv`}
                  className="text-xs text-gray-400 hover:text-white"
                  download
                >
                  CSV
                </a>
                <button
                  onClick={() => del(col.id)}
                  className="text-xs text-red-600 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create form */}
      <div className="border-t border-gray-800 pt-6">
        <h2 className="text-sm font-medium text-gray-300 mb-3">New collection</h2>
        <form onSubmit={create} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              maxLength={120}
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
              placeholder="My reading list"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              maxLength={500}
              className="w-full rounded bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
            />
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
            disabled={creating || !newName.trim()}
            className="rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}
