"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MatchJobState } from "@/lib/bookMatchJob";

type MatchDetail = {
  matchId: string;
  bookClaimText: string;
  claimId: string;
  claimText: string;
  matchType: string;
  reason: string | null;
  similarityScore: number;
};

const MATCH_TYPE_COLORS: Record<string, string> = {
  SUPPORTS: "bg-green-900/70 text-green-300 border-green-700",
  CONTRADICTS: "bg-red-900/70 text-red-300 border-red-700",
  RELATED: "bg-amber-900/70 text-amber-300 border-amber-700",
  UNVERIFIED: "bg-gray-800/70 text-gray-400 border-gray-700",
};

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

// ── Ingest job ─────────────────────────────────────────────────────────────────

type IngestJobState = {
  status: "idle" | "running" | "done" | "error";
  processed: number;
  total: number;
  claimCount: number;
  errors: number;
  errorMessage?: string;
};

const INGEST_IDLE: IngestJobState = {
  status: "idle",
  processed: 0,
  total: 0,
  claimCount: 0,
  errors: 0,
};

// ── Shared helpers ─────────────────────────────────────────────────────────────

function pct(processed: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((processed / total) * 100));
}

// ── BookRow ────────────────────────────────────────────────────────────────────

type MatchState =
  | { kind: "idle" }
  | { kind: "prompting" }
  | { kind: "starting" }
  | { kind: "running"; state: MatchJobState }
  | { kind: "done"; matched: number }
  | { kind: "error"; message: string };

function BookRow({ book }: { book: SerializedBook }) {
  const [matchState, setMatchState] = useState<MatchState>({ kind: "idle" });
  const [localMatchCount, setLocalMatchCount] = useState(book.matchCount);
  const [passphrase, setPassphrase] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailMatches, setDetailMatches] = useState<MatchDetail[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailPage, setDetailPage] = useState(1);
  const [loadingDetail, setLoadingDetail] = useState(false);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => () => stopPolling(), []);

  async function openDetail() {
    if (detailOpen) {
      setDetailOpen(false);
      return;
    }
    setDetailOpen(true);
    if (detailMatches.length > 0) return;
    setLoadingDetail(true);
    try {
      const r = await fetch(`/api/books/${book.id}/matches?page=1&limit=20`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = (await r.json()) as {
        total: number;
        page: number;
        matches: MatchDetail[];
      };
      setDetailMatches(data.matches);
      setDetailTotal(data.total);
      setDetailPage(1);
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }

  async function loadMoreDetail() {
    const nextPage = detailPage + 1;
    setLoadingDetail(true);
    try {
      const r = await fetch(
        `/api/books/${book.id}/matches?page=${nextPage}&limit=20`,
        { cache: "no-store" },
      );
      if (!r.ok) return;
      const data = (await r.json()) as {
        total: number;
        page: number;
        matches: MatchDetail[];
      };
      setDetailMatches((prev) => [...prev, ...data.matches]);
      setDetailPage(nextPage);
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }

  async function pollStatus() {
    try {
      const r = await fetch(`/api/books/${book.id}/match/status`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = (await r.json()) as MatchJobState;
      if (data.status === "running") {
        setMatchState({ kind: "running", state: data });
      } else if (data.status === "done") {
        stopPolling();
        setLocalMatchCount(data.matched);
        setMatchState({ kind: "done", matched: data.matched });
      } else if (data.status === "error") {
        stopPolling();
        setMatchState({
          kind: "error",
          message: data.errorMessage ?? "Match failed",
        });
      }
    } catch {
      // ignore transient poll errors
    }
  }

  async function startMatch() {
    setMatchState({ kind: "starting" });
    try {
      const r = await fetch(`/api/books/${book.id}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (r.status === 401) {
        // Fallback: notify via request-analysis Telegram ping
        await fetch(`/api/books/${book.id}/request-analysis`, {
          method: "POST",
        }).catch(() => undefined);
        setMatchState({
          kind: "error",
          message: "Auth failed — analysis request sent to RobClaw",
        });
        return;
      }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setMatchState({
          kind: "error",
          message: data?.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      setMatchState({
        kind: "running",
        state: { status: "running", processed: 0, matched: 0, total: 0, errors: 0 },
      });
      pollRef.current = setInterval(pollStatus, 2000);
    } catch (e) {
      setMatchState({
        kind: "error",
        message: e instanceof Error ? e.message : "Request failed",
      });
    }
  }

  const hasMore = detailMatches.length < detailTotal;

  return (
    <li className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
      <div className="p-4">
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
              {localMatchCount} graph matches · ingested{" "}
              {book.ingestedAt.slice(0, 10)}
            </p>
            {book.sourceUrl && (
              <p className="text-xs text-neutral-600 mt-1 truncate">
                {book.sourceUrl}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {matchState.kind === "idle" && (
              <button
                onClick={() => setMatchState({ kind: "prompting" })}
                className="text-xs px-3 py-1.5 rounded border border-blue-800 bg-blue-950 text-blue-200 hover:bg-blue-900 transition-colors"
              >
                {localMatchCount === 0 ? "Connect to Graph" : "Re-match"}
              </button>
            )}
            {matchState.kind === "prompting" && (
              <button
                onClick={() => {
                  setMatchState({ kind: "idle" });
                  setPassphrase("");
                }}
                className="text-xs px-3 py-1.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
            )}
            {matchState.kind === "starting" && (
              <button
                disabled
                className="text-xs px-3 py-1.5 rounded border border-blue-800 bg-blue-950 text-blue-200 opacity-50 cursor-not-allowed"
              >
                Starting…
              </button>
            )}
            {matchState.kind === "done" && (
              <span className="text-xs text-green-400">
                ✓ {matchState.matched} matches
              </span>
            )}
            {matchState.kind === "error" && (
              <button
                onClick={() => setMatchState({ kind: "idle" })}
                className="text-xs px-3 py-1.5 rounded border border-red-800 bg-red-950 text-red-200 hover:bg-red-900 transition-colors"
              >
                Error — retry?
              </button>
            )}
            {localMatchCount > 0 && (
              <button
                onClick={openDetail}
                className="text-xs px-3 py-1.5 rounded border border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
              >
                {detailOpen ? "Hide matches" : "View matches"}
              </button>
            )}
          </div>
        </div>

        {matchState.kind === "prompting" && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && passphrase && startMatch()}
              placeholder="passphrase"
              className="text-xs bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-blue-700 w-36"
            />
            <button
              onClick={startMatch}
              disabled={!passphrase}
              className="text-xs px-3 py-1.5 rounded border border-blue-800 bg-blue-950 text-blue-200 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Run
            </button>
          </div>
        )}

        {matchState.kind === "running" && (
          <ProgressBar
            label="Matching to graph"
            processed={matchState.state.processed}
            total={matchState.state.total}
            sub={`${matchState.state.matched} matches found`}
            color="bg-blue-500"
          />
        )}

        {matchState.kind === "error" && (
          <p className="mt-2 text-xs text-red-400">{matchState.message}</p>
        )}
      </div>

      {detailOpen && (
        <div className="border-t border-neutral-800">
          <div className="px-4 py-3 flex items-center justify-between bg-neutral-950/50">
            <p className="text-sm font-medium text-neutral-200">
              {book.title} —{" "}
              <span className="text-neutral-400 font-normal">
                {detailTotal} match{detailTotal !== 1 ? "es" : ""}
              </span>
            </p>
            <button
              onClick={() => setDetailOpen(false)}
              className="text-neutral-500 hover:text-neutral-300 text-lg leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="px-4 pb-4 space-y-3 pt-3">
            {loadingDetail && detailMatches.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 rounded-full border-2 border-neutral-600 border-t-neutral-300 animate-spin" />
              </div>
            )}

            {detailMatches.map((m) => (
              <div
                key={m.matchId}
                className="bg-neutral-800 border border-neutral-700 rounded-lg p-3"
              >
                <div className="grid grid-cols-2 gap-3">
                  <p className="text-sm italic text-neutral-300 line-clamp-4">
                    {m.bookClaimText}
                  </p>
                  <Link
                    href={`/claims/${m.claimId}`}
                    className="text-sm text-neutral-300 line-clamp-4 hover:text-blue-400 transition-colors"
                  >
                    {m.claimText}
                  </Link>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                      MATCH_TYPE_COLORS[m.matchType] ??
                      "bg-gray-800/70 text-gray-400 border-gray-700"
                    }`}
                  >
                    {m.matchType}
                  </span>
                  {m.reason && (
                    <span className="text-xs text-neutral-500">{m.reason}</span>
                  )}
                </div>
              </div>
            ))}

            {hasMore && (
              <button
                onClick={loadMoreDetail}
                disabled={loadingDetail}
                className="w-full text-xs py-2 rounded border border-neutral-700 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingDetail ? "Loading…" : `Load more (${detailTotal - detailMatches.length} remaining)`}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

// ── Upload form ────────────────────────────────────────────────────────────────

type UploadPhase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "ingesting"; bookId: string; ingestState: IngestJobState }
  | { kind: "requesting"; bookId: string }
  | { kind: "done"; bookId: string; matchCount: number; pendingReasons: number }
  | { kind: "error"; message: string };

function UploadForm({ onNewBook }: { onNewBook: (book: SerializedBook) => void }) {
  const [phase, setPhase] = useState<UploadPhase>({ kind: "idle" });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollIngestStatus(bookId: string) {
    try {
      const r = await fetch(`/api/books/${bookId}/ingest/status`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = (await r.json()) as IngestJobState;
      setPhase((prev) =>
        prev.kind === "ingesting" ? { kind: "ingesting", bookId, ingestState: data } : prev,
      );
      if (data.status === "done") {
        stopPolling();
        await requestAnalysisAndFinish(bookId);
      } else if (data.status === "error") {
        stopPolling();
        setPhase({ kind: "error", message: data.errorMessage ?? "Ingest failed" });
      }
    } catch {
      // ignore transient errors
    }
  }

  async function requestAnalysisAndFinish(bookId: string) {
    setPhase({ kind: "requesting", bookId });
    let matchCount = 0;
    let pendingReasons = 0;
    try {
      const r = await fetch(`/api/books/${bookId}/request-analysis`, {
        method: "POST",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPhase({
          kind: "error",
          message: data?.error ?? `Analysis request failed (${r.status})`,
        });
        return;
      }
      matchCount = data?.matchCount ?? 0;
      pendingReasons = data?.pendingReasons ?? 0;
    } catch (e) {
      setPhase({
        kind: "error",
        message: e instanceof Error ? e.message : "Analysis request failed",
      });
      return;
    }

    setPhase({ kind: "done", bookId, matchCount, pendingReasons });

    const bookRes = await fetch(`/api/books`, { cache: "no-store" });
    if (bookRes.ok) {
      const { books } = (await bookRes.json()) as { books: SerializedBook[] };
      const newBook = books.find((b) => b.id === bookId);
      if (newBook) {
        onNewBook({
          ...newBook,
          ingestedAt: new Date(newBook.ingestedAt).toISOString(),
        });
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim() || !passphrase) return;

    stopPolling();
    setPhase({ kind: "uploading" });

    const form = new FormData();
    form.append("file", file);
    form.append("title", title.trim());
    if (author.trim()) form.append("author", author.trim());
    form.append("passphrase", passphrase);

    let bookId: string;
    try {
      const r = await fetch("/api/books/upload", { method: "POST", body: form });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPhase({ kind: "error", message: data?.error ?? `Upload failed (${r.status})` });
        return;
      }
      bookId = data.bookId as string;
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Upload failed" });
      return;
    }

    // Kick off ingest
    setPhase({ kind: "ingesting", bookId, ingestState: { ...INGEST_IDLE, status: "running" } });
    try {
      await fetch(`/api/books/${bookId}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
    } catch {
      // best-effort; status poll will catch failures
    }
    pollRef.current = setInterval(() => pollIngestStatus(bookId), 2000);
  }

  const isSubmitting =
    phase.kind === "uploading" ||
    phase.kind === "ingesting" ||
    phase.kind === "requesting";

  return (
    <section className="mt-10 rounded-md border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="text-sm font-semibold text-neutral-200 mb-3">Add a book</h2>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">
            File <span className="text-neutral-600">(PDF or .txt)</span>
          </label>
          <input
            type="file"
            accept=".pdf,.txt"
            disabled={isSubmitting}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-neutral-300 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-neutral-700 file:bg-neutral-800 file:text-neutral-300 file:cursor-pointer file:hover:bg-neutral-700 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Thinking, Fast and Slow"
            className="w-full text-xs bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-blue-700 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1">Author</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Daniel Kahneman"
            className="w-full text-xs bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-blue-700 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-1">
            Passphrase <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={isSubmitting}
            placeholder="••••••••"
            className="w-full text-xs bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-blue-700 disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !file || !title.trim() || !passphrase}
          className="text-xs px-4 py-1.5 rounded border border-blue-800 bg-blue-950 text-blue-200 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {phase.kind === "uploading"
            ? "Uploading…"
            : phase.kind === "ingesting"
              ? "Extracting claims…"
              : phase.kind === "requesting"
                ? "Pinging RobClaw…"
                : "Upload & Ingest"}
        </button>
      </form>

      {/* Progress */}
      {phase.kind === "ingesting" && (
        <ProgressBar
          label="Extracting claims"
          processed={phase.ingestState.processed}
          total={phase.ingestState.total}
          sub={`${phase.ingestState.claimCount} claims found`}
          color="bg-purple-500"
        />
      )}

      {phase.kind === "requesting" && (
        <p className="mt-3 text-xs text-neutral-400">
          Requesting analysis from RobClaw…
        </p>
      )}

      {phase.kind === "done" && (
        <p className="mt-3 text-xs text-green-400">
          Book uploaded and claims extracted. Analysis requested — RobClaw
          will review {phase.matchCount} matches ({phase.pendingReasons} need
          reasons).
        </p>
      )}

      {phase.kind === "error" && (
        <p className="mt-3 text-xs text-red-400">{phase.message}</p>
      )}
    </section>
  );
}

function ProgressBar({
  label,
  processed,
  total,
  sub,
  color,
}: {
  label: string;
  processed: number;
  total: number;
  sub: string;
  color: string;
}) {
  const p = pct(processed, total);
  return (
    <div className="mt-3">
      <p className="text-[11px] text-neutral-400 mb-1">{label}</p>
      <div className="h-1.5 w-full bg-neutral-800 rounded overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: total > 0 ? `${p}%` : "100%", opacity: total > 0 ? 1 : 0.4 }}
        />
      </div>
      <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
        {total > 0 ? `${processed} / ${total}` : "starting…"} · {sub}
      </p>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function BooksClient({ books: initialBooks }: { books: SerializedBook[] }) {
  const [books, setBooks] = useState<SerializedBook[]>(initialBooks);

  function handleNewBook(book: SerializedBook) {
    setBooks((prev) => {
      if (prev.some((b) => b.id === book.id)) return prev;
      return [book, ...prev];
    });
  }

  return (
    <>
      {books.length === 0 ? (
        <p className="text-neutral-500 text-sm">No books ingested yet.</p>
      ) : (
        <ul className="space-y-3">
          {books.map((b) => (
            <BookRow key={b.id} book={b} />
          ))}
        </ul>
      )}

      <UploadForm onNewBook={handleNewBook} />
    </>
  );
}
