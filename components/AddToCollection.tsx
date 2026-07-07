"use client";
import { useEffect, useRef, useState } from "react";
import { FolderPlus } from "lucide-react";

type Collection = { id: string; name: string };

export default function AddToCollection({ claimId }: { claimId: string }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [authed, setAuthed] = useState<boolean | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (collections !== null) return;
    setLoading(true);
    const res = await fetch("/api/collections");
    if (res.status === 401) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    setAuthed(true);
    const data = await res.json();
    setCollections(data.collections ?? []);
    setLoading(false);
  }

  async function addTo(collectionId: string) {
    const res = await fetch(`/api/collections/${collectionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claimId }),
    });
    if (res.ok) {
      setAdded((prev) => new Set(prev).add(collectionId));
    }
  }

  async function createAndAdd() {
    const name = prompt("Collection name:");
    if (!name?.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Failed");
      return;
    }
    const { collection } = await res.json();
    setCollections((prev) => (prev ? [...prev, collection] : [collection]));
    await addTo(collection.id);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        title="Add to collection"
      >
        <FolderPlus size={12} />
        <span>Collect</span>
      </button>

      {open && (
        <div className="absolute left-0 top-7 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-56 py-1">
          {authed === false ? (
            <a
              href="/auth/signin"
              className="block px-3 py-2 text-xs text-gray-300 hover:bg-gray-800"
            >
              Sign in to use collections
            </a>
          ) : loading ? (
            <p className="px-3 py-2 text-xs text-gray-500">Loading…</p>
          ) : (
            <>
              {collections && collections.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-500">No collections yet</p>
              )}
              {collections?.map((col) => (
                <button
                  key={col.id}
                  onClick={() => addTo(col.id)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 flex items-center justify-between"
                >
                  <span className="truncate">{col.name}</span>
                  {added.has(col.id) && <span className="text-green-500 ml-2">✓</span>}
                </button>
              ))}
              <button
                onClick={createAndAdd}
                className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-800 border-t border-gray-800 mt-1"
              >
                + New collection
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
