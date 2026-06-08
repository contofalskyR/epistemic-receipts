"use client";

import Link from "next/link";

export default function FinancialError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 py-10">
      <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Financial</p>
      <h1 className="text-2xl font-semibold text-white">Something went wrong loading this view.</h1>
      <p className="text-sm text-gray-400 max-w-xl leading-relaxed">
        The financial data couldn&apos;t be loaded. This is most often a temporary database or upstream API hiccup.
      </p>
      {error.digest && (
        <p className="text-[11px] font-mono text-gray-600">ref: {error.digest}</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/financial?tab=congress"
          className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
        >
          Go to Congress Trades
        </Link>
      </div>
    </div>
  );
}
