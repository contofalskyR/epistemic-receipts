import Link from "next/link";
import { Newspaper, Activity, Database } from "lucide-react";
import {
  EVENT_WINDOW_DAYS,
  PIPELINE_WINDOW_DAYS,
  fmtDate,
  friendlyPipelineLabel,
  loadPipelineBuckets,
  loadRecentThresholdEvents,
  snippet,
} from "@/lib/feed";
import SinceLastVisit from "./SinceLastVisit";
import BookmarkedActivity from "./BookmarkedActivity";
import OnThisDay from "@/app/components/OnThisDay";


export const metadata = {
  title: "What's New — Epistemic Receipts",
  description:
    'Recent activity across the Epistemic Receipts pipelines — the latest claims, threshold events, and status transitions added to the graph.',
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT: "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED: "bg-yellow-900 text-yellow-300",
};

export default async function FeedPage() {
  const [pipelines, events] = await Promise.all([
    loadPipelineBuckets(),
    loadRecentThresholdEvents(),
  ]);

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
          <Newspaper size={22} className="text-amber-400" />
          What&apos;s new
        </h1>
        <p className="text-sm text-gray-400">
          Recent activity across the Epistemic Receipts pipelines, threshold
          events, and your saved claims.
        </p>
      </div>

      <SinceLastVisit />

      <OnThisDay />

      {/* Trajectory activity leads — these are claims with traced transitions */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-amber-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Trajectory activity · last {EVENT_WINDOW_DAYS} days
          </h2>
        </div>
        <p className="text-xs text-gray-600 -mt-1">
          Claims whose epistemic status crossed a recorded threshold — the most substantive updates in the graph.
        </p>

        {events.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center">
            <p className="text-sm text-gray-500">
              No threshold events in the last {EVENT_WINDOW_DAYS} days.
            </p>
          </div>
        )}

        {events.length > 0 && (
          <ul className="space-y-2">
            {events.map(e => (
              <li
                key={e.id}
                className="rounded-lg border border-gray-800 bg-gray-900/40 hover:bg-gray-900 transition-colors p-3"
              >
                <Link href={`/claims/${e.claimId}`} className="block space-y-1.5">
                  <p className="text-sm text-gray-100 leading-snug line-clamp-2">
                    {snippet(e.claimText, 160)}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE.HARD_FACT}`}>
                      threshold crossed
                    </span>
                    <span className="text-gray-500 font-mono">
                      {friendlyPipelineLabel(e.triggeredBy)}
                    </span>
                    <span className="text-gray-600 ml-auto">
                      {fmtDate(e.createdAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BookmarkedActivity />

      {/* Corpus growth — raw ingestion, secondary */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-gray-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Corpus growth · last {PIPELINE_WINDOW_DAYS} days
          </h2>
        </div>
        <p className="text-xs text-gray-600 -mt-1">
          Recently ingested baseline claims — reference records without traced trajectories yet.
        </p>

        {pipelines.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-800 p-6 text-center">
            <p className="text-sm text-gray-500">
              No new claims in the last {PIPELINE_WINDOW_DAYS} days.
            </p>
          </div>
        )}

        {pipelines.length > 0 && (
          <ul className="space-y-3">
            {pipelines.map(p => (
              <li
                key={p.ingestedBy}
                className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3"
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <Link
                    href={`/claims?ingestedBy=${encodeURIComponent(p.ingestedBy)}`}
                    className="group/link"
                  >
                    <span className="text-sm text-gray-300 group-hover/link:text-white">
                      {friendlyPipelineLabel(p.ingestedBy)}
                    </span>
                    <span className="ml-2 font-mono text-[10px] text-gray-700 break-all">
                      {p.ingestedBy}
                    </span>
                  </Link>
                  <span className="text-xs text-gray-500">
                    {p.count.toLocaleString()}{" "}
                    {p.count === 1 ? "new claim" : "new claims"}
                  </span>
                </div>
                {p.samples.length > 0 && (
                  <ul className="space-y-1.5 pl-1">
                    {p.samples.map(s => (
                      <li key={s.id} className="text-xs leading-snug">
                        <Link
                          href={`/claims/${s.id}`}
                          className="text-gray-400 hover:text-gray-100 transition-colors"
                        >
                          <span className="text-gray-600 mr-2">›</span>
                          {snippet(s.text)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
