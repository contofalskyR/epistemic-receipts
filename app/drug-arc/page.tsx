import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DrugArcClient from "./DrugArcClient";
import { StageCard, AreaRow } from "./DrugArcStageCard";


export const metadata = {
  title: 'Drug Arc — Epistemic Receipts',
  description:
    "Trace a drug's full arc from registered trials to approval, sourced from ClinicalTrials.gov and Drugs@FDA.",
};

export const revalidate = 3600;

const C = {
  bg: "#0a0a0a", panel: "#10101c", panelEdge: "#23233a",
  ink: "#e9e9f2", mut: "#8b8ba3", faint: "#55556e", brand: "#d4a853",
} as const;

// ── Therapeutic area keyword buckets ─────────────────────────────────────────

const AREA_BUCKETS: { key: string; label: string; keywords: string[]; color: string; primaryKeyword: string }[] = [
  { key: "oncology",        label: "Oncology",                keywords: ["cancer", "tumor", "carcinoma", "lymphoma", "leukemia", "melanoma", "myeloma", "sarcoma", "oncol", "neoplasm"],                                              color: "rose",   primaryKeyword: "cancer" },
  { key: "cardiology",      label: "Cardiology",              keywords: ["cardiovascular", "cardiac", "heart failure", "hypertension", "coronary", "arrhythmia", "thrombosis", "anticoagul"],                                          color: "red",    primaryKeyword: "cardiovascular" },
  { key: "metabolic",       label: "Metabolic / Endocrine",   keywords: ["diabetes", "insulin", "obesity", "thyroid", "metabolic", "hyperlipidemia", "cholesterol", "glucose", "GLP-1", "semaglutide"],                               color: "yellow", primaryKeyword: "diabetes" },
  { key: "infectious",      label: "Infectious Disease",      keywords: ["infection", "bacterial", "viral", "HIV", "antibiotic", "antiviral", "hepatitis", "pneumonia", "tuberculosis", "fungal"],                                    color: "green",  primaryKeyword: "infection" },
  { key: "neurology",       label: "Neurology / CNS",         keywords: ["neurolog", "epilepsy", "seizure", "Alzheimer", "Parkinson", "schizophrenia", "depression", "anxiety", "migraine", "multiple sclerosis"],                    color: "purple", primaryKeyword: "neurology" },
  { key: "immunology",      label: "Immunology / Autoimmune", keywords: ["autoimmune", "rheumatoid", "lupus", "inflammatory bowel", "monoclonal antibody", "immunosuppress", "transplant rejection"],                                  color: "sky",    primaryKeyword: "autoimmune" },
  { key: "respiratory",     label: "Respiratory",             keywords: ["pulmonary", "lung", "asthma", "COPD", "respiratory", "bronchial", "cystic fibrosis"],                                                                       color: "cyan",   primaryKeyword: "pulmonary" },
  { key: "dermatology",     label: "Dermatology",             keywords: ["dermatitis", "psoriasis", "eczema", "skin", "acne", "rosacea", "alopecia"],                                                                                 color: "amber",  primaryKeyword: "dermatitis" },
  { key: "hematology",      label: "Hematology",              keywords: ["anemia", "hemophilia", "platelet", "hematolog", "sickle cell", "clotting factor"],                                                                          color: "orange", primaryKeyword: "anemia" },
  { key: "gastroenterology",label: "Gastroenterology",        keywords: ["gastro", "hepatic", "liver disease", "bowel", "colon", "esophag", "irritable bowel", "ulcerative"],                                                         color: "lime",   primaryKeyword: "gastroenterology" },
];

const AREA_BAR_COLORS: Record<string, string> = {
  rose:   "rgba(244,63,94,0.6)",
  red:    "rgba(239,68,68,0.6)",
  yellow: "rgba(234,179,8,0.6)",
  green:  "rgba(34,197,94,0.6)",
  purple: "rgba(168,85,247,0.6)",
  sky:    "rgba(14,165,233,0.6)",
  cyan:   "rgba(6,182,212,0.6)",
  amber:  "rgba(245,158,11,0.6)",
  orange: "rgba(249,115,22,0.6)",
  lime:   "rgba(132,204,22,0.6)",
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

  for (const c of claims) {
    const lower = c.text.toLowerCase();
    for (const b of AREA_BUCKETS) {
      if (b.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        counts[b.key]++;
      }
    }
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
      href: "/search?q=clinical+trial",
      barColor: "rgba(59,130,246,0.8)",
      countColor: "#93c5fd",
    },
    {
      key: "approvals",
      label: "FDA Approvals",
      sublabel: "Original NDA/BLA applications approved",
      count: funnel.approvals,
      widthPct: Math.max(5, Math.round((funnel.approvals / Math.max(funnel.trials, 1)) * 100)),
      href: "/search?q=FDA+NDA+approved",
      barColor: "rgba(16,185,129,0.8)",
      countColor: "#6ee7b7",
    },
    {
      key: "adverse",
      label: "Post-Market Surveillance",
      sublabel: "Drugs with FAERS aggregate adverse event records",
      count: funnel.adverseEvents,
      widthPct: Math.max(5, Math.round((funnel.adverseEvents / Math.max(funnel.trials, 1)) * 100)),
      href: "/search?q=adverse+events",
      barColor: "rgba(249,115,22,0.8)",
      countColor: "#fdba74",
    },
    {
      key: "links",
      label: "Trial → Approval Links",
      sublabel: "Verified OUTCOME relations in the receipts graph",
      count: funnel.outcomeLinks,
      widthPct: Math.max(2, Math.round((funnel.outcomeLinks / Math.max(funnel.trials, 1)) * 100)),
      href: "/prereq-graph?domain=medicine",
      barColor: "rgba(139,92,246,0.8)",
      countColor: "#c4b5fd",
    },
  ];

  return (
    <div
      style={{
        marginTop: "-2rem",
        marginLeft: "-1.5rem",
        marginRight: "-1.5rem",
        background: C.bg,
        minHeight: "100vh",
      }}
    >
      {/* Sticky sub-nav */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: 48,
          background: C.bg,
          borderBottom: `1px solid ${C.panelEdge}`,
          display: "flex",
          alignItems: "center",
          padding: "0 2rem",
        }}
      >
        <Link
          href="/"
          style={{ color: C.brand, fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" }}
        >
          ⬡ Epistemic Receipts
        </Link>
        <span style={{ color: C.faint, margin: "0 0.5rem", fontSize: "0.9rem" }}>/</span>
        <span style={{ color: C.ink, fontWeight: 700, fontSize: "0.9rem" }}>Drug Arc</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem" }}>

        {/* Hero */}
        <div style={{ marginBottom: "3rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, color: C.ink, lineHeight: 1.25, margin: "0 0 1rem" }}>
            <span style={{ color: C.brand }}>FDA Drug Development Pipeline</span>
          </h1>
          <p style={{ fontSize: "0.95rem", color: C.mut, lineHeight: 1.7, margin: 0 }}>
            A new drug takes on average{" "}
            <span style={{ color: C.ink }}>10–15 years</span> and over{" "}
            <span style={{ color: C.ink }}>$2 billion</span> to reach patients.
            Of every 5,000 compounds that enter preclinical testing, only about{" "}
            <span style={{ color: C.ink }}>5 make it to human trials</span> — and fewer than 1 receives FDA approval.
            Each stage leaves a datable, auditable receipt. This page maps that arc
            using live data from this database.
          </p>
        </div>

        {/* Funnel stages */}
        <section style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, marginBottom: "1.25rem" }}>
            Pipeline Funnel — Live Counts
          </h2>
          {stages.map(({ key, ...s }) => (
            <StageCard key={key} {...s} />
          ))}
          <p style={{ fontSize: "0.75rem", color: C.faint, lineHeight: 1.6, marginTop: "0.75rem" }}>
            Bar widths show each stage relative to the clinical trials corpus. FDA approvals are a
            distinct pipeline (Drugs@FDA bulk export) — the counts are not strict funnel ratios, but
            they illustrate the attrition reality.
          </p>
        </section>

        {/* Drug search */}
        <section style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: C.brand, marginBottom: "0.5rem" }}>
            Trace a Drug&apos;s Arc
          </h2>
          <p style={{ fontSize: "0.85rem", color: C.mut, lineHeight: 1.6, marginBottom: "1.25rem" }}>
            Search by drug name or compound. Returns matching records across clinical trial registrations,
            FDA approval decisions, and FAERS adverse event aggregates — ordered chronologically.
          </p>
          <DrugArcClient />
        </section>

        {/* Therapeutic areas */}
        <section style={{ marginBottom: "3rem" }}>
          <h2 style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, marginBottom: "0.4rem" }}>
            FDA Approvals by Therapeutic Area
          </h2>
          <p style={{ fontSize: "0.75rem", color: C.faint, lineHeight: 1.6, marginBottom: "1rem" }}>
            Grouped from {fmt(funnel.approvals)} Drugs@FDA approval records by keyword matching in claim text.
            A single drug may appear in multiple categories.
          </p>
          <div>
            {areas.map((a) => (
              <AreaRow
                key={a.key}
                href={`/search?q=${encodeURIComponent(a.primaryKeyword)}`}
                label={a.label}
                widthPct={Math.round((a.count / maxAreaCount) * 100)}
                barColor={AREA_BAR_COLORS[a.color] ?? "rgba(100,100,120,0.6)"}
                count={a.count}
              />
            ))}
          </div>
        </section>

        {/* Featured arc */}
        <section
          style={{
            background: C.panel,
            border: `1px solid ${C.panelEdge}`,
            borderRadius: 12,
            padding: "1.5rem",
            marginBottom: "3rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: C.brand, marginBottom: "0.75rem" }}>
            Featured Arc — Semaglutide (GLP-1)
          </h2>
          <p style={{ fontSize: "0.9rem", color: C.mut, lineHeight: 1.7, margin: "0 0 0.75rem" }}>
            Semaglutide is one of the most studied arcs in this database. From Phase 3 SUSTAIN trials
            in the 2010s through three separate FDA approvals (Ozempic 2017, Rybelsus 2019, Wegovy 2021)
            to tens of thousands of FAERS adverse event reports — and a 2025 oral obesity approval
            still under active post-market surveillance. The arc is not closed.
          </p>
          <p style={{ fontSize: "0.8rem", color: C.faint, lineHeight: 1.6, margin: "0 0 1rem" }}>
            The Settling Curve demo traces this arc in detail — each milestone linked to its
            primary source claim in this database.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
              paddingTop: "1rem",
              borderTop: `1px solid ${C.panelEdge}`,
            }}
          >
            <Link
              href="/settling-curve"
              style={{
                fontSize: "0.8rem",
                color: C.brand,
                fontWeight: 600,
                textDecoration: "none",
                background: C.brand + "22",
                border: `1px solid ${C.brand}55`,
                borderRadius: 20,
                padding: "0.3rem 0.8rem",
              }}
            >
              View semaglutide settling curve →
            </Link>
            <Link
              href="/search?q=semaglutide"
              style={{
                fontSize: "0.8rem",
                color: C.mut,
                fontWeight: 500,
                textDecoration: "none",
                background: C.panelEdge,
                borderRadius: 20,
                padding: "0.3rem 0.8rem",
              }}
            >
              Search all semaglutide claims →
            </Link>
          </div>
        </section>

        {/* Interpretation */}
        <div
          style={{
            paddingTop: "2rem",
            borderTop: `1px solid ${C.panelEdge}`,
          }}
        >
          <h2 style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: C.faint, marginBottom: "1rem" }}>
            What the arc shows
          </h2>
          <p style={{ fontSize: "0.9rem", color: C.mut, lineHeight: 1.7, marginBottom: "1rem" }}>
            FDA approval is a receipt, not a verdict. It records that at the time of review,
            the available evidence crossed the agency&apos;s benefit-risk threshold for the named indication and population.
            Post-market surveillance — FAERS, pharmacovigilance studies, label updates — is how
            that receipt gets amended. Most approvals are never revoked. Some are.
          </p>
          <p style={{ fontSize: "0.9rem", color: C.mut, lineHeight: 1.7, marginBottom: "1.5rem" }}>
            The database captures both kinds. Searching for a withdrawn drug like rofecoxib (Vioxx)
            will show its trial and approval records alongside the adverse event signal that preceded
            its 2004 market withdrawal. The arc ran the same way as semaglutide — and broke differently.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              paddingTop: "1rem",
              borderTop: `1px solid ${C.panelEdge}`,
              flexWrap: "wrap",
            }}
          >
            <Link href="/search?q=clinical+trial" style={{ fontSize: "0.8rem", color: C.brand, textDecoration: "none" }}>
              Browse clinical trials →
            </Link>
            <Link href="/search?q=FDA+approved" style={{ fontSize: "0.8rem", color: C.brand, textDecoration: "none" }}>
              Browse FDA approvals →
            </Link>
            <Link href="/settling-curve" style={{ fontSize: "0.8rem", color: C.mut, textDecoration: "none" }}>
              Settling Curve demo →
            </Link>
            <Link href="/about" style={{ fontSize: "0.8rem", color: C.mut, textDecoration: "none" }}>
              About this project →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
