"use client";
import Link from "next/link";
import { ErrorState } from "@/components/DataState";

// Root error boundary (STATUS.md Phase 5). Every server-rendered public page
// reads Postgres; when a query throws, the visitor gets the shared "couldn't
// load" state with Next's reset() instead of the framework's generic
// "Application error" page — and never an empty list.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-8">
      <Link href="/" className="text-xs text-gray-500 hover:text-white">← home</Link>
      <ErrorState
        what="this page"
        detail={error.digest ? `ref ${error.digest}` : undefined}
        onRetry={reset}
      />
    </div>
  );
}
