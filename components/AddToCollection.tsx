"use client";
import { useEffect, useRef, useState } from "react";
import { FolderPlus } from "lucide-react";

type Collection = { id: string; name: string };

// Renders nothing unless the visitor has a session. Collections are a
// session-authed feature and the public edition has no sign-in surface, so an
// anonymous visitor must not see "Collect" at all (it used to open a dropdown
// linking to /auth/signin, a 404 on the public edition). The probe below is the
// same mount-time pattern BookmarkToggle and FollowButton use on this row; for
// an anonymous visitor /api/collections is an auth() check → 401, no DB hit.
export default function AddToCollection({ claimId }: { claimId: string }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Probe for a session on mount. Any non-OK response (401, or a 500 from an
  // edition with no Auth.js config) means "no session" — fail closed and stay hidden.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/collections", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCollections(data.collections ?? []);
      } catch {
        // network error → treat as no session
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  // No session (or not yet known): render nothing.
  if (collections === null) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-colors bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        title="Add to collection"
      >
        <FolderPlus size={12} />
        <span>Collect</span>
      </button>

      {open && (
        <div className="absolute left-0 top-7 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-56 py-1">
          {collections.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">No collections yet</p>
          )}
          {collections.map((col) => (
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
        </div>
      )}
    </div>
  );
}
