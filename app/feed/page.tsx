import Link from "next/link";
import { Newspaper, Activity, Database } from "lucide-react";
import { prisma } from "@/lib/prisma";
import SinceLastVisit from "./SinceLastVisit";
import BookmarkedActivity from "./BookmarkedActivity";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PIPELINE_WINDOW_DAYS = 7;
const PIPELINE_LIMIT = 6;
const SAMPLES_PER_PIPELINE = 3;
const EVENT_WINDOW_DAYS = 7;
const EVENT_LIMIT = 10;
const SNIPPET_LEN = 80;

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT: "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED: "bg-yellow-900 text-yellow-300",
};

function snippet(text: string, max = SNIPPET_LEN): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type PipelineBucket = {
  ingestedBy: string;
  count: number;
  samples: { id: string; text: string }[];
};

async function loadPipelineBuckets(): Promise<PipelineBucket[]> {
  const since = new Date(Date.now() - PIPELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const grouped = await prisma.claim.groupBy({
    by: ["ingestedBy"],
    where: { deleted: false, createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { ingestedBy: "desc" } },
    take: PIPELINE_LIMIT,
  });

  if (grouped.length === 0) return [];

  const ingestedByList = grouped.map(g => g.ingestedBy);
  const samples = await prisma.claim.findMany({
    where: {
      deleted: false,
      createdAt: { gte: since },
      ingestedBy: { in: ingestedByList },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true, ingestedBy: true, createdAt: true },
    take: ingestedByList.length * SAMPLES_PER_PIPELINE * 4,
  });

  const byPipeline = new Map<string, { id: string; text: string }[]>();
  for (const c of samples) {
    const bucket = byPipeline.get(c.ingestedBy) ?? [];
    if (bucket.length < SAMPLES_PER_PIPELINE) {
      bucket.push({ id: c.id, text: c.text });
      byPipeline.set(c.ingestedBy, bucket);
    }
  }

  return grouped.map(g => ({
    ingestedBy: g.ingestedBy,
    count: g._count._all,
    samples: byPipeline.get(g.ingestedBy) ?? [],
  }));
}

type RecentEvent = {
  id: string;
  claimId: string;
  claimText: string;
  triggeredBy: string;
  createdAt: Date;
};

async function loadRecentThresholdEvents(): Promise<RecentEvent[]> {
  const since = new Date(Date.now() - EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const events = await prisma.thresholdEvent.findMany({
    where: { deleted: false, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: EVENT_LIMIT,
    select: {
      id: true,
      claimId: true,
      triggeredBy: true,
      createdAt: true,
      claim: { select: { text: true, deleted: true } },
    },
  });
  return events
    .filter(e => e.claim && !e.claim.deleted)
    .map(e => ({
      id: e.id,
      claimId: e.claimId,
      claimText: e.claim!.text,
      triggeredBy: e.triggeredBy,
      createdAt: e.createdAt,
    }));
}

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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-gray-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Recent claims by pipeline · last {PIPELINE_WINDOW_DAYS} days
          </h2>
        </div>

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
                    className="font-mono text-sm text-amber-300 hover:text-amber-200 break-all"
                  >
                    {p.ingestedBy}
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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-gray-500" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Recent threshold events · last {EVENT_WINDOW_DAYS} days
          </h2>
        </div>

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
                      {e.triggeredBy}
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
    </div>
  );
}
