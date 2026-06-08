import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DrugArcClient from "./DrugArcClient";

export const revalidate = 3600;

// ── Therapeutic area keyword buckets ─────────────────────────────────────────

const AREA_BUCKETS: { key: string; label: string; keywords: string[]; color: string }[] = [
  { key: "oncology",        label: "Oncology",                keywords: ["cancer", "tumor", "carcinoma", "lymphoma", "leukemia", "melanoma", "myeloma", "sarcoma", "oncol", "neoplasm"], color: "rose" },
  { key: "cardiology",      label: "Cardiology",              keywords: ["cardiovascular", "cardiac", "heart failure", "hypertension", "coronary", "arrhythmia", "thrombosis", "anticoagul"], color: "red" },
  { key: "metabolic",       label: "Metabolic / Endocrine",   keywords: ["diabetes", "insulin", "obesity", "thyroid", "metabolic", "hyperlipidemia", "cholesterol", "glucose", "GLP-1", "semaglutide"], color: "yellow" },
  { key: "infectious",      label: "Infectious Disease",      keywords: ["infection", "bacterial", "viral", "HIV", "antibiotic", "antiviral", "hepatitis", "pneumonia", "tuberculosis", "fungal"], color: "green" },
  { key: "neurology",       label: "Neurology / CNS",         keywords: ["neurolog", "epilepsy", "seizure", "Alzheimer", "Parkinson", "schizophrenia", "depression", "anxiety", "migraine", "multiple sclerosis"], color: "purple" },
  { key: "immunology",      label: "Immunology / Autoimmune", keywords: ["autoimmune", "rheumatoid", "lupus", "inflammatory bowel", "monoclonal antibody", "immunosuppress", "transplant rejection"], color: "sky" },
  { key: "respiratory",     label: "Respiratory",             keywords: ["pulmonary", "lung", "asthma", "COPD", "respiratory", "bronchial", "cystic fibrosis"], color: "cyan" },
  { key: "dermatology",     label: "Dermatology",             keywords: ["dermatitis", "psoriasis", "eczema", "skin", "acne", "rosacea", "alopecia"], color: "amber" },
  { key: "hematology",      label: "Hematology",              keywords: ["anemia", "hemophilia", "platelet", "hematolog", "sickle cell", "clotting factor"], color: "orange" },
  { key: "gastroenterology",label: "Gastroenterology",        keywords: ["gastro", "hepatic", "liver disease", "bowel", "colon", "esophag", "irritable bowel", "ulcerative"], color: "lime" },
];

const COLOR_BAR: Record<string, string> = {
  rose: "bg-rose-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  sky: "bg-sky-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  lime: "bg-lime-500",
};

const COLOR_TEXT: Record<string, string> = {
  rose: "text-rose-400",
  red: "text-red-400",
  yellow: "text-yellow-400",
  green: "text-green-400",
  purple: "text-purple-400",
  sky: "text-sky-400",
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  orange: "text-orange-400",
  lime: "text-lime-400",
};

// ── Server data fetches ───────────────────────────────────────────────────────

async function getFunnelCounts() {
  const [trials, approvals, adverseEvents, outcomeLinks] = await Promise.all([
    prisma.claim.count({
      where: { ingestedBy: "clinicaltrials_v1", deleted: false, verificationStatus: { not: "DEPRECATED" } },
    }),
    prisma.claim.count({
      where: { ingestedBy: "drugsatfda_v1", deleted: false, verificationStatus: { not: "DEPRECATED" } },
    }),
    prisma.claim.count({
      where: { ingestedBy: "faers_normalized_drugs_v1", deleted: false, verificationStatus: { not: "DEPRECATED" } },
    }),
    prisma.claimRelation.count({
      where: {
        relationType: "OUTCOME",
        fromClaim: { ingestedBy: "clinicaltrials_v1", deleted: false },
        toClaim: { ingestedBy: "drugsatfda_v1", deleted: false },
      },
    }),
  ]);
  return { trials, approvals, adverseEvents, outcomeLinks };
}

async function getTherapeuticAreas() {
  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: "drugsatfda_v1",
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
    },
    select: { text: true },
  });

  const counts: Record<string, number> = {};
  for (const b of AREA_BUCKETS) counts[b.key] = 0;
  let uncategorized = 0;

  for (const c of claims) {
    const lower = c.text.toLowerCase();
    let matched = false;
    for (const b of AREA_BUCKETS) {
      if (b.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        counts[b.key]++;
        matched = true;
      }
    }
    if (!matched) uncategorized++;
  }

  return AREA_BUCKETS.map((b) => ({ ...b, count: counts[b.key] }))
    .sort((a, b) => b.count - a.count);
}

// ── Page ──────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function DrugArcPage() {
  const [funnel, areas] = await Promise.all([
    getFunnelCounts(),
    getTherapeuticAreas(),
  ]);

  const maxAreaCount = Math.max(...areas.map((a) => a.count), 1);

  const stages = [
    {
      key: "trials",
      label: "Clinical Trials",
      sublabel: "Registered & completed trials in the public record",
      count: funnel.trials,
      widthPct: 100,
      color: "bg-blue-500/80",
      textColor: "text-blue-300",
      border: "border-blue-800/40",
    },
    {
      key: "approvals",
      label: "FDA Approvals",
      sublabel: "Original NDA/BLA applications approved",
      count: funnel.approvals,
      widthPct: Math.max(5, Math.round((funnel.approvals / Math.max(funnel.trials, 1)) * 100)),
      color: "bg-emerald-500/80",
      textColor: "text-emerald-300",
      border: "border-emerald-800/40",
    },
    {
      key: "adverse",
      label: "Post-Market Surveillance",
      sublabel: "Drugs with FAERS aggregate adverse event records",
      count: funnel.adverseEvents,
      widthPct: Math.max(5, Math.round((funnel.adverseEvents / Math.max(funnel.trials, 1)) * 100)),
      color: "bg-orange-500/80",
      textColor: "text-orange-300",
      border: "border-orange-800/40",
    },
    {
      key: "links",
      label: "Trial → Approval Links",
      sublabel: "Verified OUTCOME relations in the receipts graph",
      count: funnel.outcomeLinks,
      widthPct: Math.max(2, Math.round((funnel.outcomeLinks / Math.max(funnel.trials, 1)) * 100)),
      color: "bg-violet-500/80",
      textColor: "text-violet-300",
      border: "border-violet-800/40",
    },
  ];

  return (
    <div className="max-w-2xl space-y-12">

      {/* Hero */}
      <div className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">Drug Arc</p>
        <h1 className="text-2xl font-semibold text-white leading-snug">
          From Lab to Market: The FDA Drug Development Pipeline
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          A new drug takes on average{" "}
          <span className="text-gray-200">10–15 years</span> and over{" "}
          <span className="text-gray-200">$2 billion</span> to reach patients.
          Of every 5,000 compounds that enter preclinical testing, only about{" "}
          <span className="text-gray-200">5 make it to human trials</span> — and fewer than 1 receives FDA approval.
          Each stage leaves a datable, auditable receipt. This page maps that arc
          using live data from this database.
        </p>
      </div>

      {/* Funnel visualization */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Pipeline Funnel — Live Counts
        </h2>
        <div className="space-y-3">
          {stages.map((s) => (
            <div key={s.key} className={`rounded-lg border ${s.border} bg-gray-900/40 px-4 py-3 space-y-2`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">{s.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.sublabel}</p>
                </div>
                <span className={`text-lg font-bold tabular-nums ${s.textColor} shrink-0`}>
                  {fmt(s.count)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.color} transition-all`}
                  style={{ width: `${Math.min(100, s.widthPct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Bar widths show each stage relative to the clinical trials corpus. FDA approvals are a
          distinct pipeline (Drugs@FDA bulk export) — the counts are not strict funnel ratios, but
          they illustrate the attrition reality.
        </p>
      </section>

      {/* Drug search */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Trace a Drug's Arc
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Search by drug name or compound. Returns matching records across clinical trial registrations,
            FDA approval decisions, and FAERS adverse event aggregates — ordered chronologically.
          </p>
        </div>
        <DrugArcClient />
      </section>

      {/* Therapeutic area heatmap */}
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            FDA Approvals by Therapeutic Area
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            Grouped from {fmt(funnel.approvals)} Drugs@FDA approval records by keyword matching in claim text.
            A single drug may appear in multiple categories.
          </p>
        </div>
        <div className="space-y-2">
          {areas.map((a) => (
            <div key={a.key} className="flex items-center gap-3">
              <div className="w-36 shrink-0 text-xs text-gray-400 text-right">{a.label}</div>
              <div className="flex-1 h-3 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${COLOR_BAR[a.color] ?? "bg-gray-500"} transition-all`}
                  style={{ width: `${Math.round((a.count / maxAreaCount) * 100)}%` }}
                />
              </div>
              <div className={`w-14 shrink-0 text-xs tabular-nums ${COLOR_TEXT[a.color] ?? "text-gray-400"}`}>
                {fmt(a.count)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured arc */}
      <section className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Featured Arc — Semaglutide (GLP-1)
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          Semaglutide is one of the most studied arcs in this database. From Phase 3 SUSTAIN trials
          in the 2010s through three separate FDA approvals (Ozempic 2017, Rybelsus 2019, Wegovy 2021)
          to tens of thousands of FAERS adverse event reports — and a 2025 oral obesity approval
          still under active post-market surveillance. The arc is not closed.
        </p>
        <p className="text-xs text-gray-500 leading-relaxed">
          The Settling Curve demo traces this arc in detail — each milestone linked to its
          primary source claim in this database.
        </p>
        <div className="flex items-center gap-4 flex-wrap pt-1 border-t border-gray-800">
          <Link
            href="/settling-curve"
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            View semaglutide settling curve →
          </Link>
          <Link
            href="/search?q=semaglutide"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Search all semaglutide claims →
          </Link>
        </div>
      </section>

      {/* Interpretation */}
      <div className="space-y-3 text-sm text-gray-400 leading-relaxed border-t border-gray-800 pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">What the arc shows</h2>
        <p>
          FDA approval is a receipt, not a verdict. It records that at the time of review,
          the available evidence crossed the agency's benefit-risk threshold for the named indication and population.
          Post-market surveillance — FAERS, pharmacovigilance studies, label updates — is how
          that receipt gets amended. Most approvals are never revoked. Some are.
        </p>
        <p>
          The database captures both kinds. Searching for a withdrawn drug like rofecoxib (Vioxx)
          will show its trial and approval records alongside the adverse event signal that preceded
          its 2004 market withdrawal. The arc ran the same way as semaglutide — and broke differently.
        </p>
        <div className="flex items-center gap-3 pt-2 border-t border-gray-800 flex-wrap text-xs">
          <Link href="/search?q=clinical+trial" className="text-gray-500 hover:text-gray-300 transition-colors">
            Browse clinical trials →
          </Link>
          <Link href="/search?q=FDA+approved" className="text-gray-500 hover:text-gray-300 transition-colors">
            Browse FDA approvals →
          </Link>
          <Link href="/settling-curve" className="text-gray-500 hover:text-gray-300 transition-colors">
            Settling Curve demo →
          </Link>
          <Link href="/about" className="text-gray-500 hover:text-gray-300 transition-colors">
            About this project →
          </Link>
        </div>
      </div>

    </div>
  );
}
