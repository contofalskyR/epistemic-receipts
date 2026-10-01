"use client";

import Link from "next/link";

// The three states of a DB-backed public page, with three different sentences
// (STATUS.md Phase 5, 2026-09-30):
//
//   LoadingState — the request is in flight.
//   EmptyState   — the request succeeded and matched nothing. Say what was
//                  filtered ("No opinions for this filter"), not just "No results".
//   ErrorState   — the request failed. This is never shown as a zero: a page
//                  that cannot reach Postgres says so and offers Retry.
//
// Client components switch on a `status` and render one of these; server
// components use EmptyState for empty lists and let a thrown error reach
// app/error.tsx, which renders ErrorState with Next's reset().

type Action = { label: string; href: string } | { label: string; onClick: () => void };

export function LoadingState({
  label = "Loading…",
  lines = 3,
  className = "",
}: {
  label?: string;
  /** Skeleton rows under the label; 0 for a one-line indicator. */
  lines?: number;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={`space-y-3 py-6 ${className}`}>
      <p className="text-sm text-gray-500">{label}</p>
      {lines > 0 && (
        <div aria-hidden className="space-y-2 animate-pulse">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-3 rounded bg-gray-800/70"
              style={{ width: `${[72, 88, 61, 80, 55][i % 5]}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  className = "",
}: {
  /** What matched nothing, in the user's terms: "No opinions for this filter". */
  title: string;
  /** How to get out of it: "Clear the court or date filter." */
  hint?: string;
  action?: Action;
  className?: string;
}) {
  return (
    <div
      className={`rounded border border-dashed border-gray-800 px-4 py-6 text-sm ${className}`}
    >
      <p className="italic text-gray-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-600">{hint}</p>}
      {action && <ActionLink action={action} />}
    </div>
  );
}

export function ErrorState({
  what,
  detail,
  onRetry,
  className = "",
}: {
  /** What could not be loaded: "opinions", "this topic", "the trajectory list". */
  what: string;
  /** Optional short diagnostic ("HTTP 503"); never the stack. */
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded border border-red-900/60 bg-red-950/20 px-4 py-5 text-sm ${className}`}
    >
      <p className="font-medium text-red-300">Couldn&apos;t load {what}.</p>
      <p className="mt-1 text-xs text-gray-500">
        The database did not answer{detail ? ` (${detail})` : ""}. Nothing is missing — this is a
        failed request, not an empty result.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded border border-gray-700 px-3 py-1 text-xs text-gray-200 hover:border-gray-500 hover:text-white transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function ActionLink({ action }: { action: Action }) {
  const cls =
    "mt-3 inline-block text-xs text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline";
  if ("href" in action) {
    return (
      <Link href={action.href} className={cls}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}
