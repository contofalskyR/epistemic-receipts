import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

export type HomepageStats = {
  claims: number;
  sources: number;
  legislativeVotes: number;
  retractedPapers: number;
  vdemIndicators: number;
};

export type IngestedByCount = { ingestedBy: string; count: number };

export type FeaturedClaim = {
  id: string;
  text: string;
  sourceName: string | null;
  sourceYear: number | null;
} | null;

export type TopicChipData = {
  id: string;
  name: string;
  slug: string;
  domain: string;
  claimCount: number;
};

export type HomepageSectionsProps = {
  stats: HomepageStats;
  ingestedByCounts: Map<string, number>;
  featured: { settled: FeaturedClaim; contested: FeaturedClaim; recorded: FeaturedClaim };
  topTopics: TopicChipData[];
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
    ingestedByKeys: ["world_bank_v1", "ipcc_v1", "who_gho_v1"],
    sourceTags: ["World Bank", "WHO GHO", "IPCC"],
    topBorder: "border-t-emerald-500",
    hoverBorder: "hover:border-emerald-400",
  },
  {
    name: "US Congress",
    emoji: "🏛️",
    href: "/congress-trades",
    ingestedByKeys: ["congress_v1", "voteview_v1", "congress_bills_v1"],
    sourceTags: ["Congress.gov", "Voteview", "STOCK Act"],
    topBorder: "border-t-blue-500",
    hoverBorder: "hover:border-blue-400",
  },
  {
    name: "Neuroscience",
    emoji: "🧠",
    href: "/search?q=neuroscience",
    ingestedByKeys: ["openalex_v1"],
    sourceTags: ["OpenAlex", "NIH RePORTER"],
    topBorder: "border-t-purple-500",
    hoverBorder: "hover:border-purple-400",
  },
  {
    name: "Law & Courts",
    emoji: "⚖️",
    href: "/search?q=law",
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
    href: "/search?q=medicine",
    ingestedByKeys: ["openfda_labels_v1", "drugsatfda_v1", "faers_adverse_v1", "faers_normalized_drugs_v1"],
    sourceTags: ["openFDA", "Drugs@FDA", "FAERS"],
    topBorder: "border-t-sky-500",
    hoverBorder: "hover:border-sky-400",
  },
  {
    name: "History",
    emoji: "📜",
    href: "/search?q=history",
    ingestedByKeys: ["nara_catalog_v1", "miller_center_v1", "frus_v1"],
    sourceTags: ["NARA", "Miller Center", "FRUS"],
    topBorder: "border-t-orange-500",
    hoverBorder: "hover:border-orange-400",
  },
  {
    name: "Astronomy & Space",
    emoji: "🔭",
    href: "/search?q=space",
    ingestedByKeys: ["nasa_exoplanet_v1", "space_missions_v1"],
    sourceTags: ["NASA", "GCAT"],
    topBorder: "border-t-teal-500",
    hoverBorder: "hover:border-teal-400",
  },
  {
    name: "Chemistry & Physics",
    emoji: "🧪",
    href: "/search?q=chemistry",
    ingestedByKeys: ["chebi_v1", "pubchem_v1", "periodic_table_v1"],
    sourceTags: ["ChEBI", "PubChem", "IUPAC"],
    topBorder: "border-t-pink-500",
    hoverBorder: "hover:border-pink-400",
  },
  {
    name: "Economics",
    emoji: "📊",
    href: "/search?q=economics",
    ingestedByKeys: ["world_bank_v1", "fred_v1", "openfec_v1", "openfec_ie_v1"],
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
  {
    name: "Biology & Physiology",
    emoji: "🧬",
    href: "/search?q=biology",
    ingestedByKeys: ["genbank_v1", "ncbi_gene_v1", "iucn_v1"],
    sourceTags: ["GenBank", "NCBI Gene", "IUCN"],
    topBorder: "border-t-violet-500",
    hoverBorder: "hover:border-violet-400",
  },
];

// ─── Changelog data ───────────────────────────────────────────────────────────

const CHANGELOG: { date: string; text: string }[] = [
  {
    date: "JUNE 8, 2026",
    text: "Destination Pages Phase 2 shipped: /prereq-graph and /foreign-legislation live. epistemicAxis badges wired across all claim surfaces (SETTLED/CONTESTED/RECORDED/OPEN). 113,319 Voteview roll-calls (1789–2026) now searchable.",
  },
  {
    date: "JUNE 8, 2026",
    text: "WHO axis backfill complete — 32,713 WHO GHO claims → RECORDED. epistemicAxis coverage ~100%. Correlation filter on Congress Trades now wired to 140k LegislativeVote records.",
  },
  {
    date: "JUNE 7, 2026",
    text: "V-Dem enrichment: 67,254 new ClaimRelations (SANCTION_CONTEXT, CONFLICT_CONTEXT, MILITARY_CONTEXT). Contested Receipts shipped: epistemicStatus field, CONTRADICTS detector (11,319 edges), /settling-curve demo.",
  },
  {
    date: "JUNE 6, 2026",
    text: "Alerts MVP live. /fields hub (26 taxonomies). /feed What's New. Globe category density filters (All/Science/Law/Legislation/Medicine/Government/History).",
  },
  {
    date: "JUNE 4, 2026",
    text: "/physics taxonomy — 24 families, ~250 entries, KaTeX equations. OFAC SDN pipeline — 19,034 sanction entries with polity linking.",
  },
  {
    date: "JUNE 3, 2026",
    text: "/legislation expanded to 52 countries with 88 perpetual ingestion loops. 7 CourtListener loops running (SCOTUS, circuits, state supremes, judges, disclosures, BIA, Tax Court).",
  },
  {
    date: "JUNE 1, 2026",
    text: "OpenFEC campaign finance, World Bank UI with indicator chips and comparison charts, Academic Fields badges, CourtListener nightly crons.",
  },
];

// ─── Featured-claim styling ───────────────────────────────────────────────────

const AXIS_STYLE: Record<string, { label: string; dot: string; text: string }> = {
  SETTLED:   { label: "SETTLED",   dot: "bg-emerald-400", text: "text-emerald-300" },
  CONTESTED: { label: "CONTESTED", dot: "bg-amber-400",   text: "text-amber-300" },
  RECORDED:  { label: "RECORDED",  dot: "bg-blue-400",    text: "text-blue-300" },
};

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
    { label: "Claims indexed",      value: stats.claims },
    { label: "Primary sources",     value: stats.sources },
    { label: "Congressional votes", value: stats.legislativeVotes },
    { label: "Retracted papers",    value: stats.retractedPapers },
    { label: "Democracy indicators", value: stats.vdemIndicators },
  ];
  return (
    <section className="w-full bg-gray-900/80 border-y border-gray-800">
      <div className="flex flex-col sm:flex-row max-w-6xl mx-auto">
        {cells.map((c, i) => (
          <div
            key={c.label}
            className={`flex-1 px-6 py-6 text-center ${
              i < cells.length - 1 ? "sm:border-r border-b sm:border-b-0 border-gray-800" : ""
            }`}
          >
            <div className="text-3xl sm:text-4xl font-bold text-amber-400 tabular-nums">
              {c.value.toLocaleString()}
            </div>
            <div className="mt-1 text-xs uppercase tracking-widest text-gray-500">
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
          26 taxonomies — click any to browse claims
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

function FeaturedClaimCard({ axis, claim }: { axis: keyof typeof AXIS_STYLE; claim: FeaturedClaim }) {
  const style = AXIS_STYLE[axis];
  if (!claim) {
    return (
      <div className="rounded-xl bg-gray-900/80 border border-gray-800 px-5 py-5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          <span className={`text-xs font-mono uppercase tracking-widest ${style.text}`}>
            {style.label}
          </span>
        </div>
        <p className="mt-3 text-sm text-gray-500 italic">No claim available.</p>
      </div>
    );
  }
  return (
    <Link
      href={`/claims/${claim.id}`}
      className="block rounded-xl bg-gray-900/80 border border-gray-800 hover:border-gray-600 px-5 py-5 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
        <span className={`text-xs font-mono uppercase tracking-widest ${style.text}`}>
          {style.label}
        </span>
      </div>
      <p className="mt-3 text-sm text-gray-200 leading-relaxed group-hover:text-white transition-colors">
        {truncate(claim.text, 180)}
      </p>
      {(claim.sourceName || claim.sourceYear) && (
        <p className="mt-3 text-xs text-gray-500 truncate">
          {claim.sourceName ?? "Unknown source"}
          {claim.sourceYear ? ` · ${claim.sourceYear}` : ""}
        </p>
      )}
    </Link>
  );
}

function FeaturedClaims({ featured }: { featured: HomepageSectionsProps["featured"] }) {
  return (
    <section className="max-w-6xl mx-auto px-6 pb-16">
      <header className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-semibold text-white">Featured Claims</h2>
        <p className="mt-1 text-sm text-gray-500">
          Recently updated · click to see full epistemic receipt
        </p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeaturedClaimCard axis="SETTLED"   claim={featured.settled} />
        <FeaturedClaimCard axis="CONTESTED" claim={featured.contested} />
        <FeaturedClaimCard axis="RECORDED"  claim={featured.recorded} />
      </div>
    </section>
  );
}

const DOMAIN_DOT: Record<string, string> = {
  "academic-literature":  "bg-indigo-500",
  "archives":             "bg-violet-500",
  "astronomy":            "bg-teal-500",
  "chemistry":            "bg-pink-500",
  "clinical-trials":      "bg-sky-500",
  "culture":              "bg-fuchsia-500",
  "defense":              "bg-slate-500",
  "diplomacy":            "bg-blue-500",
  "economics":            "bg-yellow-500",
  "environment":          "bg-emerald-500",
  "genetics":             "bg-lime-500",
  "geology":              "bg-orange-500",
  "government":           "bg-blue-500",
  "history":              "bg-orange-500",
  "institutional":        "bg-cyan-500",
  "intelligence":         "bg-red-500",
  "international":        "bg-blue-500",
  "labor":                "bg-yellow-500",
  "law":                  "bg-amber-500",
  "legislation":          "bg-blue-500",
  "medicine":             "bg-sky-500",
  "physics":              "bg-cyan-500",
  "politics":             "bg-red-500",
  "psychology":           "bg-purple-500",
  "public-health":        "bg-green-500",
  "public_health":        "bg-green-500",
  "research-funding":     "bg-indigo-500",
  "science":              "bg-teal-500",
  "scientific-integrity": "bg-rose-500",
  "technology":           "bg-blue-500",
};

function TaxonomyIndex({ topics }: { topics: TopicChipData[] }) {
  const totalTopics = topics.length;
  return (
    <section className="max-w-6xl mx-auto px-6 pb-16">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white">Browse by Topic</h2>
          <p className="mt-1 text-sm text-gray-500">
            Top {totalTopics} topics by claim count — click any to browse
          </p>
        </div>
        <Link href="/topics" className="text-sm text-amber-400 hover:text-amber-300 transition-colors shrink-0">
          All topics →
        </Link>
      </header>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => {
          const dot = DOMAIN_DOT[topic.domain] ?? "bg-gray-500";
          return (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800/80 transition-colors group"
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">
                {topic.name}
              </span>
              <span className="text-xs text-gray-600 tabular-nums">
                {topic.claimCount.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ChangelogSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 pb-20">
      <header className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-semibold text-white">Recent Updates</h2>
      </header>
      <div className="divide-y divide-gray-800 border-y border-gray-800">
        {CHANGELOG.map((entry, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2 sm:gap-6 py-4">
            <div className="text-xs font-mono text-gray-500 uppercase tracking-widest sm:pt-0.5">
              {entry.date}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{entry.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Link
          href="/feed"
          className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          See the full feed →
        </Link>
      </div>
    </section>
  );
}

// ─── Top-level export ─────────────────────────────────────────────────────────

export default function HomepageSections({ stats, ingestedByCounts, featured, topTopics }: HomepageSectionsProps) {
  return (
    <>
      <StatsBar stats={stats} />
      <DomainGrid ingestedByCounts={ingestedByCounts} />
      <FeaturedClaims featured={featured} />
      <TaxonomyIndex topics={topTopics} />
      <ChangelogSection />
    </>
  );
}
