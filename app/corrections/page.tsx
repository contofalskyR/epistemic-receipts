import Link from "next/link";

export const revalidate = 3600;

export const metadata = {
  title: "Corrections — Epistemic Receipts",
  description:
    "Public audit log of data-quality events: pipeline retirements, fabricated-record corrections, and schema diagnostics.",
};

type EventKind = "RETIRED" | "CORRECTED" | "DEPRECATED" | "DIAGNOSTIC";

interface AuditEntry {
  date: string;            // ISO YYYY-MM-DD
  kind: EventKind;
  source: string;          // pipeline tag, field, or system area
  title: string;
  description: string;
  details?: string[];      // bullet points
  recordsAffected?: number;
  resolutionLinks?: { label: string; href: string }[];
}

const ENTRIES: AuditEntry[] = [
  {
    date: "2026-06-08",
    kind: "CORRECTED",
    source: "Claim.currentStatus / epistemicStatus",
    title: "Two undocumented status values discovered and resolved via epistemicAxis backfill",
    description:
      "A pre-migration diagnostic over all 1,466,486 active claims surfaced two values written by historical ingesters that were not in the original schema docstrings: VERIFIED (2,011 records) in currentStatus and established (2,886 records) in epistemicStatus. Rather than retroactively rewrite the source columns, both values were mapped into the new 5-way epistemicAxis column (treated as RECORDED) during backfill, preserving the legacy fields for audit.",
    details: [
      "currentStatus = VERIFIED: 2,011 claims (legacy ingesters that wrote into the wrong column)",
      "epistemicStatus = established: 2,886 claims (not in original docstring)",
      "Resolution: introduced epistemicAxis column with explicit mapping rules; legacy values preserved",
    ],
    recordsAffected: 4897,
    resolutionLinks: [
      { label: "Diagnostic doc", href: "/" },
    ],
  },
  {
    date: "2026-05-12",
    kind: "RETIRED",
    source: "uspto_v1 (Pipeline 5)",
    title: "USPTO Patents pipeline retired — fabricated metadata confirmed on audit",
    description:
      "Pipeline 5 ingested 182 US patent claims and 97 distinct patent numbers using a hardcoded curated list. On audit, records were confirmed to contain fabricated metadata sourced from model recall rather than the USPTO registry. The fabrication was structural: model memory produced internally consistent but incorrect records.",
    details: [
      "Exact scope: 182 claims, 97 distinct patent numbers",
      "Failure mode A (fabricated metadata): US4431740 carried the correct patent number but title and inventors were lifted from a different patent — US4237224, the Cohen-Boyer chimeric DNA patent. The two patents share a technological lineage that made the confabulation plausible but unverifiable without live API access. Pattern analysis of other records in the batch showed the same signature.",
      "Failure mode B (structural contamination): court-case-style citation strings were placed in the assignee field for the tobacco patent bucket during ingestion — a separate bug from the fabrication issue, likely caused by inadequate field validation in the ingest script.",
      "Resolution: all 182 claims set to verificationStatus=DEPRECATED with metadata.deprecation_reason documenting both failure modes. Records retained in database for audit trail. Script relocated to scripts/retired/ingest-uspto-patents.ts to prevent re-runs.",
      "Doctrine change: AGENTS.md codified the verifiable-sources rule — 'curated lists in HARD_FACT pipelines must be sourced from a verifiable external record (live API, Wikipedia article with citation, peer-reviewed publication, or government database); training-data recall is not a verifiable source.' GenBank (Pipeline 3) had already implemented this correctly by verifying accessions against ncbi.nlm.nih.gov before approval. The USPTO pipeline failed to do so because the absence of a working USPTO bulk API made model recall feel like an acceptable substitute. It was not.",
    ],
    recordsAffected: 182,
    resolutionLinks: [
      { label: "Pipeline data card — uspto_v1", href: "/datasets/uspto_v1" },
      { label: "Methodology — deprecation policy", href: "/methodology#deprecation" },
      { label: "Methodology — reference-tier test", href: "/methodology#reference-tier" },
    ],
  },
];

const KIND_STYLE: Record<EventKind, string> = {
  RETIRED:    "bg-red-950/60 text-red-300 border-red-900/60",
  CORRECTED:  "bg-blue-950/60 text-blue-300 border-blue-900/60",
  DEPRECATED: "bg-orange-950/60 text-orange-300 border-orange-900/60",
  DIAGNOSTIC: "bg-gray-800/60 text-gray-300 border-gray-700/60",
};

export default function CorrectionsPage() {
  const sorted = [...ENTRIES].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="space-y-3">
        <p className="text-xs text-gray-600 font-mono uppercase tracking-widest">
          Corrections
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-snug">
          Public audit log
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
          We log every meaningful data-quality event on our side of the ledger: pipelines retired,
          records corrected or marked deprecated, schema diagnostics that changed how we read existing data.
          Nothing is hard-deleted &mdash; deprecated records stay in the database with a{" "}
          <span className="font-mono">verificationStatus</span> flag and a written reason, so the audit
          trail outlives any single fix.
        </p>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Logged events</p>
          <p className="mt-1 text-3xl font-semibold text-white tabular-nums">{sorted.length}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Pipelines retired</p>
          <p className="mt-1 text-3xl font-semibold text-white tabular-nums">
            {sorted.filter((e) => e.kind === "RETIRED").length}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-4">
          <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Records affected</p>
          <p className="mt-1 text-3xl font-semibold text-white tabular-nums">
            {sorted
              .reduce((s, e) => s + (e.recordsAffected ?? 0), 0)
              .toLocaleString()}
          </p>
        </div>
      </div>

      {/* Audit log */}
      <div className="space-y-3">
        {sorted.map((e, i) => (
          <article
            key={i}
            className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-5 space-y-3"
          >
            <header className="flex items-start gap-3 flex-wrap">
              <span className="font-mono text-xs text-gray-500 tabular-nums shrink-0 mt-0.5">
                {e.date}
              </span>
              <span
                className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border ${KIND_STYLE[e.kind]} shrink-0`}
              >
                {e.kind}
              </span>
              <span className="text-xs font-mono text-gray-400 shrink-0">
                {e.source}
              </span>
              {typeof e.recordsAffected === "number" && (
                <span className="text-xs text-gray-500 shrink-0 ml-auto">
                  {e.recordsAffected.toLocaleString()} records affected
                </span>
              )}
            </header>

            <h2 className="text-sm font-semibold text-white leading-snug">
              {e.title}
            </h2>

            <p className="text-sm text-gray-400 leading-relaxed">{e.description}</p>

            {e.details && e.details.length > 0 && (
              <ul className="text-xs text-gray-500 space-y-1 list-disc pl-5">
                {e.details.map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
              </ul>
            )}

            {e.resolutionLinks && e.resolutionLinks.length > 0 && (
              <div className="flex gap-3 flex-wrap pt-1 border-t border-gray-800">
                {e.resolutionLinks.map((l) => (
                  <Link
                    key={l.href + l.label}
                    href={l.href}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {l.label} &rarr;
                  </Link>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Principles */}
      <div className="rounded-lg border border-gray-800 bg-gray-900/40 px-5 py-5 space-y-3 text-sm text-gray-400 leading-relaxed">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          How we handle data-quality events
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <span className="text-gray-300 font-medium">No hard deletes.</span> Deprecated records
            are flagged, not erased. The audit trail must outlive any single correction.
          </li>
          <li>
            <span className="text-gray-300 font-medium">Reasons are written down.</span> Every
            deprecation carries a <span className="font-mono">metadata.deprecation_reason</span>{" "}
            string referencing the specific failure mode.
          </li>
          <li>
            <span className="text-gray-300 font-medium">Pipelines that fail audit are retired,
              not patched.</span> When a data source can&apos;t support per-record verification at
            reasonable cost, the source is retired rather than left in the canon.
          </li>
          <li>
            <span className="text-gray-300 font-medium">
              humanReviewed and autoApproved stay separate.
            </span>{" "}
            A human review flag is never set by a script to work around a visibility bug &mdash; the
            filter is fixed instead.
          </li>
        </ul>
      </div>
    </div>
  );
}
