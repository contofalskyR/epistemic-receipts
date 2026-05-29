"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type SerializedBook = {
  id: string;
  title: string;
  author: string | null;
  sourceUrl: string | null;
  ingestedAt: string;
  chunkCount: number;
  claimCount: number;
  matchCount: number;
};

type JobState = {
  status: "idle" | "running" | "done" | "error";
  processed: number;
  matched: number;
  total: number;
  errors: number;
  startedAt?: number;
  finishedAt?: number;
  errorMessage?: string;
  dbMatchCount?: number;
};

const IDLE: JobState = {
  status: "idle",
  processed: 0,
  matched: 0,
  total: 0,
  errors: 0,
};

function statusBadge(status: JobState["status"]): string {
  switch (status) {
    case "running":
      return "bg-blue-950 text-blue-300 border border-blue-800";
    case "done":
      return "bg-green-950 text-green-300 border border-green-800";
    case "error":
      return "bg-red-950 text-red-300 border border-red-800";
    default:
      return "bg-neutral-800 text-neutral-400 border border-neutral-700";
  }
}

function pct(state: JobState): number {
  if (!state.total) return 0;
  return Math.min(100, Math.round((state.processed / state.total) * 100));
}

function BookRow({
  book,
  onMatchedCountChange,
}: {
  book: SerializedBook;
  onMatchedCountChange: (id: string, n: number) => void;
}) {
  const [state, setState] = useState<JobState>(IDLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`/api/books/${book.id}/match/status`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = (await r.json()) as JobState;
      setState(data);
      if (typeof data.dbMatchCount === "number") {
        onMatchedCountChange(book.id, data.dbMatchCount);
      }
      if (data.status === "done" || data.status === "error") {
        stopPolling();
      }
    } catch {
      // ignore transient fetch errors
    }
  }, [book.id, onMatchedCountChange, stopPolling]);

  useEffect(() => {
    // On mount, take one snapshot — if a job is already running, start polling.
    fetchStatus().then(() => {
      // setState inside fetchStatus is async; rely on state in the next effect tick.
    });
  }, [fetchStatus]);

  useEffect(() => {
    if (state.status === "running" && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchStatus();
      }, 2000);
    }
    if (state.status !== "running" && pollRef.current) {
      stopPolling();
    }
    return () => {
      // do not stop on every re-render; cleanup happens in stopPolling and on unmount below.
    };
  }, [state.status, fetchStatus, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  async function triggerMatch() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/books/${book.id}/match`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error ?? `HTTP ${r.status}`);
        if (data?.state) setState(data.state as JobState);
      } else if (data?.state) {
        setState(data.state as JobState);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/reader/${book.id}`}
            className="text-lg font-medium text-neutral-100 hover:text-blue-400"
          >
            {book.title}
          </Link>
          {book.author && (
            <p className="text-neutral-400 text-sm mt-1">by {book.author}</p>
          )}
          <p className="text-xs text-neutral-500 mt-2">
            {book.chunkCount} paragraphs · {book.claimCount} extracted claims ·{" "}
            {book.matchCount} graph matches · ingested{" "}
            {book.ingestedAt.slice(0, 10)}
          </p>
          {book.sourceUrl && (
            <p className="text-xs text-neutral-600 mt-1 truncate">
              {book.sourceUrl}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <button
            onClick={triggerMatch}
            disabled={busy || state.status === "running"}
            className="text-xs px-3 py-1.5 rounded border border-blue-800 bg-blue-950 text-blue-200 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state.status === "running"
              ? "Matching…"
              : busy
                ? "Starting…"
                : "Match against DB"}
          </button>
          <span
            className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${statusBadge(state.status)}`}
          >
            {state.status}
          </span>
        </div>
      </div>

      {(state.status === "running" || state.status === "done") &&
        state.total > 0 && (
          <div className="mt-3">
            <div className="h-1.5 w-full bg-neutral-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${pct(state)}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
              processed {state.processed} / {state.total} · matched{" "}
              {state.matched}
              {state.errors > 0 && (
                <span className="text-red-400">
                  {" "}
                  · errors {state.errors}
                </span>
              )}
            </p>
          </div>
        )}

      {state.status === "error" && (
        <p className="mt-2 text-xs text-red-400">
          Match job failed: {state.errorMessage ?? "(no message)"}
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </li>
  );
}

export default function BooksClient({ books }: { books: SerializedBook[] }) {
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>(
    Object.fromEntries(books.map((b) => [b.id, b.matchCount])),
  );

  const updateMatchCount = useCallback((id: string, n: number) => {
    setMatchCounts((prev) => (prev[id] === n ? prev : { ...prev, [id]: n }));
  }, []);

  if (books.length === 0) {
    return (
      <p className="text-neutral-500 text-sm">
        No books ingested yet. See the box below to add one.
      </p>
    );
  }

  const enriched = books.map((b) => ({
    ...b,
    matchCount: matchCounts[b.id] ?? b.matchCount,
  }));

  return (
    <ul className="space-y-3">
      {enriched.map((b) => (
        <BookRow key={b.id} book={b} onMatchedCountChange={updateMatchCount} />
      ))}
    </ul>
  );
}
