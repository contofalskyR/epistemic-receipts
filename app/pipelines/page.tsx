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
  // ── Science & Health ────────────────────────────────────────────────────────
  { tag: "faers_normalized_drugs_v1", description: "FAERS drug aggregate adverse event counts (openFDA)", status: "in-production", notes: "995 drugs, 2026-05-13" },
  { tag: "icd11_v1", description: "WHO ICD-11 MMS disease classifications, 2024-01 release", status: "in-production", notes: "1,374 records. Shipped 2026-05-20." },
  { tag: "usgs_eq_v1", description: "USGS M6.5+ earthquakes since 1900", status: "in-production", notes: "4,696 events. Shipped 2026-05-20." },
  { tag: "crossref_retractions_v1", description: "Retracted papers via CrossRef + Retraction Watch", status: "in-production", notes: "26,624 + 110 records. Shipped 2026-05-20." },
  { tag: "genbank_v1", description: "GenBank accessions, NCBI", status: "in-production" },
  { tag: "ncbi_gene_v1", description: "NCBI gene entries", status: "dry-run-pending" },
  { tag: "nih_clinical_trials_v1", description: "ClinicalTrials.gov trial registrations", status: "dry-run-pending" },
  // ── Finance & Corporate ─────────────────────────────────────────────────────
  { tag: "sec_edgar_v1", description: "SEC EDGAR historically significant filings — Enron, WorldCom, Lehman, Boeing, GE", status: "in-production", notes: "379 records. Shipped 2026-05-20." },
  // ── Awards & Recognition ────────────────────────────────────────────────────
  { tag: "nobel_v1", description: "Nobel Prize laureates 1901–2024, all categories", status: "in-production", notes: "1,378 records. Shipped 2026-05-20." },
  // ── International Law & Courts ──────────────────────────────────────────────
  { tag: "wto_disputes_v1", description: "WTO Dispute Settlement cases DS1–DS644", status: "in-production", notes: "645 cases. Shipped 2026-05-20." },
  { tag: "icj_judgments_v1", description: "ICJ (International Court of Justice) judgments 1946–2023", status: "in-production", notes: "~800 decisions. Shipped 2026-05-20." },
  { tag: "icc_judgments_v1", description: "ICC (International Criminal Court) indictments and judgments", status: "in-production", notes: "74 records. Shipped 2026-05-20." },
  { tag: "african_court_v1", description: "African Court on Human and Peoples' Rights — all received applications", status: "in-production", notes: "~300 cases. Shipped 2026-05-20." },
  { tag: "un_treaties_v1", description: "UN Treaty Collection — multilateral treaties, 27 chapters", status: "in-production", notes: "416 treaties. Shipped 2026-05-20." },
  { tag: "un_ga_resolutions_v1", description: "UN General Assembly resolutions (A/RES/*), 1946–present", status: "in-production", notes: "~19,000+ records. Shipped 2026-05-20." },
  { tag: "cr_unsc_v1", description: "UN Security Council resolutions", status: "in-production" },
  // ── US Legislation & Regulation ─────────────────────────────────────────────
  { tag: "fr_rules_v1", description: "Federal Register significant final rules (EO 12866): EPA, FDA, OSHA, CMS, DEA, FTC, FCC since 1994", status: "in-production", notes: "1,920 records. Shipped 2026-05-20." },
  { tag: "congress_bills_v1", description: "US Congress bills, Congress.gov", status: "in-production" },
  { tag: "congress_votes_v1", description: "US Congress roll call votes on enacted bills, 113th–119th Congress", status: "in-production", notes: "~505 votes. Shipped 2026-05-20." },
  { tag: "scotus_v1", description: "SCOTUS opinions", status: "in-production" },
  // ── IP Law ──────────────────────────────────────────────────────────────────
  { tag: "wipo_lex_v1", description: "WIPO Lex IP legislation — 190+ countries", status: "in-production", notes: "8,100 records. Shipped 2026-05-20." },
  // ── European Legislation ────────────────────────────────────────────────────
  { tag: "eu_parliament_v1", description: "European Parliament legislative acts", status: "in-production", notes: "4,331 acts. Shipped 2026-05-20." },
  { tag: "uk_legislation_v1", description: "UK legislation", status: "in-production" },
  { tag: "scotland_legislation_v1", description: "Scottish Parliament legislation", status: "in-production", notes: "408 acts. Shipped 2026-05-20." },
  { tag: "wales_senedd_v1", description: "Senedd (Welsh Parliament) legislation", status: "in-production", notes: "100 acts. Shipped 2026-05-20." },
  { tag: "estonia_legislation_v1", description: "Estonia legislation (Riigi Teataja)", status: "in-production", notes: "5,870 acts. Shipped 2026-05-20." },
  { tag: "croatia_legislation_v1", description: "Croatia legislation (Narodne novine)", status: "in-production", notes: "~400 acts. Shipped 2026-05-20." },
  { tag: "cyprus_legislation_v1", description: "Cyprus legislation (CyLaw)", status: "in-production", notes: "12,682 acts. Shipped 2026-05-20." },
  { tag: "malta_legislation_v1", description: "Malta legislation", status: "in-production", notes: "563 laws. Shipped 2026-05-20." },
  // ── Asia-Pacific Legislation ────────────────────────────────────────────────
  { tag: "korea_legislation_v1", description: "South Korea legislation (KLRI)", status: "in-production", notes: "2,114 laws. Shipped 2026-05-20." },
  { tag: "malaysia_legislation_v1", description: "Malaysia legislation", status: "in-production", notes: "881 acts. Shipped 2026-05-20." },
  { tag: "thailand_legislation_v1", description: "Thailand legislation (Council of State)", status: "in-production", notes: "~4,940 acts. Shipped 2026-05-20." },
  { tag: "nz_legislation_v1", description: "New Zealand legislation — acts, bills, local acts, repealed", status: "in-production", notes: "7,890 total. Shipped 2026-05-20." },
  { tag: "paclii_legislation_v1", description: "PacLII Pacific Islands legislation", status: "in-production", notes: "1,583 acts. Shipped 2026-05-20." },
  // ── Middle East & South Asia ────────────────────────────────────────────────
  { tag: "israel_knesset_v1", description: "Israel Knesset primary laws", status: "in-production", notes: "2,009 laws. Shipped 2026-05-20." },
  { tag: "uae_legislation_v1", description: "UAE federal legislation", status: "in-production", notes: "177 laws. Shipped 2026-05-20." },
  { tag: "srilanka_legislation_v1", description: "Sri Lanka legislation", status: "in-production", notes: "1,704 acts. Shipped 2026-05-20." },
  // ── Latin America ────────────────────────────────────────────────────────────
  { tag: "peru_legislation_v1", description: "Peru legislation (SPIJ)", status: "in-production", notes: "5,202 laws. Shipped 2026-05-20." },
  { tag: "costa_rica_legislation_v1", description: "Costa Rica legislation (SCIJ)", status: "in-production", notes: "~3–5k leyes. Shipped 2026-05-20." },
  { tag: "central_america_v1", description: "Central America legislation — Panama, El Salvador, Guatemala", status: "in-production", notes: "~1,017+ acts. Shipped 2026-05-20." },
  { tag: "caribbean_v1", description: "Caribbean legislation — Bahamas, Belize", status: "in-production", notes: "Shipped 2026-05-20." },
  // ── Africa ───────────────────────────────────────────────────────────────────
  { tag: "africanlii_v1", description: "AfricanLII — Malawi, Seychelles, Tanzania, eSwatini", status: "in-production", notes: "1,009 acts across 4 countries. Shipped 2026-05-20." },
  // ── Caribbean & Pacific Small States ────────────────────────────────────────
  { tag: "tt_legislation_v1", description: "Trinidad & Tobago legislation", status: "in-production", notes: "368 acts. Shipped 2026-05-20." },
  { tag: "brunei_legislation_v1", description: "Brunei legislation (AGC)", status: "in-production", notes: "288 acts. Shipped 2026-05-20." },
  { tag: "jamaica_legislation_v1", description: "Jamaica legislation", status: "in-production", notes: "528 acts. Shipped 2026-05-20." },
  // ── Caucasus & Central Asia ──────────────────────────────────────────────────
  { tag: "georgia_legislation_v1", description: "Georgia legislation", status: "in-production", notes: "301 laws. Shipped 2026-05-20." },
  { tag: "central_asia_v1", description: "Central Asia legislation — Armenia, Azerbaijan, Uzbekistan, Kyrgyzstan", status: "in-production", notes: "Shipped 2026-05-20." },
  { tag: "western_balkans_v1", description: "Western Balkans legislation — Kosovo + partial coverage", status: "in-production", notes: "4,061+ acts. Shipped 2026-05-20." },
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
