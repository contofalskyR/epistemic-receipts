export const revalidate = 3600;

import { prisma } from "@/lib/prisma";
import { corpusCountByPipeline } from "@/lib/corpus";
import { PIPELINES, type PipelineStatus } from "@/lib/pipelines/registry";
import PipelinesClient, { type PipelineRow, type PipelinesStats, type UnregisteredRow } from "./PipelinesClient";


interface PipelineMeta {
  tag: string;
  description: string;
  status: PipelineStatus;
  notes?: string;
}

export const metadata = {
  title: "Pipelines — Epistemic Receipts",
  description: "Every ingestion pipeline powering the claim graph — operational status, record counts, and technical notes.",
};

// Derived from the ONE pipeline registry (lib/pipelines/registry.ts, front door
// phase 3); this page used to carry its own 78-row list with its own statuses.
const PIPELINE_REGISTRY: PipelineMeta[] = PIPELINES.filter((p) => !!p.method).map((p) => ({
  tag: p.tag,
  description: p.name,
  status: p.status ?? "in-production",
  ...(p.notes ? { notes: p.notes } : {}),
}));

export default async function PipelinesPage() {
  const [claimCounts, sourceCounts] = await Promise.all([
    // Per-pipeline claim counts under the site-wide corpus definition
    // (lib/corpus.ts: deleted = false), shared with the homepage tiles and
    // /api/corpus-stats. The old `verificationStatus: { not: "DEPRECATED" }`
    // filter silently dropped every never-classified (NULL status) claim.
    corpusCountByPipeline(),
    prisma.source.groupBy({
      by: ["ingestedBy"],
      _count: { _all: true },
      where: { deleted: false },
    }),
  ]);

  const getClaimCount = (tag: string) =>
    claimCounts.find((r) => r.ingestedBy === tag)?.count ?? 0;
  const getSourceCount = (tag: string) =>
    sourceCounts.find((r) => r.ingestedBy === tag)?._count._all ?? 0;

  const registeredTags = new Set(PIPELINE_REGISTRY.map((p) => p.tag));
  const allDbTags = new Set([
    ...claimCounts.map((r) => r.ingestedBy),
    ...sourceCounts.map((r) => r.ingestedBy),
  ]);

  const pipelineClaimTotal = claimCounts
    .filter((r) => r.ingestedBy !== "manual")
    .reduce((sum, r) => sum + r.count, 0);
  const pipelineSourceTotal = sourceCounts
    .filter((r) => r.ingestedBy !== "manual")
    .reduce((sum, r) => sum + r._count._all, 0);

  const unregisteredTags = Array.from(allDbTags).filter(
    (t) => t !== "manual" && !registeredTags.has(t)
  );

  // Raw internal tags (enrich:*, seed:*, one-off ids) are ops detail, not public
  // provenance. Development builds show the raw list; production shows an
  // aggregate line and defers the catalogue to /sources. (PUBLISH-CHECKLIST.md)
  const showRawUnregistered = process.env.NODE_ENV === "development";
  const unregisteredClaimTotal = unregisteredTags.reduce(
    (sum, t) => sum + getClaimCount(t),
    0
  );

  const pipelines: PipelineRow[] = PIPELINE_REGISTRY.map((p) => ({
    ...p,
    claims: getClaimCount(p.tag),
    sources: getSourceCount(p.tag),
  }));

  const stats: PipelinesStats = {
    pipelineClaimTotal,
    pipelineSourceTotal,
    registeredCount: PIPELINE_REGISTRY.length,
    manualClaims: getClaimCount("manual"),
    manualSources: getSourceCount("manual"),
    unregisteredTagCount: unregisteredTags.length,
    unregisteredClaimTotal,
  };

  const unregistered: UnregisteredRow[] = showRawUnregistered
    ? unregisteredTags.map((tag) => ({
        tag,
        claims: getClaimCount(tag),
        sources: getSourceCount(tag),
      }))
    : [];

  return (
    <PipelinesClient
      pipelines={pipelines}
      stats={stats}
      unregistered={unregistered}
    />
  );
}
