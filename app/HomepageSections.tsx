import Link from "next/link";
import type { WhatsNewItem } from "@/lib/feed";
import { compactCount } from "@/lib/format";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HomepageStats = {
  claims: number;
  sources: number;
  legislativeVotes: number;
  retractedPapers: number;
  vdemIndicators: number;
};

export type HomepageSectionsProps = {
  stats: HomepageStats;
  ingestedByCounts: Map<string, number>;
  whatsNew: WhatsNewItem[];
};

// ─── Domain config ────────────────────────────────────────────────────────────

type Domain = {
  name: string;
  emoji: string;
  href: string;
  ingestedByKeys: string[];
  sourceTags: string[];
  topBorder: string;
  hoverBorder: string;
};

const DOMAINS: Domain[] = [
  {
    name: "Climate & Environment",
    emoji: "🌡️",
    href: "/search?q=climate",
    // NB: the pipeline tag is "worldbank_v1" (no underscore) — the old
    // "world_bank_v1" key silently counted 0, and "ipcc_v1" doesn't exist
    // as a pipeline, so the tile also displayed an IPCC chip with no IPCC
    // data behind it (AUDIT-PRELAUNCH-2026-07-06).
    ingestedByKeys: ["worldbank_v1", "who_gho_v1"],
    sourceTags: ["World Bank", "WHO GHO"],
    topBorder: "border-t-emerald-500",
    hoverBorder: "hover:border-emerald-400",
  },
  {
    name: "US Congress",
    emoji: "🏛️",
    href: "/congress-trades",
    // congress_stock_act_v1 backs the "STOCK Act" chip; the tracker pipeline
    // is Congress.gov data like congress_v1.
    ingestedByKeys: ["congress_v1", "voteview_v1", "congress_bills_v1", "congress_bills_tracker_v1", "congress_stock_act_v1"],
    sourceTags: ["Congress.gov", "Voteview", "STOCK Act"],
    topBorder: "border-t-blue-500",
    hoverBorder: "hover:border-blue-400",
  },
  {
    name: "Academic Literature",
    emoji: "📚",
    href: "/fields",
    // Was mislabeled "Neuroscience": openalex_v1 is the whole cross-field
    // OpenAlex corpus, not a neuroscience set (AUDIT-PRELAUNCH-2026-07-06 §9).
    ingestedByKeys: ["openalex_v1", "nih_reporter_v1"],
    sourceTags: ["OpenAlex", "NIH RePORTER"],
    topBorder: "border-t-purple-500",
    hoverBorder: "hover:border-purple-400",
  },
  {
    name: "Law & Courts",
    emoji: "⚖️",
    href: "/law",
    ingestedByKeys: [
      "courtlistener_scotus_v1",
      "courtlistener_circuits_v1",
      "courtlistener_state_supreme_v1",
    ],
    sourceTags: ["SCOTUS", "Circuits", "State Supremes"],
    topBorder: "border-t-amber-500",
    hoverBorder: "hover:border-amber-400",
  },
  {
    name: "Global Politics",
    emoji: "🌍",
    href: "/search?q=politics",
    ingestedByKeys: ["vdem_v1", "who_gho_v1", "ofac_sdn_v1"],
    sourceTags: ["V-Dem", "WHO GHO", "OFAC SDN"],
    topBorder: "border-t-red-500",
    hoverBorder: "hover:border-red-400",
  },
  {
    name: "Vaccines & Medicine",
    emoji: "💉",
    href: "/medicine",
    ingestedByKeys: ["openfda_labels_v1", "drugsatfda_v1", "faers_normalized_drugs_v1"],
    sourceTags: ["openFDA", "Drugs@FDA", "FAERS"],
    topBorder: "border-t-sky-500",
    hoverBorder: "hover:border-sky-400",
  },
  {
    name: "History",
    emoji: "📜",
    href: "/history",
    ingestedByKeys: ["nara_catalog_v1", "miller_center_v1", "frus_v1"],
    sourceTags: ["NARA", "Miller Center", "FRUS"],
    topBorder: "border-t-orange-500",
    hoverBorder: "hover:border-orange-400",
  },
  {
    name: "Astronomy & Space",
    emoji: "🔭",
    href: "/astronomy",
    ingestedByKeys: ["nasa_exoplanet_v1", "space_missions_v1"],
    sourceTags: ["NASA", "GCAT"],
    topBorder: "border-t-teal-500",
    hoverBorder: "hover:border-teal-400",
  },
  {
    name: "Chemistry & Physics",
    emoji: "🧪",
    href: "/chemistry",
    ingestedByKeys: ["chebi_v1", "pubchem_v1", "periodic_table_v1"],
    sourceTags: ["ChEBI", "PubChem", "IUPAC"],
    topBorder: "border-t-pink-500",
    hoverBorder: "hover:border-pink-400",
  },
  {
    name: "Economics",
    emoji: "📊",
    href: "/economics",
    ingestedByKeys: ["worldbank_v1", "fred_v1", "openfec_v1", "openfec_ie_v1"],
    sourceTags: ["World Bank", "FRED", "OpenFEC"],
    topBorder: "border-t-yellow-500",
    hoverBorder: "hover:border-yellow-400",
  },
  {
    name: "Retractions",
    emoji: "🔁",
    href: "/retraction-explorer",
    ingestedByKeys: ["crossref_retractions_v1", "retraction_watch_v1"],
    sourceTags: ["CrossRef", "Retraction Watch"],
    topBorder: "border-t-rose-500",
    hoverBorder: "hover:border-rose-400",
  },
  // "Biology & Physiology" tile removed for launch: genbank_v1 has 99 claims,
  // ncbi_gene_v1 is dry-run pending, and iucn_v1 doesn't exist yet — a
  // 99-claim tile beside 300k-claim tiles read as a bug to first-time
  // visitors (AUDIT-PRELAUNCH-2026-07-06 §9). Re-add once the life-science
  // pipelines land:
  // {
  //   name: "Biology & Physiology",
  //   emoji: "🧬",
  //   href: "/biology",
  //   ingestedByKeys: ["genbank_v1", "ncbi_gene_v1", "iucn_v1"],
  //   sourceTags: ["GenBank", "NCBI Gene", "IUCN"],
  //   topBorder: "border-t-violet-500",
  //   hoverBorder: "hover:border-violet-400",
  // },
];

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

function sumKeys(counts: Map<string, number>, keys: string[]): number {
  let sum = 0;
  for (const k of keys) sum += counts.get(k) ?? 0;
  return sum;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: HomepageStats }) {
  const cells: { label: string; value: number }[] = [
    { label: "Claims indexed",       value: stats.claims },
    { label: "Primary sources",      value: stats.sources },
    { label: "Congressional votes",  value: stats.legislativeVotes },
    { label: "Retracted papers",     value: stats.retractedPapers },
    { label: "Democracy indicators", value: stats.vdemIndicators },
  ];
  // Full-bleed band: -mx-6 cancels the global <main> px-6 gutter so the bar runs
  // edge-to-edge, while the inner container keeps the content centered. On mobile
  // it's a compact 2-column grid (not a 500px-tall stack); 5 columns on desktop.
  // The gap + container background renders thin separators between cells.
  return (
    <section className="-mx-6 bg-gray-800/60 border-y border-gray-800">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-px max-w-6xl mx-auto">
        {cells.map((c) => (
          <div key={c.label} className="bg-gray-900/90 px-4 py-6 text-center">
            <div className="text-2xl sm:text-4xl font-bold text-amber-400 tabular-nums">
              {c.value.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] sm:text-xs uppercase tracking-widest text-gray-500">
              {c.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DomainGrid({ ingestedByCounts }: { ingestedByCounts: Map<string, number> }) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <header className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-semibold text-white">Explore by Domain</h2>
        <p className="mt-1 text-sm text-gray-500">
          Each domain draws on its own primary sources — click any to browse claims
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {DOMAINS.map((d) => {
          const count = sumKeys(ingestedByCounts, d.ingestedByKeys);
          return (
            <Link
              key={d.name}
              href={d.href}
              className={`group block rounded-xl bg-gray-900/80 border border-gray-800 ${d.hoverBorder} border-t-[3px] ${d.topBorder} px-5 py-5 transition-colors`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0">{d.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
                    {d.name}
                  </h3>
                  <p className="mt-1 text-2xl font-bold text-gray-100 tabular-nums">
                    {count.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">claims</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {d.sourceTags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 uppercase tracking-wide"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Feature showcase strip ─────────────────────────────────────────────────────

type Feature = {
  emoji: string;
  name: string;
  blurb: string;
  href: string;
  accent: string; // border-t color
  cta: string;
};

const FEATURES: Feature[] = [
  {
    emoji: "📈",
    name: "Settling Curve",
    blurb: "Watch a claim move across expert literature, institutions, courts, and the public — milestone by milestone.",
    href: "/settling-curve",
    accent: "border-t-emerald-500",
    cta: "Trace a trajectory",
  },
  {
    emoji: "🗳️",
    name: "Representation Gap",
    blurb: "700k constituents' opinions vs. how their delegation actually voted — issue by issue.",
    href: "/analysis/representation",
    accent: "border-t-sky-500",
    cta: "See the gap",
  },
  {
    emoji: "💸",
    name: "Congress Trades",
    blurb: "STOCK Act disclosures correlated with the votes each legislator cast.",
    href: "/congress-trades",
    accent: "border-t-blue-500",
    cta: "Follow the money",
  },
  {
    emoji: "🔁",
    name: "Retraction Explorer",
    blurb: "26k+ retracted papers and the live citations that still point at them.",
    href: "/retraction-explorer",
    accent: "border-t-rose-500",
    cta: "Inspect retractions",
  },
  {
    emoji: "🔍",
    name: "Case Studies",
    blurb: "Curated investigations — from Korematsu to Pluto to the lab-leak debate — each tracing a full epistemic arc.",
    href: "/case-studies",
    accent: "border-t-amber-500",
    cta: "Browse case studies",
  },
];

function FeatureShowcase({ claimsLabel }: { claimsLabel: string }) {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-16 pb-4">
      <header className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-semibold text-white">What you can do here</h2>
        <p className="mt-1 text-sm text-gray-500">
          Five ways into {claimsLabel} claims — each one a different lens on how knowledge moves.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f) => (
          <Link
            key={f.name}
            href={f.href}
            className={`group flex flex-col rounded-xl bg-gray-900/80 border border-gray-800 hover:border-gray-600 border-t-[3px] ${f.accent} px-5 py-5 transition-colors`}
          >
            <span className="text-2xl">{f.emoji}</span>
            <h3 className="mt-3 text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
              {f.name}
            </h3>
            <p className="mt-1.5 text-sm text-gray-400 leading-relaxed flex-1">{f.blurb}</p>
            <span className="mt-4 text-xs font-medium text-amber-400 group-hover:text-amber-300 transition-colors">
              {f.cta} →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── "What's new" — recent epistemic transitions (ClaimStatusHistory) ────────────

const TRANSITION_AXIS_STYLE: Record<string, { label: string; dot: string; text: string }> = {
  SETTLED:   { label: "Settled",   dot: "bg-emerald-400", text: "text-emerald-300" },
  CONTESTED: { label: "Contested", dot: "bg-amber-400",   text: "text-amber-300" },
  RECORDED:  { label: "Recorded",  dot: "bg-slate-400",   text: "text-slate-300" },
  REVERSED:  { label: "Reversed",  dot: "bg-red-400",     text: "text-red-300" },
  ABANDONED: { label: "Abandoned", dot: "bg-gray-500",    text: "text-gray-400" },
  OPEN:      { label: "Open",      dot: "bg-sky-400",     text: "text-sky-300" },
};

function WhatsNewStrip({ items }: { items: WhatsNewItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white">What&apos;s new</h2>
          <p className="mt-1 text-sm text-gray-500">
            The latest epistemic state-changes added to the graph
          </p>
        </div>
        <Link href="/feed" className="text-sm text-amber-400 hover:text-amber-300 transition-colors shrink-0">
          Full feed →
        </Link>
      </header>
      <div className="divide-y divide-gray-800 border-y border-gray-800">
        {items.map((t) => {
          const axis = TRANSITION_AXIS_STYLE[t.toAxis] ?? TRANSITION_AXIS_STYLE.RECORDED;
          return (
            <Link
              key={t.id}
              href={t.href}
              className="group grid grid-cols-1 sm:grid-cols-[1fr_auto] items-center gap-2 sm:gap-6 py-4 hover:bg-gray-900/40 transition-colors -mx-3 px-3 rounded-lg"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-300 group-hover:text-white transition-colors leading-relaxed">
                  {truncate(t.claimText, 150)}
                </p>
                {t.reason && (
                  <p className="mt-0.5 text-xs text-gray-600 leading-snug line-clamp-1">
                    {truncate(t.reason, 120)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs">
                {t.occurredYear && <span className="font-mono text-gray-600">{t.occurredYear}</span>}
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${axis.dot}`} />
                  <span className={`font-mono uppercase tracking-wide ${axis.text}`}>{axis.label}</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Coming soon — in-development features ──────────────────────────────────────

function ComingSoon() {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-8 pb-16">
      <Link
        href="/globe"
        className="block rounded-xl border border-gray-800/80 bg-gray-900/40 px-6 py-6 hover:border-gray-600/80 hover:bg-gray-900/60 transition-colors group"
      >
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 opacity-60 group-hover:opacity-90 transition-opacity" aria-hidden="true">🌍</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-400 group-hover:text-gray-200 transition-colors">Interactive Globe</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-700/80 border border-amber-900/40 rounded-full px-2 py-0.5">
                In development
              </span>
            </div>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed max-w-2xl">
              A geographic view of claims by country — where legislation was passed, where
              science was published, where events occurred.
            </p>
          </div>
          <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-sm shrink-0 self-center">→</span>
        </div>
      </Link>
    </section>
  );
}

// ─── Top-level export ─────────────────────────────────────────────────────────

export default function HomepageSections({
  stats,
  ingestedByCounts,
  whatsNew,
}: HomepageSectionsProps) {
  return (
    <>
      <FeatureShowcase claimsLabel={compactCount(stats.claims)} />
      <StatsBar stats={stats} />
      <WhatsNewStrip items={whatsNew} />
      <DomainGrid ingestedByCounts={ingestedByCounts} />
      <ComingSoon />
    </>
  );
}
