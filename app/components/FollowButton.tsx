"use client";
import { useEffect, useState } from "react";
import { Radio, Check } from "lucide-react";
import { getOrCreateProfileKey } from "@/hooks/useBookmarks";

/**
 * FollowButton (B12-2) — anonymous-first follow toggle, same visual weight as
 * CitationButton/BookmarkToggle. No email promise anywhere: following surfaces
 * the entity's dated moves on /following, the /feed digest, and the personal
 * RSS feed. Never gates content.
 */

type EntityType = "claim" | "trajectory" | "topic" | "domain" | "story";

const STORAGE_KEY = "er_profile_key";

function readKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export default function FollowButton({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  // Server-renders as "not following" so SSR HTML and first client render match.
  const [followed, setFollowed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = readKey();
    if (!key) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ key, entityType, entityId });
        const r = await fetch(`/api/follow/check?${qs}`, { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const data: { followed?: boolean } = await r.json();
        if (!cancelled) setFollowed(Boolean(data.followed));
      } catch {
        /* stay at "not following" */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  async function toggle() {
    const key = getOrCreateProfileKey();
    const was = followed;
    setFollowed(!was);
    setError(null);
    try {
      const r = await fetch("/api/follow", {
        method: was ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, entityType, entityId }),
      });
      if (!r.ok) {
        setFollowed(was);
        const data: { error?: string } = await r.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Try again.");
      }
    } catch {
      setFollowed(was);
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-colors ${
          followed
            ? "bg-amber-900/60 text-amber-300 hover:bg-amber-900"
            : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
        }`}
        title={
          followed
            ? "Unfollow — remove from your /following page"
            : "Follow the dated trajectory — every move shows on your /following page and feed"
        }
        aria-pressed={followed}
      >
        {followed ? <Check size={12} /> : <Radio size={12} />}
        <span>{followed ? "Following" : "Follow"}</span>
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
