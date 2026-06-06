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

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 animate-pulse">
      <div className="h-3 bg-gray-800 rounded w-11/12 mb-2" />
      <div className="h-3 bg-gray-800 rounded w-3/4 mb-3" />
      <div className="flex gap-2">
        <div className="h-4 w-16 bg-gray-800 rounded-full" />
        <div className="h-4 w-20 bg-gray-800 rounded-full" />
        <div className="h-4 w-12 bg-gray-800 rounded" />
      </div>
    </div>
  );
}

function SkeletonSection({ type }: { type: string }) {
  const label = type.charAt(0) + type.slice(1).toLowerCase();
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-gray-700 text-[10px] mt-px">▾</span>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-700">
          {label} claims
        </h2>
        <span className="h-3 w-8 bg-gray-800 rounded animate-pulse ml-0.5" />
      </div>
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
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

          {!isSearch && (section.pages === -1 ? (
            // No count available on page 1 — show Load more if we got a full page
            section.claims.length >= 10 && (
              <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                <button onClick={() => onPageChange(2)} className="hover:text-gray-300 transition-colors">
                  Load more →
                </button>
              </div>
            )
          ) : section.pages > 1 && (
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
          ))}
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
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    setFetchError(null);
    const p = new URLSearchParams(searchParams.toString());
    fetch(`/api/claims/homepage?${p.toString()}`)
      .then(r => {
        if (!r.ok) {
          setFetchError(`API error ${r.status} — ${r.url}`);
          setLoading(false);
          return;
        }
        r.json().then((d: HomepageResponse) => { setData(d); setLoading(false); });
      })
      .catch(err => { setFetchError(String(err)); setLoading(false); });
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
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">June 6, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">/statistics/explorer — claim-powered companion to the statistics taxonomy</span> — new sibling at <span className="font-mono">/statistics/explorer</span> that groups OpenAlex-sourced claims by detected statistical method instead of by curated method family. Each tile is one of 33 methods (regression, logistic regression, ANOVA, t-test, chi-square, Bayesian, mixed-effects, SEM, factor analysis, PCA, RCT, meta-analysis, machine learning, deep learning, neural network, survival analysis, confidence interval, p-value, odds/risk ratio, correlation, cross-validation, bootstrap, propensity score, instrumental variable, diff-in-diff, RDD, time-series, clustering, random forest/boosting, SVM, GEE/longitudinal, GWAS/multiple testing, effect size, power analysis) with a live claim count, and clicking through opens <span className="font-mono">/statistics/explorer/[slug]</span> — a paginated list of receipts whose title or abstract mentions that method&apos;s vocabulary, with chips linking to other methods detected in the same claim. Detection is regex over title + abstract — fast and conservative, not semantic. Tags are stored at <span className="font-mono">Claim.metadata.statMethods: string[]</span> (no schema change). Seeded with 5,000 OpenAlex claims (~13% tag rate so far — heavily AI/ML biased because that&apos;s where the first 5k by id-sort cluster); the rest of the ~212k OpenAlex catalog can be tagged via <span className="font-mono">scripts/enrich-stat-methods.ts --commit</span>. New files: <span className="font-mono">lib/statMethods.ts</span> (single source of truth for slugs/labels/regex patterns, shared by the enrichment script and the UI), <span className="font-mono">scripts/enrich-stat-methods.ts</span>, <span className="font-mono">app/statistics/explorer/page.tsx</span>, <span className="font-mono">app/statistics/explorer/[slug]/page.tsx</span>. The existing <span className="font-mono">/statistics</span> taxonomy and <span className="font-mono">/statistics/methods</span> textbook reference are untouched — the explorer layers on top.</li>
            <li><span className="text-gray-400">/fields hub page — index of every taxonomy at /fields</span> — the 26 hand-built field taxonomies (<span className="font-mono">/physics</span>, <span className="font-mono">/chemistry</span>, <span className="font-mono">/biology</span>, <span className="font-mono">/mathematics</span>, <span className="font-mono">/statistics</span>, <span className="font-mono">/logic</span>, <span className="font-mono">/computer-science</span>, <span className="font-mono">/astronomy</span>, <span className="font-mono">/geology</span>, <span className="font-mono">/earth-sciences</span>, <span className="font-mono">/neuroscience</span>, <span className="font-mono">/psychology</span>, <span className="font-mono">/sociology</span>, <span className="font-mono">/anthropology</span>, <span className="font-mono">/linguistics</span>, <span className="font-mono">/economics</span>, <span className="font-mono">/finance</span>, <span className="font-mono">/engineering</span>, <span className="font-mono">/medicine</span>, <span className="font-mono">/law</span>, <span className="font-mono">/tax-law</span>, <span className="font-mono">/ip-law</span>, <span className="font-mono">/governance</span>, <span className="font-mono">/philosophy</span>, <span className="font-mono">/history</span>, <span className="font-mono">/ideologies</span>) are now consolidated under a single hub at <span className="font-mono">/fields</span> grouped into five clusters — <strong>Formal Sciences</strong>, <strong>Natural Sciences</strong>, <strong>Social Sciences</strong>, <strong>Applied &amp; Professional</strong>, and <strong>Humanities</strong>. Each card shows the title, a one-line description, and the family count. Static server component; no DB hits. <span className="font-mono">app/layout.tsx</span> nav was correspondingly slimmed — the per-discipline link block (43 entries) collapsed to a single <span className="font-mono">Fields</span> entry, dropping nav length by roughly 60%.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">June 5, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">/history taxonomy page — 24 families, 288 entries</span> — new sibling of <span className="font-mono">/philosophy</span> / <span className="font-mono">/law</span> / <span className="font-mono">/governance</span> / <span className="font-mono">/ideologies</span> / <span className="font-mono">/economics</span> / <span className="font-mono">/sociology</span> at <span className="font-mono">/history</span>. Five sections (Ancient · Medieval · Early Modern · Modern &amp; Contemporary · Historiography &amp; Contested Questions) cover <strong>24 families · 288 entries</strong>. Each card carries a <span className="font-mono">keyFact</span> (plain prose — no LaTeX, since history is narrative), an optional <span className="font-mono">date</span> (single year, range, or century where appropriate — &ldquo;c. 9,500 BCE&rdquo;, &ldquo;1789 – 1799&rdquo;, &ldquo;13th – 14th c.&rdquo;), an optional <span className="font-mono">example</span>, tags, and <span className="font-mono">xref</span> chips linking to sibling pages (<span className="font-mono">historical-events</span>, <span className="font-mono">ideologies</span>, <span className="font-mono">philosophy</span>, <span className="font-mono">governance</span>, <span className="font-mono">law</span>, <span className="font-mono">economics</span>, <span className="font-mono">biology</span>, <span className="font-mono">astronomy</span>) instead of duplicating. Four status badges color-code epistemic posture: <strong>LANDMARK</strong> (green — Out of Africa, Code of Hammurabi, Aristotle, Pax Romana, Fall of Constantinople, Magna Carta, Newton&apos;s Principia, French Revolution, Darwin, Holocaust, UDHR, Civil Rights Act, Fall of Communism), <strong>REVISED</strong> (sky — feudalism as historiographical construct per Susan Reynolds, Peace of Westphalia per Krasner, witch-trials as early-modern not medieval, Great Zimbabwe&apos;s indigenous origin per Caton-Thompson, tulip mania per Goldgar, steppe nomadism), <strong>CONTESTED</strong> (amber — Late Bronze Age Collapse, Trojan War historicity, Maya Classic Collapse, fall of Rome, Mongol environmental impact, Tordesillas indemnities, 17th-century General Crisis, Cold War origins, Hiroshima necessity, Holocaust intentionalists vs. functionalists), and <strong>OPEN</strong> (red — Indus Valley script, Etruscan language, Greek Fire composition, Anthropocene start date, Great Divergence causes, Ukraine war, AI revolution, digital-history reproducibility). Coverage: prehistory through 2026; ~58 entries on Ancient, ~58 on Medieval, ~60 on Early Modern, ~84 on Modern/Contemporary, ~24 on historiography itself; non-Western coverage includes Mesoamerica, the Andes, Sub-Saharan Africa (Aksum, Mali, Ghana, Songhai, Great Zimbabwe, Swahili), the Mongol world, South and Southeast Asia (Khmer, Chola, Vijayanagara, Mughal, Delhi Sultanate), and China across Shang, Han, Tang, Song, Yuan, Ming, Qing. Data layer split <span className="font-mono">app/history/&#123;types,data,data2,data3,page&#125;.tsx</span>; counts (<span className="font-mono">24 families · 288 entries</span>) are computed from the data, not hardcoded. Nav link added in <span className="font-mono">app/layout.tsx</span> between Philosophy and About. Footer updated to &ldquo;last updated June 5, 2026 — history taxonomy added&rdquo;.</li>
            <li><span className="text-gray-400">/sociology taxonomy page — 22 families, 265 entries</span> — new sibling of <span className="font-mono">/psychology</span> / <span className="font-mono">/economics</span> / <span className="font-mono">/philosophy</span> / <span className="font-mono">/medicine</span> / <span className="font-mono">/law</span> / <span className="font-mono">/governance</span> / <span className="font-mono">/ideologies</span> at <span className="font-mono">/sociology</span>. Five sections (Foundations &amp; Theory · Social Structure · Culture &amp; Identity · Methods &amp; Quantitative Sociology · Contested &amp; Open Questions) cover <strong>22 families · 265 concept entries</strong>. Each card carries a <span className="font-mono">keyFact</span> (KaTeX-typeset where useful), an optional <span className="font-mono">formula</span> rendered as a standalone KaTeX expression (Pareto power law, Oaxaca-Blinder decomposition, AMCE, IGE, intergenerational elasticity, betweenness centrality, propensity score, RDD, IV, DiD, fixed-effects panel, multilevel HLM, quantile regression, IRT, OADR, TFR), the original <span className="font-mono">theorist</span>, an optional <span className="font-mono">example</span>, tags, and <span className="font-mono">xref</span> chips linking to sibling pages (<span className="font-mono">psychology</span>, <span className="font-mono">economics</span>, <span className="font-mono">philosophy</span>, <span className="font-mono">statistics</span>, <span className="font-mono">ideologies</span>, <span className="font-mono">governance</span>, <span className="font-mono">linguistics</span>) instead of duplicating. Four status badges color-code epistemic posture: <strong>LANDMARK</strong> (green — Durkheim social facts, Weber Verstehen, Granovetter weak ties, Schelling segregation, Coleman Report, Massey-Denton American Apartheid, Bourdieu cultural capital, Chetty falling absolute mobility, Goldin gender pay-gap), <strong>REFUTED</strong> (rose — Hawthorne effect, Stanford Prison Experiment, broken windows policing), <strong>CONTESTED</strong> (amber — Davis-Moore functionalism, Putnam <em>Bowling Alone</em> social-capital decline, Piketty&apos;s $r &gt; g$, religious-economy supply-side theory, Hofstede cultural dimensions, omnivorousness, Bonilla-Silva color-blind racism), and <strong>OPEN</strong> (red — social media and adolescent mental health, sociology of AI, platform power, climate sociology, algorithmic bias trade-offs, structure-vs-agency, micro-macro foundations, open science in sociology). Frontier topics flagged: post-2010 polarization, COVID mortality disparities, remote work share (~28% by 2023 per Barrero-Bloom-Davis), demographic decline (South Korea TFR 0.72 in 2023; sub-replacement now ~2/3 of world population). Data layer split <span className="font-mono">app/sociology/&#123;types,data,data2,data3,page&#125;.tsx</span>; counts (<span className="font-mono">22 families · 265 entries</span>) are computed from the data, not hardcoded. Nav link added in <span className="font-mono">app/layout.tsx</span> between Psychology and Medicine. Footer updated to &ldquo;last updated June 5, 2026 — sociology taxonomy added&rdquo;.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">June 4, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">/computer-science taxonomy page — 22 families, 241 entries, per-family prerequisite DAG</span> — new sibling of <span className="font-mono">/mathematics</span> / <span className="font-mono">/chemistry</span> / <span className="font-mono">/physics</span> / <span className="font-mono">/statistics</span> / <span className="font-mono">/medicine</span> / <span className="font-mono">/law</span> / <span className="font-mono">/governance</span> / <span className="font-mono">/ideologies</span> / <span className="font-mono">/finance</span> at <span className="font-mono">/computer-science</span>. Five sections (Theoretical CS &amp; Foundations · Algorithms &amp; Data Structures · Systems &amp; Architecture · Programming Languages/Software/Interfaces · AI/ML/Open Problems) cover <strong>22 families · 241 concept entries</strong>. Each card has a <span className="font-mono">keyInsight</span> (the algorithmic complexity, theorem, or design principle that defines the concept, KaTeX-typeset where useful), an optional <span className="font-mono">notation</span> block (rendered as a standalone KaTeX expression — Bellman optimality, Attention, Amdahl&apos;s law, RSA, $f = g + h$ for A*), an optional <span className="font-mono">example</span>, an explicit <span className="font-mono">prereqs</span> list (defines DAG edges), tags, and <span className="font-mono">xref</span> chips linking to sibling pages (<span className="font-mono">mathematics</span>, <span className="font-mono">statistics</span>, <span className="font-mono">physics</span>) instead of duplicating. Headline visualization: per-family <strong>prerequisite knowledge map</strong> — directed acyclic graph rendered as SVG via Kahn-style topological layering, with in-family nodes color-tinted and cross-family / primitive prerequisites drawn as dashed neutral boxes; click any in-family node to scroll to and expand its card. Four status badges: <strong>SOLVED</strong> (green — Halting problem, Cook-Levin, Hilbert&apos;s 10th), <strong>OPEN</strong> (red — P vs NP, one-way functions, matrix-multiplication exponent $\omega$, Collatz, quantum supremacy, AGI scaling, AI alignment), <strong>REFUTED</strong> (rose), and <strong>FAMOUS</strong> (amber, for landmark concepts like Turing machine, Cook-Levin, Curry-Howard, AlphaGo, transformer, Moore&apos;s Law, Diffie-Hellman, CAP theorem, FLP, ResNet, GANs). Data layer split <span className="font-mono">app/computer-science/&#123;types,data,data2,data3,page&#125;.tsx</span>; counts (<span className="font-mono">22 families · 241 entries · ~280 prereq edges</span>) are computed from the data, not hardcoded. Nav link added in <span className="font-mono">app/layout.tsx</span> between Physics and Medicine.</li>
            <li><span className="text-gray-400">/medicine taxonomy page — 20 families, 257 entries, clickable body-systems map</span> — new sibling of <span className="font-mono">/mathematics</span> / <span className="font-mono">/chemistry</span> / <span className="font-mono">/physics</span> / <span className="font-mono">/statistics</span> / <span className="font-mono">/law</span> / <span className="font-mono">/governance</span> / <span className="font-mono">/ideologies</span> / <span className="font-mono">/finance</span> at <span className="font-mono">/medicine</span>. Five sections (Basic Sciences &amp; Anatomy · Medical Specialties · Diagnostics &amp; Treatment · Pharmacology · Public Health &amp; Open Questions) cover <strong>20 families · 257 concept entries</strong>. Each card carries a <span className="font-mono">keyFact</span> (the clinical principle, mechanism, or diagnostic criterion that defines the topic — plain text, no LaTeX), an optional <span className="font-mono">example</span>, an <span className="font-mono">organSystem</span> tag where applicable, and <span className="font-mono">xref</span> chips linking to sibling pages (<span className="font-mono">chemistry</span> for drug structures &amp; biochemistry, <span className="font-mono">statistics</span> for epidemiology &amp; trial design) instead of duplicating. Two mandatory headline visualizations: (1) a clickable <strong>body-systems map</strong> — twelve organ systems (cardiovascular, respiratory, gastrointestinal, neurological, musculoskeletal, endocrine, immune, reproductive, renal, dermatological, psychiatric, hematological) rendered as a color-coded grid; click any cell to see hallmark organs, common diseases, and every taxonomy entry tagged to that system. (2) A <strong>disease/treatment lineage network</strong> rendering organ systems as nodes and clinically-meaningful cross-system relationships as directed edges (diabetes → diabetic kidney disease, cardiorenal syndrome, MASH, lupus nephritis, EPO/anemia of CKD, etc.) — labeled by the linking syndrome or therapy. Four status badges color-code epistemic posture: <strong>LANDMARK</strong> (green — germ theory, penicillin, smallpox eradication, mRNA vaccines, CRISPR therapeutics, GLP-1 RAs, immune checkpoint inhibitors, sickle cell gene therapy), <strong>REFUTED</strong> (rose — Wakefield&apos;s 1998 MMR-autism paper retracted by <em>The Lancet</em>, Theranos), <strong>CONTESTED</strong> (amber — HRT timing hypothesis, aducanumab/lecanemab risk-benefit, PTSD-MDMA, AI-radiology generalizability, US health-system performance, &ldquo;no safe level&rdquo; alcohol), and <strong>OPEN</strong> (red — antimicrobial resistance, pancreatic cancer survival, glioblastoma, US maternal mortality, climate-and-health, biomedical replication crisis). Recent therapeutic shifts reflected: GLP-1 RAs and SGLT2 inhibitors reshaping diabetes/HF/CKD/obesity, KarXT for schizophrenia (2024), Trikafta for CF, Casgevy/Lyfgenia for sickle cell (2023), resmetirom for MASH (2024), lecanemab/donanemab for early AD, fezolinetant for menopause. Data layer split <span className="font-mono">app/medicine/&#123;types,systems,data,data2,data3,page&#125;.tsx</span>; counts (<span className="font-mono">20 families · 257 entries · 12 organ systems</span>) are computed from the data, not hardcoded. Nav link added in <span className="font-mono">app/layout.tsx</span> between Physics and Statistics. <span className="font-mono">tsc --noEmit</span> clean.</li>
            <li><span className="text-gray-400">/law taxonomy page — 22 families, 247 entries</span> — new sibling of <span className="font-mono">/mathematics</span> / <span className="font-mono">/chemistry</span> / <span className="font-mono">/physics</span> / <span className="font-mono">/statistics</span> / <span className="font-mono">/governance</span> / <span className="font-mono">/ideologies</span> / <span className="font-mono">/finance</span> at <span className="font-mono">/law</span>. Five sections (Constitutional &amp; Public Law · Criminal Law &amp; Procedure · Civil &amp; Private Law · International &amp; Comparative · Legal Theory &amp; Landmark Cases) cover <strong>22 families · 247 concept entries</strong>. Each card has a <span className="font-mono">keyPrinciple</span> (the legal doctrine or rule that defines the area, in plain text — no LaTeX, since legal citations are plain), an optional <span className="font-mono">citation</span> (Bluebook-style reporter citation for foundational cases — e.g. <em>Brown v. Board of Education, 347 U.S. 483 (1954)</em>), an optional <span className="font-mono">example</span>, tags, and <span className="font-mono">xref</span> chips linking to sibling pages (<span className="font-mono">governance</span>, <span className="font-mono">historical-events</span>, <span className="font-mono">ideologies</span>, <span className="font-mono">statistics</span>, <span className="font-mono">finance</span>) instead of duplicating. Four status badges color-code doctrinal posture: <strong>LANDMARK</strong> (green), <strong>OVERRULED</strong> (rose — preserved for historical importance: Lochner, Dred Scott, Korematsu, Chevron), <strong>CONTESTED</strong> (amber — holdings that stand but are sharply criticized: Citizens United, Kelo, felony murder, non-compete bans, plenary power), and <strong>OPEN</strong> (red — unresolved questions: AI personhood/copyright, digital privacy under the 4th Amendment, climate-plaintiff standing, fate of the administrative state post-Loper Bright). Recent doctrinal shifts reflected: Chevron overruled by <em>Loper Bright</em> (2024), <em>Bostock</em>'s extension of Title VII to LGBT employees (2020), <em>Sackett</em>'s narrowing of CWA (2023), <em>Dobbs</em>'s overruling of Roe/Casey (2022). Data layer split <span className="font-mono">app/law/&#123;types,data,data2,data3,page&#125;.tsx</span>; counts (<span className="font-mono">22 families · 247 entries</span>) are computed from the data, not hardcoded. Nav link added in <span className="font-mono">app/layout.tsx</span> between Governance and Ideologies. <span className="font-mono">tsc --noEmit</span> clean.</li>
            <li><span className="text-gray-400">/stats/media-coverage — NYT vs. 119th Congress bills</span> — new page at <span className="font-mono">/stats/media-coverage</span> that surfaces which 119th Congress bills the New York Times covers and which it ignores. New Prisma model <span className="font-mono">BillCoverage</span> (one row per Claim, fields <span className="font-mono">articleCount</span> / <span className="font-mono">topHeadlines</span> JSON / <span className="font-mono">searchQuery</span> / <span className="font-mono">lastChecked</span>, FK to <span className="font-mono">Claim.id</span> as <span className="font-mono">String</span> not Int — the prompt&apos;s schema sketch was off for our cuid IDs). New script <span className="font-mono">scripts/populate-bill-coverage.ts</span> pulls every Claim tagged with the <span className="font-mono">congress-119</span> Topic (across both <span className="font-mono">congress_bills_tracker_v1</span> and <span className="font-mono">congress_v1</span>), distills a clean 5–6-word NYT search query from each bill&apos;s short title (prefers the quoted title, strips H.R./S./H.Res. prefixes, strips &ldquo;To amend / To provide / A bill to / Providing for / Expressing the sense&rdquo; lead verbs, drops trailing &ldquo;Act of 2024&rdquo; years, caps at six meaningful non-stopword words), hits <span className="font-mono">api.nytimes.com/svc/search/v2/articlesearch.json</span> at the published 10 req/min (6s spacing, 429/503 backoff with up to 3 retries), and upserts the hit count + top-3 <span className="font-mono">{`{headline,url,date}`}</span> into <span className="font-mono">BillCoverage</span>. Supports <span className="font-mono">--limit N</span>, <span className="font-mono">--dry-run</span>, <span className="font-mono">--skip-existing</span>. New API <span className="font-mono">GET /api/stats/media-coverage</span> (5-min revalidate) returns a unified payload with <span className="font-mono">{`{bills, stats}`}</span>, supports <span className="font-mono">?sort=asc|desc&amp;status=enacted|all&amp;limit&amp;offset</span>, and aggregates stats over the full coverage table (not the page slice). Page is a client component with two stacked sections: <strong>Most Covered</strong> (top 20 by article count, with type + status badges, NYT query echoed, expandable top-3 headline links) and <strong>Dark Matter</strong> (bills with zero NYT coverage, sorted enacted-first so the &ldquo;passed Congress but not the newspaper of record&rdquo; tail is the first thing you see). Four-stat header (total bills tracked / with coverage / dark matter / avg articles), &ldquo;last refreshed&rdquo; date, empty state with the populate command if the table is empty, skeleton loader during fetch. Nav link added in <span className="font-mono">app/layout.tsx</span>; cross-link card added near the bottom of <span className="font-mono">/stats</span>. Migration <span className="font-mono">20260604120000_add_bill_coverage</span> applied via <span className="font-mono">prisma db execute</span> + <span className="font-mono">prisma migrate resolve --applied</span> (shadow-DB shadow-cannot-run-in-tx fingerprint, same pattern as prior trgm index migration).</li>
            <li><span className="text-gray-400">/chemistry taxonomy page — 21 families, 248 entries, interactive periodic table</span> — new sibling of <span className="font-mono">/mathematics</span> / <span className="font-mono">/statistics</span> / <span className="font-mono">/sports</span> / <span className="font-mono">/governance</span> / <span className="font-mono">/ideologies</span> / <span className="font-mono">/finance</span> at <span className="font-mono">/chemistry</span>. Five sections (Foundations · Physical · Organic · Inorganic/Materials/Nuclear · Analytical/Biochem/Open) cover <strong>21 families · 248 concept entries</strong>; each entry has a <span className="font-mono">keyFact</span> (KaTeX-typeset), optional <span className="font-mono">formula</span> + <span className="font-mono">reaction</span> (LaTeX <span className="font-mono">\ce&#123;...&#125;</span> via mhchem extension), optional <span className="font-mono">transforms</span> edges (reactant class → product class), optional <span className="font-mono">example</span>, and <span className="font-mono">xref</span> chips that link to sibling pages (math, statistics) instead of duplicating. Two headline visualizations: (1) an <strong>interactive 118-element periodic table</strong> in the standard 18-col × 7-row layout with lanthanide and actinide f-block strips below, every cell clickable to a category-tinted detail panel (symbol, Z, group, period, block, std. atomic weight); disputed placements (H group 1 vs 17; La/Lu and Ac/Lr group-3 composition) are surfaced as neutral notes, not adjudicated. (2) A <strong>reaction / transformation network (synthesis map)</strong> rendering Family 12 functional-group classes as nodes and Family 13 named reactions as directed edges labeled by reaction — built directly from the <span className="font-mono">transforms</span> field on each reaction entry. Data layer split <span className="font-mono">app/chemistry/&#123;types,elements,data,data2,data3,page&#125;.tsx</span>; counts on the page (<span className="font-mono">21 families · 248 entries · 118 elements</span>) are computed from the data, not hardcoded. Accuracy locked: oganesson (Z=118) is the heaviest confirmed element, period 7 complete, elements 119+ not synthesized, LK-99 explicitly marked <span className="font-mono">REFUTED</span> (not an open question), room-temperature ambient-pressure superconductivity flagged as still unachieved. KaTeX-rendered, mhchem-loaded as a side-effect import, 248 cards × 0 parse errors. <span className="font-mono">tsc --noEmit</span> clean.</li>
            <li><span className="text-gray-400">/legislation multi-country — Canada + New Zealand added</span> — the <span className="font-mono">/legislation</span> page now covers three parliaments via a country-switcher tab row at the top. <strong>🇺🇸 US Congress</strong> retains all existing functionality (view tabs, status filter chips, type selector, full 119th record view). <strong>🇨🇦 Canada</strong> queries <span className="font-mono">canada_bills_v1</span> (Royal Assent bills from the 35th Parliament, 1994, to present via LEGISinfo) with a simplified filter (search + pagination only, status taxonomy differs). <strong>🇳🇿 New Zealand</strong> queries <span className="font-mono">nz_legislation_v1</span> + <span className="font-mono">nz_bills_v1</span> (acts in force and bills from the Parliamentary Counsel Office API) with the same simplified filter. API route (<span className="font-mono">app/api/legislation/route.ts</span>) gains a <span className="font-mono">country=us|ca|nz</span> query param; non-US requests short-circuit into <span className="font-mono">foreignCountryView()</span> which queries by <span className="font-mono">ingestedBy</span> tag and maps metadata to the shared <span className="font-mono">BillHit</span> shape (Canada: <span className="font-mono">billNumber</span>, <span className="font-mono">parliament</span>, <span className="font-mono">billType</span> from metadata + <span className="font-mono">sourceUrl</span> from edge; NZ: <span className="font-mono">actNumber</span>, <span className="font-mono">year</span>, <span className="font-mono">actType</span> from metadata, status inferred from <span className="font-mono">metadata.dataset</span>). All responses include a <span className="font-mono">countries</span> summary. <span className="font-mono">BillRow</span> renders the correct source-link label per country (congress.gov / parl.ca / legislation.govt.nz). Status labels for CA/NZ fall back to the raw string if not in the US <span className="font-mono">STATUS_LABEL</span> map. Two new perpetual-loop scripts: <span className="font-mono">scripts/canada-bills-loop.sh</span> (runs <span className="font-mono">ingest-canada-bills.ts --full</span> every 12h, logs to <span className="font-mono">/tmp/canada-bills-loop.log</span>) and <span className="font-mono">scripts/nz-bills-loop.sh</span> (runs <span className="font-mono">ingest-nz-legislation.ts --mode bills --full</span> every 12h, logs to <span className="font-mono">/tmp/nz-bills-loop.log</span>). Both follow the same <span className="font-mono">set -euo pipefail</span> + <span className="font-mono">tee -a</span> pattern as <span className="font-mono">congress-bills-loop.sh</span>. <span className="font-mono">npx tsc --noEmit</span> clean on both tsconfigs (pre-existing errors in unrelated scripts unchanged).</li>
            <li><span className="text-gray-400">/legislation upgrades — auto-update banner, Terminal Outcomes view, Full 119th Record view</span> — three additions to the live Congress bill tracker. <strong>Auto-update banner</strong> at the top of the page (pulsing green dot, &ldquo;Live tracker — auto-refreshes every 12 hours from the Congress.gov API&rdquo;) carries a relative &ldquo;Last pull: Xh ago&rdquo; derived from <span className="font-mono">MAX(metadata-&gt;&gt;&apos;lastTrackedAt&apos;)</span> across <span className="font-mono">congress_bills_tracker_v1</span> claims, so visitors see at a glance that the data is fresh. <strong>Terminal Outcomes view</strong> (new tab) filters the list to bills tagged with any of <span className="font-mono">status-enacted</span> / <span className="font-mono">status-vetoed</span> / <span className="font-mono">status-failed</span> and renders the outcome as a prominent colored badge (ENACTED green / VETOED red / FAILED grey) with a <span className="font-mono">LAST ACTION / &lt;date&gt;</span> block on the right. <strong>Full 119th Record view</strong> shows every tracked 119th-Congress bill grouped by outcome (Enacted → Passed → Vetoed → Failed → Still Active) with each group sorted by latest-action date desc; a header strip displays outcome counts as colored dots. The tracker ingester (<span className="font-mono">scripts/ingest-congress-bills-tracker.ts</span>) gained a <span className="font-mono">status-failed</span> classifier (matches &ldquo;failed of passage&rdquo;, &ldquo;motion to suspend the rules…failed&rdquo;, &ldquo;cloture motion rejected&rdquo;, etc.) so future passes populate the new bucket. API (<span className="font-mono">app/api/legislation/route.ts</span>) accepts a new <span className="font-mono">view=full</span> param and supports <span className="font-mono">status=terminal</span> as an OR-of-three multi-status filter; <span className="font-mono">BillHit</span> now carries <span className="font-mono">latestActionDate</span>, <span className="font-mono">latestActionText</span>, and a derived <span className="font-mono">outcome</span> field. Verified end-to-end against the running dev server: <span className="font-mono">view=full</span> returns 500 bills with <span className="font-mono">{`outcomeCounts {enacted:0, passed:1, vetoed:0, failed:0, active:499}`}</span> against today&apos;s tracker snapshot; <span className="font-mono">status=terminal</span> correctly returns 0 (no bills in terminal state yet — empty state exercised).</li>
            <li><span className="text-gray-400">CourtListener Tier 2 ingesters built</span> — two new scripts extend the CourtListener footprint beyond opinions. <span className="font-mono">scripts/ingest-courtlistener-disclosures.ts</span> is a two-pass ingester for judge financial disclosures: Pass 1 mints one form-level Claim per <span className="font-mono">/financial-disclosures/</span> entry (text &ldquo;&lt;Judge&gt; filed a federal judicial Annual Financial Disclosure Report for calendar year &lt;year&gt;&rdquo;, Source URL preferring the actual PDF), and Pass 2 — whenever <span className="font-mono">has_been_extracted=true</span> — pulls <span className="font-mono">/gifts/</span> and <span className="font-mono">/reimbursements/</span> for that form and mints child Claims for editorially significant entries: gifts with parsed value upper-bound ≥ $5,000 and reimbursements whose <span className="font-mono">location</span> looks foreign (non-empty + no unambiguous US marker). Line-item Claims are parented to the form Claim via <span className="font-mono">parentClaimId</span>; all Claims are INSTITUTIONAL / HARD_FACT / PROCEDURAL / edge score 70, tagged with new topics <span className="font-mono">judicial-ethics</span> (parent) and <span className="font-mono">financial-disclosures</span> (child). The filer&apos;s name is resolved against the linked <span className="font-mono">/people/&lt;id&gt;/</span> record (cached in-process). Re-running on an already-ingested form skips Pass 1 but still re-runs Pass 2, so new line items added by CL after the initial sweep are picked up idempotently. Flags: <span className="font-mono">--limit N</span>, <span className="font-mono">--min-year N</span>, <span className="font-mono">--extracted-only</span>, <span className="font-mono">--slow</span> (10s delay, 90s timeout, 10 retries), <span className="font-mono">--dry-run</span>; 429/Retry-After honored, transactions gated by <span className="font-mono">{`{ timeout: 30000 }`}</span>. Companion <span className="font-mono">scripts/disclosures-loop.sh</span> runs the ingester on a 12h loop at <span className="font-mono">--slow --limit 200</span>, logged to <span className="font-mono">/tmp/disclosures-loop.log</span>. <span className="font-mono">scripts/ingest-courtlistener-courts.ts</span> ingests the full CourtListener court catalogue as Topics only (no Claims, no Sources) — one Topic per court, slugged <span className="font-mono">court-&lt;id&gt;</span> (e.g. <span className="font-mono">court-scotus</span>, <span className="font-mono">court-ca9</span>), nested under five jurisdiction-derived parents (<span className="font-mono">federal-courts</span> / <span className="font-mono">state-courts</span> / <span className="font-mono">military-courts</span> / <span className="font-mono">international-courts</span> / <span className="font-mono">other-courts</span>) per the CL jurisdiction code map (F/FD/FB/FS → federal, S/SA/ST/SG/SS → state, U → military, I → international, else other). Idempotent slug upsert; supports <span className="font-mono">--jurisdiction &lt;code&gt;</span> and <span className="font-mono">--dry-run</span>. Both scripts share the same <span className="font-mono">clFetch</span> retry-with-backoff helper used by the circuits ingester (Pipeline 4).</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">June 2, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">/statistics/methods — interactive textbook reference</span> — new long-form companion to <span className="font-mono">/statistics</span> at <span className="font-mono">/statistics/methods</span>, served by <span className="font-mono">app/statistics/methods/page.tsx</span> (client component). Covers the <strong>10 most-cited statistical methods</strong> in depth — p-value &amp; NHST, confidence intervals, effect size, correlation (and the causation trap), odds ratio &amp; relative risk, regression (linear + logistic), meta-analysis &amp; forest plots, statistical power &amp; sample size, Bayesian inference, and multiple comparisons / Bonferroni. Each entry is structured as: <strong>Problem it solves</strong> (lead) → <strong>Figure</strong> (Recharts: rejection-region normal curve for p-values, 20 simulated 95% CIs around μ=0, Cohen&apos;s d=0.8 overlap density, scatter+OLS for correlation, logistic-vs-linear sigmoid, inline-SVG 2×2 contingency for OR/RR, synthetic forest plot, power curves for d=0.2/0.5/0.8, Beta(2,2)→Beta(9,5) Bayesian update, family-wise error vs. Bonferroni floor) → <strong>How it works</strong> (mechanism + formulas in mono-block) → <strong>Worked example</strong> (one concrete sentence with numbers) → <strong>Arguments for</strong> &amp; <strong>Pitfalls</strong> (side-by-side green/red lists) → <strong>Related claims</strong> from the DB. Sidebar (sticky on desktop) navigates between methods; family-color dot per entry; filter input scans names, descriptions, examples; expand/collapse-all toggle. New API <span className="font-mono">GET /api/statistics/related-claims</span> (5-min revalidate) does an OR-contains text match over <span className="font-mono">Claim.text</span> for ~3 keywords per method (e.g. <em>p-value</em> tries <span className="font-mono">&quot;p-value&quot;</span>, <span className="font-mono">&quot;p &lt; 0.05&quot;</span>, <span className="font-mono">&quot;statistical significance&quot;</span>, <span className="font-mono">&quot;null hypothesis&quot;</span>) and returns up to 3 most-recent claim previews per method. Linked from the top of <span className="font-mono">/statistics</span> as the &ldquo;textbook-style interactive reference&rdquo; for the 10 most-cited methods.</li>
            <li><span className="text-gray-400">/statistics upgraded to textbook depth</span> — every one of the 105 methods on <span className="font-mono">/statistics</span> now expands on click into a textbook-style entry with three labeled sections: <strong>Problem</strong> (the question the method answers — &ldquo;Does the mean of a single sample differ from a specific value?&rdquo;), <strong>Key insight</strong> (the mechanistic core, with formulas in inline mono — <span className="font-mono">t = (x̄₁ − x̄₂) / √(s²/n₁ + s²/n₂)</span>, <span className="font-mono">posterior ∝ prior × likelihood</span>, <span className="font-mono">D_KL(P‖Q) = Σ p(x) log(p(x)/q(x))</span>), and <strong>Example</strong> (one concrete sentence with numbers — drug trial 50/group, t ≈ 2.5, p ≈ 0.014; Card &amp; Krueger NJ/PA min-wage DiD; LDL MR confirming the statin causal pathway). Eleven of the most iconic methods also gained a small 200×100 inline SVG figure (no external deps, dark-themed): bell curve with μ±σ (Mean/SD), two overlapping bells (t-test), scatter + regression line (Linear regression), sigmoid (Logistic regression), prior×likelihood∝posterior triptych (Bayesian inference), Venn of H(X), H(Y), I(X;Y) (Mutual information), point cloud with PC1/PC2 arrows (PCA), ROC curve with shaded AUC and diagonal baseline (ROC/AUC), two bells with α and β tails shaded (Power analysis), Kaplan-Meier step survival curve (Cox PH), and a time series with forecast cone and confidence fan (ARIMA). Card click toggles expansion (Enter/Space supported, focus-ring on tab); only one card is open at a time across the page so the read experience stays focused; the per-card <span className="font-mono">/search?q=</span> link uses <span className="font-mono">stopPropagation</span> so it still works. Filter input now scans <span className="font-mono">problem</span>, <span className="font-mono">keyInsight</span>, and <span className="font-mono">example</span> too, so queries like &ldquo;log-odds&rdquo;, &ldquo;MLE&rdquo;, or &ldquo;parallel trends&rdquo; find the right card. Section labels are <span className="font-mono">text-[10px] uppercase tracking-widest text-gray-500</span> — same style as elsewhere on the site.</li>
            <li><span className="text-gray-400">Statistics taxonomy page (/statistics)</span> — new standalone interactive guide to statistical methods at <span className="font-mono">/statistics</span>, served by <span className="font-mono">app/statistics/page.tsx</span> (pure client component, no API calls). <strong>9 families</strong> color-coded — Descriptive (gray), Frequentist Inferential (blue), Regression &amp; Prediction (green), Bayesian (purple), Experimental Design (amber), Causal Inference (orange), Signal Processing &amp; Time Series (teal), Information Theory (rose), Machine Learning (violet) — covering <strong>117 methods</strong> in total. Each method card carries a one-line description, two-or-three &ldquo;used for&rdquo; tag chips, and a per-method link to <span className="font-mono">/search?q=&lt;method&gt;</span> to find related claims. Top-bar filter input matches against method name + description + tags in real time; per-family headers are individually collapsible with Expand-all / Collapse-all buttons. Sticky search bar with backdrop-blur stays pinned during scroll. Added <strong>Statistics</strong> link to the global nav in <span className="font-mono">app/layout.tsx</span>, slotted between Fields and Review. Bottom of the page carries an explicit caveat that the search link is a free-text match (not a curated cross-reference) and notes that a claim-powered method explorer is on the roadmap.</li>
            <li><span className="text-gray-400">Retraction Watch UI polish + retracted-claim status reflect</span> — three follow-on changes to yesterday&apos;s Retraction Watch enrichment. (1) On the claim detail page, the per-edge score column now reads as a single inline string <span className="font-mono">&quot;80/100, at the time&quot;</span> (rose-colored, same line) instead of stacking <span className="font-mono">at the time</span> below the score. (2) The <strong>What happened next</strong> panel&apos;s REVERSED rows now render a graduated, plain-English description of <em>how untrue</em> the original finding turned out to be — derived from <span className="font-mono">retractionNature</span> + <span className="font-mono">retractionCategory</span> + <span className="font-mono">retractionSeverity</span>: &ldquo;Entirely fabricated&rdquo; (Fraud / Paper mill), &ldquo;Evidence falsified&rdquo; (Plagiarism / Image manipulation), &ldquo;Completely retracted&rdquo; (HIGH other), &ldquo;Significantly invalidated&rdquo; (MEDIUM), &ldquo;Partially retracted&rdquo; (LOW), &ldquo;Findings questioned&rdquo; (Expression of concern), &ldquo;Finding improved/corrected&rdquo; (Correction nature). Rendered as a faint arrow + phrase below the reason line. (3) New script <span className="font-mono">scripts/tag-retracted-claims.ts</span> flipped <strong>11,319 <span className="font-mono">openalex_v1</span> claims</strong> that are the <span className="font-mono">fromClaim</span> of a REVERSED ClaimRelation from <span className="font-mono">PROVISIONAL</span> → <span className="font-mono">DISPUTED</span>, so the claim status badge across the app finally reflects that the published finding has been formally disputed. Idempotent (only flips PROVISIONAL — skips human-reviewed HARD_FACT / DEPRECATED rows), 500-row batches with <span className="font-mono">{`{ timeout: 30000 }`}</span>, <span className="font-mono">ALLOW_EDITS=true</span> gated.</li>
            <li><span className="text-gray-400">Retraction Watch enrichment — REVERSED follow-ups now carry a <em>why</em></span> — new script <span className="font-mono">scripts/enrich-retractions.ts</span> joins every <span className="font-mono">REVERSED</span> ClaimRelation against the full Retraction Watch database, distributed under CC0 by CrossRef Labs at <span className="font-mono">api.labs.crossref.org/data/retractionwatch</span> (~64 MB CSV, ~70k rows, no registration). For each match, <span className="font-mono">followUpContext</span> is merged with a primary <span className="font-mono">retractionReason</span> (e.g. <em>Falsification/Fabrication of Data</em>), a short <span className="font-mono">retractionCategory</span> (Fraud · Paper mill · Plagiarism · Image manipulation · Data error · Duplication · Authorship/COI · Investigation · Editorial concern · Correction), a <span className="font-mono">retractionSeverity</span> band (HIGH / MEDIUM / LOW), the RW <span className="font-mono">RetractionNature</span> (Retraction / Expression of concern / Correction / Reinstatement), and the full <span className="font-mono">retractionReasonsAll</span> token list for transparency. Result: <strong>5,703 of 11,319 REVERSED rows</strong> enriched (50.4% coverage) — <strong>HIGH 2,590</strong>, <strong>MEDIUM 2,306</strong>, <strong>LOW 807</strong>. Top categories: Paper mill 1,544, Authorship / COI 747, Plagiarism 730, Data error 690, Correction 631, Duplication 432, Fraud 174. The 5,616 unmatched rows are mostly recent papers Retraction Watch hasn&apos;t catalogued yet (a re-run after a future RW refresh will pick up new matches — the script is idempotent). On the claim detail page, the &ldquo;Retracted&rdquo; row now renders a severity-colored second badge with a dot — deep red for HIGH fraud / paper-mill / plagiarism, orange for MEDIUM data errors / duplication / authorship, yellow for LOW corrections / editorial concerns — and italicized reason text below the badges. CSV is cached locally at <span className="font-mono">.cache/retraction-watch.csv</span> (24h TTL, <span className="font-mono">--refresh</span> to force re-download). Severity classifier in <span className="font-mono">CATEGORY_RULES</span> picks the highest-severity match across the semicolon-separated reason tokens.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">June 1, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">Congress.gov vote → law linker (link-congress-relations.ts)</span> — new linker (<span className="font-mono">scripts/link-congress-relations.ts</span>) walks all 505 <span className="font-mono">congress_votes_v1</span> claims and joins each to its matching <span className="font-mono">congress_v1</span> enacted-law claim by <span className="font-mono">(congress, billType, billNumber)</span>, producing <strong>505 OUTCOME</strong> rows in one pass (no API calls, no unmatched). Pass B queries Congress.gov <span className="font-mono">/bill/{`{congress}`}/{`{type}`}/{`{number}`}/relatedbills</span> across the 230 unique bills covered by vote claims to detect SUPERSEDED_BY signals; <strong>3,353 related-bill records returned</strong>, but the CRS-curated relationship vocabulary is dominated by <span className="font-mono">"Related bill"</span> (3,225, too generic to treat as supersession) and <span className="font-mono">"Identical bill"</span> / <span className="font-mono">"Companion"</span> / <span className="font-mono">"Procedurally related"</span> (parallel-introduced bills, deliberately excluded). The only specific supersede signals returned were 4× <span className="font-mono">"Text similarities"</span> + 1× <span className="font-mono">"Public law contains the text"</span> — and in all 5 cases the related bill has no <span className="font-mono">congress_v1</span> claim in our DB (it was a non-enacted companion), so <strong>0 SUPERSEDED_BY</strong> rows were created. Accurate, not a bug: this endpoint isn't structured to expose strong supersession semantics. <span className="font-mono">ClaimRelation OUTCOME</span> total: 33 → <strong>538</strong>. Direction logic for any future supersede match: earlier <span className="font-mono">enactedDate</span> → later (falls back to lower congress number).</li>
            <li><span className="text-gray-400">What-happened-next badge labels refreshed</span> — relabeled the follow-up badges on the claim detail page to read more naturally: <strong>OUTCOME</strong> now shows as &ldquo;Led to&rdquo;, <strong>REVERSED</strong> as &ldquo;Retracted&rdquo;, and <strong>EXPANDED</strong> as &ldquo;Expanded by&rdquo;. <strong>SUPERSEDED_BY</strong> (&ldquo;Superseded by&rdquo;) and <strong>STATUS_UPDATE</strong> (&ldquo;Status update&rdquo;) unchanged. Cosmetic-only — no schema or API change.</li>
            <li><span className="text-gray-400">CrossRef retraction linker investigation (link-retractions-crossref.ts)</span> — built a dedicated retraction linker that runs two steps: (1) a DB-side DOI join across all DOI-bearing claims (<span className="font-mono">openalex_v1</span> + any future pipelines) against <span className="font-mono">crossref_retractions_v1</span>, and (2) a CrossRef API probe of 2,000 unmatched retraction DOIs looking for <span className="font-mono">relation.retraction[]</span> / <span className="font-mono">update-to[].DOI</span> fields that differ from the original paper DOI. Result: REVERSED count stays at <strong>26</strong>. Root-cause confirmed by the investigation: (a) the existing DOI matcher IS correct — <span className="font-mono">crossref_retractions_v1</span> stores the original retracted paper&apos;s DOI (not a notice DOI), the join logic was never wrong; (b) the plateau is a <em>coverage</em> problem — our 161k OpenAlex sample targets cognition / biomedical / policy, while CrossRef retractions cluster in materials science, chemistry, and paper-mill-heavy engineering fields; (c) the CrossRef API <span className="font-mono">relation</span> field is empty for ~99.9% of retraction records (2,000 DOIs sampled — 0 alternate notice DOIs found). The existing 26 REVERSED rows were refreshed with an enriched <span className="font-mono">followUpContext</span> (adds <span className="font-mono">source: &apos;crossref_api&apos;</span>, <span className="font-mono">retractionDoi</span>, <span className="font-mono">originalDoi</span>). Recommended path to grow the count meaningfully: add OpenAlex ingest for materials science (C192562407), chemistry (C185592680), and engineering (C41008148) — estimated +500–2,000 REVERSED based on the 26/161k base rate.</li>
            <li><span className="text-gray-400">Follow-up linker batch (4 new sequential pipelines)</span> — four new linker scripts run in sequence on top of the follow-up layer that shipped earlier today: <span className="font-mono">scripts/link-legislation-amendments.ts</span> matches amendment / repeal language across every <span className="font-mono">*_legislation_v1</span> corpus with per-country extractors (Chile <span className="font-mono">MODIFICA LA LEY Nº X</span> → <span className="font-mono">metadata.numero</span>, Cyprus <span className="font-mono">(Τροποποιητικός)</span> title-stem ILIKE, Luxembourg date-based <span className="font-mono">"loi du &lt;D&gt; &lt;month-fr&gt; &lt;YYYY&gt;"</span> → <span className="font-mono">metadata.date</span>, UK <span className="font-mono">"X Act YYYY (Amendment) Act ZZZZ"</span> exact-title); <span className="font-mono">scripts/link-clinicaltrials-outcomes.ts</span> extends the trial→paper match with a broader NCT regex, a <span className="font-mono">Source.url</span> scan, and text-parsed <span className="font-mono">primary completion &lt;Month YYYY&gt;</span> attached to <span className="font-mono">followUpContext</span> (10,785 of 10,957 trials parse to a past-completion date — <span className="font-mono">clinicaltrials_v1</span> has null <span className="font-mono">metadata</span>, so the status field the brief asked for isn&apos;t there); <span className="font-mono">scripts/link-retraction-originals.ts</span> unifies <span className="font-mono">crossref_retractions_v1</span> + <span className="font-mono">retraction_watch_v1</span> into a 26,645-DOI map and tries three OpenAlex signals (<span className="font-mono">metadata.doi</span> URL-prefixed, bare DOI, <span className="font-mono">Source.url</span>) — all three land on the same 26 papers, so the matcher isn&apos;t the limiter, OpenAlex coverage is; <span className="font-mono">scripts/link-congress-outcomes.ts</span> indexes 10,360 enacted bills into 9,565 short titles + 4,503 act-name variants and resolves <span className="font-mono">"to amend [Act]"</span> / <span className="font-mono">"amend section X of [Act]"</span> patterns against that index. <strong>Net adds:</strong> +4,159 SUPERSEDED_BY (Chile 810, Cyprus 3,122, Luxembourg 137, UK 10, Congress 80), +1 OUTCOME (<span className="font-mono">congress_v1</span> ↔ <span className="font-mono">nara_catalog_v1</span> via act-name match — only one act name landed against the 12 NARA records that reference Public Law citations). Existing OUTCOME (32) and REVERSED (26) rows refreshed with richer <span className="font-mono">followUpContext</span>. Final <span className="font-mono">ClaimRelation</span> totals: <strong>SUPERSEDED_BY 39,966</strong>, <strong>OUTCOME 33</strong>, <strong>REVERSED 26</strong>. Pipeline-by-pipeline tractability notes and skipped-corpora rationale live in each script&apos;s doc comment and in CONSULTANT.md.</li>
            <li><span className="text-gray-400">Claim follow-up layer (&ldquo;What happened next&rdquo;)</span> — claim detail pages now render a <strong>What happened next</strong> section above the citation graph, listing later claims linked to this one via the <span className="font-mono">ClaimRelation</span> table with one of five follow-up relation types: <strong>OUTCOME</strong> (e.g. a trial → the paper that reported its results), <strong>STATUS_UPDATE</strong>, <strong>SUPERSEDED_BY</strong> (e.g. an FDA drug label superseded by a later effective-date label for the same drug + manufacturer, or a congressional act amended by a later bill), <strong>REVERSED</strong> (e.g. an OpenAlex paper retracted via its CrossRef retraction notice), and <strong>EXPANDED</strong>. Schema gained <span className="font-mono">followUpContext Json?</span> on <span className="font-mono">ClaimRelation</span> plus an index on <span className="font-mono">(toClaimId, relationType)</span>; migration <span className="font-mono">20260601120000_add_followup_relations</span>. New script <span className="font-mono">scripts/link-claim-followups.ts</span> auto-links across four pipelines using DB-side heuristics — DOI exact-match on <span className="font-mono">openalex_v1</span> ↔ <span className="font-mono">crossref_retractions_v1</span>, NCT-ID text-match on <span className="font-mono">clinicaltrials_v1</span> → <span className="font-mono">openalex_v1</span>, &ldquo;to amend [Act Name]&rdquo; pattern within <span className="font-mono">congress_v1</span>, and same-(generic_name, manufacturer) chains ordered by <span className="font-mono">effective_time</span> for <span className="font-mono">openfda_labels_v1</span>. Result: <strong>35,807 SUPERSEDED_BY</strong> (FDA label chains + 21 congressional amendments) + <strong>32 OUTCOME</strong> (trial → result paper) + <strong>26 REVERSED</strong> (paper → retraction). Each row carries a <span className="font-mono">followUpContext</span> JSON blob with the heuristic, confidence, and pipeline pair so future-you can audit how the link was made. New API <span className="font-mono">GET /api/claims/[id]/followups</span> and lazy-loaded client component <span className="font-mono">components/WhatHappenedNextPanel.tsx</span> — renders nothing when a claim has no follow-ups.</li>
            <li><span className="text-gray-400">Nav audit + ISR caching for slow analysis pages</span> — every one of the 25 top-nav links was probed against the running dev server; all 25 returned 200 (no dead links, no empty stubs). <span className="font-mono">/sources</span> already 308-redirects to <span className="font-mono">/datasets</span> via <span className="font-mono">next.config.ts</span> and the Sources nav link is intentionally kept until the Sources-into-Datasets consolidation ships as its own task. The three slowest pages were running <span className="font-mono">export const dynamic = &quot;force-dynamic&quot;</span> and recomputing from scratch on every request: <span className="font-mono">/analysis/votes</span> (~10s cold), <span className="font-mono">/analysis/topics</span> (~1.5s), and <span className="font-mono">/pipelines</span> (~3.5s cold). All three switched to <span className="font-mono">export const revalidate = 3600</span> so production now serves them from the ISR cache and only re-renders hourly. <span className="font-mono">npx tsc --noEmit</span> clean.</li>
            <li><span className="text-gray-400">Academic-field badges on /topics</span> — each topic row on <span className="font-mono">/topics</span> now carries a small colored pill labelling its top-level academic discipline (<strong>SOCIAL SCI</strong> blue, <strong>NATURAL SCI</strong> emerald, <strong>HUMANITIES</strong> violet, <strong>APPLIED SCI</strong> amber, <strong>FORMAL SCI</strong> cyan). Clicking a badge jumps to <span className="font-mono">/fields</span>. Mapping is by <span className="font-mono">Topic.domain</span> → discipline, covering all 29 in-use domains. Backfilled the DB at the same time: <span className="font-mono">scripts/tag-topics-academic-field.ts</span> was extended from 8 → 29 domain mappings (each pointing at a level-1 <span className="font-mono">AcademicField</span> slug) and re-run; <strong>348/348 topics</strong> now carry a non-null <span className="font-mono">academicFieldId</span>, up from 0. Discipline derivation is purely from the domain string so the badge renders client-side without any extra API call.</li>
            <li><span className="text-gray-400">Sources merged into Datasets</span> — the standalone <span className="font-mono">/sources</span> page (flat, unnavigable list of ~838k source records) is gone. Clicking any dataset card on <span className="font-mono">/datasets</span> now opens a right-side drawer that fetches that pipeline&apos;s sources via <span className="font-mono">/api/sources?ingestedBy=…&amp;limit=50</span> with paginated &ldquo;Load more&rdquo;, in-drawer name/URL filter, ESC-to-close, and a header carrying the pipeline tag, label, description, record count, last-ingested date, and external source link. Top nav loses the <strong>Sources</strong> link, and <span className="font-mono">/sources</span> 301-redirects to <span className="font-mono">/datasets</span> via <span className="font-mono">next.config.ts</span>. Source records now live in the context of the dataset that produced them rather than as a context-free global feed.</li>
            <li><span className="text-gray-400">World Bank Indicators topic page rewrite</span> — <span className="font-mono">/topics/world-bank-indicators</span> is no longer a flat 34,643-claim list. The page now special-cases the <span className="font-mono">worldbank_v1</span> pipeline with three features: <strong>indicator faceting</strong> (chip row for GDP, GDP per capita, Population, Life expectancy, CO₂ per capita), a <strong>country filter</strong> with a debounced text input that narrows the country list and the claim list together, and a <strong>Recharts comparison chart</strong> (<span className="font-mono">LineChart</span>, one line per country, x-axis year 1990–2022, y-axis indicator value, defaults to USA / CHN / DEU / JPN / GBR with per-indicator value formatting). Claim list now sorts alphabetically by country then year-descending instead of the useless &quot;newest emerged&quot; (every World Bank claim has the same emerged date). New API at <span className="font-mono">/api/topics/world-bank-indicators/data</span> reads structured <span className="font-mono">Claim.metadata</span> (indicatorCode, countryIso3, year, value) via JSON-path raw SQL — no regex parsing, no new columns, no migration. Wired in via <span className="font-mono">app/topics/[slug]/page.tsx</span> slug-check that renders the new <span className="font-mono">WorldBankView</span> while the generic topic page stays intact for every other topic. New files: <span className="font-mono">app/api/topics/world-bank-indicators/data/route.ts</span>, <span className="font-mono">app/topics/[slug]/WorldBankView.tsx</span>, <span className="font-mono">app/topics/[slug]/WorldBankChart.tsx</span>.</li>
            <li><span className="text-gray-400">OpenFEC campaign finance pipelines</span> — two new ingesters bring 1,200 federal-election claims into the receipts graph for the 2020 / 2022 / 2024 cycles. <span className="font-mono">openfec_v1</span> pulls per-cycle candidate fundraising totals (top 200 by receipts × 3 cycles = 600 claims) with total receipts, individual itemized contributions, and PAC contributions, plus party / office / state context. <span className="font-mono">openfec_ie_v1</span> pulls Super-PAC outside spending from <span className="font-mono">Schedule E</span> (top 200 by total × 3 cycles = 600 claims), gated at <strong>≥$100,000</strong> per (candidate, cycle, support/oppose) tuple. <span className="font-mono">scripts/ingest-openfec.ts</span> supports <span className="font-mono">--cycle YYYY</span> (repeatable), <span className="font-mono">--limit N</span>, <span className="font-mono">--office P|S|H</span>, and <span className="font-mono">--dry-run</span>; rate-limited with 200ms inter-page delay and full 429 / Retry-After honoring; transactions gated by <span className="font-mono">{`{ timeout: 30000 }`}</span> per CONSULTANT rule. Sources link to <span className="font-mono">fec.gov/data/candidate/{`{id}`}</span>; IE candidate names resolved via <span className="font-mono">/candidates/?candidate_id=</span> lookup with in-memory cache. Two new topics created (<span className="font-mono">campaign-finance</span>, <span className="font-mono">independent-expenditure</span>).</li>
            <li><span className="text-gray-400">EU Parliament votes 13× expansion</span> — new pipeline <span className="font-mono">eu_parliament_votes_v2</span> ingests <strong>24,224 plenary roll-call votes</strong> (2004–present) from the HowTheyVote.eu release (which mirrors the European Parliament&apos;s DOCEO XML; the EP <span className="font-mono">data.europarl.europa.eu/api/v2</span> JSON-LD endpoints only expose vote <em>metadata</em>, no tallies). Each vote carries aggregate yes / no / abstain counts plus a full <span className="font-mono">byPartyJson</span> breakdown by political group (EPP, S&amp;D, Renew, Greens/EFA, The Left, ECR, PfE, Non-attached, ESN) computed by streaming 17M member-vote rows once. <span className="font-mono">scripts/ingest-eu-parliament-votes.ts</span> uses 200-row batches with 30s txn timeout, <span className="font-mono">--dry-run</span> / <span className="font-mono">--limit N</span> flags, and <span className="font-mono">ALLOW_EDITS=true</span> gating. <span className="font-mono">/analysis/votes</span> now buckets the by-body table by country label rather than raw <span className="font-mono">ingestedBy</span> tag, so the legacy <span className="font-mono">eu_parliament_v1</span> (~1,900 enriched, no party breakdown) and the new <span className="font-mono">eu_parliament_votes_v2</span> collapse into a single &quot;European Parliament&quot; row.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 31, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">Per-body decade trend chart (Recharts)</span> — Section 4 of <span className="font-mono">/analysis/votes</span> swaps its plain decade-rate table for a Recharts <span className="font-mono">LineChart</span> with one line per legislative body: US House, US Senate, UK, EU Parliament, Canada. Each body is compared against its own history (within-subjects) instead of pooled into a single curve where a UK-heavy or Senate-only decade silently dominated. <span className="font-mono">lib/voteAnalysis.ts</span> gains <span className="font-mono">getBodyKey()</span> which splits <span className="font-mono">congress_v1</span> by chamber via regex on <span className="font-mono">LegislativeVote.chamber</span>, plus a new <span className="font-mono">decadeTrendByBody</span> output shaped for direct recharts consumption (decades where a body has &lt; 10 recorded votes are omitted so noise floors stay off the chart; <span className="font-mono">connectNulls</span> bridges gaps). New client component <span className="font-mono">app/analysis/votes/DecadeTrendChart.tsx</span> handles the 300px <span className="font-mono">ResponsiveContainer</span>, dark-theme axes, custom tooltip listing each body sorted by contested % with vote-count in parens, and stable per-body colors. The original pooled table is preserved below the chart inside a collapsible <span className="font-mono">&lt;details&gt;</span>.</li>
            <li><span className="text-gray-400">Topic trajectory heatmap (z-scored)</span> — <span className="font-mono">/analysis/votes</span> gains a new section between the decade-trend table and party loyalty. For each topic we compute its share of all votes per decade, then z-score that trajectory against the topic&apos;s own historical mean: red cells flag decades when the topic was anomalously high vs. its own baseline, blue cells flag anomalously low. Filters to topics appearing in 3+ decades with at least one |z| ≥ 1, top 20 by max |z|. Pure CSS grid, no recharts. New <span className="font-mono">TopicZRow</span> export + <span className="font-mono">topicZScores</span> on <span className="font-mono">buildVoteAnalysis()</span>; client component <span className="font-mono">app/analysis/votes/TopicHeatmap.tsx</span>.</li>
            <li><span className="text-gray-400">Analysis-page polish: paired party comparison + plain-language vote summary</span> — <span className="font-mono">/analysis/representation</span> gained a within-subjects (paired) party-comparison block. The previous two cards averaged Dem gap and Rep gap over different row sets — clean apples-to-oranges. Now we compute (demGap − repGap) on each row where <em>both</em> are known and report paired count, % of rows where Democrats diverged more, and median + mean paired difference. The original aggregate cards are kept but explicitly flagged as not directly comparable, and the topic-level breakdown gained a <span className="font-mono">Paired diff</span> column (demAvgGap − repAvgGap with sign). <span className="font-mono">/analysis/votes</span> gained a collapsible <span className="font-mono">What does this mean?</span> block right under the summary cards: 4–5 server-rendered plain-English sentences pulled from existing aggregates (overall contested share, single most-partisan bill with chi-square phrasing, party-loyalty averages for the two largest blocs, a strong bipartisan example, and the most contested decade by share). Uses a native <span className="font-mono">&lt;details&gt;</span> element — no new client components, no new queries.</li>
            <li><span className="text-gray-400">/globe fixes + Connected Events</span> — three quality-of-life fixes on <span className="font-mono">/globe</span>: claim cards in the sidebar are now real Next <span className="font-mono">&lt;Link&gt;</span> elements (previously plain <span className="font-mono">&lt;a&gt;</span> tags that misbehaved under the globe canvas), the timeline play interval slowed from 120ms → 1000ms per year so eras are actually readable, and the legend gained a <span className="font-mono">Connections →</span> link to the new page. <strong>Connected Events</strong> (<span className="font-mono">/globe/connections</span>) is a new view: every Claim with PolityClaim links to 2+ countries becomes an undirected edge between those countries; the top 100 pairs by shared-claim count are rendered as animated amber arcs on a dark globe, with arc brightness and stroke width scaled by claim count. New <span className="font-mono">GET /api/globe/connections</span> SQL-aggregates PolityClaim → Polity → countryCode at the database level (CTE with <span className="font-mono">HAVING COUNT(DISTINCT countryCode) &ge; 2</span>) and returns each pair with up to 5 sample claims; a right-side filterable pair list and a left-side detail drawer (sample claims with <span className="font-mono">/claims/[id]</span> links) round out the UX. Centroids live in <span className="font-mono">lib/country-centroids.ts</span> (alpha-3 → lat/lng/name) covering every country present in the polity graph.</li>
            <li><span className="text-gray-400">Citation graph (OpenAlex)</span> — claim detail pages now show a <span className="font-mono">Citation graph</span> panel with three collapsible sections: <strong>Later Work</strong> (papers that cite this one, newest first), <strong>Related Papers</strong> (topically similar via OpenAlex <span className="font-mono">related_works</span>), and <strong>References</strong> (papers this one cites). New <span className="font-mono">ClaimRelation</span> table joins claims with <span className="font-mono">@@unique([fromClaimId, toClaimId, relationType])</span> and indexes on both FK sides. New <span className="font-mono">openAlexId</span> column added to <span className="font-mono">Claim</span> for fast workId lookup. Enrichment script <span className="font-mono">scripts/enrich-openalex-relations.ts</span> walks each OpenAlex-sourced claim, hits <span className="font-mono">api.openalex.org/works/W…</span> for <span className="font-mono">referenced_works</span> + <span className="font-mono">related_works</span> + <span className="font-mono">cited_by_api_url</span> (top 10 citing papers, newest first), and optionally creates lightweight stub claims (<span className="font-mono">ingestedBy: openalex_stub_v1</span>, <span className="font-mono">verificationStatus: PROVISIONAL</span>) so citing-paper links have a destination. 100ms throttle, polite User-Agent, 429/Retry-After honored. New API route <span className="font-mono">GET /api/claims/[id]/relations</span> returns the grouped payload; the panel lazy-loads it and renders nothing when a claim has no relations.</li>
            <li><span className="text-gray-400">Bookmarks (anonymous key)</span> — save claims without an account. A UUID v4 is stored in <span className="font-mono">localStorage</span> as <span className="font-mono">er_profile_key</span> and maps to a new <span className="font-mono">Profile</span> row (just the key, no PII). New <span className="font-mono">Bookmark</span> table joins profiles to claims with a <span className="font-mono">@@unique([profileId, claimId])</span> constraint. New routes: <span className="font-mono">GET/POST/DELETE /api/bookmarks</span> and <span className="font-mono">GET /api/bookmarks/claims</span>. New <span className="font-mono">/bookmarks</span> page lists saved claims, exposes a &ldquo;Copy key&rdquo; button, and accepts a key paste to switch profiles (restore on another device). Bookmark icon (lucide <span className="font-mono">Bookmark</span> / <span className="font-mono">BookmarkCheck</span>) added to the claim detail header. No email, no password, no OAuth.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 30, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">Direct Polity↔Vote + Polity↔Claim linking</span> — populated the two new junction tables (<span className="font-mono">PolityVote</span>, <span className="font-mono">PolityClaim</span>) added in migration <span className="font-mono">20260530190000_add_polity_vote_claim</span>. The new <span className="font-mono">scripts/link-polity-votes-claims.ts</span> derives links from each row&apos;s pipeline / dataSource → alpha-2 → alpha-3 country code (via <span className="font-mono">lib/globe-pipeline-country.ts</span>) intersected with <span className="font-mono">Polity.countryCode</span> and the row&apos;s date falling within <span className="font-mono">[Polity.startYear, Polity.endYear]</span>. Result: <strong>114,367 PolityVote</strong> rows (from 116,267 LegislativeVote rows; 1,900 skipped — primarily <span className="font-mono">howtheyvote_eu</span> multi-country) and <strong>347,884 PolityClaim</strong> rows (from 701,363 Claims with <span className="font-mono">claimEmergedAt</span>). 205 of 2,361 polities had ISO alpha-3 country codes; the rest are historical polities without ISO codes reserved for future curation. Unlocks &ldquo;all claims/votes related to country X&rdquo; browsing and a polity filter dimension for <span className="font-mono">/globe</span>.</li>
            <li><span className="text-gray-400">/analysis/representation launched (CCES)</span> — Cooperative Election Study cumulative 2006–2024 (Harvard Dataverse <span className="font-mono">doi:10.7910/DVN/II2DB6</span>, 702k respondents) aggregated into <strong>24,615</strong> per (state, year, topic) constituent-opinion rows in the new <span className="font-mono">ConstituentOpinion</span> table, joined to 104k <span className="font-mono">MemberVote</span> rows from <span className="font-mono">congress_v1</span> / <span className="font-mono">voteview_v1</span>. The new page surfaces the largest individual representation gaps, top-25 worst states, topic-level gaps with CCES-proxy mapping (ideology, party-ID, uninsured rate for health, union membership for labor), decade trend (2000s → 2020s), and a head-to-head party comparison — does the Dem or Republican delegation diverge further from its in-state ideological base? Pipeline: <span className="font-mono">scripts/_cces_extract.py</span> (pyreadstat → JSON) → <span className="font-mono">scripts/ingest-cces.ts</span> → Postgres. API at <span className="font-mono">/api/analysis/representation</span>.</li>
            <li><span className="text-gray-400">Historical Event Graph (Phase 3)</span> — new <span className="font-mono">/historical-events</span> index and <span className="font-mono">/historical-events/[slug]</span> detail pages wire the 9 curated HistoricalEvent rows (Cuban Missile Crisis, Church Committee, JFK, Vietnam, Cold War, COINTELPRO, WWII, Korea, Bay of Pigs) into the broader graph. Two new junction tables (<span className="font-mono">HistoricalEventVote</span>, <span className="font-mono">HistoricalEventPolity</span>) and a linker script (<span className="font-mono">scripts/link-historical-events.ts</span>) produced <strong>52,034 vote links</strong> and <strong>25 polity links</strong> by matching <span className="font-mono">LegislativeVote.voteDate</span> within each event&apos;s year window against the event&apos;s country set (dataSource → ISO mapping), topic-keyword set, and bill-title keywords. Detail page shows result breakdown, chamber rollup, per-year timeline, party tallies (where <span className="font-mono">byPartyJson</span> exists), 50-per-page vote table with match-reason chips, linked polities, and recent linked claims.</li>
            <li><span className="text-gray-400">Globe Phase 3 — country click → claim list</span> — clicking any country on <span className="font-mono">/globe</span> now shows a paginated sidebar of claims linked to that jurisdiction via the <span className="font-mono">PolityClaim</span> junction table (<strong>347,884 links</strong>). New API route <span className="font-mono">/api/globe/country-claims?country=XX&amp;limit=20&amp;offset=0</span> resolves the ISO alpha-2 code → alpha-3 → <span className="font-mono">Polity.countryCode</span> → <span className="font-mono">PolityClaim</span> → <span className="font-mono">Claim</span>. Sidebar: flag emoji, country name, total count, filter input, claim cards (title, status badge, verification badge, pipeline tag, link to <span className="font-mono">/claims/[id]</span>), and &ldquo;Load more&rdquo; pagination.</li>
            <li><span className="text-gray-400">Globe time slider + historical borders</span> — <span className="font-mono">/globe</span> now has a 1789→2026 year slider with a play button that animates the heatmap (and origins) across history. As the year moves back, the modern Natural Earth borders swap to nearest-snapshot historical borders from <span className="font-mono">aourednik/historical-basemaps</span> (parchment fill, click disabled). Density refetches against <span className="font-mono">/api/globe/density-temporal?before=YYYY</span> and the new <span className="font-mono">/api/globe/origins?yearTo=YYYY</span> filter; both debounce at 200ms. GeoJSON files are lazy-fetched from <span className="font-mono">public/geo/historical/</span> and cached in-memory per session.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 29, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">/books management UI</span> — new <span className="font-mono">/books</span> page lists every ingested book with paragraph / claim / graph-match counts and a per-book <span className="font-mono">Match against DB</span> button that triggers <span className="font-mono">scripts/match-book-to-graph.ts</span> as a detached child process. New API surface: <span className="font-mono">GET /api/books</span>, <span className="font-mono">POST /api/books/[bookId]/match</span> (ALLOW_EDITS-gated), and <span className="font-mono">GET /api/books/[bookId]/match/status</span> which the client polls every 2s during a run. Progress is streamed to the UI via a JSON tempfile (<span className="font-mono">MATCH_PROGRESS_FILE</span>) written by the script after every BookClaim; the status endpoint also reports the authoritative <span className="font-mono">bookClaimMatch</span> count from the DB.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 28, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">LLM match enrichment</span> — added <span className="font-mono">reason</span> field to <span className="font-mono">BookClaimMatch</span>. New script <span className="font-mono">scripts/enrich-match-reasons.ts</span> calls <span className="font-mono">claude --print</span> at concurrency 15 to explain each claim↔receipt link in one sentence; replies of &quot;NULL&quot; indicate no meaningful connection and cause the match row to be deleted. Reader UI now shows the reason text (small muted italic) below each match badge. Similarity floor raised from 0.70 → 0.82 to prevent noisy matches from being created in the first place. Supports <span className="font-mono">--dry-run</span> flag.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 27, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">Aesthetic medicine pipelines (4 buckets)</span> — new ClinicalTrials.gov <span className="font-mono">aesthetic</span> bucket (30 interventions × 9 conditions, COMPLETED filter on both, results-posted filter on conditions); new <span className="font-mono">fda_aesthetic_devices_v1</span> pipeline ingesting FDA 510(k) clearances and PMA approvals (12 device-name searches + a plastic-surgery committee sweep post-filtered to aesthetic keywords, decision_date ≥ 2000); new <span className="font-mono">cosmetic_faers_v1</span> pipeline mirroring Pipeline 8 against openFDA&apos;s cosmetic event endpoint (product-level aggregate AE counts, ≥5-report noise floor); new OpenAlex <span className="font-mono">aesthetic-medicine</span> bucket across 15 dermatology/surgery search terms (subfield-filtered via the correct <span className="font-mono">primary_topic.subfield.id</span> path — spec called for <span className="font-mono">field.display_name</span> but Dermatology/Surgery are subfields under field 27/Medicine, not fields). Dry-runs and typecheck clean; full ingest runs queued as a separate step.</li>
          </ul>
        </div>

        <div className="rounded-md border border-gray-800/60 bg-gray-900/40 px-4 py-3 space-y-1.5">
          <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">May 26, 2026</p>
          <ul className="space-y-1 text-xs text-gray-500">
            <li><span className="text-gray-400">Site-wide perf overhaul</span> — every page that touched the 842k-claim table was timing out on Vercel Hobby. Fixed the topic-page N+1 (per-party + per-leader <span className="font-mono">claimTopic.count</span> loops collapsed into one <span className="font-mono">findMany</span> aggregated in JS), removed <span className="font-mono">force-dynamic</span> from seven cacheable API routes (stats, search, globe/density, density-temporal, origins, analysis/votes, topic detail) so the CDN edge cache works again, capped every previously-unbounded <span className="font-mono">LegislativeVote.findMany</span> in <span className="font-mono">lib/stats-queries.ts</span> + <span className="font-mono">lib/voteAnalysis.ts</span> at 50k rows, and added a <span className="font-mono">pg_trgm</span> GIN index on <span className="font-mono">Claim.text</span> so /search ILIKE queries no longer seq-scan the 842k-row table.</li>
            <li><span className="text-gray-400">Homepage timeout fix</span> — the per-claimType section query was still sorting 100k+ rows in memory after the index filter. Added two covering composites (<span className="font-mono">deleted, parentClaimId, claimType, createdAt</span> and <span className="font-mono">…, verificationStatus</span>) so the planner can satisfy ORDER BY + verification filter from the index alone. CDN cache on the unfiltered homepage extended from 30s/2min to 5min/1hr so most visitors hit the edge, not the function. Loading skeleton replaces the empty page during fetch.</li>
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
      {fetchError && (
        <div className="rounded border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {fetchError}
        </div>
      )}
      {loading && !data ? (
        <div className="space-y-10">
          {ALL_TYPES.map(type => <SkeletonSection key={type} type={type} />)}
        </div>
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
