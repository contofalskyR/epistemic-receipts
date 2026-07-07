"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const params = useSearchParams();
  const error = params.get("error");

  const messages: Record<string, string> = {
    Verification: "The sign-in link has expired or has already been used. Please request a new one.",
    Default: "Something went wrong. Please try signing in again.",
  };

  return (
    <div className="max-w-xs space-y-4">
      <h1 className="text-lg font-semibold text-white">Sign-in error</h1>
      <p className="text-sm text-gray-400">
        {messages[error ?? ""] ?? messages.Default}
      </p>
      <a
        href="/auth/signin"
        className="inline-block rounded bg-white text-gray-950 text-sm font-medium px-4 py-2 hover:bg-gray-200 transition-colors"
      >
        Try again
      </a>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  );
}
