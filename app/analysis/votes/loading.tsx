// Streaming fallback for the vote-analysis page. buildVoteAnalysis() scans
// ~500k MemberVote rows on cache misses, which can take 10–20s; without this
// file the route renders a black screen the whole time.
export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 animate-pulse" aria-busy="true">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-gray-800" />
        <div className="h-7 w-72 rounded bg-gray-800" />
        <div className="h-4 w-full max-w-xl rounded bg-gray-900" />
        <div className="h-4 w-96 rounded bg-gray-900" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-gray-800 bg-gray-900/40" />
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Crunching contested-vote statistics across ~50k recorded votes…
      </p>
      <div className="h-64 rounded-lg border border-gray-800 bg-gray-900/40" />
      <div className="h-64 rounded-lg border border-gray-800 bg-gray-900/40" />
    </div>
  );
}
