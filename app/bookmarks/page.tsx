"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Copy, KeyRound } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";

type BookmarkedClaim = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  verificationStatus: string | null;
  ingestedBy: string;
  createdAt: string;
  bookmarkedAt: string;
};

export default function BookmarksPage() {
  const { profileKey, copyKey, copied, restoreFromKey, toggle } = useBookmarks();
  const [claims, setClaims] = useState<BookmarkedClaim[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fetchClaims = useCallback(async (key: string | null) => {
    if (!key) {
      setClaims([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/bookmarks/claims?key=${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      if (!r.ok) {
        setClaims([]);
      } else {
        const data: { claims: BookmarkedClaim[] } = await r.json();
        setClaims(data.claims ?? []);
      }
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims(profileKey);
  }, [profileKey, fetchClaims]);

  async function handleRemove(claimId: string) {
    if (!claims) return;
    setClaims(claims.filter(c => c.id !== claimId));
    await toggle(claimId);
  }

  function handleRestore() {
    setRestoreError(null);
    const ok = restoreFromKey(restoreInput);
    if (!ok) {
      setRestoreError("Please paste a valid key (at least 8 characters).");
      return;
    }
    setRestoreInput("");
  }

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <BookmarkCheck size={22} className="text-amber-400" />
          Bookmarks
        </h1>
        <p className="text-sm text-gray-400">
          Save claims to revisit later. Save your key to access your bookmarks on
          another device. No account needed.
        </p>
      </div>

      {/* Profile key card */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound size={14} className="text-gray-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Your profile key
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-xs text-amber-300 bg-gray-950 border border-gray-800 rounded px-2 py-1 font-mono break-all">
            {profileKey ?? "— will be generated when you bookmark a claim —"}
          </code>
          <button
            type="button"
            onClick={copyKey}
            disabled={!profileKey}
            className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Copy size={12} />
            {copied ? "Copied!" : "Copy key"}
          </button>
        </div>
        <p className="text-[11px] text-gray-500 leading-snug">
          This key is your only way to recover your bookmarks. If you clear browser
          storage or use a new device, paste it below to restore.
        </p>
      </section>

      {/* Restore from another key */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/30 p-4 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Restore from key
        </h2>
        <p className="text-xs text-gray-400">
          Paste a key from another device to switch to that profile.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={restoreInput}
            onChange={e => setRestoreInput(e.target.value)}
            placeholder="paste profile key…"
            className="flex-1 min-w-[14rem] bg-gray-950 border border-gray-800 rounded px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-600"
          />
          <button
            type="button"
            onClick={handleRestore}
            className="text-xs px-3 py-1.5 rounded bg-amber-900/40 border border-amber-900/60 hover:bg-amber-900/70 text-amber-200"
          >
            Restore
          </button>
        </div>
        {restoreError && (
          <p className="text-xs text-red-400">{restoreError}</p>
        )}
      </section>

      {/* Claim list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Saved claims
          </h2>
          {claims && claims.length > 0 && (
            <span className="text-xs text-gray-500">{claims.length} saved</span>
          )}
        </div>

        {loading && (
          <p className="text-xs text-gray-600 italic">Loading bookmarks…</p>
        )}

        {!loading && (!claims || claims.length === 0) && (
          <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center space-y-2">
            <Bookmark size={20} className="text-gray-700 mx-auto" />
            <p className="text-sm text-gray-400">No bookmarks yet.</p>
            <p className="text-xs text-gray-600">
              Click the bookmark icon on any claim to save it.
            </p>
          </div>
        )}

        {!loading && claims && claims.length > 0 && (
          <ul className="space-y-2">
            {claims.map(c => (
              <li
                key={c.id}
                className="rounded-lg border border-gray-800 bg-gray-900/40 hover:bg-gray-900 transition-colors p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/claims/${c.id}`}
                    className="text-sm text-gray-100 hover:text-white leading-snug flex-1 line-clamp-3"
                  >
                    {c.text}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemove(c.id)}
                    title="Remove bookmark"
                    className="shrink-0 text-amber-400 hover:text-amber-300"
                  >
                    <BookmarkCheck size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                  <EpistemicAxisBadge
                    axis={c.epistemicAxis}
                    className="px-1.5 py-0.5 rounded-full font-medium"
                  />
                  <span className="px-1.5 py-0.5 rounded-full font-medium bg-gray-800 text-gray-500">
                    {c.claimType}
                  </span>
                  <span className="text-gray-600">
                    {c.ingestedBy}
                  </span>
                  <span className="text-gray-700 ml-auto">
                    saved {new Date(c.bookmarkedAt).toLocaleDateString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
