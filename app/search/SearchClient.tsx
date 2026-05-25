"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type ClaimHit = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  ingestedBy: string;
  verificationStatus: string | null;
  createdAt: string;
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
  counts: { claims: number; sources: number };
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

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT: "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED: "bg-yellow-900 text-yellow-300",
};

const VS_STYLE: Record<string, string> = {
  VERIFIED: "bg-blue-950 text-blue-400 border border-blue-800/50",
  PROVISIONAL: "bg-gray-800/60 text-gray-500 border border-gray-700/50",
  DISPUTED: "bg-red-950 text-red-400 border border-red-800/50",
  DEPRECATED: "bg-gray-900 text-gray-600 border border-gray-800",
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

export default function SearchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlQ = searchParams.get("q") ?? "";
  const urlTypeRaw = (searchParams.get("type") ?? "all").toLowerCase();
  const urlType: "claims" | "sources" | "all" =
    urlTypeRaw === "claims" || urlTypeRaw === "sources" ? urlTypeRaw : "all";
  const urlOffset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const [input, setInput] = useState(urlQ);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setInput(urlQ);
  }, [urlQ]);

  const pushUrl = useCallback(
    (overrides: Partial<{ q: string; type: string; offset: number }>) => {
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
      const qs = next.toString();
      router.replace(qs ? `/search?${qs}` : "/search");
    },
    [router, searchParams],
  );

  // Fetch whenever URL changes
  useEffect(() => {
    const q = urlQ.trim();
    if (q.length < MIN_QUERY) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const p = new URLSearchParams();
    p.set("q", q);
    p.set("type", urlType);
    p.set("limit", String(PAGE_SIZE));
    p.set("offset", String(urlOffset));
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
  }, [urlQ, urlType, urlOffset]);

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

  const totalForType = useMemo(() => {
    if (!data) return 0;
    if (urlType === "claims") return data.counts.claims;
    if (urlType === "sources") return data.counts.sources;
    return data.counts.claims + data.counts.sources;
  }, [data, urlType]);

  const pageCount = Math.max(1, Math.ceil(totalForType / PAGE_SIZE));
  const currentPage = Math.floor(urlOffset / PAGE_SIZE) + 1;

  const trimmedQ = input.trim();
  const queryTooShort = trimmedQ.length > 0 && trimmedQ.length < MIN_QUERY;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Search</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Search claims and sources</h1>
        <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">
          Full-text search across every claim and source in the database. Minimum {MIN_QUERY} characters.
        </p>
      </div>

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

          {data && trimmedQ.length >= MIN_QUERY && (
            <span className="text-xs text-gray-500 ml-auto">
              {data.counts.claims.toLocaleString()} {data.counts.claims === 1 ? "claim" : "claims"} ·{" "}
              {data.counts.sources.toLocaleString()} {data.counts.sources === 1 ? "source" : "sources"}
            </span>
          )}
        </div>
      </div>

      {/* States */}
      {trimmedQ.length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-6 text-sm text-gray-500 italic">
          Type a query to begin. Searches Claim.text and Source.name/url with a case-insensitive substring match.
        </div>
      )}

      {queryTooShort && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-6 text-sm text-gray-500 italic">
          Keep typing — at least {MIN_QUERY} characters.
        </div>
      )}

      {loading && trimmedQ.length >= MIN_QUERY && (
        <p className="text-sm text-gray-500">Searching…</p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {data && !loading && !error && trimmedQ.length >= MIN_QUERY && (
        <Results data={data} type={urlType} />
      )}

      {/* Pagination */}
      {data && !loading && !error && totalForType > PAGE_SIZE && (
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
    (!showClaims || data.claims.length === 0) && (!showSources || data.sources.length === 0);

  if (nothing) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-6 text-sm text-gray-500 italic">
        No matches for <span className="text-gray-300">&ldquo;{data.query}&rdquo;</span>.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {showClaims && data.claims.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
            Claims ({data.counts.claims.toLocaleString()})
          </h2>
          <div className="space-y-2">
            {data.claims.map(c => (
              <ClaimResult key={c.id} claim={c} />
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

function ClaimResult({ claim }: { claim: ClaimHit }) {
  return (
    <Link
      href={`/claims/${claim.id}`}
      className="block rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-600 transition-colors group"
    >
      <p className="text-sm text-gray-200 group-hover:text-white leading-relaxed">
        {truncate(claim.text)}
      </p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            STATUS_STYLE[claim.currentStatus] ?? STATUS_STYLE.DISPUTED
          }`}
        >
          {claim.currentStatus}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-800 text-gray-400">
          {claim.claimType}
        </span>
        {claim.verificationStatus && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded font-mono ${
              VS_STYLE[claim.verificationStatus] ?? "bg-gray-800 text-gray-600"
            }`}
          >
            {claim.verificationStatus}
          </span>
        )}
        <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-gray-800/60 text-gray-500">
          {claim.ingestedBy}
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
          <p className="text-sm text-gray-200 group-hover:text-white truncate">{source.name}</p>
          {source.url && (
            <p className="text-xs text-blue-400 mt-0.5 truncate">{source.url}</p>
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
