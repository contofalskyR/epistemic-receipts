"use client";
import Link from "next/link";

// Segment error boundary — replaces the old client page's fetchError view
// (server-side DB failures now surface here instead of a fetch catch).
export default function ClaimError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4">
      <Link href="/" className="text-xs text-gray-500 hover:text-white">← back</Link>
      <p className="text-red-500 text-sm">
        Something went wrong loading this receipt.{" "}
        <button onClick={reset} className="underline underline-offset-2 hover:text-red-400">
          Try again
        </button>
      </p>
    </div>
  );
}
