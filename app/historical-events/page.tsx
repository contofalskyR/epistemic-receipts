import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export const metadata = { title: "Historical Events — Epistemic Receipts" };

const CATEGORY_COLORS: Record<string, string> = {
  DIPLOMATIC: "bg-blue-900/40 text-blue-300 border-blue-800/60",
  INTELLIGENCE: "bg-purple-900/40 text-purple-300 border-purple-800/60",
  MILITARY: "bg-red-900/40 text-red-300 border-red-800/60",
  LEGISLATIVE: "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
};

function formatYear(d: Date | null): string {
  if (!d) return "?";
  return String(d.getUTCFullYear());
}

export default async function HistoricalEventsPage() {
  const events = await prisma.historicalEvent.findMany({
    orderBy: [{ startDate: "asc" }],
    include: {
      _count: { select: { claims: true, votes: true, polities: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-800 pb-6">
        <h1 className="text-xl font-semibold text-white">Historical Events</h1>
        <p className="mt-2 text-sm text-gray-500">
          Cross-cutting historical events linking the claim graph to legislative votes and
          historical polities. Each event aggregates contemporaneous Congressional roll calls,
          state actors, and curated claims for the period.
        </p>
      </div>

      <div className="grid gap-4">
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/historical-events/${e.slug}`}
            className="block rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4 hover:border-gray-600 hover:bg-gray-900/70 transition-colors group"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-white group-hover:text-gray-100">
                    {e.name}
                  </h2>
                  {e.category && (
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${CATEGORY_COLORS[e.category] ?? "bg-gray-800 text-gray-400 border-gray-700"}`}>
                      {e.category}
                    </span>
                  )}
                  <span className="text-xs font-mono text-gray-500">
                    {formatYear(e.startDate)}
                    {e.startDate && e.endDate && formatYear(e.startDate) !== formatYear(e.endDate)
                      ? `–${formatYear(e.endDate)}`
                      : ""}
                  </span>
                </div>
                {e.description && (
                  <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{e.description}</p>
                )}
              </div>
              <div className="flex-shrink-0 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-base font-mono text-white">{e._count.votes.toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">Votes</div>
                </div>
                <div>
                  <div className="text-base font-mono text-white">{e._count.claims.toLocaleString()}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">Claims</div>
                </div>
                <div>
                  <div className="text-base font-mono text-white">{e._count.polities}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">Polities</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
