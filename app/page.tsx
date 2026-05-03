"use client";
import { useEffect, useState, useRef, useMemo, useCallback, Suspense } from "react";
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
  humanReviewed: boolean;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TYPES    = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"] as const;
const ALL_STATUSES = ["DISPUTED", "HARD_FACT", "NEVER_RESOLVES"] as const;
const PAGE_SIZE    = 10;
const SEARCH_LIMIT = 50;

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

function ClaimMeta({ claim, small }: { claim: ChildClaim; small?: boolean }) {
  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[claim.currentStatus] ?? STATUS_STYLE.DISPUTED}`}>
        {claim.currentStatus}
      </span>
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
        {claim.claimType}
      </span>
      <span className={`text-gray-600 ${small ? "text-[11px]" : "text-xs"}`}>
        {claim._count.edges} {claim._count.edges === 1 ? "source" : "sources"}
      </span>
      {claim.claimEmergedAt && claim.claimEmergedPrecision ? (
        <span className={`text-gray-600 ${small ? "text-[11px]" : "text-xs"}`}>
          {formatAge(claim.claimEmergedAt, claim.claimEmergedPrecision)} · emerged {formatEmerged(claim.claimEmergedAt, claim.claimEmergedPrecision)}
        </span>
      ) : (
        <span className={`text-gray-700 ${small ? "text-[11px]" : "text-xs"}`}>
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
          className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          {ct.topic.name}
        </Link>
      ))}
      {!expanded && overflow > 0 && (
        <button
          className="text-[11px] px-1.5 py-0.5 rounded bg-gray-800/60 text-gray-600 hover:text-gray-400 transition-colors"
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
  return (
    <div>
      <div
        onClick={() => router.push(`/claims/${claim.id}`)}
        className="block rounded-lg border border-gray-800 px-4 py-3 hover:border-gray-600 transition-colors group cursor-pointer"
      >
        <p className="text-sm text-gray-200 group-hover:text-white transition-colors leading-snug line-clamp-2">
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
                    ? "border-blue-800/60 bg-blue-900/20 hover:border-blue-700 hover:bg-blue-900/30"
                    : "border-gray-800/60 bg-gray-900/40 hover:border-gray-700 hover:bg-gray-900/70"
                }`}
              >
                <p className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors leading-snug line-clamp-2">
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
        <span className="text-gray-600 text-[10px]">{open ? "▴" : "▾"}</span>
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
        <span className="text-gray-700 text-[10px] group-hover:text-gray-500 transition-colors mt-px">
          {isCollapsed ? "▸" : "▾"}
        </span>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 group-hover:text-gray-400 transition-colors">
          {label} claims
        </h2>
        <span className="text-gray-700 text-xs font-normal normal-case tracking-normal ml-0.5">
          ({section.total})
        </span>
      </button>

      {!isCollapsed && (
        <>
          {section.total === 0 ? (
            <p className="text-sm text-gray-700 italic">No {label.toLowerCase()} claims match.</p>
          ) : (
            <div className="space-y-3">
              {section.claims.map(c => (
                <ClaimCard key={c.id} claim={c} searchQuery={searchQuery} />
              ))}
            </div>
          )}

          {!isSearch && section.pages > 1 && (
            <div className="flex items-center gap-2 mt-4 text-xs text-gray-600">
              <button
                onClick={() => onPageChange(section.page - 1)}
                disabled={section.page <= 1}
                className="hover:text-gray-400 disabled:opacity-30 transition-colors"
              >
                ← Previous
              </button>
              <span className="text-gray-800">·</span>
              <span>Page {section.page} of {section.pages}</span>
              <span className="text-gray-800">·</span>
              <button
                onClick={() => onPageChange(section.page + 1)}
                disabled={section.page >= section.pages}
                className="hover:text-gray-400 disabled:opacity-30 transition-colors"
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

  // Cached claim list — fetched once on mount, never re-fetched on filter change
  const [allClaims, setAllClaims] = useState<TopClaim[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch("/api/claims/homepage")
      .then(r => r.json())
      .then(d => { setAllClaims(d.claims ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []); // mount only

  // Parse current URL filter state
  const urlQ        = searchParams.get("q") || "";
  const urlTypes    = searchParams.get("types")?.split(",").filter(Boolean) ?? [...ALL_TYPES];
  const urlStatuses = searchParams.get("statuses")?.split(",").filter(Boolean) ?? [...ALL_STATUSES];
  const urlReview   = searchParams.get("review") || "reviewed";
  const urlSource   = searchParams.get("source") || "all";
  const urlSort     = searchParams.get("sort") || "recent";
  const urlTopics   = searchParams.get("topics")?.split(",").filter(Boolean) ?? [];

  // Local search input, debounced into URL (doesn't trigger re-fetch)
  const [searchInput, setSearchInput] = useState(urlQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setSearchInput(urlQ); }, [urlQ]);

  // Per-section collapse (local only, resets when data changes)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // ── Client-side filter + sort + paginate — all derived from cached allClaims ──

  const { sections, isSearch } = useMemo(() => {
    const q      = urlQ.trim().toLowerCase();
    const isSearchActive = q.length > 0;

    // Review
    let filtered = allClaims;
    if (urlReview === "reviewed")   filtered = filtered.filter(c => c.humanReviewed);
    if (urlReview === "unreviewed") filtered = filtered.filter(c => !c.humanReviewed);

    // Type
    if (urlTypes.length < ALL_TYPES.length) {
      filtered = filtered.filter(c => urlTypes.includes(c.claimType));
    }

    // Status
    if (urlStatuses.length < ALL_STATUSES.length) {
      filtered = filtered.filter(c => urlStatuses.includes(c.currentStatus));
    }

    // Ingestion source
    if (urlSource !== "all") {
      filtered = filtered.filter(c => c.ingestedBy === urlSource);
    }

    // Topic filter
    if (urlTopics.length > 0) {
      filtered = filtered.filter(c =>
        c.topics.some(ct => urlTopics.includes(ct.topic.slug))
      );
    }

    // Search — substring match across claim text, child text, source names/URLs, threshold notes
    if (q) {
      filtered = filtered.filter(c =>
        c.text.toLowerCase().includes(q) ||
        c.children.some(ch => ch.text.toLowerCase().includes(q)) ||
        c.edges.some(e =>
          e.source.name.toLowerCase().includes(q) ||
          (e.source.url?.toLowerCase().includes(q) ?? false)
        ) ||
        c.thresholdEvents.some(te => te.note?.toLowerCase().includes(q) ?? false)
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (urlSort) {
        case "oldest_emerged":
          if (!a.claimEmergedAt) return 1;
          if (!b.claimEmergedAt) return -1;
          return a.claimEmergedAt < b.claimEmergedAt ? -1 : 1;
        case "newest_emerged":
          if (!a.claimEmergedAt) return 1;
          if (!b.claimEmergedAt) return -1;
          return a.claimEmergedAt > b.claimEmergedAt ? -1 : 1;
        case "most_sources":
        case "most_edges":
          return b._count.edges - a._count.edges;
        default: // recent
          return b.createdAt > a.createdAt ? -1 : 1;
      }
    });

    // Build per-type sections with pagination
    const result: Record<string, SectionData> = {};
    for (const type of ALL_TYPES) {
      const typeClaims = sorted.filter(c => c.claimType === type);
      const total      = typeClaims.length;
      if (isSearchActive) {
        result[type] = { total, claims: typeClaims.slice(0, SEARCH_LIMIT), page: 1, pages: 1 };
      } else {
        const page  = Math.max(1, parseInt(searchParams.get(`${type.toLowerCase()}_page`) || "1", 10));
        const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const safePg = Math.min(page, pages);
        result[type] = {
          total,
          claims: typeClaims.slice((safePg - 1) * PAGE_SIZE, safePg * PAGE_SIZE),
          page: safePg,
          pages,
        };
      }
    }

    return { sections: result, isSearch: isSearchActive };
  // searchParams as a dep: stable reference when URL unchanged, changes when URL changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClaims, searchParams, urlQ, urlTypes.join(","), urlStatuses.join(","), urlReview, urlSource, urlSort, urlTopics.join(",")]);

  // Distinct ingestion sources for filter dropdown, derived client-side
  const ingestedBySources = useMemo(
    () => [...new Set(allClaims.map(c => c.ingestedBy))].sort(),
    [allClaims]
  );

  // All topics present in the loaded claims, for the filter dropdown
  const allTopicOptions = useMemo(() => {
    const seen = new Map<string, { slug: string; name: string; domain: string }>();
    for (const c of allClaims) {
      for (const ct of c.topics) {
        if (!seen.has(ct.topic.slug)) seen.set(ct.topic.slug, ct.topic);
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [allClaims]);

  // Auto-collapse sections with > 10 results on first data load
  useEffect(() => {
    if (!allClaims.length) return;
    const next: Record<string, boolean> = {};
    for (const type of ALL_TYPES) {
      next[type] = allClaims.filter(c => c.claimType === type).length > 10;
    }
    setCollapsed(next);
  }, [allClaims]);

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
    if (p.get("review") === "reviewed") p.delete("review");
    if (p.get("source") === "all")      p.delete("source");
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
    urlReview !== "reviewed" ||
    urlSource !== "all" ||
    urlTopics.length > 0;

  const totalVisible = ALL_TYPES.reduce((s, t) => s + (sections[t]?.total ?? 0), 0);

  // ── Render ──

  return (
    <div className="space-y-12">
      <BlackHoleCanvas />

      {/* Mission statement — unchanged */}
      <div className="flex flex-col space-y-5 border-b border-gray-800 pb-10">
        <div>
          <h1 className="text-2xl font-semibold text-white">Epistemic Receipts</h1>
          <p className="mt-3 text-gray-300 leading-relaxed">
            A claim-provenance tool for tracking how consensus gets made — and unmade. Not a fact-checker.
            Not a verdict machine. The receipts are the product; auditability is the principle.
          </p>
          <p className="mt-3 text-xs text-gray-700 font-mono tracking-wide">
            invented May 2, 2026
          </p>
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
            value={urlReview}
            options={[
              { value: "reviewed",   label: "Reviewed only" },
              { value: "unreviewed", label: "Unreviewed only" },
              { value: "all",        label: "All" },
            ]}
            onChange={v => updateFilter({ review: v })}
          />

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
        <p className="text-xs text-gray-700 text-center pb-4">
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
