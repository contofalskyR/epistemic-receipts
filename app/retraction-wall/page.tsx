import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export const metadata = {
  title: "Retraction Wall — Epistemic Receipts",
  description:
    "Live feed of scientific self-correction: every retracted paper tracked, every downstream paper auto-updated.",
};

const PIPELINE = "crossref_retractions_v1";

type RetractionMeta = {
  title?: string;
  journal?: string;
  publisher?: string;
  doi?: string;
  updateType?: string;
} | null;

type RetractionRow = {
  id: string;
  text: string;
  claimEmergedAt: Date | null;
  createdAt: Date;
  metadata: RetractionMeta;
  contradictsCount: number;
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

function titleFromMetaOrText(meta: RetractionMeta, text: string): string {
  const t = (meta?.title || "").trim();
  if (t) return t;
  // Fall back to extracting between quotes in claim text
  const m = text.match(/"([^"]+)"/);
  if (m) return m[1];
  return text.slice(0, 140);
}

async function getRecentRetractions(limit: number): Promise<RetractionRow[]> {
  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: PIPELINE,
      deleted: false,
    },
    select: {
      id: true,
      text: true,
      claimEmergedAt: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: [{ claimEmergedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  if (claims.length === 0) return [];

  const ids = claims.map((c) => c.id);
  const grouped = await prisma.claimRelation.groupBy({
    by: ["fromClaimId"],
    where: { fromClaimId: { in: ids }, relationType: "CONTRADICTS" },
    _count: { _all: true },
  });
  const countById = new Map<string, number>();
  for (const g of grouped) countById.set(g.fromClaimId, g._count._all);

  return claims.map((c) => ({
    id: c.id,
    text: c.text,
    claimEmergedAt: c.claimEmergedAt,
    createdAt: c.createdAt,
    metadata: c.metadata as RetractionMeta,
    contradictsCount: countById.get(c.id) ?? 0,
  }));
}

async function getTopRipple(limit: number): Promise<RetractionRow[]> {
  // Top fromClaim ids by CONTRADICTS count, restricted to retraction-pipeline claims.
  const grouped = await prisma.claimRelation.groupBy({
    by: ["fromClaimId"],
    where: {
      relationType: "CONTRADICTS",
      fromClaim: { ingestedBy: PIPELINE, deleted: false },
    },
    _count: { _all: true },
    orderBy: { _count: { fromClaimId: "desc" } },
    take: limit,
  });
  const ids = grouped.map((g) => g.fromClaimId);
  if (ids.length === 0) return [];

  const claims = await prisma.claim.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      text: true,
      claimEmergedAt: true,
      createdAt: true,
      metadata: true,
    },
  });
  const byId = new Map(claims.map((c) => [c.id, c]));

  return grouped
    .map((g) => {
      const c = byId.get(g.fromClaimId);
      if (!c) return null;
      return {
        id: c.id,
        text: c.text,
        claimEmergedAt: c.claimEmergedAt,
        createdAt: c.createdAt,
        metadata: c.metadata as RetractionMeta,
        contradictsCount: g._count._all,
      };
    })
    .filter((x): x is RetractionRow => x !== null);
}

export default async function RetractionWallPage() {
  const [
    totalRetracted,
    totalContradicts,
    recent,
    topRipple,
    last30d,
  ] = await Promise.all([
    prisma.claim.count({ where: { ingestedBy: PIPELINE, deleted: false } }),
    prisma.claimRelation.count({ where: { relationType: "CONTRADICTS" } }),
    getRecentRetractions(100),
    getTopRipple(10),
    prisma.claim.count({
      where: {
        ingestedBy: PIPELINE,
        deleted: false,
        claimEmergedAt: {
          gte: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        },
      },
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Retraction Wall
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-snug">
          Live feed of scientific self-correction
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
          Retraction Watch and CrossRef report when a paper is officially retracted.
          Our knowledge graph automatically updates &mdash; propagating the dispute to every
          paper that relies on it via <span className="font-mono text-gray-300">CONTRADICTS</span> edges.
          Each row is a receipt; click through for the underlying claim and edge history.
        </p>
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-5 py-4">
          <p className="text-xs text-red-400/80 font-mono uppercase tracking-widest">
            Retracted papers tracked
          </p>
          <p className="mt-1 text-3xl font-semibold text-white tabular-nums">
            {totalRetracted.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            pipeline <span className="font-mono">{PIPELINE}</span>
          </p>
        </div>
        <div className="rounded-lg border border-orange-900/50 bg-orange-950/30 px-5 py-4">
          <p className="text-xs text-orange-400/80 font-mono uppercase tracking-widest">
            Automatic dispute propagations
          </p>
          <p className="mt-1 text-3xl font-semibold text-white tabular-nums">
            {totalContradicts.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            CONTRADICTS relations linking retractions to originals
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">
            Retractions in last 30 days
          </p>
          <p className="mt-1 text-3xl font-semibold text-white tabular-nums">
            {last30d.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            by reported retraction date
          </p>
        </div>
      </div>

      {/* Top ripple section */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-white">
            Papers whose retraction ripples furthest
          </h2>
          <p className="text-xs text-gray-500 max-w-2xl">
            Ranked by the number of downstream papers each retraction record contradicts in our
            knowledge graph. A higher count means more of the literature touches this withdrawn work.
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 divide-y divide-gray-800/70">
          {topRipple.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-500 italic">
              No CONTRADICTS edges from retracted papers yet.
            </p>
          )}
          {topRipple.map((r, i) => {
            const title = titleFromMetaOrText(r.metadata, r.text);
            const doi = r.metadata?.doi?.trim();
            const href = doi
              ? `/retraction-explorer?q=${encodeURIComponent(doi)}`
              : `/claims/${r.id}`;
            return (
              <Link
                key={r.id}
                href={href}
                className="flex items-start gap-4 px-4 py-3 hover:bg-gray-900/80 transition-colors group"
              >
                <span className="shrink-0 w-7 h-7 rounded-full bg-red-900/40 border border-red-800/50 flex items-center justify-center text-xs font-mono text-red-300">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm text-gray-200 group-hover:text-white leading-snug line-clamp-2">
                    {title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.metadata?.journal ?? "—"}
                    {r.metadata?.publisher ? ` · ${r.metadata.publisher}` : ""}
                    {r.claimEmergedAt ? ` · retracted ${fmtDate(r.claimEmergedAt)}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-semibold text-red-300 tabular-nums">
                    {r.contradictsCount.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">
                    contradicts
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent retractions table */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-white">
            Most recent retractions
          </h2>
          <p className="text-xs text-gray-500 max-w-2xl">
            The {recent.length.toLocaleString()} most recently reported retractions in our index, by publisher-submitted retraction date.
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/40 overflow-hidden">
          <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-mono uppercase tracking-widest text-gray-600 border-b border-gray-800 bg-gray-950/40">
            <div className="col-span-6">Paper</div>
            <div className="col-span-3">Journal / publisher</div>
            <div className="col-span-2">Retracted</div>
            <div className="col-span-1 text-right">Cites</div>
          </div>
          <div className="divide-y divide-gray-800/70">
            {recent.map((r) => {
              const title = titleFromMetaOrText(r.metadata, r.text);
              const doi = r.metadata?.doi?.trim();
              const recentHref = doi
                ? `/retraction-explorer?q=${encodeURIComponent(doi)}`
                : `/claims/${r.id}`;
              return (
                <Link
                  key={r.id}
                  href={recentHref}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-3 px-4 py-3 hover:bg-gray-900/80 transition-colors group"
                >
                  <div className="sm:col-span-6 min-w-0">
                    <p className="text-sm text-gray-200 group-hover:text-white leading-snug line-clamp-2">
                      {title}
                    </p>
                    {r.metadata?.updateType && (
                      <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mt-0.5">
                        {r.metadata.updateType}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-3 min-w-0">
                    <p className="text-xs text-gray-400 truncate">
                      {r.metadata?.journal ?? "—"}
                    </p>
                    {r.metadata?.publisher && (
                      <p className="text-[10px] text-gray-600 truncate">
                        {r.metadata.publisher}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-mono text-gray-400">
                      {fmtDate(r.claimEmergedAt)}
                    </p>
                  </div>
                  <div className="sm:col-span-1 sm:text-right">
                    <p className="text-sm font-semibold text-gray-300 tabular-nums">
                      {r.contradictsCount > 0 ? r.contradictsCount.toLocaleString() : "—"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feed links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/retractions"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900/40 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-900/80 transition-colors"
        >
          API docs &amp; JSON feed
        </Link>
        <a
          href="/api/retractions/rss"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-orange-700/60 bg-orange-950/30 px-4 py-2 text-sm text-orange-300 hover:bg-orange-950/60 transition-colors font-mono"
        >
          Subscribe RSS ↗
        </a>
      </div>

      {/* Footer note */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4 text-xs text-gray-500 leading-relaxed">
        <p>
          <span className="text-gray-400 font-medium">How this is built.</span>{" "}
          Source data comes from the CrossRef API&apos;s publisher-reported retraction stream (the dedicated
          Retraction Watch API is no longer public). Each retraction is matched against{" "}
          <span className="font-mono">openalex_v1</span> publications via normalized DOI, and a{" "}
          <span className="font-mono">CONTRADICTS</span> ClaimRelation is written from the retraction record
          to every matching original. The graph updates as new retractions arrive &mdash; downstream claims do not
          have to be manually flagged.
        </p>
        <p className="mt-2">
          See also: <Link href="/settling-curve" className="text-gray-400 hover:text-white underline-offset-2 hover:underline">Settling Curve</Link>{" "}
          (the reverse arc &mdash; how a claim accrues confidence), and{" "}
          <Link href="/corrections" className="text-gray-400 hover:text-white underline-offset-2 hover:underline">Corrections</Link>{" "}
          (data-quality events on our side of the ledger).
        </p>
      </div>
    </div>
  );
}
