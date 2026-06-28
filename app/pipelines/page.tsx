export const revalidate = 3600;

import { prisma } from "@/lib/prisma";
import PipelinesClient, { type PipelineRow, type PipelinesStats, type UnregisteredRow } from "./PipelinesClient";

type PipelineStatus = "in-production" | "dry-run-complete" | "dry-run-pending" | "awaiting-approval" | "retired";

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

const PIPELINE_REGISTRY: PipelineMeta[] = [
  { tag: "faers_normalized_drugs_v1", description: "FAERS drug aggregate adverse event counts (openFDA)", status: "in-production", notes: "995 drugs, 2026-05-13" },
  { tag: "icd11_v1", description: "WHO ICD-11 MMS disease classifications, 2024-01 release", status: "in-production", notes: "1,374 records. Shipped 2026-05-20." },
  { tag: "usgs_eq_v1", description: "USGS M6.5+ earthquakes since 1900", status: "in-production", notes: "4,696 events. Shipped 2026-05-20." },
  { tag: "crossref_retractions_v1", description: "Retracted papers via CrossRef + Retraction Watch", status: "in-production", notes: "26,624 + 110 records. Shipped 2026-05-20." },
  { tag: "genbank_v1", description: "GenBank accessions, NCBI", status: "in-production" },
  { tag: "ncbi_gene_v1", description: "NCBI gene entries", status: "dry-run-pending" },
  { tag: "nih_clinical_trials_v1", description: "ClinicalTrials.gov trial registrations", status: "dry-run-pending" },
  { tag: "sec_edgar_v1", description: "SEC EDGAR historically significant filings — Enron, WorldCom, Lehman, Boeing, GE", status: "in-production", notes: "379 records. Shipped 2026-05-20." },
  { tag: "nobel_v1", description: "Nobel Prize laureates 1901-2024, all categories", status: "in-production", notes: "1,378 records. Shipped 2026-05-20." },
  { tag: "wto_disputes_v1", description: "WTO Dispute Settlement cases DS1-DS644", status: "in-production", notes: "645 cases. Shipped 2026-05-20." },
  { tag: "icj_judgments_v1", description: "ICJ (International Court of Justice) judgments 1946-2023", status: "in-production", notes: "~800 decisions. Shipped 2026-05-20." },
  { tag: "icc_judgments_v1", description: "ICC (International Criminal Court) indictments and judgments", status: "in-production", notes: "74 records. Shipped 2026-05-20." },
  { tag: "african_court_v1", description: "African Court on Human and Peoples Rights — all received applications", status: "in-production", notes: "~300 cases. Shipped 2026-05-20." },
  { tag: "un_treaties_v1", description: "UN Treaty Collection — multilateral treaties, 27 chapters", status: "in-production", notes: "416 treaties. Shipped 2026-05-20." },
  { tag: "un_ga_resolutions_v1", description: "UN General Assembly resolutions (A/RES/*), 1946-present", status: "in-production", notes: "~19,000+ records. Shipped 2026-05-20." },
  { tag: "cr_unsc_v1", description: "UN Security Council resolutions", status: "in-production" },
  { tag: "fr_rules_v1", description: "Federal Register significant final rules (EO 12866): EPA, FDA, OSHA, CMS, DEA, FTC, FCC since 1994", status: "in-production", notes: "1,920 records. Shipped 2026-05-20." },
  { tag: "congress_bills_v1", description: "US Congress bills, Congress.gov", status: "in-production" },
  { tag: "congress_votes_v1", description: "US Congress roll call votes on enacted bills, 113th-119th Congress", status: "in-production", notes: "~505 votes. Shipped 2026-05-20." },
  { tag: "scotus_v1", description: "SCOTUS opinions", status: "in-production" },
  { tag: "wipo_lex_v1", description: "WIPO Lex IP legislation — 190+ countries", status: "in-production", notes: "8,100 records. Shipped 2026-05-20." },
  { tag: "eu_parliament_v1", description: "European Parliament legislative acts", status: "in-production", notes: "4,331 acts. Shipped 2026-05-20." },
  { tag: "uk_legislation_v1", description: "UK legislation", status: "in-production" },
  { tag: "scotland_legislation_v1", description: "Scottish Parliament legislation", status: "in-production", notes: "408 acts. Shipped 2026-05-20." },
  { tag: "wales_senedd_v1", description: "Senedd (Welsh Parliament) legislation", status: "in-production", notes: "100 acts. Shipped 2026-05-20." },
  { tag: "estonia_legislation_v1", description: "Estonia legislation (Riigi Teataja)", status: "in-production", notes: "5,870 acts. Shipped 2026-05-20." },
  { tag: "croatia_legislation_v1", description: "Croatia legislation (Narodne novine)", status: "in-production", notes: "~400 acts. Shipped 2026-05-20." },
  { tag: "cyprus_legislation_v1", description: "Cyprus legislation (CyLaw)", status: "in-production", notes: "12,682 acts. Shipped 2026-05-20." },
  { tag: "malta_legislation_v1", description: "Malta legislation", status: "in-production", notes: "563 laws. Shipped 2026-05-20." },
  { tag: "korea_legislation_v1", description: "South Korea legislation (KLRI)", status: "in-production", notes: "2,114 laws. Shipped 2026-05-20." },
  { tag: "malaysia_legislation_v1", description: "Malaysia legislation", status: "in-production", notes: "881 acts. Shipped 2026-05-20." },
  { tag: "thailand_legislation_v1", description: "Thailand legislation (Council of State)", status: "in-production", notes: "~4,940 acts. Shipped 2026-05-20." },
  { tag: "nz_legislation_v1", description: "New Zealand legislation — acts, bills, local acts, repealed", status: "in-production", notes: "7,890 total. Shipped 2026-05-20." },
  { tag: "paclii_legislation_v1", description: "PacLII Pacific Islands legislation", status: "in-production", notes: "1,583 acts. Shipped 2026-05-20." },
  { tag: "israel_knesset_v1", description: "Israel Knesset primary laws", status: "in-production", notes: "2,009 laws. Shipped 2026-05-20." },
  { tag: "uae_legislation_v1", description: "UAE federal legislation", status: "in-production", notes: "177 laws. Shipped 2026-05-20." },
  { tag: "srilanka_legislation_v1", description: "Sri Lanka legislation", status: "in-production", notes: "1,704 acts. Shipped 2026-05-20." },
  { tag: "peru_legislation_v1", description: "Peru legislation (SPIJ)", status: "in-production", notes: "5,202 laws. Shipped 2026-05-20." },
  { tag: "costa_rica_legislation_v1", description: "Costa Rica legislation (SCIJ)", status: "in-production", notes: "~3-5k leyes. Shipped 2026-05-20." },
  { tag: "central_america_v1", description: "Central America legislation — Panama, El Salvador, Guatemala", status: "in-production", notes: "~1,017+ acts. Shipped 2026-05-20." },
  { tag: "caribbean_v1", description: "Caribbean legislation — Bahamas, Belize", status: "in-production", notes: "Shipped 2026-05-20." },
  { tag: "africanlii_v1", description: "AfricanLII — Malawi, Seychelles, Tanzania, eSwatini", status: "in-production", notes: "1,009 acts across 4 countries. Shipped 2026-05-20." },
  { tag: "tt_legislation_v1", description: "Trinidad and Tobago legislation", status: "in-production", notes: "368 acts. Shipped 2026-05-20." },
  { tag: "brunei_legislation_v1", description: "Brunei legislation (AGC)", status: "in-production", notes: "288 acts. Shipped 2026-05-20." },
  { tag: "jamaica_legislation_v1", description: "Jamaica legislation", status: "in-production", notes: "528 acts. Shipped 2026-05-20." },
  { tag: "georgia_legislation_v1", description: "Georgia legislation", status: "in-production", notes: "301 laws. Shipped 2026-05-20." },
  { tag: "central_asia_v1", description: "Central Asia legislation — Armenia, Azerbaijan, Uzbekistan, Kyrgyzstan", status: "in-production", notes: "Shipped 2026-05-20." },
  { tag: "western_balkans_v1", description: "Western Balkans legislation — Kosovo + partial coverage", status: "in-production", notes: "4,061+ acts. Shipped 2026-05-20." },
];

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

  const pipelineClaimTotal = claimCounts
    .filter((r) => r.ingestedBy !== "manual")
    .reduce((sum, r) => sum + r._count._all, 0);
  const pipelineSourceTotal = sourceCounts
    .filter((r) => r.ingestedBy !== "manual")
    .reduce((sum, r) => sum + r._count._all, 0);

  const unregisteredTags = Array.from(allDbTags).filter(
    (t) => t !== "manual" && !registeredTags.has(t)
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
  };

  const unregistered: UnregisteredRow[] = unregisteredTags.map((tag) => ({
    tag,
    claims: getClaimCount(tag),
    sources: getSourceCount(tag),
  }));

  return (
    <PipelinesClient
      pipelines={pipelines}
      stats={stats}
      unregistered={unregistered}
    />
  );
}
