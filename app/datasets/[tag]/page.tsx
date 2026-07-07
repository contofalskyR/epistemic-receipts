import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PIPELINES, getPipeline } from "@/lib/pipelines/registry";

export const revalidate = 3600;

export async function generateStaticParams() {
  return PIPELINES.map(p => ({ tag: p.tag }));
}

export async function generateMetadata({ params }: { params: { tag: string } }) {
  const p = getPipeline(params.tag);
  if (!p) return {};
  return {
    title: `${p.name} — Datasets — Epistemic Receipts`,
    description: `Provenance data card for ${p.name}: upstream source, fetch method, live claim counts, and caveats.`,
  };
}

async function getCoverage(tag: string) {
  const [groups, aggregate, lastRun] = await Promise.all([
    prisma.claim.groupBy({
      by: ["verificationStatus", "humanReviewed", "autoApproved"],
      where: { ingestedBy: tag, deleted: false },
      _count: { _all: true },
    }),
    prisma.claim.aggregate({
      where: { ingestedBy: tag, deleted: false },
      _min: { claimEmergedAt: true },
      _max: { claimEmergedAt: true },
      _count: { _all: true },
    }),
    prisma.pipelineRun.findFirst({
      where: { pipelineTag: tag, status: "done" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);

  const total = aggregate._count._all;
  const humanReviewed = groups
    .filter(r => r.humanReviewed)
    .reduce((s, r) => s + r._count._all, 0);
  const autoApproved = groups
    .filter(r => r.autoApproved)
    .reduce((s, r) => s + r._count._all, 0);
  const deprecated = groups
    .filter(r => r.verificationStatus === "DEPRECATED")
    .reduce((s, r) => s + r._count._all, 0);

  const verificationMix: Record<string, number> = {};
  for (const r of groups) {
    const key = r.verificationStatus ?? "null";
    verificationMix[key] = (verificationMix[key] ?? 0) + r._count._all;
  }

  return {
    total,
    humanReviewed,
    autoApproved,
    deprecated,
    verificationMix,
    earliestClaim: aggregate._min.claimEmergedAt,
    latestClaim: aggregate._max.claimEmergedAt,
    lastRunAt: lastRun?.finishedAt ?? null,
  };
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function DatasetPage({ params }: { params: { tag: string } }) {
  const p = getPipeline(params.tag);
  if (!p) notFound();

  const cov = await getCoverage(params.tag);

  const pills = [
    { label: "Total claims", value: cov.total.toLocaleString(), color: "text-white" },
    { label: "Human reviewed", value: cov.humanReviewed.toLocaleString(), color: "text-blue-300" },
    { label: "Auto-approved", value: cov.autoApproved.toLocaleString(), color: "text-purple-300" },
    ...(cov.deprecated > 0
      ? [{ label: "Deprecated", value: cov.deprecated.toLocaleString(), color: "text-orange-300" }]
      : []),
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-600 space-x-1">
        <Link href="/datasets" className="hover:text-gray-400 transition-colors">
          Datasets
        </Link>
        <span>/</span>
        <span className="text-gray-400 font-mono">{params.tag}</span>
      </nav>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-white">{p.name}</h1>
          {p.retired && (
            <span className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded border border-red-900/60 bg-red-950/40 text-red-400">
              retired
            </span>
          )}
        </div>
        <p className="text-xs font-mono text-gray-500">{p.tag}</p>
      </div>

      {/* Provenance */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Provenance
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Upstream source</dt>
          <dd className="text-gray-200">
            <a
              href={p.upstreamUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white underline underline-offset-2 transition-colors"
            >
              {p.upstreamName}
            </a>
          </dd>
          <dt className="text-gray-500">Fetch method</dt>
          <dd className="text-gray-200">{p.method}</dd>
          <dt className="text-gray-500">Cadence</dt>
          <dd className="text-gray-200 capitalize">{p.cadence}</dd>
          {cov.lastRunAt && (
            <>
              <dt className="text-gray-500">Last successful run</dt>
              <dd className="text-gray-200 font-mono">{fmtDate(cov.lastRunAt)}</dd>
            </>
          )}
          {!cov.lastRunAt && (
            <>
              <dt className="text-gray-500">Last successful run</dt>
              <dd className="text-gray-500 italic">No pipeline runs recorded</dd>
            </>
          )}
        </dl>
      </section>

      {/* Coverage */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Coverage
        </h2>

        {cov.total === 0 ? (
          <p className="text-sm text-gray-500 italic">No claims ingested yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {pills.map(pill => (
                <div
                  key={pill.label}
                  className="rounded-md border border-gray-800 bg-gray-900/40 px-4 py-3 min-w-[130px]"
                >
                  <p className="text-xs text-gray-500">{pill.label}</p>
                  <p className={`text-xl font-semibold tabular-nums ${pill.color}`}>
                    {pill.value}
                  </p>
                </div>
              ))}
            </div>

            {(fmtDate(cov.earliestClaim) || fmtDate(cov.latestClaim)) && (
              <p className="text-xs text-gray-500 font-mono">
                Date range of claims:{" "}
                <span className="text-gray-400">
                  {fmtDate(cov.earliestClaim) ?? "unknown"}
                  {" → "}
                  {fmtDate(cov.latestClaim) ?? "present"}
                </span>
              </p>
            )}

            {Object.keys(cov.verificationMix).length > 0 && (
              <div className="rounded-md border border-gray-800 bg-gray-900/40 px-4 py-3 space-y-1">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
                  Verification status breakdown
                </p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-xs">
                  {Object.entries(cov.verificationMix)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <>
                        <dt key={status + "-k"} className="text-gray-500 font-mono">{status}</dt>
                        <dd key={status + "-v"} className="text-gray-300 tabular-nums">
                          {count.toLocaleString()}
                        </dd>
                      </>
                    ))}
                </dl>
              </div>
            )}
          </>
        )}
      </section>

      {/* Caveats */}
      {p.caveats && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Caveats
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">{p.caveats}</p>
        </section>
      )}

      {/* Retirement notice */}
      {p.retired && (
        <section className="rounded-lg border border-red-900/40 bg-red-950/20 px-5 py-5 space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-red-400">
            Pipeline retired
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            This pipeline is no longer active. Existing records remain in the database
            with <span className="font-mono text-gray-300">verificationStatus=DEPRECATED</span> and
            are preserved for audit purposes. The ingest script has been relocated to{" "}
            <span className="font-mono text-gray-300">scripts/retired/</span>.
          </p>
          <p className="text-sm text-gray-500">
            See{" "}
            <Link href="/corrections" className="hover:text-gray-300 transition-colors underline underline-offset-2">
              /corrections
            </Link>{" "}
            for the full retirement audit entry and{" "}
            <Link href="/methodology#deprecation" className="hover:text-gray-300 transition-colors underline underline-offset-2">
              /methodology#deprecation
            </Link>{" "}
            for the deprecation policy.
          </p>
        </section>
      )}

      {/* Footer links */}
      <div className="flex gap-4 text-xs text-gray-600">
        <Link href="/datasets" className="hover:text-gray-400 transition-colors">
          ← All datasets
        </Link>
        <Link href="/methodology" className="hover:text-gray-400 transition-colors">
          Methodology
        </Link>
        <Link href="/corrections" className="hover:text-gray-400 transition-colors">
          Corrections
        </Link>
      </div>
    </div>
  );
}
