"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Rss, KeyRound } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";

/**
 * /following (B12-3) — one place for everything the reader follows:
 * follows (claims, trajectories, topics, domains, stories) + bookmarks.
 * /bookmarks and /alerts permanently redirect here. Anonymous-first; the
 * profile key is the only credential and never leaves the reader's control.
 */

type ResolvedFollow = {
  followId: string;
  entityType: "claim" | "trajectory" | "topic" | "domain" | "story";
  entityId: string;
  followedAt: string;
  title: string;
  href: string | null;
  status: string | null;
  deprecated: boolean;
  lastMoveAt: string | null;
};

type BookmarkedClaim = {
  id: string;
  text: string;
  epistemicAxis: string | null;
  verificationStatus: string | null;
  bookmarkedAt: string;
};

const GROUPS: { type: ResolvedFollow["entityType"]; label: string }[] = [
  { type: "claim", label: "Claims" },
  { type: "trajectory", label: "Trajectories" },
  { type: "topic", label: "Topics" },
  { type: "domain", label: "Domains" },
  { type: "story", label: "Stories" },
];

function timeSince(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
  if (days < 1) return "moved today";
  if (days < 60) return `last move ${days}d ago`;
  if (days < 730) return `last move ${Math.floor(days / 30)}mo ago`;
  return `last move ${Math.floor(days / 365)}y ago`;
}

export default function FollowingPage() {
  const { profileKey, copyKey, copied, restoreFromKey, toggle } = useBookmarks();
  const [follows, setFollows] = useState<ResolvedFollow[] | null>(null);
  const [bookmarked, setBookmarked] = useState<BookmarkedClaim[] | null>(null);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const load = useCallback(async (key: string | null) => {
    if (!key) {
      setFollows([]);
      setBookmarked([]);
      return;
    }
    const qs = `key=${encodeURIComponent(key)}`;
    const [f, b] = await Promise.all([
      fetch(`/api/follow?${qs}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { follows: [] }))
        .catch(() => ({ follows: [] })),
      fetch(`/api/bookmarks/claims?${qs}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { claims: [] }))
        .catch(() => ({ claims: [] })),
    ]);
    setFollows((f.follows ?? []) as ResolvedFollow[]);
    setBookmarked((b.claims ?? []) as BookmarkedClaim[]);
  }, []);

  useEffect(() => {
    load(profileKey);
  }, [profileKey, load]);

  async function unfollow(f: ResolvedFollow) {
    if (!profileKey) return;
    setFollows((cur) => (cur ?? []).filter((x) => x.followId !== f.followId));
    await fetch("/api/follow", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: profileKey,
        entityType: f.entityType,
        entityId: f.entityId,
      }),
    }).catch(() => {});
  }

  async function removeBookmark(claimId: string) {
    setBookmarked((cur) => (cur ?? []).filter((c) => c.id !== claimId));
    await toggle(claimId);
  }

  function handleRestore() {
    setRestoreError(null);
    if (!restoreFromKey(restoreInput)) {
      setRestoreError("Please paste a valid key (at least 8 characters).");
      return;
    }
    setRestoreInput("");
  }

  const loading = follows === null || bookmarked === null;
  const empty =
    !loading && (follows?.length ?? 0) === 0 && (bookmarked?.length ?? 0) === 0;

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">Following</h1>
        <p className="text-sm text-gray-400">
          Everything you follow, in one place — current epistemic status and
          time since the last dated move. No account needed: your follows live
          in your browser, linked to a private key you control.
        </p>
        {profileKey && (
          <a
            href={`/api/feed/following.rss?key=${encodeURIComponent(profileKey)}`}
            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            <Rss size={12} />
            RSS feed of moves in what you follow
          </a>
        )}
      </div>

      {/* Profile key management (ported from /bookmarks) */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500">
          <KeyRound size={12} />
          Your profile key
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-[14rem] text-xs text-amber-300 bg-black border border-gray-800 rounded px-3 py-1.5 font-mono break-all">
            {profileKey ?? "— will be generated when you follow or bookmark something —"}
          </code>
          <button
            type="button"
            onClick={copyKey}
            disabled={!profileKey}
            className="text-xs px-3 py-1.5 rounded border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {copied ? "✓ Copied" : "Copy key"}
          </button>
        </div>
        <p className="text-xs text-gray-600">
          This key is your only way to recover your follows and bookmarks on a
          new device or after clearing storage.
        </p>
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <input
            type="text"
            value={restoreInput}
            onChange={(e) => setRestoreInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRestore()}
            placeholder="paste profile key to restore…"
            className="flex-1 min-w-[14rem] text-xs px-3 py-1.5 rounded border border-gray-800 bg-black text-gray-300 placeholder-gray-600 font-mono focus:border-gray-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleRestore}
            className="text-xs px-3 py-1.5 rounded border border-amber-800/50 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 transition-colors"
          >
            Restore
          </button>
        </div>
        {restoreError && <p className="text-xs text-red-400">{restoreError}</p>}
      </div>

      {loading && <p className="text-sm text-gray-600 italic">Loading…</p>}

      {empty && (
        <div className="rounded-lg border border-dashed border-gray-800 p-8 text-center space-y-2">
          <p className="text-sm text-gray-400">
            You aren&apos;t following anything yet.
          </p>
          <p className="text-xs text-gray-600">
            Hit &ldquo;Follow&rdquo; on any claim, settling curve, or topic —
            its dated moves will show up here and in your{" "}
            <Link href="/feed" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
              feed
            </Link>
            .
          </p>
        </div>
      )}

      {GROUPS.map(({ type, label }) => {
        const items = (follows ?? []).filter((f) => f.entityType === type);
        if (items.length === 0) return null;
        return (
          <section key={type} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              {label} · {items.length}
            </h2>
            <ul className="space-y-2">
              {items.map((f) => (
                <li
                  key={f.followId}
                  className={`rounded-lg border p-3 space-y-1.5 ${
                    f.deprecated
                      ? "border-gray-800/60 bg-gray-900/20 opacity-60"
                      : "border-gray-800 bg-gray-900/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {f.href && !f.deprecated ? (
                      <Link
                        href={f.href}
                        className="text-sm text-gray-100 hover:text-white leading-snug"
                      >
                        {f.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-500 leading-snug">
                        {f.title}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => unfollow(f)}
                      className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
                    >
                      Unfollow
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-[10px] text-gray-500">
                    {f.deprecated ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500">
                        {type === "claim" || type === "trajectory"
                          ? "this claim was deprecated"
                          : "no longer available"}
                      </span>
                    ) : (
                      <>
                        {(type === "claim" || type === "trajectory") && f.status ? (
                          <EpistemicAxisBadge axis={f.status} />
                        ) : (
                          f.status && <span>{f.status}</span>
                        )}
                        {timeSince(f.lastMoveAt) && (
                          <span className="text-gray-600">{timeSince(f.lastMoveAt)}</span>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {(bookmarked?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Bookmarks · {bookmarked!.length}
          </h2>
          <ul className="space-y-2">
            {bookmarked!.map((c) => (
              <li
                key={c.id}
                className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/claims/${c.id}`}
                    className="text-sm text-gray-100 hover:text-white leading-snug"
                  >
                    {c.text.length > 220 ? c.text.slice(0, 219).trimEnd() + "…" : c.text}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeBookmark(c.id)}
                    className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  {c.epistemicAxis && <EpistemicAxisBadge axis={c.epistemicAxis} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
