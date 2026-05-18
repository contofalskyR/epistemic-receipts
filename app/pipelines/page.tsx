export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

type PipelineStatus = "in-production" | "dry-run-complete" | "dry-run-pending" | "awaiting-approval" | "retired";

interface PipelineMeta {
  tag: string;
  description: string;
  status: PipelineStatus;
  notes?: string;
}

const PIPELINE_REGISTRY: PipelineMeta[] = [
  { tag: "faers_normalized_drugs_v1", description: "FAERS drug aggregate adverse event counts (openFDA)", status: "in-production", notes: "995 drugs, 2026-05-13" },
  { tag: "sec_edgar_v1", description: "SEC EDGAR historically significant filings — Enron, WorldCom, Lehman, Boeing, GE", status: "awaiting-approval" },
  { tag: "nobel_v1", description: "Nobel Prize laureates 1901–2024, all categories, Nobel Foundation API", status: "awaiting-approval" },
  { tag: "icd11_v1", description: "WHO ICD-11 MMS disease classifications, 2024-01 release", status: "dry-run-pending", notes: "Requires ICD API credentials" },
  { tag: "usgs_eq_v1", description: "USGS M6.5+ earthquakes since 1900 (~4,700 events)", status: "awaiting-approval", notes: "4,696 candidates (17 exceptional M8.5+, 1,590 great M7.0–8.4, 3,089 major M6.5–6.9)" },
  { tag: "crossref_retractions_v1", description: "Retracted papers via CrossRef (~26,500 records)", status: "dry-run-pending" },
  { tag: "fr_rules_v1", description: "Federal Register significant final rules (EO 12866): EPA, FDA, OSHA, CMS, DEA, FTC, FCC since 1994", status: "awaiting-approval", notes: "~1,921 records" },
  { tag: "congress_bills_v1", description: "Bills, Congress.gov", status: "dry-run-pending" },
  { tag: "cr_unsc_v1", description: "UN Security Council resolutions", status: "dry-run-pending" },
  { tag: "genbank_v1", description: "GenBank accessions, NCBI", status: "dry-run-pending" },
  { tag: "scotus_v1", description: "SCOTUS opinions", status: "dry-run-pending" },
  { tag: "ncbi_gene_v1", description: "NCBI gene entries", status: "dry-run-pending" },
  { tag: "nih_clinical_trials_v1", description: "ClinicalTrials.gov trial registrations", status: "dry-run-pending" },
];

const STATUS_LABELS: Record<PipelineStatus, string> = {
  "in-production": "In production",
  "dry-run-complete": "Dry-run complete",
  "awaiting-approval": "Awaiting approval",
  "dry-run-pending": "Dry-run pending",
  "retired": "Retired",
};

const STATUS_CLASSES: Record<PipelineStatus, string> = {
  "in-production": "bg-green-900/60 text-green-300 border border-green-700/50",
  "dry-run-complete": "bg-yellow-900/60 text-yellow-300 border border-yellow-700/50",
  "awaiting-approval": "bg-yellow-900/60 text-yellow-300 border border-yellow-700/50",
  "dry-run-pending": "bg-gray-800 text-gray-400 border border-gray-700/50",
  "retired": "bg-red-900/40 text-red-400 border border-red-800/50",
};

export default async function PipelinesPage() {
  const [claimCounts, sourceCounts] = await Promise.all([
    prisma.claim.groupBy({
      by: ["ingestedBy"],
      _count: { _all: true },
      where: { deleted: false, verificationStatus: { not: "DEPRECATED" } },
    }),
    prisma.source.groupBy({
      by: ["ingestedBy"],
      _count: { _all: true },
      where: { deleted: false },
    }),
  ]);

  const getClaimCount = (tag: string) =>
    claimCounts.find((r) => r.ingestedBy === tag)?._count._all ?? 0;
  const getSourceCount = (tag: string) =>
    sourceCounts.find((r) => r.ingestedBy === tag)?._count._all ?? 0;

  const registeredTags = new Set(PIPELINE_REGISTRY.map((p) => p.tag));
  const allDbTags = new Set([
    ...claimCounts.map((r) => r.ingestedBy),
    ...sourceCounts.map((r) => r.ingestedBy),
  ]);

  const manualClaimCount = getClaimCount("manual");
  const manualSourceCount = getSourceCount("manual");

  const pipelineClaimTotal = claimCounts
    .filter((r) => r.ingestedBy !== "manual")
    .reduce((sum, r) => sum + r._count._all, 0);
  const pipelineSourceTotal = sourceCounts
    .filter((r) => r.ingestedBy !== "manual")
    .reduce((sum, r) => sum + r._count._all, 0);

  const unregisteredTags = Array.from(allDbTags).filter(
    (t) => t !== "manual" && !registeredTags.has(t)
  );

  return (
    <div className="space-y-8 text-sm text-gray-300">
      <div>
        <h1 className="text-lg font-semibold text-white">Pipelines</h1>
        <p className="mt-1 text-xs text-gray-500">
          Active ingestion pipelines and their current database counts.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Pipeline claims</div>
          <div className="text-xl font-semibold text-white">{pipelineClaimTotal.toLocaleString()}</div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Pipeline sources</div>
          <div className="text-xl font-semibold text-white">{pipelineSourceTotal.toLocaleString()}</div>
        </div>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Registered pipelines</div>
          <div className="text-xl font-semibold text-white">{PIPELINE_REGISTRY.length}</div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-white">Active Pipelines</h2>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tag</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Description</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Claims</th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">Sources</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE_REGISTRY.map((pipeline, i) => {
                const claims = getClaimCount(pipeline.tag);
                const sources = getSourceCount(pipeline.tag);
                return (
                  <tr
                    key={pipeline.tag}
                    className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                  >
                    <td className="px-4 py-3 font-mono text-gray-300 whitespace-nowrap align-top">
                      {pipeline.tag}
                    </td>
                    <td className="px-4 py-3 text-gray-400 align-top">
                      {pipeline.description}
                      {pipeline.notes && (
                        <span className="block text-gray-600 mt-0.5">{pipeline.notes}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white tabular-nums align-top">
                      {claims > 0 ? claims.toLocaleString() : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-white tabular-nums align-top">
                      {sources > 0 ? sources.toLocaleString() : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${STATUS_CLASSES[pipeline.status]}`}>
                        {STATUS_LABELS[pipeline.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold text-white">Manually Curated</h2>
        <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3 flex gap-8">
          <div>
            <div className="text-xs text-gray-500 mb-1">Claims</div>
            <div className="text-base font-semibold text-white">{manualClaimCount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Sources</div>
            <div className="text-base font-semibold text-white">{manualSourceCount.toLocaleString()}</div>
          </div>
        </div>
        <p className="text-xs text-gray-600">
          Records entered by hand via the admin interface, not attributed to any pipeline.
        </p>
      </div>

      {unregisteredTags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-white">Unregistered Tags</h2>
          <div className="rounded border border-gray-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Tag</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Claims</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Sources</th>
                </tr>
              </thead>
              <tbody>
                {unregisteredTags.map((tag) => (
                  <tr key={tag} className="border-b border-gray-800/50 last:border-0">
                    <td className="px-4 py-3 font-mono text-gray-400">{tag}</td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">{getClaimCount(tag).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">{getSourceCount(tag).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
