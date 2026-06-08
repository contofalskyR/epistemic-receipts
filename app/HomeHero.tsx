"use client";
import { useEffect, useState, useRef, useCallback, Suspense, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BlackHoleCanvas from "@/app/components/BlackHoleCanvas";
import { EpistemicAxisBadge } from "@/components/EpistemicAxisBadge";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Terminal Spinner ─────────────────────────────────────────────────────────

const SPINNER_FRAMES = ["|", "/", "-", "\\", "|", "/", "-", "\\"];

function TerminalSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 font-mono text-xs text-gray-500 select-none"
      aria-hidden="true"
    >
      <span className="text-green-500/80 text-sm w-3 inline-block text-center">
        {SPINNER_FRAMES[frame]}
      </span>
      searching…
    </span>
  );
}

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

const TYPE_LABEL: Record<string, string> = {
  EMPIRICAL:      "Empirical",
  INSTITUTIONAL:  "Institutional",
  INTERPRETIVE:   "Interpretive",
  HYBRID:         "Hybrid",
};

const TYPE_TOOLTIP: Record<string, string> = {
  EMPIRICAL:     "A factual claim grounded in observable, measurable evidence",
  INSTITUTIONAL: "A claim about laws, rules, or official decisions by institutions",
  INTERPRETIVE:  "A claim that involves inference or expert judgment",
  HYBRID:        "Combines empirical data with institutional or interpretive framing",
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

function truncate(text: string, n = 200): string {
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

function ClaimResult({ claim, query, index }: { claim: ClaimHit; query: string; index: number }) {
  const displayText = truncate(claim.text);
  const year = claim.claimEmergedAt
    ? new Date(claim.claimEmergedAt).getFullYear()
    : claim.createdAt
    ? new Date(claim.createdAt).getFullYear()
    : null;

  return (
    <Link
      href={`/claims/${claim.id}`}
      className="block rounded-lg border border-gray-800 bg-gray-900/80 backdrop-blur-sm px-4 py-3 hover:border-gray-600 transition-colors group opacity-0"
      style={{
        animation: "result-in 0.35s ease forwards",
        animationDelay: `${index * 70}ms`,
      }}
    >
      <p className="text-sm text-gray-200 group-hover:text-white leading-relaxed">
        <Highlighted text={displayText} query={query} />
      </p>

      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
        {claim.sourceName && (
          <span className="truncate flex-1">
            <span className="text-gray-600">From:</span> {claim.sourceName}
          </span>
        )}
        {year && (
          <span className="shrink-0 font-mono text-gray-600">{year}</span>
        )}
      </div>

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
        <span className="text-xs text-gray-700 group-hover:text-gray-500 transition-colors shrink-0 ml-2">
          Evidence trail →
        </span>
      </div>
    </Link>
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
    <div
      className="rounded-xl border border-gray-800 bg-gray-900/60 backdrop-blur-sm px-6 py-8 text-center space-y-4"
      style={{ animation: "result-in 0.35s ease forwards" }}
    >
      <div className="text-3xl">🔭</div>
      <div className="space-y-1">
        <p className="text-gray-200 font-medium">
          Nothing found for &ldquo;{query}&rdquo;
        </p>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          This topic isn&apos;t in our database yet. Try a broader term, or let us know — we track what&apos;s missing and prioritize additions based on demand.
        </p>
      </div>

      {status === "idle" && (
        <button
          onClick={suggest}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500 hover:text-white transition-colors"
        >
          Suggest this topic
        </button>
      )}
      {status === "sending" && (
        <p className="text-xs text-gray-500 font-mono">Sending…</p>
      )}
      {status === "sent" && (
        <p className="text-sm text-green-400">
          Got it — we&apos;ll look into adding &ldquo;{query}&rdquo;.
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-red-400">Couldn&apos;t send. Try again later.</p>
      )}

      <p className="text-xs text-gray-600 pt-1">
        Or try one of the topic chips above to explore what we do have.
      </p>
    </div>
  );
}

function ResultsLegend() {
  return (
    <div className="rounded-lg border border-gray-800/60 bg-gray-900/40 backdrop-blur-sm px-4 py-3 text-xs text-gray-500 space-y-1.5"
      style={{ animation: "result-in 0.3s ease forwards" }}>
      <p className="text-gray-400 font-medium">What you&apos;re looking at</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        <span><span className="text-green-400">Hard Fact</span> — verified across independent sources</span>
        <span><span className="text-yellow-400">Disputed</span> — contested or conflicting evidence</span>
        <span><span className="text-indigo-400">Topic badge</span> — the field this claim belongs to</span>
        <span><span className="text-gray-300">Evidence trail →</span> — click to see timeline &amp; sources</span>
      </div>
    </div>
  );
}

function useCyclingPlaceholder(examples: string[], intervalMs = 2400) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % examples.length), intervalMs);
    return () => clearInterval(id);
  }, [examples.length, intervalMs]);
  return `Try "${examples[idx]}"…`;
}

function HomeHeroContent({ children }: { children?: React.ReactNode }) {
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
            {loading && <TerminalSpinner />}
          </div>

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

          <div className="mt-6 text-center text-sm text-gray-500 space-y-1">
            <p>Every claim is sourced. Every source is traceable.</p>
            <p>Start with a question.</p>
          </div>
        </div>
      </section>

      {/* Below-fold: solid background covers the fixed canvas */}
      <div className="relative bg-gray-950">

        {/* Inline search results — only reserve vertical space when a search is active */}
        <section className={`relative max-w-3xl mx-auto ${showResults ? "pb-16 min-h-[40vh]" : ""}`}>
          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {showResults && !error && data && !loading && hasHits && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                  {data.counts.claims.toLocaleString()} {data.counts.claims === 1 ? "result" : "results"} for &ldquo;{trimmed}&rdquo;
                </p>
              </div>
              <ResultsLegend />
              {data.claims.map((c, i) => <ClaimResult key={c.id} claim={c} query={trimmed} index={i} />)}
              {data.counts.claims > data.claims.length && (
                <Link
                  href={`/search?q=${encodeURIComponent(trimmed)}`}
                  className="block text-center text-sm text-blue-400 hover:text-blue-300 transition-colors pt-2"
                >
                  See all {data.counts.claims.toLocaleString()} results →
                </Link>
              )}
            </div>
          )}

          {showResults && !error && data && !loading && !hasHits && (
            <MissingState query={trimmed} />
          )}

          {!showResults && trimmed.length > 0 && (
            <p className="text-xs text-gray-600 text-center italic">
              Keep typing — at least {MIN_QUERY} characters.
            </p>
          )}
        </section>

        {/* Server-rendered sections below the hero */}
        {children}
      </div>
    </div>
  );
}

export default function HomeHero({ children }: { children?: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <HomeHeroContent>{children}</HomeHeroContent>
    </Suspense>
  );
}
