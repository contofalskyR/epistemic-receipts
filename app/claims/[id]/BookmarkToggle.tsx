"use client";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";

// Client leaf — server-renders as "not bookmarked" (profileKey is null until
// the mount effect reads localStorage), so SSR HTML and first client render match.
export default function BookmarkToggle({ claimId }: { claimId: string }) {
  const { isBookmarked, toggle, profileKey } = useBookmarks();
  const active = profileKey ? isBookmarked(claimId) : false;
  return (
    <button
      type="button"
      onClick={() => toggle(claimId)}
      className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 transition-colors ${
        active
          ? "bg-amber-900/60 text-amber-300 hover:bg-amber-900"
          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
      }`}
      title={active ? "Remove bookmark" : "Bookmark this claim"}
      aria-pressed={active}
    >
      {active ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
      <span>{active ? "Bookmarked" : "Bookmark"}</span>
    </button>
  );
}
