"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatAge, formatEmerged, type EmergedPrecision } from "@/lib/claimAge";
import BlackHoleCanvas from "@/app/components/BlackHoleCanvas";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChildClaim = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  parentClaimId: string | null;
  createdAt: string;
  claimEmergedAt: string | null;
  claimEmergedPrecision: EmergedPrecision | null;
  verificationStatus: string | null;
  _count: { edges: number };
};

type TopicTag = {
  topic: { id: string; name: string; slug: string; domain: string };
};

type TopClaim = ChildClaim & {
  ingestedBy: string;
  children: ChildClaim[];
  edges: { source: { name: string; url: string | null } }[];
  thresholdEvents: { note: string | null }[];
  topics: TopicTag[];
};

type SectionData = {
  total: number;
  claims: TopClaim[];
  page: number;
  pages: number;
};

type HomepageResponse = {
  sections: Record<string, SectionData>;
  meta: {
    ingestedBySources: string[];
    topics: { slug: string; name: string; domain: string }[];
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TYPES    = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"] as const;
const ALL_STATUSES = ["DISPUTED", "HARD_FACT", "NEVER_RESOLVES"] as const;
const PAGE_SIZE    = 10;

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT:      "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED:       "bg-yellow-900 text-yellow-300",
};

const SORT_OPTIONS = [
  { value: "recent",         label: "Most recently updated" },
  { value: "oldest_emerged", label: "Oldest emergence date" },
  { value: "newest_emerged", label: "Newest emergence date" },
  { value: "most_sources",   label: "Most sources" },
  { value: "most_edges",     label: "Most edges" },
] as const;

// ─── Claim card (unchanged visual logic) ─────────────────────────────────────

const VS_STYLE: Record<string, string> = {
  VERIFIED:    "bg-blue-950 text-blue-400 border border-blue-800/50",
  PROVISIONAL: "bg-gray-800/60 text-gray-500 border border-gray-700/50",
  DISPUTED:    "bg-red-950 text-red-400 border border-red-800/50",
  DEPRECATED:  "bg-gray-900 text-gray-600 border border-gray-800",
};

function ClaimMeta({ claim, small }: { claim: ChildClaim; small?: boolean }) {
  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[claim.currentStatus] ?? STATUS_STYLE.DISPUTED}`}>
        {claim.currentStatus}
      </span>
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
        {claim.claimType}
      </span>
      {claim.verificationStatus && (
        <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${VS_STYLE[claim.verificationStatus] ?? "bg-gray-800 text-gray-600"}`}>
          {claim.verificationStatus}
        </span>
      )}
      <span className={`text-gray-500 ${small ? "text-xs" : "text-xs"}`}>
        {claim._count.edges} {claim._count.edges === 1 ? "source" : "sources"}
      </span>
      {claim.claimEmergedAt && claim.claimEmergedPrecision ? (
        <span className={`text-gray-500 ${small ? "text-xs" : "text-xs"}`}>
          {formatAge(claim.claimEmergedAt, claim.claimEmergedPrecision)} · emerged {formatEmerged(claim.claimEmergedAt, claim.claimEmergedPrecision)}
        </span>
      ) : (
        <span className={`text-gray-500 ${small ? "text-xs" : "text-xs"}`}>
          added {new Date(claim.createdAt).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

function TopicChips({ topics }: { topics: TopicTag[] }) {
  const [expanded, setExpanded] = useState(false);
  if (topics.length === 0) return null;
  const visible = expanded ? topics : topics.slice(0, 3);
  const overflow = topics.length - 3;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {visible.map(ct => (
        <Link
          key={ct.topic.id}
          href={`/topics/${ct.topic.slug}`}
          className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          {ct.topic.name}
        </Link>
      ))}
      {!expanded && overflow > 0 && (
        <button
          className="text-xs px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-500 hover:text-gray-400 transition-colors"
          onClick={e => { e.preventDefault(); e.stopPropagation(); setExpanded(true); }}
        >
          +{overflow} more
        </button>
      )}
    </div>
  );
}

function ClaimCard({ claim, searchQuery }: { claim: TopClaim; searchQuery: string }) {
  const router = useRouter();
  const q = searchQuery.toLowerCase();
  const isDeprecated = claim.verificationStatus === "DEPRECATED";
  return (
    <div>
      <div
        onClick={() => router.push(`/claims/${claim.id}`)}
        className={`block rounded-lg border px-4 py-3 transition-colors group cursor-pointer ${
          isDeprecated
            ? "border-gray-800/50 bg-gray-950 hover:border-gray-700 opacity-60"
            : "border-gray-800 bg-gray-900 hover:border-gray-600"
        }`}
      >
        {isDeprecated && (
          <p className="text-xs text-gray-500 font-mono mb-1.5">
            Pipeline retired — preserved for audit purposes, do not cite as authoritative
          </p>
        )}
        <p className={`text-sm leading-relaxed line-clamp-2 transition-colors ${isDeprecated ? "text-gray-500 group-hover:text-gray-400" : "text-gray-200 group-hover:text-white"}`}>
          {claim.text}
        </p>
        <ClaimMeta claim={claim} />
        <TopicChips topics={claim.topics} />
      </div>

      {claim.children.length > 0 && (
        <div className="ml-7 mt-1 border-l border-gray-800 pl-3 space-y-1">
          {claim.children.map(child => {
            const isMatch = q !== "" && child.text.toLowerCase().includes(q);
            return (
              <Link
                key={child.id}
                href={`/timeline#${child.id}`}
                className={`block rounded-md border px-3 py-2 transition-colors group ${
                  isMatch
                    ? "border-blue-800/60 bg-blue-950 hover:border-blue-700"
                    : "border-gray-800/60 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <p className="text-[13px] text-gray-400 group-hover:text-gray-200 transition-colors leading-relaxed line-clamp-2">
                  {child.text}
                </p>
                <ClaimMeta claim={child} small />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Filter bar components ────────────────────────────────────────────────────

function MultiSelect({
  label, options, selected, onChange, searchable,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const isAll = selected.length === options.length;
  const isNone = selected.length === 0;
  const displayLabel = isNone
    ? label
    : selected.length === 1 ? (options.find(o => o.value === selected[0])?.label ?? label)
    : `${label}: ${selected.length}`;

  const filtered = searchable && search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap ${
          isNone
            ? "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
            : "border-blue-700 text-blue-300 bg-blue-950/30 hover:border-blue-600"
        }`}
      >
        {displayLabel}
        <span className="text-gray-500 text-[10px]">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg py-1 z-30 min-w-[170px] max-h-64 overflow-y-auto shadow-2xl">
          {searchable && (
            <div className="px-2 py-1.5 border-b border-gray-800">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-gray-500"
              />
            </div>
          )}
          {!searchable && (
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 hover:text-white hover:bg-gray-800 cursor-pointer select-none border-b border-gray-800/60">
              <input
                type="checkbox"
                checked={isAll}
                onChange={e => onChange(e.target.checked ? options.map(o => o.value) : [])}
                className="accent-blue-500 shrink-0"
              />
              All
            </label>
          )}
          {filtered.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-800 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={e => {
                  if (e.target.checked) onChange([...selected, opt.value]);
                  else onChange(selected.filter(v => v !== opt.value));
                }}
                className="accent-blue-500 shrink-0"
              />
              {opt.label}
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-600 px-3 py-2">No matches</p>
          )}
        </div>
      )}
    </div>
  );
}

function SingleSelect({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="shrink-0 text-xs px-2 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-300 focus:outline-none transition-colors"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function ClaimSection({
  type, section, isCollapsed, onToggle, searchQuery, isSearch, onPageChange,
}: {
  type: string;
  section: SectionData;
  isCollapsed: boolean;
  onToggle: () => void;
  searchQuery: string;
  isSearch: boolean;
  onPageChange: (page: number) => void;
}) {
  const label = type.charAt(0) + type.slice(1).toLowerCase();

  return (
    <section>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full text-left mb-3 group"
      >
        <span className="text-gray-500 text-[10px] group-hover:text-gray-400 transition-colors mt-px">
          {isCollapsed ? "▸" : "▾"}
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">
          {label} claims
        </h2>
        <span className="text-gray-500 text-xs font-normal normal-case tracking-normal ml-0.5">
          ({section.total})
        </span>
      </button>

      {!isCollapsed && (
        <>
          {section.total === 0 ? (
            <p className="text-sm text-gray-500 italic">No {label.toLowerCase()} claims match.</p>
          ) : (
            <div className="space-y-3">
              {section.claims.map(c => (
                <ClaimCard key={c.id} claim={c} searchQuery={searchQuery} />
              ))}
            </div>
          )}

          {!isSearch && section.pages > 1 && (
            <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
              <button
                onClick={() => onPageChange(section.page - 1)}
                disabled={section.page <= 1}
                className="hover:text-gray-300 disabled:opacity-30 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-gray-700">·</span>
              <span>Page {section.page} of {section.pages}</span>
              <span className="text-gray-700">·</span>
              <button
                onClick={() => onPageChange(section.page + 1)}
                disabled={section.page >= section.pages}
                className="hover:text-gray-300 disabled:opacity-30 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function HomeContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Server-driven data — re-fetched whenever URL params change
  const [data, setData]       = useState<HomepageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Parse current URL filter state
  const urlQ              = searchParams.get("q") || "";
  const urlTypes          = searchParams.get("types")?.split(",").filter(Boolean) ?? [...ALL_TYPES];
  const urlStatuses       = searchParams.get("statuses")?.split(",").filter(Boolean) ?? [...ALL_STATUSES];
  const urlVerification   = searchParams.get("verification") || "all";
  const urlShowDeprecated = searchParams.get("deprecated") === "1";
  const urlSource         = searchParams.get("source") || "all";
  const urlSort           = searchParams.get("sort") || "recent";
  const urlTopics         = searchParams.get("topics")?.split(",").filter(Boolean) ?? [];

  // Re-fetch from server whenever URL params change
  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams(searchParams.toString());
    fetch(`/api/claims/homepage?${p.toString()}`)
      .then(r => r.json())
      .then((d: HomepageResponse) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [searchParams]);

  // Local search input, debounced into URL
  const [searchInput, setSearchInput] = useState(urlQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setSearchInput(urlQ); }, [urlQ]);

  // Per-section collapse (local only)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const sections       = data?.sections ?? {} as Record<string, SectionData>;
  const isSearch       = urlQ.trim().length > 0;

  const ingestedBySources = data?.meta.ingestedBySources ?? [];
  const allTopicOptions   = data?.meta.topics ?? [];

  // Auto-collapse sections with > PAGE_SIZE results on first data load
  useEffect(() => {
    if (!data) return;
    const next: Record<string, boolean> = {};
    for (const type of ALL_TYPES) {
      next[type] = (data.sections[type]?.total ?? 0) > PAGE_SIZE;
    }
    setCollapsed(next);
  }, [data]);

  // ── URL helpers ──

  const buildParams = useCallback((
    overrides: Record<string, string | string[] | null> = {},
    resetPages = false,
  ): URLSearchParams => {
    const p = new URLSearchParams(searchParams.toString());

    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
        p.delete(k);
      } else if (Array.isArray(v)) {
        p.set(k, v.join(","));
      } else {
        p.set(k, v);
      }
    }

    if (resetPages) {
      for (const t of ALL_TYPES) p.delete(`${t.toLowerCase()}_page`);
    }

    // Strip defaults
    if (p.get("verification") === "all") p.delete("verification");
    if (p.get("deprecated") !== "1")     p.delete("deprecated");
    if (p.get("source") === "all")       p.delete("source");
    if (p.get("sort") === "recent")     p.delete("sort");
    if ((p.get("q") ?? "") === "")      p.delete("q");

    const selTypes = p.get("types")?.split(",").filter(Boolean) ?? [];
    if (selTypes.length === 0 || selTypes.length >= ALL_TYPES.length) p.delete("types");

    const selStatuses = p.get("statuses")?.split(",").filter(Boolean) ?? [];
    if (selStatuses.length === 0 || selStatuses.length >= ALL_STATUSES.length) p.delete("statuses");

    const selTopics = p.get("topics")?.split(",").filter(Boolean) ?? [];
    if (selTopics.length === 0) p.delete("topics");

    return p;
  }, [searchParams]);

  const updateFilter = useCallback((overrides: Record<string, string | string[] | null>) => {
    router.push(`/?${buildParams(overrides, true).toString()}`);
  }, [router, buildParams]);

  const setPage = useCallback((type: string, page: number) => {
    const p   = buildParams({});
    const key = `${type.toLowerCase()}_page`;
    if (page > 1) p.set(key, String(page));
    else p.delete(key);
    router.push(`/?${p.toString()}`);
  }, [router, buildParams]);

  function handleSearch(v: string) {
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateFilter({ q: v.trim() || null });
    }, 250);
  }

  // ── Derived display ──

  const isFiltered =
    urlQ !== "" ||
    urlTypes.length    !== ALL_TYPES.length ||
    urlStatuses.length !== ALL_STATUSES.length ||
    urlVerification !== "all" ||
    urlShowDeprecated ||
    urlSource !== "all" ||
    urlTopics.length > 0;

  const totalVisible = ALL_TYPES.reduce((s, t) => s + (sections[t]?.total ?? 0), 0);

  // ── Render ──

  return (
    <div className="space-y-12">
      {/* Top loading bar */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 h-0.5 transition-opacity duration-500 ${loading ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
      >
        <div
          className="h-full bg-blue-500"
          style={{
            animation: loading ? "loading-bar 2s ease-in-out infinite" : undefined,
          }}
        />
      </div>

      <BlackHoleCanvas />

      {/* Mission statement — unchanged */}
      <div className="flex flex-col space-y-5 border-b border-gray-800 pb-10">
        <div>
          <h1 className="text-2xl font-semibold text-white">Epistemic Receipts</h1>
          <p className="mt-3 text-gray-300 leading-relaxed">
            A claim-provenance tool for tracking how consensus gets made — and unmade. Not a fact-checker.
            Not a verdict machine. The receipts are the product; auditability is the principle.
          </p>
          <p className="mt-3 text-xs text-gray-500 font-mono tracking-wide">
            invented May 2, 2026
          </p>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 26, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">Performance fix</span> — at ~840k claims the site stopped loading. Added 35 database indexes (`Claim.ingestedBy/claimType/currentStatus/verificationStatus/createdAt/claimEmergedAt/parentClaimId`, `Edge.sourceId/claimId`, `Source.ingestedBy`, plus composites) built with <span className="font-mono">CREATE INDEX CONCURRENTLY</span> so live ingest writes didn&apos;t deadlock. Hot-path WHERE/ORDER BY queries that were sequential-scanning all rows are now index lookups.</li>
            <li><span className="text-gray-400">API hardening</span> — `/api/edges`, `/api/sources`, `/api/timeline`, `/api/threshold-events`, `/api/meta-edges` were unbounded <span className="font-mono">findMany</span> calls returning every row with deep joins; now require pagination (limit + offset) and a filter parameter (`claimId` / `sourceId`) where applicable. Homepage&apos;s `distinct: ingestedBy` query switched to `groupBy` to use the new composite index.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 25, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">/globe</span> upgrades — country search bar (top-left floating panel) lets you jump straight to any country without spinning the globe; sidebar gains a per-country &ldquo;Filter claims…&rdquo; input with match counts; clicked-country claim totals now match the density map (previously the sidebar only counted PoliticalContext-linked claims and under-reported US/UK/DE by tens of thousands — pipeline-ingested claims are now included via shared <span className="font-mono">lib/globe-pipeline-country.ts</span>).</li>
            <li><span className="text-gray-400">/fields</span> launched — Academic Fields browser organized by Wikipedia&apos;s Outline of Academic Disciplines (2,569 fields across 5 top-level sections); drill into any field to see subfields, linked topics, and tagged claims. <span className="font-mono">Topic.academicFieldId</span> FK added; run <span className="font-mono">scripts/tag-topics-academic-field.ts</span> to link existing topics to their fields.</li>
            <li><span className="text-gray-400">+300</span> SCOTUS opinions — U.S. Supreme Court rulings by citation count (Marbury v. Madison onward), ingested as INSTITUTIONAL claims from CourtListener&apos;s public API (Pipeline 4 — <span className="font-mono">courtlistener_scotus_v1</span>)</li>
            <li><span className="text-gray-400">+4,475</span> clinical trial results — completed Phase 3/4 studies from ClinicalTrials.gov v2 API; primary endpoints and Phase 2 case studies as EMPIRICAL claims (Pipeline 7 — <span className="font-mono">clinicaltrials_v1</span>)</li>
            <li><span className="text-gray-400">+10,000+</span> academic papers — highly-cited works in cognitive science, psychology, biomedicine, and policy from OpenAlex; abstract-derived claims with PROVISIONAL verification status (Pipeline 16 — <span className="font-mono">openalex_v1</span>)</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 23, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">+85,068</span> FDA drug labels — Structured Product Labeling records from openFDA spanning 1970–present (brand + generic + indication snippet), partitioned by effective_time to bypass openFDA&apos;s 25k pagination cap (Pipeline 8 — <span className="font-mono">openfda_labels_v1</span>)</li>
            <li><span className="text-gray-400">/search</span> launched — cross-cutting full-text search across every claim and source, with filter pills for claims-only / sources-only / all, paginated 25-at-a-time, linked from the nav</li>
            <li><span className="text-gray-400">/topics/[slug]</span> pages extended — every topic now shows a per-year timeline of claim activity, a vote-pattern summary (recorded votes, % contested vs. unanimous, mean aye/nay percentages), and a YES/NO/ABSTAIN-per-party tally aggregated from <span className="font-mono">LegislativeVote.byPartyJson</span> on linked sources</li>
            <li><span className="text-gray-400">/analysis/votes</span> page launched — cross-body contested vs. unanimous breakdown across UK, EU Parliament, Canada, and US Congress (2,900+ recorded LegislativeVotes), with per-body tables and party-level aggregates</li>
            <li><span className="text-gray-400">Roll call vote claim pages</span> now show member-by-member breakdowns — API falls back to the matching bill source&apos;s `LegislativeVote` when the vote claim&apos;s own source has none directly attached</li>
            <li><span className="text-gray-400">Bill claim pages</span> no longer time out on Vercel Hobby — member votes (400+ per chamber) lazy-load via a new `/api/legislative-votes/[id]/members` endpoint when the user expands the vote-record section, instead of being fetched up front</li>
            <li><span className="text-gray-400">Parliamentary-majority enrichment (Tier 2)</span> shipped — full run completed across 49 countries, <span className="font-mono">governingParty</span> populated on 112,843 of 219,965 PoliticalContext rows (107,122 stayed NULL because Tier 1 had no <span className="font-mono">hogParty</span> to fall back to); <span className="font-mono">majorityType / coalitionPartners</span> stayed NULL throughout because Wikidata cabinet items rarely carry <span className="font-mono">P102 / P1830</span> party links — script wrote NULL rather than guessing</li>
            <li><span className="text-gray-400">+459</span> NATO official texts — summit communiqués, strategic concepts, and declarations 1941–2025 from nato.int/cps via Wayback CDX enumeration (Pipeline 17)</li>
            <li><span className="text-gray-400">+3,868</span> Austria Nationalrat enacted laws — Beschlüsse des Nationalrates (DOKTYP=BNR) from Parlament.gv.at (Pipeline 22)</li>
            <li><span className="text-gray-400">+528</span> Jamaica Acts of Parliament 2000–2023 — from the Ministry of Justice Laws of Jamaica catalogue (Pipeline 79)</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 19, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">Pipeline 17</span> (NATO Official Texts) ingester built — 481 documents enumerated from the Wayback CDX index of nato.int/cps/en/natohq/official_texts_, dry-run validated end-to-end (titles + document dates parsed correctly across 1941–2025), awaiting approval before full ingest</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 18, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">+4,696</span> USGS M6.5+ earthquakes (1900–present) — epicenter, magnitude, depth, tsunami flag (Pipeline 12)</li>
            <li><span className="text-gray-400">+1,915</span> Federal Register significant final rules — EPA, FDA, OSHA, CMS, DEA, FTC, FCC since 1994 (Pipeline 14)</li>
            <li><span className="text-gray-400">+1,026</span> Nobel Prize laureates (1901–2024) — all six categories, Nobel Foundation API v2.1 (Pipeline 10)</li>
            <li><span className="text-gray-400">+379</span> SEC EDGAR filings — Enron, WorldCom, Lehman, Boeing 737 MAX, GE Power (Pipeline 9)</li>
            <li><span className="text-gray-400">+205</span> U.S. Congress enacted bills — full text, sponsor, committees, vote record (Pipeline 1)</li>
            <li><span className="text-gray-400">662</span> stale Nobel records deprecated — prior script version with incompatible externalId scheme, superseded by Pipeline 10 re-ingestion, retained for audit trail</li>
            <li><span className="text-gray-400">/pipelines</span> status page launched — live pipeline counts and audit state</li>
            <li><span className="text-gray-400">Homepage</span> rebuilt with server-side filtering and pagination for 47k-claim scale</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 13, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">+995</span> FAERS drug-level adverse event counts — openFDA generic_name normalization, 1,000-drug cap, tagged adverse-events (Pipeline 8)</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 12, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">+2,798</span> UN Security Council resolutions (1946–2025) — every adopted resolution, vote record, and subject classification from the CR-UNSC v2025 dataset</li>
            <li><span className="text-gray-400">Verification status</span> system added — claims now carry VERIFIED, PROVISIONAL, or DEPRECATED badges reflecting pipeline audit state</li>
            <li><span className="text-gray-400">Pipeline 5</span> (USPTO patents) retired — fabricated records confirmed on audit; 182 claims flagged DEPRECATED and preserved for audit trail</li>
          </ul>
        </div>

        <div className="space-y-2 text-sm text-gray-500 leading-relaxed">
          <p>
            <span className="text-gray-400 font-medium">What it tracks:</span>{" "}
            claims, the sources arguing for or against them, and how the evidence shifts over time
          </p>
          <p>
            <span className="text-gray-400 font-medium">What it doesn&apos;t do:</span>{" "}
            declare truth on contested questions, defer to institutional authority, or pretend interpretive disputes have empirical answers
          </p>
          <p>
            <span className="text-gray-400 font-medium">What you&apos;ll find here:</span>{" "}
            empirical claims that resolved cleanly, claims still hovering after years, and interpretive disputes that won&apos;t ever resolve — each with full receipts of who said what, when, and why
          </p>
        </div>
      </div>

      {/* Filter bar — sticky, wraps on narrow viewports */}
      <div className="sticky top-0 z-10 bg-gray-950 -mx-6 px-6 py-3 border-b border-gray-800/50">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search — full-width on mobile, flex-1 on wider */}
          <input
            type="text"
            value={searchInput}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search claims and sources…"
            className="w-full sm:flex-1 sm:min-w-[180px] bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-3 py-1.5 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
          />

          <MultiSelect
            label="Type"
            options={ALL_TYPES.map(t => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }))}
            selected={urlTypes}
            onChange={v => updateFilter({ types: v.length === ALL_TYPES.length ? null : v })}
          />

          <MultiSelect
            label="Status"
            options={[
              { value: "DISPUTED",       label: "Disputed" },
              { value: "HARD_FACT",      label: "Hard Fact" },
              { value: "NEVER_RESOLVES", label: "Never Resolves" },
            ]}
            selected={urlStatuses}
            onChange={v => updateFilter({ statuses: v.length === ALL_STATUSES.length ? null : v })}
          />

          <SingleSelect
            value={urlVerification}
            options={[
              { value: "all",         label: "All verification" },
              { value: "verified",    label: "Verified only" },
              { value: "provisional", label: "Provisional only" },
            ]}
            onChange={v => updateFilter({ verification: v })}
          />

          <button
            onClick={() => updateFilter({ deprecated: urlShowDeprecated ? null : "1" })}
            className={`text-xs px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap ${
              urlShowDeprecated
                ? "border-gray-600 text-gray-400 bg-gray-800/40"
                : "border-gray-800 text-gray-600 hover:border-gray-700 hover:text-gray-400"
            }`}
          >
            {urlShowDeprecated ? "Hide deprecated" : "Show deprecated"}
          </button>

          <SingleSelect
            value={urlSource}
            options={[
              { value: "all", label: "All sources" },
              ...ingestedBySources.map(s => ({
                value: s,
                label: s === "openfda_v1" ? "openFDA v1" : s,
              })),
            ]}
            onChange={v => updateFilter({ source: v })}
          />

          {allTopicOptions.length > 0 && (
            <MultiSelect
              label="Topic"
              options={allTopicOptions.map(t => ({
                value: t.slug,
                label: `${t.domain === "public_health" ? "Public Health" : t.domain.charAt(0).toUpperCase() + t.domain.slice(1)}: ${t.name}`,
              }))}
              selected={urlTopics}
              onChange={v => updateFilter({ topics: v.length > 0 ? v : null })}
              searchable
            />
          )}

          {isFiltered && (
            <button
              onClick={() => { setSearchInput(""); router.push("/"); }}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors hover:underline underline-offset-2 shrink-0"
            >
              Clear filters
            </button>
          )}

          {/* Sort — pushed to right */}
          <div className="ml-auto shrink-0">
            <SingleSelect
              value={urlSort}
              options={SORT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              onChange={v => updateFilter({ sort: v })}
            />
          </div>
        </div>
      </div>

      {/* Sections */}
      {loading ? (
        <p className="text-gray-600 text-sm">Loading…</p>
      ) : (
        <div className="space-y-10">
          {ALL_TYPES.map(type => {
            const section = sections[type] ?? { total: 0, claims: [], page: 1, pages: 1 };
            // During search, hide sections with no matches (they're noise; for other filters, keep them to show (0))
            if (isSearch && section.total === 0) return null;
            return <ClaimSection
              key={type}
              type={type}
              section={section}
              isCollapsed={!!collapsed[type]}
              onToggle={() => setCollapsed(c => ({ ...c, [type]: !c[type] }))}
              searchQuery={urlQ}
              isSearch={isSearch}
              onPageChange={page => setPage(type, page)}
            />
          })}
        </div>
      )}

      {totalVisible > 0 && (
        <p className="text-xs text-gray-500 text-center pb-4">
          {totalVisible} {totalVisible === 1 ? "claim" : "claims"} · audit index · not a feed
        </p>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <HomeContent />
    </Suspense>
  );
}
