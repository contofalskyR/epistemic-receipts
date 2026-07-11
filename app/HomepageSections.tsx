// Below-the-fold bands of the V1 landing page (docs/design v1-landing-mockup.html):
// "Moved recently" ticker → three pillars → corpus index → honesty band.
// Server component, no client JS. Counting logic is untouched from the
// pre-launch audit fixes — only the presentation changed (tiles → text links).

import Link from "next/link";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";
import { snippet, type WhatsNewItem } from "@/lib/feed";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HomepageStats = {
  claims: number;
  /** ClaimStatusHistory rows — dated status transitions across the corpus. */
  transitions: number;
  /** Non-deprecated claims with ≥2 dated transitions — moved past the entry point at least once. */
  settlingCurves: number;
  /** Subset of settlingCurves whose transitions land on more than one distinct calendar date — real movement over time, not a same-day bulk completion. */
  settlingCurvesMultiDate: number;
  sources: number;
  legislativeVotes: number;
  retractedPapers: number;
};

export type HomepageSectionsProps = {
  stats: HomepageStats;
  ingestedByCounts: Map<string, number>;
  whatsNew: WhatsNewItem[];
};

// ─── Domain config ────────────────────────────────────────────────────────────
// V1 renders these as quiet text links in the corpus band instead of tiles, but
// the config (and its audit-verified pipeline keys) is unchanged. emoji/border
// fields are kept so the tile presentation can be restored without re-auditing.

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

function sumKeys(counts: Map<string, number>, keys: string[]): number {
  let sum = 0;
  for (const k of keys) sum += counts.get(k) ?? 0;
  return sum;
}

// ─── "Moved recently" ticker ─────────────────────────────────────────────────
// The mockup's "Moved this week" strip. Items are the latest ClaimStatusHistory
// rows by ingestion time (lib/feed.loadRecentTransitions) — labeled "recently"
// rather than "this week" because the loader has no calendar window and the
// label must stay true in a slow week. Axis coloring reuses EpistemicAxisBadge.

function MovedTicker({ items }: { items: WhatsNewItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <section
      aria-label="Recently moved claims"
      className="-mx-6 border-y border-gray-800/80 bg-gray-900/30"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-5 overflow-x-auto px-6 py-3 no-scrollbar">
        <span className="shrink-0 text-[11px] font-mono uppercase tracking-[0.14em] text-amber-400/90">
          Moved recently
        </span>
        {items.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className="inline-flex shrink-0 items-center gap-2 text-[13px] text-gray-400 transition-colors hover:text-gray-200"
          >
            <EpistemicAxisBadge
              axis={t.toAxis}
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            />
            <span className="whitespace-nowrap">{snippet(t.reason ?? t.claimText, 88)}</span>
            {t.occurredYear && (
              <span className="font-mono text-[11px] text-gray-600">{t.occurredYear}</span>
            )}
          </Link>
        ))}
        <Link
          href="/feed"
          className="shrink-0 text-[13px] text-amber-400/80 transition-colors hover:text-amber-300"
        >
          Full feed →
        </Link>
      </div>
    </section>
  );
}

// ─── Pillars ──────────────────────────────────────────────────────────────────
// Mockup pillar 2 is "Orphaned trials" — that tracker isn't live in this repo
// (no route, no pipeline), so the second real pillar is the Retraction Explorer,
// with its count derived from the same grouped query as everything else. The
// third card is the mockup's V2 tease, deliberately unlinked.

function Pillars({ retractedPapers }: { retractedPapers: number }) {
  return (
    <section className="mx-auto max-w-5xl py-8">
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/settling-curve"
          className="group rounded-xl border border-gray-800 bg-gray-900/60 p-5 transition-colors hover:border-gray-600"
        >
          <span aria-hidden="true" className="text-xl text-emerald-400">
            ◠
          </span>
          <h3 className="mt-2.5 text-[15px] font-medium text-gray-100 transition-colors group-hover:text-white">
            Settling curves
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-500">
            Follow any claim&apos;s dated trajectory — and get an email when it moves. No date is
            ever invented; undatable transitions are refused, on the record.
          </p>
        </Link>

        <Link
          href="/retraction-explorer"
          className="group rounded-xl border border-gray-800 bg-gray-900/60 p-5 transition-colors hover:border-gray-600"
        >
          <span aria-hidden="true" className="text-xl text-rose-300">
            ↩
          </span>
          <h3 className="mt-2.5 text-[15px] font-medium text-gray-100 transition-colors group-hover:text-white">
            Retracted, still cited
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-500">
            {retractedPapers.toLocaleString("en-US")} retracted papers — named, dated, sourced —
            and the live citations that still point at them.
          </p>
        </Link>

        <div className="rounded-xl border border-amber-700/60 bg-gray-900/60 p-5">
          <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-amber-400/90">
            Coming — V2
          </p>
          <h3 className="mt-2.5 text-[15px] font-medium text-gray-100">
            What does a book rest on?
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-500">
            One classic, every citation drawn as an arc, colored by its status today. Some arcs
            will be red.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Corpus band ──────────────────────────────────────────────────────────────
// Replaces the StatsBar + DomainGrid tiles with one quiet index band.
// Stats-bar numbers still derive from the SAME grouped query the domain links
// use, so the same figure can never differ across one page (audit §8: the stats
// bar said 26,624 retracted papers while the Retractions tile said 26,679 —
// the bar counted crossref only, the tile crossref + retraction_watch).
// Domain routes (/law, /medicine, /history, …) keep their homepage links here —
// V1 trims are hide-from-nav, never deletion.

function CorpusBand({
  stats,
  ingestedByCounts,
}: {
  stats: HomepageStats;
  ingestedByCounts: Map<string, number>;
}) {
  const cells: { label: string; value: number }[] = [
    { label: "claims indexed", value: stats.claims },
    { label: "dated transitions", value: stats.transitions },
    { label: "settling curves", value: stats.settlingCurves },
    { label: "curves with movement over time", value: stats.settlingCurvesMultiDate },
    { label: "primary sources", value: stats.sources },
    { label: "congressional votes", value: stats.legislativeVotes },
    { label: "retracted papers", value: stats.retractedPapers },
  ];
  return (
    <section className="mx-auto max-w-5xl pb-12 pt-2">
      <h2 className="text-[11px] font-mono uppercase tracking-[0.14em] text-gray-500">
        The corpus
      </h2>
      <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 font-mono text-[13px] leading-relaxed text-gray-500">
        {cells.map((c, i) => (
          <span key={c.label} className="whitespace-nowrap">
            <span className="tabular-nums text-gray-200">{c.value.toLocaleString("en-US")}</span>{" "}
            {c.label}
            {i < cells.length - 1 && <span className="text-gray-700"> ·</span>}
          </span>
        ))}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {DOMAINS.map((d) => {
          const count = sumKeys(ingestedByCounts, d.ingestedByKeys);
          return (
            <Link
              key={d.name}
              href={d.href}
              className="inline-flex items-baseline gap-1.5 rounded-full border border-gray-800 bg-gray-900/50 px-3 py-1 text-[12.5px] text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
            >
              {d.name}
              <span className="font-mono text-[11px] tabular-nums text-gray-600">
                {count.toLocaleString("en-US")}
              </span>
            </Link>
          );
        })}
        <Link
          href="/case-studies"
          className="inline-flex items-baseline rounded-full border border-gray-800 bg-gray-900/50 px-3 py-1 text-[12.5px] text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
        >
          Case studies
        </Link>
        <Link
          href="/globe"
          className="inline-flex items-baseline rounded-full border border-gray-800 bg-gray-900/50 px-3 py-1 text-[12.5px] text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
        >
          Globe
        </Link>
      </div>
    </section>
  );
}

// ─── Honesty band ─────────────────────────────────────────────────────────────
// The mockup footer, as a homepage band (the site-wide footer lives in
// layout.tsx and is out of scope). "CC-BY" from the mockup is NOT the real
// license — the data ships under ER-Community-1.0 (/license) — and the API
// serves JSON only (/docs/api), so the mono line says exactly that.

function HonestyBand() {
  return (
    <section className="-mx-6 border-t border-gray-800/80">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 py-5 text-xs text-gray-500">
        <span className="leading-relaxed">
          Dates are never invented — undatable transitions are refused, and we say so.{" "}
          <Link
            href="/methodology"
            className="text-gray-400 underline-offset-2 transition-colors hover:text-gray-200 hover:underline"
          >
            Methods
          </Link>
          {" · "}
          <Link
            href="/corrections"
            className="text-gray-400 underline-offset-2 transition-colors hover:text-gray-200 hover:underline"
          >
            Corrections log
          </Link>
        </span>
        <span className="font-mono">
          <Link href="/docs/api" className="transition-colors hover:text-gray-300">
            API
          </Link>
          {" · JSON · "}
          <Link href="/license" className="transition-colors hover:text-gray-300">
            ER-Community-1.0
          </Link>
        </span>
      </div>
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
      <MovedTicker items={whatsNew} />
      <Pillars retractedPapers={stats.retractedPapers} />
      <CorpusBand stats={stats} ingestedByCounts={ingestedByCounts} />
      <HonestyBand />
    </>
  );
}
