"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BlackHoleCanvas from "@/app/components/BlackHoleCanvas";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  counts: { claims: number; sources: number };
  claims: ClaimHit[];
  sources: SourceHit[];
  message?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_QUERY = 3;
const RESULT_LIMIT = 8;

const PLACEHOLDER_EXAMPLES = [
  "climate policy",
  "CRISPR",
  "NATO expansion",
  "fentanyl regulations",
  "cognitive dissonance",
  "vaccine trials",
  "Cuban Missile Crisis",
];

// Hand-picked topic chips. Labels are the search term; href points to a topic page
// when one exists, otherwise the chip just runs the inline search.
type TopicChip = { label: string; query: string; href?: string };

const TOPIC_CHIPS: TopicChip[] = [
  { label: "Climate",       query: "climate",      href: "/topics/environment" },
  { label: "Neuroscience",  query: "neuroscience", href: "/neuroscience" },
  { label: "US Congress",   query: "Congress",     href: "/legislation" },
  { label: "Cold War",      query: "Cold War" },
  { label: "Vaccines",      query: "vaccine" },
  { label: "Supreme Court", query: "Supreme Court" },
  { label: "Chemistry",     query: "chemistry",    href: "/chemistry" },
  { label: "Nobel Prize",   query: "Nobel",        href: "/topics/nobel-prizes" },
  { label: "Earthquakes",   query: "earthquake" },
  { label: "Retractions",   query: "retracted" },
];

const STATUS_STYLE: Record<string, string> = {
  HARD_FACT:      "bg-green-900 text-green-300",
  NEVER_RESOLVES: "bg-gray-700 text-gray-400",
  DISPUTED:       "bg-yellow-900 text-yellow-300",
};

const VS_STYLE: Record<string, string> = {
  VERIFIED:    "bg-blue-950 text-blue-400 border border-blue-800/50",
  PROVISIONAL: "bg-gray-800/60 text-gray-500 border border-gray-700/50",
  DISPUTED:    "bg-red-950 text-red-400 border border-red-800/50",
  DEPRECATED:  "bg-gray-900 text-gray-600 border border-gray-800",
};

function truncate(text: string, n = 200): string {
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

// ─── Inline result card ───────────────────────────────────────────────────────

function ClaimResult({ claim }: { claim: ClaimHit }) {
  return (
    <Link
      href={`/claims/${claim.id}`}
      className="block rounded-lg border border-gray-800 bg-gray-900/80 backdrop-blur-sm px-4 py-3 hover:border-gray-600 transition-colors group"
    >
      <p className="text-sm text-gray-200 group-hover:text-white leading-relaxed">
        {truncate(claim.text)}
      </p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
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
        <span className="text-xs px-1.5 py-0.5 rounded font-mono bg-gray-800/60 text-gray-500">
          {claim.ingestedBy}
        </span>
      </div>
    </Link>
  );
}

// ─── Cycling placeholder hook ─────────────────────────────────────────────────

function useCyclingPlaceholder(examples: string[], intervalMs = 2400) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % examples.length), intervalMs);
    return () => clearInterval(id);
  }, [examples.length, intervalMs]);
  return `Try "${examples[idx]}"…`;
}

// ─── Hero / search UI ─────────────────────────────────────────────────────────

function HomeContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const urlQ         = searchParams.get("q") ?? "";

  const [input, setInput] = useState(urlQ);
  const [data, setData]   = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef    = useRef<AbortController | null>(null);

  const placeholder = useCyclingPlaceholder(PLACEHOLDER_EXAMPLES);

  // Run search when input is long enough; debounce 300ms
  useEffect(() => {
    const q = input.trim();
    clearTimeout(debounceRef.current);

    if (q.length < MIN_QUERY) {
      setData(null);
      setLoading(false);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${RESULT_LIMIT}&type=claims`, {
        signal: controller.signal,
      })
        .then(async r => {
          if (!r.ok) throw new Error(`Search failed (${r.status})`);
          return (await r.json()) as SearchResponse;
        })
        .then(d => { setData(d); setLoading(false); })
        .catch(err => {
          if (err.name === "AbortError") return;
          setError(err.message || "Search failed");
          setLoading(false);
        });
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [input]);

  // Keep URL in sync (shallow) so /?q=X is a shareable link
  useEffect(() => {
    const q = input.trim();
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    const qs = next.toString();
    const target = qs ? `/?${qs}` : "/";
    router.replace(target, { scroll: false });
  }, [input, router]);

  const handleChipClick = useCallback((chip: TopicChip) => {
    setInput(chip.query);
  }, []);

  const trimmed = input.trim();
  const showResults = trimmed.length >= MIN_QUERY;
  const hasHits = data && (data.claims.length > 0);

  return (
    <div className="relative">
      <BlackHoleCanvas />

      {/* Hero */}
      <section className="relative pt-12 pb-8 sm:pt-20 sm:pb-12 max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-semibold text-white text-center tracking-tight leading-tight">
          What would you like to learn about?
        </h1>

        <div className="mt-8 sm:mt-10">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="w-full bg-gray-900/80 backdrop-blur-sm border border-gray-700 text-gray-100 text-base sm:text-lg rounded-xl px-5 py-4 placeholder-gray-500 focus:outline-none focus:border-gray-400 focus:bg-gray-900 transition-colors shadow-2xl"
              aria-label="Search Epistemic Receipts"
            />
            {loading && (
              <span
                className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-mono"
                aria-hidden="true"
              >
                searching…
              </span>
            )}
          </div>

          {/* Topic chips */}
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            {TOPIC_CHIPS.map(chip => (
              <button
                key={chip.label}
                onClick={() => handleChipClick(chip)}
                className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-gray-700 bg-gray-900/60 backdrop-blur-sm text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Onboarding copy — implicit philosophy */}
          <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
            <p>Every claim is sourced. Every source is traceable.</p>
            <p>Start with a question.</p>
          </div>
        </div>
      </section>

      {/* Inline search results */}
      <section className="relative max-w-3xl mx-auto pb-16 min-h-[40vh]">
        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        {showResults && !error && data && !loading && hasHits && (
          <div className="space-y-3">
            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
              {data.counts.claims.toLocaleString()} {data.counts.claims === 1 ? "result" : "results"}
            </p>
            {data.claims.map(c => <ClaimResult key={c.id} claim={c} />)}
            {data.counts.claims > data.claims.length && (
              <Link
                href={`/search?q=${encodeURIComponent(trimmed)}`}
                className="block text-center text-sm text-blue-400 hover:text-blue-300 transition-colors pt-2"
              >
                See all {data.counts.claims.toLocaleString()} results for &ldquo;{trimmed}&rdquo; →
              </Link>
            )}
          </div>
        )}

        {showResults && !error && data && !loading && !hasHits && (
          <div className="rounded-lg border border-gray-800 bg-gray-900/60 backdrop-blur-sm px-4 py-6 text-sm text-gray-500 italic text-center">
            No matches for &ldquo;{trimmed}&rdquo;. Try a broader term or one of the topic chips above.
          </div>
        )}

        {!showResults && trimmed.length > 0 && (
          <p className="text-xs text-gray-600 text-center italic">
            Keep typing — at least {MIN_QUERY} characters.
          </p>
        )}
      </section>

      {/* Recent additions (formerly "What's New") */}
      <section className="relative max-w-3xl mx-auto pt-8 pb-16 border-t border-gray-800/60">
        <h2 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-5">
          Recent additions
        </h2>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 7, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Homepage redesigned as a search-first discovery experience. Three new Wikidata SPARQL ingesters: <span className="font-mono">wikidata_nobel_v1</span> (1,023 laureates), <span className="font-mono">wikidata_elements_v1</span> (118 elements), <span className="font-mono">wikidata_space_missions_v1</span> (500 missions). Physiology taxonomy: 18 biological families across cardiovascular, renal, neurological, immune, endocrine, and reproductive systems.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 6, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              What&apos;s New feed at <Link href="/feed" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/feed</Link> shows recent additions and activity on your bookmarks. Globe heatmap now supports category filters. 26 taxonomy pages consolidated at <Link href="/fields" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/fields</Link>.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 5, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              History taxonomy: 24 families, 288 entries from prehistory to 2026. Sociology taxonomy: 22 families, 265 entries with foundational theorists and open questions.
            </p>
          </div>

          <div>
            <p className="text-xs font-mono text-gray-600 uppercase tracking-widest mb-1">June 2, 2026</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              Statistics methods reference at <Link href="/statistics/methods" className="font-mono text-gray-300 hover:text-white underline-offset-2 hover:underline">/statistics/methods</Link> — interactive deep-dives on the 10 most-cited methods. Retracted papers now marked DISPUTED across the app (11,319 claims updated).
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/feed"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            See the full feed →
          </Link>
        </div>
      </section>
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
