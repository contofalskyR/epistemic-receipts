"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EpistemicAxisBadge, AXIS_CONFIG } from "@/components/EpistemicAxisBadge";
import { EpistemicLegend } from "@/components/EpistemicLegend";
import { cleanDisplayText } from "@/lib/text";
import SettlingCurveMini from "@/app/components/SettlingCurveMini";

type ClaimHit = {
  id: string;
  text: string;
  currentStatus: string;
  epistemicAxis: string | null;
  claimType: string;
  ingestedBy: string;
  verificationStatus: string | null;
  epistemicStatus: string | null;
  createdAt: string;
  claimEmergedAt: string | null;
  sourceName: string | null;
  topicLabel: string | null;
  transitionCount?: number;
};

type CurveHit = {
  id: string;
  curveId: string;
  text: string;
  transitionCount: number;
  firstYear: number | null;
  lastYear: number | null;
  hasReversal: boolean;
  milestones: { year: number; axis: string }[];
};

type SourceHit = {
  id: string;
  name: string;
  url: string | null;
  methodologyType: string;
  ingestedBy: string;
  firstClaimId: string | null;
};

type SearchResponse = {
  query: string;
  type: "claims" | "sources" | "all";
  limit: number;
  offset: number;
  country: string | null;
  countryName: string | null;
  axis: string | null;
  counts: { claims: number; sources: number };
  curves?: CurveHit[];
  claims: ClaimHit[];
  sources: SourceHit[];
  message?: string;
};

const MIN_QUERY = 3;
const PAGE_SIZE = 25;

const TYPES = [
  { value: "all", label: "All" },
  { value: "claims", label: "Claims" },
  { value: "sources", label: "Sources" },
] as const;

// Left-edge stripe per epistemic axis — the fastest scanning signal on a result card.
// Full literal class strings so Tailwind's scanner picks them up.
const AXIS_STRIPE: Record<string, string> = {
  SETTLED: "border-l-emerald-400/70 hover:border-l-emerald-400/70",
  CONTESTED: "border-l-amber-400/70 hover:border-l-amber-400/70",
  RECORDED: "border-l-slate-400/50 hover:border-l-slate-400/50",
  OPEN: "border-l-blue-400/70 hover:border-l-blue-400/70",
  UNRESOLVABLE: "border-l-violet-400/70 hover:border-l-violet-400/70",
  // Terminal transition outcomes — reach the stored column via the write-time
  // stamp (patch 3); previously only the read-time override surfaced them.
  REVERSED: "border-l-rose-400/70 hover:border-l-rose-400/70",
  ABANDONED: "border-l-gray-500/70 hover:border-l-gray-500/70",
};
const AXIS_STRIPE_FALLBACK = "border-l-gray-700 hover:border-l-gray-700";

// Example queries for the pre-search state — same voice as the homepage chips.
const EXAMPLE_QUERIES = [
  "CRISPR",
  "NATO expansion",
  "room-temperature superconductor",
  "Cuban Missile Crisis",
  "semaglutide",
  "Voting Rights Act",
];

const TYPE_LABEL: Record<string, string> = {
  EMPIRICAL: "Empirical",
  INSTITUTIONAL: "Institutional",
  INTERPRETIVE: "Interpretive",
  HYBRID: "Hybrid",
};

const TYPE_TOOLTIP: Record<string, string> = {
  EMPIRICAL: "A factual claim grounded in observable, measurable evidence",
  INSTITUTIONAL: "A claim about laws, rules, or official decisions by institutions",
  INTERPRETIVE: "A claim that involves inference or expert judgment",
  HYBRID: "Combines empirical data with institutional or interpretive framing",
};

const EPISTEMIC_BADGE: Record<string, { label: string; style: string }> = {
  confirmed:         { label: "Confirmed ✓",      style: "bg-green-900/70 text-green-300 border border-green-700/50" },
  retracted:         { label: "Retracted ✗",      style: "bg-red-900/70 text-red-300 border border-red-700/50" },
  candidate:         { label: "Candidate",         style: "bg-yellow-900/70 text-yellow-300 border border-yellow-700/50" },
  false_positive:    { label: "False Positive",    style: "bg-gray-700/70 text-gray-400 border border-gray-600/50" },
  contested_dissent: { label: "Split Decision",    style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
  registered_trial:  { label: "Registered Trial",  style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
  active_trial:      { label: "Active Trial",      style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
  completed_trial:   { label: "Completed Trial",   style: "bg-cyan-900/70 text-cyan-300 border border-cyan-700/50" },
  approved:          { label: "FDA Approved",      style: "bg-emerald-900/70 text-emerald-300 border border-emerald-700/50" },
  established:       { label: "Established",       style: "bg-teal-900/70 text-teal-300 border border-teal-700/50" },
  settled_judgment:  { label: "Settled Judgment",  style: "bg-indigo-900/70 text-indigo-300 border border-indigo-700/50" },
  contested:         { label: "Contested",         style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
};

const METHODOLOGY_LABELS: Record<string, string> = {
  primary: "Primary",
  derivative: "Derivative",
  opinion: "Opinion",
};

function truncate(text: string, n = 240): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-400/20 text-yellow-200 rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

function MissingState({ query }: { query: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [, startTransition] = useTransition();

  function suggest() {
    setStatus("sending");
    startTransition(() => {
      fetch("/api/search/miss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
        .then(r => setStatus(r.ok ? "sent" : "error"))
        .catch(() => setStatus("error"));
    });
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-6 py-10 text-center space-y-4"
      style={{ animation: "result-in 0.35s ease forwards" }}>
      <div className="text-4xl">🔭</div>
      <div className="space-y-1.5">
        <p className="text-gray-200 font-medium text-lg">
          Nothing found for &ldquo;{query}&rdquo;
        </p>
        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
          This topic isn&apos;t in our database yet. We track what people search for and prioritize additions based on demand — your search just counted.
        </p>
      </div>

      {status === "idle" && (
        <button
          onClick={suggest}
          className="inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          Suggest &ldquo;{query}&rdquo; as a topic
        </button>
      )}
      {status === "sending" && (
        <p className="text-xs text-gray-500 font-mono">Sending…</p>
      )}
      {status === "sent" && (
        <p className="text-sm text-green-400">
          Noted — we&apos;ll look into adding &ldquo;{query}&rdquo;.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-400">Couldn&apos;t send. Try a different query or come back later.</p>
      )}

      <p className="text-xs text-gray-600 pt-2">
        Try a broader term, or browse <Link href="/fields" className="text-gray-500 hover:text-gray-300 underline-offset-2 hover:underline">Fields</Link> to explore what&apos;s already here.
      </p>
    </div>
  );
}

function SearchLegend() {
  return (
    <div style={{ animation: "result-in 0.3s ease forwards" }}>
      <EpistemicLegend label="Status edge:" className="px-1" />
    </div>
  );
}

export default function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q") ?? "";
  const urlTypeRaw = (searchParams.get("type") ?? "all").toLowerCase();
  const urlType: "claims" | "sources" | "all" =
    urlTypeRaw === "claims" || urlTypeRaw === "sources" ? urlTypeRaw : "all";
  const urlOffset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const urlCountry = (searchParams.get("country") ?? "").trim().toUpperCase();
  const VALID_AXES = ["SETTLED", "CONTESTED", "RECORDED", "OPEN", "UNRESOLVABLE", "REVERSED", "ABANDONED"] as const;
  const urlAxisRaw = (searchParams.get("axis") ?? "").trim().toUpperCase();
  const urlAxis = (VALID_AXES as readonly string[]).includes(urlAxisRaw) ? urlAxisRaw : "";

  const [input, setInput] = useState(urlQ);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  const pushUrl = useCallback(
    (overrides: Partial<{ q: string; type: string; offset: number; country: string; axis: string }>) => {
      const next = new URLSearchParams(searchParams.toString());
      if (overrides.q !== undefined) {
        if (overrides.q) next.set("q", overrides.q);
        else next.delete("q");
      }
      if (overrides.type !== undefined) {
        if (overrides.type === "all") next.delete("type");
        else next.set("type", overrides.type);
      }
      if (overrides.offset !== undefined) {
        if (overrides.offset > 0) next.set("offset", String(overrides.offset));
        else next.delete("offset");
      }
      if (overrides.country !== undefined) {
        if (overrides.country) next.set("country", overrides.country);
        else next.delete("country");
      }
      if (overrides.axis !== undefined) {
        if (overrides.axis) next.set("axis", overrides.axis);
        else next.delete("axis");
      }
      const qs = next.toString();
      router.replace(qs ? `/search?${qs}` : "/search");
    },
    [router, searchParams],
  );

  // Fetch whenever URL changes
  useEffect(() => {
    const q = urlQ.trim();
    // A country filter alone is enough to fetch even with empty q.
    if (q.length < MIN_QUERY && !urlCountry && !urlAxis) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("type", urlType);
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(urlOffset));
    if (urlCountry) p.set("country", urlCountry);
    if (urlAxis) p.set("axis", urlAxis);
    fetch(`/api/search?${p.toString()}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Search failed (${r.status})`);
        return (await r.json()) as SearchResponse;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setError(err.message || "Search failed");
        setLoading(false);
      });
    return () => controller.abort();
  }, [urlQ, urlType, urlOffset, urlCountry, urlAxis]);

  function onInputChange(v: string) {
    setInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushUrl({ q: v.trim(), offset: 0 });
    }, 250);
  }

  function onTypeChange(t: string) {
    pushUrl({ type: t, offset: 0 });
  }

  // Claims and sources paginate independently against the same offset, so the
  // page count for "all" is the larger of the two — not their sum.
  const pageCount = useMemo(() => {
    if (!data) return 1;
    const claimPages = Math.ceil(data.counts.claims / PAGE_SIZE);
    const sourcePages = Math.ceil(data.counts.sources / PAGE_SIZE);
    if (urlType === "claims") return Math.max(1, claimPages);
    if (urlType === "sources") return Math.max(1, sourcePages);
    return Math.max(1, claimPages, sourcePages);
  }, [data, urlType]);

  const currentPage = Math.floor(urlOffset / PAGE_SIZE) + 1;

  const trimmedQ = input.trim();
  const queryTooShort = trimmedQ.length > 0 && trimmedQ.length < MIN_QUERY;
  const hasCountry = urlCountry.length > 0;
  const hasAxisFilter = urlAxis.length > 0;
  const countryLabel = data?.countryName ?? (hasCountry ? urlCountry : null);
  const showResults = trimmedQ.length >= MIN_QUERY || hasCountry || hasAxisFilter;

  function clearCountry() {
    pushUrl({ country: "", offset: 0 });
  }

  function runExample(q: string) {
    clearTimeout(debounceRef.current);
    setInput(q);
    pushUrl({ q, offset: 0 });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Search</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Pull the receipt on any claim</h1>
        <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">
          1.6M+ sourced claims — settled, contested, or overturned. Every result traces back to
          who said it, when, and whether it&apos;s still standing.
        </p>
      </div>

      {hasCountry && countryLabel && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm">
          <span className="text-amber-200">
            Showing claims from{" "}
            <span className="font-semibold text-amber-100">{countryLabel}</span>
            {data && (
              <span className="ml-2 text-amber-400/80">
                · {data.counts.claims.toLocaleString()}{" "}
                {data.counts.claims === 1 ? "claim" : "claims"}
              </span>
            )}
          </span>
          <button
            onClick={clearCountry}
            className="text-xs text-amber-300 hover:text-amber-100 transition-colors"
          >
            Clear country filter ×
          </button>
        </div>
      )}

      <div className="space-y-3">
        <input
          type="text"
          value={input}
          onChange={e => onInputChange(e.target.value)}
          placeholder="Search claims and sources…"
          autoFocus
          className="w-full bg-gray-900 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
        />

        <div className="flex items-center gap-2 flex-wrap">
          {TYPES.map(t => {
            const active = urlType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => onTypeChange(t.value)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? "bg-white text-gray-950 border-white font-medium"
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
              >
                {t.label}
              </button>
            );
          })}

          <span className="text-gray-700 text-xs">|</span>

          {(["SETTLED", "CONTESTED", "RECORDED", "OPEN"] as const).map(ax => {
            const cfg = AXIS_CONFIG[ax]!;
            const active = urlAxis === ax;
            return (
              <button
                key={ax}
                onClick={() => pushUrl({ axis: active ? "" : ax, offset: 0 })}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? `${cfg.style} border-transparent font-medium`
                    : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500"
                }`}
                title={cfg.tooltip}
              >
                {cfg.label}
              </button>
            );
          })}

          {data && showResults && (
            <span className="text-xs text-gray-500 ml-auto">
              {data.counts.claims.toLocaleString()} {data.counts.claims === 1 ? "claim" : "claims"} ·{" "}
              {data.counts.sources.toLocaleString()} {data.counts.sources === 1 ? "source" : "sources"}
            </span>
          )}
        </div>
      </div>

      {/* States */}
      {trimmedQ.length === 0 && !hasCountry && !hasAxisFilter && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-5 py-6 space-y-3">
          <p className="text-sm text-gray-400">
            Start with a question — a law, a paper, a ruling, a number. Try:
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => runExample(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            Or browse by discipline in{" "}
            <Link href="/fields" className="text-gray-500 hover:text-gray-300 underline-offset-2 hover:underline">
              Fields
            </Link>
            .
          </p>
        </div>
      )}

      {queryTooShort && !hasCountry && !hasAxisFilter && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-5 py-6 text-sm text-gray-500 italic">
          Keep typing — at least {MIN_QUERY} characters.
        </div>
      )}

      {loading && showResults && (
        <p className="text-sm text-gray-500">Searching…</p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {data && !loading && !error && showResults && (
        <Results data={data} type={urlType} />
      )}

      {/* Pagination */}
      {data && !loading && !error && pageCount > 1 && (
        <div className="flex items-center gap-3 text-xs text-gray-500 pt-2">
          <button
            onClick={() => pushUrl({ offset: Math.max(0, urlOffset - PAGE_SIZE) })}
            disabled={urlOffset === 0}
            className="hover:text-gray-300 disabled:opacity-30 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-gray-700">·</span>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <span className="text-gray-700">·</span>
          <button
            onClick={() => pushUrl({ offset: urlOffset + PAGE_SIZE })}
            disabled={currentPage >= pageCount}
            className="hover:text-gray-300 disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function Results({ data, type }: { data: SearchResponse; type: "claims" | "sources" | "all" }) {
  const showClaims = type === "all" || type === "claims";
  const showSources = type === "all" || type === "sources";
  const nothing =
    (!showClaims || (data.claims.length === 0 && (data.curves ?? []).length === 0)) &&
    (!showSources || data.sources.length === 0);

  if (nothing) {
    return <MissingState query={data.query} />;
  }

  const curves = data.curves ?? [];

  return (
    <div className="space-y-8">
      {/* Settling curves — the chef's kiss: queries that match a multi-step
          claim surface its curve first, sparkline and all. */}
      {showClaims && curves.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Settling curves ({curves.length})
          </h2>
          <p className="text-xs text-gray-600">
            These results have a traced trajectory — how the claim settled, unsettled, or reversed.
          </p>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pt-1">
            {curves.map((cv) => (
              <Link
                key={cv.id}
                href={`/settling-curve?t=${encodeURIComponent(cv.curveId)}`}
                className="block rounded-lg p-4 bg-gray-900/80 border border-gray-800 hover:border-amber-400/50 transition-colors group"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-[10px] text-gray-500">
                    {cv.firstYear ?? ""}
                    {cv.lastYear != null && cv.lastYear !== cv.firstYear ? ` → ${cv.lastYear}` : ""}
                  </span>
                  {cv.hasReversal && (
                    <span className="font-mono text-[10px] text-rose-400">↩ reversed</span>
                  )}
                </div>
                <p className="text-[13px] text-gray-200 leading-snug mb-3" style={{ minHeight: 36 }}>
                  {cleanDisplayText(cv.text.length > 120 ? cv.text.slice(0, 117) + "…" : cv.text)}
                </p>
                <SettlingCurveMini
                  milestones={cv.milestones}
                  ariaLabel={`Settling curve: ${cv.text}`}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] text-gray-500">
                    {cv.transitionCount} transitions
                  </span>
                  <span className="font-mono text-[11px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    trace it →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {showClaims && data.claims.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Claims ({data.counts.claims.toLocaleString()})
          </h2>
          <SearchLegend />
          <div className="space-y-2">
            {data.claims.map((c, i) => (
              <ClaimResult key={c.id} claim={c} query={data.query} index={i} />
            ))}
          </div>
        </section>
      )}

      {showSources && data.sources.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Sources ({data.counts.sources.toLocaleString()})
          </h2>
          <div className="space-y-2">
            {data.sources.map(s => (
              <SourceResult key={s.id} source={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ClaimResult({ claim, query, index }: { claim: ClaimHit; query: string; index: number }) {
  const router = useRouter();
  const year = claim.claimEmergedAt
    ? new Date(claim.claimEmergedAt).getFullYear()
    : claim.createdAt
    ? new Date(claim.createdAt).getFullYear()
    : null;

  const stripe = (claim.epistemicAxis && AXIS_STRIPE[claim.epistemicAxis]) || AXIS_STRIPE_FALLBACK;
  const hasCurve = (claim.transitionCount ?? 0) >= 2;

  return (
    <Link
      href={`/claims/${claim.id}`}
      className={`block rounded-lg border border-gray-800 border-l-2 ${stripe} bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group opacity-0`}
      style={{
        animation: "result-in 0.35s ease forwards",
        animationDelay: `${Math.min(index, 8) * 40}ms`,
      }}
    >
      <p className="text-sm text-gray-200 group-hover:text-white leading-relaxed">
        {/* cleanDisplayText: OpenAlex abstracts carry literal <i>/<sup> tags */}
        <Highlighted text={truncate(cleanDisplayText(claim.text))} query={query} />
      </p>

      {/* Source + year */}
      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
        {claim.sourceName && (
          <span className="truncate flex-1">
            <span className="text-gray-600">From:</span> {cleanDisplayText(claim.sourceName)}
          </span>
        )}
        {year && <span className="shrink-0 font-mono text-gray-600">{year}</span>}
      </div>

      {/* Badges + trail */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <EpistemicAxisBadge axis={claim.epistemicAxis} />
          {claim.topicLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-950 text-indigo-300">
              {claim.topicLabel}
            </span>
          )}
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400"
            title={TYPE_TOOLTIP[claim.claimType] ?? ""}
          >
            {TYPE_LABEL[claim.claimType] ?? claim.claimType}
          </span>
          {claim.epistemicStatus && EPISTEMIC_BADGE[claim.epistemicStatus] && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EPISTEMIC_BADGE[claim.epistemicStatus]!.style}`}>
              {EPISTEMIC_BADGE[claim.epistemicStatus]!.label}
            </span>
          )}
        </div>
        <span className="flex items-center gap-3 shrink-0 ml-2">
          {hasCurve && (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/settling-curve?t=${encodeURIComponent(claim.id)}`);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push(`/settling-curve?t=${encodeURIComponent(claim.id)}`);
                }
              }}
              className="text-xs text-amber-500/70 hover:text-amber-300 transition-colors cursor-pointer"
              title={`${claim.transitionCount} transitions — open the settling curve`}
            >
              ↝ Settling curve
            </span>
          )}
          <span className="text-xs text-gray-700 group-hover:text-gray-500 transition-colors">
            Evidence trail →
          </span>
        </span>
      </div>
    </Link>
  );
}

function SourceResult({ source }: { source: SourceHit }) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-gray-200 group-hover:text-white truncate">{cleanDisplayText(source.name)}</p>
          {source.url && (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <a href={source.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 hover:underline truncate"
                onClick={e => e.stopPropagation()}>
                {source.url}
              </a>
              {source.url.startsWith('https://doi.org/') ? (
                <>
                  <a href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(source.url.replace('https://doi.org/', ''))}`}
                    target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="text-xs px-1 py-0.5 rounded bg-blue-900/40 text-blue-400 hover:text-blue-300 whitespace-nowrap">PubMed ↗</a>
                  <a href={`https://www.semanticscholar.org/search?q=${encodeURIComponent(source.url.replace('https://doi.org/', ''))}&sort=Relevance`}
                    target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="text-xs px-1 py-0.5 rounded bg-purple-900/40 text-purple-400 hover:text-purple-300 whitespace-nowrap">S2 ↗</a>
                </>
              ) : (
                <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(source.name)}`}
                  target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  className="text-xs px-1 py-0.5 rounded bg-gray-800 text-gray-400 hover:text-gray-300 whitespace-nowrap">Scholar ↗</a>
              )}
            </div>
          )}
        </div>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
          {METHODOLOGY_LABELS[source.methodologyType] ?? source.methodologyType}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-gray-800/60 text-gray-500">
          {source.ingestedBy}
        </span>
        {source.firstClaimId ? (
          <span className="text-xs text-gray-500">→ linked claim</span>
        ) : (
          <span className="text-xs text-gray-600 italic">no linked claims</span>
        )}
      </div>
    </>
  );

  if (source.firstClaimId) {
    return (
      <Link
        href={`/claims/${source.firstClaimId}`}
        className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 group">{inner}</div>
  );
}
