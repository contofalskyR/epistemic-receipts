"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const STORAGE_KEY = "er_last_visit";
const MIN_WINDOW_MS = 60 * 1000;
const MAX_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

type State =
  | { kind: "loading" }
  | { kind: "welcome" }
  | { kind: "count"; count: number; since: string };

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

function fmtRelative(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "earlier";
  const diffMs = Date.now() - then.getTime();
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 1) return "moments ago";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "about a month ago";
  return `${months} months ago`;
}

export default function SinceLastVisit() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const previous = readStored();
    const nowIso = new Date().toISOString();
    writeStored(nowIso);

    if (!previous) {
      setState({ kind: "welcome" });
      return;
    }

    const parsed = new Date(previous);
    if (Number.isNaN(parsed.getTime())) {
      setState({ kind: "welcome" });
      return;
    }

    const ageMs = Date.now() - parsed.getTime();
    if (ageMs < MIN_WINDOW_MS) {
      setState({ kind: "count", count: 0, since: previous });
      return;
    }
    if (ageMs > MAX_WINDOW_MS) {
      setState({ kind: "welcome" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/feed/new-since?since=${encodeURIComponent(previous)}`,
          { cache: "no-store" },
        );
        if (!r.ok) {
          if (!cancelled) setState({ kind: "welcome" });
          return;
        }
        const data: { count?: number; since?: string | null } = await r.json();
        if (cancelled) return;
        if (typeof data.count === "number" && data.since) {
          setState({ kind: "count", count: data.count, since: data.since });
        } else {
          setState({ kind: "welcome" });
        }
      } catch {
        if (!cancelled) setState({ kind: "welcome" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-amber-400" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-amber-300">
          Since your last visit
        </h2>
      </div>

      {state.kind === "loading" && (
        <p className="text-sm text-gray-500 italic">Loading…</p>
      )}

      {state.kind === "welcome" && (
        <p className="text-sm text-gray-300 leading-snug">
          Welcome — here&apos;s what&apos;s been added recently. Browse the
          sections below for the latest claims and threshold events.
        </p>
      )}

      {state.kind === "count" && (
        <p className="text-sm text-gray-200 leading-snug">
          <span className="text-amber-300 font-semibold">
            {state.count.toLocaleString()}
          </span>{" "}
          new {state.count === 1 ? "claim" : "claims"} added since you were last
          here ({fmtRelative(state.since)}).{" "}
          <Link
            href="/claims?sort=recent"
            className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >
            See the newest →
          </Link>
        </p>
      )}
    </section>
  );
}
