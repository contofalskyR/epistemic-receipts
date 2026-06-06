"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookmarkCheck } from "lucide-react";

const STORAGE_KEY = "er_profile_key";

type EventPreview = { eventType: string; createdAt: string };
type ClaimWithActivity = {
  claimId: string;
  claimText: string;
  currentStatus?: string;
  events: EventPreview[];
};

type State =
  | { kind: "loading" }
  | { kind: "no-profile" }
  | { kind: "empty" }
  | { kind: "ready"; claims: ClaimWithActivity[] };

function readKey(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function snippet(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export default function BookmarkedActivity() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const key = readKey();
    if (!key || key.length < 8) {
      setState({ kind: "no-profile" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/feed/bookmarked-activity?key=${encodeURIComponent(key)}`,
          { cache: "no-store" },
        );
        if (!r.ok) {
          if (!cancelled) setState({ kind: "empty" });
          return;
        }
        const data: { claims?: ClaimWithActivity[] } = await r.json();
        if (cancelled) return;
        const claims = data.claims ?? [];
        setState(
          claims.length === 0
            ? { kind: "empty" }
            : { kind: "ready", claims },
        );
      } catch {
        if (!cancelled) setState({ kind: "empty" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <BookmarkCheck size={14} className="text-gray-500" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Activity on your bookmarks · last 30 days
        </h2>
      </div>

      {state.kind === "loading" && (
        <p className="text-xs text-gray-600 italic">Checking your bookmarks…</p>
      )}

      {state.kind === "no-profile" && (
        <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center space-y-2">
          <p className="text-sm text-gray-400">No bookmarks yet.</p>
          <p className="text-xs text-gray-600">
            Save claims you want to follow — when they cross a threshold or get
            updated, you&apos;ll see it here.
          </p>
          <Link
            href="/bookmarks"
            className="inline-block mt-2 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            Go to bookmarks →
          </Link>
        </div>
      )}

      {state.kind === "empty" && (
        <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center">
          <p className="text-sm text-gray-500">
            No new activity on your bookmarks in the last 30 days.
          </p>
        </div>
      )}

      {state.kind === "ready" && (
        <ul className="space-y-2">
          {state.claims.map(c => (
            <li
              key={c.claimId}
              className="rounded-lg border border-gray-800 bg-gray-900/40 hover:bg-gray-900 transition-colors p-3 space-y-2"
            >
              <Link
                href={`/claims/${c.claimId}`}
                className="block text-sm text-gray-100 hover:text-white leading-snug"
              >
                {snippet(c.claimText)}
              </Link>
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                {c.events.slice(0, 4).map((e, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded-full font-medium bg-green-900 text-green-300">
                      threshold
                    </span>
                    <span className="text-gray-500 font-mono">
                      {e.eventType}
                    </span>
                    <span className="text-gray-600">{fmtDate(e.createdAt)}</span>
                  </li>
                ))}
                {c.events.length > 4 && (
                  <li className="text-gray-600">
                    +{c.events.length - 4} more
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
