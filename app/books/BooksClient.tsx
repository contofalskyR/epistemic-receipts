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

// ── Match job ──────────────────────────────────────────────────────────────────

type MatchJobState = {
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

const MATCH_IDLE: MatchJobState = {
  status: "idle",
  processed: 0,
  matched: 0,
  total: 0,
  errors: 0,
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

function statusBadge(status: string): string {
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

function pct(processed: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((processed / total) * 100));
}

// ── BookRow ────────────────────────────────────────────────────────────────────

function BookRow({
  book,
  onMatchedCountChange,
}: {
  book: SerializedBook;
  onMatchedCountChange: (id: string, n: number) => void;
}) {
  const [matchState, setMatchState] = useState<MatchJobState>(MATCH_IDLE);
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
      const data = (await r.json()) as MatchJobState;
      setMatchState(data);
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
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (matchState.status === "running" && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchStatus();
      }, 2000);
    }
    if (matchState.status !== "running" && pollRef.current) {
      stopPolling();
    }
  }, [matchState.status, fetchStatus, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  async function triggerMatch() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/books/${book.id}/match`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error ?? `HTTP ${r.status}`);
        if (data?.state) setMatchState(data.state as MatchJobState);
      } else if (data?.state) {
        setMatchState(data.state as MatchJobState);
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
            disabled={busy || matchState.status === "running"}
            className="text-xs px-3 py-1.5 rounded border border-blue-800 bg-blue-950 text-blue-200 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {matchState.status === "running"
              ? "Matching…"
              : busy
                ? "Starting…"
                : "Match against DB"}
          </button>
          <span
            className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${statusBadge(matchState.status)}`}
          >
            {matchState.status}
          </span>
        </div>
      </div>

      {(matchState.status === "running" || matchState.status === "done") &&
        matchState.total > 0 && (
          <div className="mt-3">
            <div className="h-1.5 w-full bg-neutral-800 rounded overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${pct(matchState.processed, matchState.total)}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1 tabular-nums">
              processed {matchState.processed} / {matchState.total} · matched{" "}
              {matchState.matched}
              {matchState.errors > 0 && (
                <span className="text-red-400">
                  {" "}
                  · errors {matchState.errors}
                </span>
              )}
            </p>
          </div>
        )}

      {matchState.status === "error" && (
        <p className="mt-2 text-xs text-red-400">
          Match job failed: {matchState.errorMessage ?? "(no message)"}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </li>
  );
}

// ── Upload form ────────────────────────────────────────────────────────────────

type UploadPhase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "ingesting"; bookId: string; ingestState: IngestJobState }
  | { kind: "matching"; bookId: string; matchState: MatchJobState }
  | { kind: "done"; bookId: string }
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
        // auto-trigger match job
        await triggerMatch(bookId, passphrase);
      } else if (data.status === "error") {
        stopPolling();
        setPhase({ kind: "error", message: data.errorMessage ?? "Ingest failed" });
      }
    } catch {
      // ignore transient errors
    }
  }

  async function pollMatchStatus(bookId: string) {
    try {
      const r = await fetch(`/api/books/${bookId}/match/status`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = (await r.json()) as MatchJobState;
      setPhase((prev) =>
        prev.kind === "matching" ? { kind: "matching", bookId, matchState: data } : prev,
      );
      if (data.status === "done") {
        stopPolling();
        setPhase({ kind: "done", bookId });
        // fetch the new book and add it to the list
        const bookRes = await fetch(`/api/books`, { cache: "no-store" });
        if (bookRes.ok) {
          const { books } = (await bookRes.json()) as { books: SerializedBook[] };
          const newBook = books.find((b) => b.id === bookId);
          if (newBook) onNewBook({ ...newBook, ingestedAt: new Date(newBook.ingestedAt).toISOString() });
        }
      } else if (data.status === "error") {
        stopPolling();
        setPhase({ kind: "error", message: data.errorMessage ?? "Match failed" });
      }
    } catch {
      // ignore transient errors
    }
  }

  async function triggerMatch(bookId: string, pass: string) {
    setPhase({ kind: "matching", bookId, matchState: { ...INGEST_IDLE, status: "running" } as unknown as MatchJobState });
    try {
      await fetch(`/api/books/${bookId}/match`, { method: "POST" });
    } catch {
      // best-effort; status poll will catch failures
    }
    pollRef.current = setInterval(() => pollMatchStatus(bookId), 2000);
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

  const isSubmitting = phase.kind === "uploading" || phase.kind === "ingesting" || phase.kind === "matching";

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
              : phase.kind === "matching"
                ? "Matching against DB…"
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

      {phase.kind === "matching" && (
        <ProgressBar
          label="Matching against DB"
          processed={phase.matchState.processed}
          total={phase.matchState.total}
          sub={`${phase.matchState.matched ?? 0} matches found`}
          color="bg-blue-500"
        />
      )}

      {phase.kind === "done" && (
        <p className="mt-3 text-xs text-green-400">
          Book uploaded, claims extracted, and matched against the knowledge graph. It appears in the list above.
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
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>(
    Object.fromEntries(initialBooks.map((b) => [b.id, b.matchCount])),
  );

  const updateMatchCount = useCallback((id: string, n: number) => {
    setMatchCounts((prev) => (prev[id] === n ? prev : { ...prev, [id]: n }));
  }, []);

  function handleNewBook(book: SerializedBook) {
    setBooks((prev) => {
      if (prev.some((b) => b.id === book.id)) return prev;
      return [book, ...prev];
    });
    setMatchCounts((prev) => ({ ...prev, [book.id]: book.matchCount }));
  }

  const enriched = books.map((b) => ({
    ...b,
    matchCount: matchCounts[b.id] ?? b.matchCount,
  }));

  return (
    <>
      {books.length === 0 ? (
        <p className="text-neutral-500 text-sm">No books ingested yet.</p>
      ) : (
        <ul className="space-y-3">
          {enriched.map((b) => (
            <BookRow key={b.id} book={b} onMatchedCountChange={updateMatchCount} />
          ))}
        </ul>
      )}

      <UploadForm onNewBook={handleNewBook} />
    </>
  );
}
