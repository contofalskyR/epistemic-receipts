"use client";
import Link from "next/link";
import { ErrorState } from "@/components/DataState";

// Segment error boundary — server-side DB failures while rendering a receipt
// surface here (shared state, STATUS.md Phase 5), never as an empty receipt.
export default function ClaimError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Link href="/" className="text-xs text-gray-500 hover:text-white">← back</Link>
      <ErrorState
        what="this receipt"
        detail={error.digest ? `ref ${error.digest}` : undefined}
        onRetry={reset}
      />
    </div>
  );
}
