import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
      <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">404 — Page not found</p>
      <h1 className="text-2xl font-semibold text-white">This page doesn&apos;t exist.</h1>
      <p className="text-sm text-gray-400 max-w-sm">
        The URL may be wrong, or the page was moved. Try searching or browsing from the start.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/start-here" className="text-amber-400 hover:text-amber-300 transition-colors">Start here →</Link>
        <Link href="/search" className="text-gray-400 hover:text-gray-200 transition-colors">Search</Link>
      </div>
    </div>
  );
}
